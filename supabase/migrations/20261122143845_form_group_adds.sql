-- "Added to group": on a form that hands out a WhatsApp invite, admins tick off each registrant once
-- they are in the group. It replaces Approve/Reject there, which only ever meant "added".
-- Recruitment forms and forms that add the student to a community keep the real review, since
-- approval drives their outcome (the community tag).
--
-- One mark per form + email, whichever way the person signed up (Lounge response or PAN BS event
-- page), so a guest who later registers in the Lounge keeps it. A mark is permanent: only the admin
-- who made it can undo it, and only right away (the admin UI offers Undo for 10 seconds).

create table public.form_group_adds (
  form_id uuid not null references public.lounge_forms(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email <> ''),
  added_by uuid references public.members(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (form_id, email)
);
alter table public.form_group_adds enable row level security;
revoke all on public.form_group_adds from public, anon, authenticated;

-- Students who want their joined groups back on the Lounge (a profile switch). Readable through
-- the existing table-level select on members; written only by set_joined_groups_shown.
alter table public.members add column joined_groups_shown boolean not null default false;

create function private.tracks_group_adds(p_form_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.lounge_forms f
      join private.lounge_form_invites i on i.form_id = f.id
     where f.id = p_form_id
       and f.form_kind <> 'recruitment'
       and not f.joins_community
       and coalesce(btrim(i.invite_url), '') <> ''
  );
$$;

-- Whether the signed-in member is marked added on this form, by their account email or the email
-- their response was sent with.
create function private.added_to_group(p_form_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.form_group_adds a
     where a.form_id = p_form_id
       and a.email in (
         select lower(btrim(m.email)) from public.members m where m.id = auth.uid()
         union
         select lower(btrim(r.submitted_email)) from public.form_responses r
          where r.form_id = p_form_id and r.member_id = auth.uid()
       )
  );
$$;

create function public.list_form_adds(p_form_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.manages_form(p_form_id) is not true then
    raise exception 'This form is outside your organizer scope' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'tracks', private.tracks_group_adds(p_form_id),
    'adds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'email', a.email, 'added_at', a.added_at, 'added_by', a.added_by,
        'added_by_name', coalesce(nullif(m.preferred_name, ''), m.full_name)
      ) order by a.added_at)
      from public.form_group_adds a
      left join public.members m on m.id = a.added_by
      where a.form_id = p_form_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Idempotent: marking someone already added returns the existing mark (and who made it).
create function public.mark_form_added(p_form_id uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_row public.form_group_adds;
  v_created boolean := false;
begin
  if private.manages_form(p_form_id) is not true then
    raise exception 'This form is outside your organizer scope' using errcode = '42501';
  end if;
  if not private.tracks_group_adds(p_form_id) then
    raise exception 'This form does not track WhatsApp group adds' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.form_responses r
     where r.form_id = p_form_id and lower(btrim(r.submitted_email)) = v_email
    union all
    select 1 from public.form_guest_responses g
     where g.form_id = p_form_id and lower(btrim(g.email)) = v_email
  ) then
    raise exception 'Nobody registered on this form with that email' using errcode = '22023';
  end if;

  insert into public.form_group_adds (form_id, email, added_by)
  values (p_form_id, v_email, auth.uid())
  on conflict (form_id, email) do nothing
  returning * into v_row;

  if found then
    v_created := true;
    perform private.write_audit('form.added', 'lounge_forms', p_form_id::text, null,
      jsonb_build_object('email', v_email));
  else
    select * into v_row from public.form_group_adds where form_id = p_form_id and email = v_email;
  end if;

  return jsonb_build_object(
    'email', v_row.email, 'added_at', v_row.added_at, 'added_by', v_row.added_by,
    'added_by_name', (select coalesce(nullif(m.preferred_name, ''), m.full_name)
                        from public.members m where m.id = v_row.added_by),
    'created', v_created
  );
end;
$$;

-- Undo is for a mis-click: the same admin, within 15 seconds (the UI offers 10; the rest is slack
-- for the round trip). After that the mark stays.
create function public.undo_form_added(p_form_id uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_row public.form_group_adds;
begin
  if private.manages_form(p_form_id) is not true then
    raise exception 'This form is outside your organizer scope' using errcode = '42501';
  end if;
  delete from public.form_group_adds
   where form_id = p_form_id and email = v_email
     and added_by = auth.uid() and added_at > now() - interval '15 seconds'
  returning * into v_row;
  if not found then
    raise exception 'Too late to undo: the mark is saved' using errcode = 'PT409';
  end if;
  perform private.write_audit('form.added_undo', 'lounge_forms', p_form_id::text,
    jsonb_build_object('email', v_email), null);
  return true;
end;
$$;

create function public.set_joined_groups_shown(p_shown boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old boolean;
begin
  if not private.is_active_member() then
    raise exception 'Account is not active' using errcode = '42501';
  end if;
  if p_shown is null then
    raise exception 'Choose shown or hidden' using errcode = '22023';
  end if;
  select joined_groups_shown into v_old from public.members where id = auth.uid() for update;
  if v_old is distinct from p_shown then
    update public.members set joined_groups_shown = p_shown where id = auth.uid();
    perform private.write_audit(
      'member.joined_groups_shown', 'members', auth.uid()::text,
      jsonb_build_object('joined_groups_shown', v_old),
      jsonb_build_object('joined_groups_shown', p_shown)
    );
  end if;
  return p_shown;
end;
$$;

revoke all on function private.tracks_group_adds(uuid) from public, anon, authenticated;
revoke all on function private.added_to_group(uuid) from public, anon, authenticated;
revoke all on function public.list_form_adds(uuid) from public, anon;
revoke all on function public.mark_form_added(uuid, text) from public, anon;
revoke all on function public.undo_form_added(uuid, text) from public, anon;
revoke all on function public.set_joined_groups_shown(boolean) from public, anon;
grant execute on function public.list_form_adds(uuid) to authenticated;
grant execute on function public.mark_form_added(uuid, text) to authenticated;
grant execute on function public.undo_form_added(uuid, text) to authenticated;
grant execute on function public.set_joined_groups_shown(boolean) to authenticated;

-- On these forms an approval has only ever meant "added to the WhatsApp group".
insert into public.form_group_adds (form_id, email, added_by, added_at)
select r.form_id, lower(btrim(r.submitted_email)), r.reviewed_by, coalesce(r.reviewed_at, now())
  from public.form_responses r
 where r.review_status = 'approved'
   and coalesce(btrim(r.submitted_email), '') <> ''
   and private.tracks_group_adds(r.form_id)
on conflict (form_id, email) do nothing;

-- The Lounge needs to know, per form, whether it is tracked and whether the student is in.
create or replace function pg_temp.patch_once(p_body text, p_anchor text, p_new text) returns text
language plpgsql as $$
begin
 if (length(p_body) - length(replace(p_body, p_anchor, ''))) / length(p_anchor) <> 1 then
  raise exception 'anchor not found exactly once, update this migration: %', left(p_anchor, 80);
 end if;
 return replace(p_body, p_anchor, p_new);
end; $$;

do $patch$
declare b text := pg_get_functiondef('public.list_lounge_forms()'::regprocedure);
begin
 b := pg_temp.patch_once(b, $a$'review_status',(select r.review_status$a$,
  $a$'tracks_adds',private.tracks_group_adds(f.id),'added',private.added_to_group(f.id),'review_status',(select r.review_status$a$);
 execute b;
end $patch$;

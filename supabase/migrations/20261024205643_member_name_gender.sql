-- Students fill in their own full name and gender, once (owner, 2026-10-25).
-- * Students who signed in after the roster clean-up have no full name. They may now set it, and
--   gender, themselves while it is empty; after that an admin corrects it (member_profile_update).
-- * The direct column grant that let a student rewrite full_name and gender at any time goes:
--   public.complete_my_profile is the only student path, and it audits as member.self_profile.
-- * Gender is a choice of Female or Male everywhere it is stored; the admin forms are dropdowns.

revoke update (full_name, gender) on table public.members from authenticated;

alter table public.members
  add constraint members_gender_choice check (gender is null or gender in ('Female', 'Male'));
alter table public.member_roster
  add constraint member_roster_gender_choice check (gender is null or gender in ('Female', 'Male'));

-- Either argument may be null (leave it). A field that is already set cannot be changed here;
-- sending the same value again is harmless.
create function public.complete_my_profile(p_full_name text, p_gender text)
returns public.members
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r        public.members;
  v_name   text := nullif(regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g'), '');
  v_gender text := nullif(btrim(coalesce(p_gender, '')), '');
  v_old    jsonb := '{}'::jsonb;
  v_new    jsonb := '{}'::jsonb;
begin
  if not private.is_active_member() then
    raise exception 'Account is not active' using errcode = '42501';
  end if;
  if v_name is null and v_gender is null then
    raise exception 'Add your full name or gender' using errcode = '22023';
  end if;
  if length(v_name) < 2 or length(v_name) > 200 then
    raise exception 'Full name must be 2 to 200 characters' using errcode = '22023';
  end if;
  if v_gender not in ('Female', 'Male') then
    raise exception 'Choose Female or Male' using errcode = '22023';
  end if;

  select * into r from public.members where id = (select auth.uid()) for update;
  if v_name is not null and r.full_name is not null and r.full_name <> v_name then
    raise exception 'Your full name is already set. Ask your Regional Coordinator to correct it.' using errcode = 'PT409';
  end if;
  if v_gender is not null and r.gender is not null and r.gender <> v_gender then
    raise exception 'Your gender is already set. Ask your Regional Coordinator to correct it.' using errcode = 'PT409';
  end if;

  if v_name is not null and r.full_name is null then
    v_old := v_old || jsonb_build_object('full_name', null);
    v_new := v_new || jsonb_build_object('full_name', v_name);
  end if;
  if v_gender is not null and r.gender is null then
    v_old := v_old || jsonb_build_object('gender', null);
    v_new := v_new || jsonb_build_object('gender', v_gender);
  end if;
  if v_new = '{}'::jsonb then
    return r;
  end if;

  update public.members
     set full_name = coalesce(full_name, v_name),
         gender    = coalesce(gender, v_gender)
   where id = r.id
  returning * into r;

  perform private.write_audit('member.self_profile', 'members', r.id::text, v_old, v_new);
  return r;
end;
$$;

comment on function public.complete_my_profile(text, text) is
  'A student sets their own full name and/or gender while empty. Audited as member.self_profile.';

revoke execute on function public.complete_my_profile(text, text) from public, anon, service_role;
grant execute on function public.complete_my_profile(text, text) to authenticated;

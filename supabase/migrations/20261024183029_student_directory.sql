-- Super Admin student directory (owner, 2026-10-24).
-- * private.student_directory keeps the name, phone, term, region and gender of every student in
--   the house upload of 2026-10-23, signed in or not. It sits in the private schema with no table
--   grants, so the only way in is public.search_student_directory, which only Super Admins may call.
-- * The roster then keeps just email and region for students who have not signed in; their name,
--   phone and gender live only here. A first Google sign-in copies the roster row as before, so a
--   cleaned student starts with no name or phone (owner's choice), and the directory is not copied.
-- * Rows are loaded outside git: no personal data in migrations.

create table private.student_directory (
  email       text primary key,
  full_name   text,
  phone       text,
  term        text,
  region_id   smallint references public.regions (id),
  gender      text,
  imported_at timestamptz not null default now(),

  constraint student_directory_email_format check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint student_directory_phone_e164 check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$')
);

comment on table private.student_directory is
  'Contact details of every student in the 2026-10-23 house upload. Read only through search_student_directory (Super Admins, audited as data.directory_search).';

revoke all on table private.student_directory from public, anon, authenticated, service_role;

-- Substring search over name, email and phone digits. One query returns at most 50 rows plus the
-- total, and every call (even one that finds nothing) leaves a data.directory_search audit row.
-- The audit trail is also the meter: 300 searches an hour per Super Admin.
create function public.search_student_directory(p_query text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_q      text := lower(btrim(coalesce(p_query, '')));
  v_digits text := regexp_replace(coalesce(p_query, ''), '[^0-9]', '', 'g');
  v_total  integer;
  v_rows   jsonb;
begin
  if not private.is_super_admin() then
    raise exception 'Only a Super Admin can search the student directory' using errcode = '42501';
  end if;
  if (select count(*) from public.audit_log l
      where l.actor_id = (select auth.uid()) and l.action = 'data.directory_search'
        and l.created_at > now() - interval '1 hour') >= 300 then
    raise exception 'Too many searches in the last hour. Try again later.' using errcode = '54000';
  end if;
  if length(v_q) < 3 or length(v_q) > 200 then
    raise exception 'Type at least 3 characters' using errcode = '22023';
  end if;

  -- strpos, not LIKE, so % and _ in the query are plain characters. Phone matching needs four
  -- digits so a short name fragment with a digit in it does not match every number.
  with hits as (
    select d.* from private.student_directory d
    where strpos(d.email, v_q) > 0
       or strpos(lower(coalesce(d.full_name, '')), v_q) > 0
       or (length(v_digits) >= 4 and strpos(regexp_replace(coalesce(d.phone, ''), '[^0-9]', '', 'g'), v_digits) > 0)
  ), page as (
    select h.* from hits h order by h.full_name nulls last, h.email limit 50
  )
  select (select count(*) from hits),
         coalesce(jsonb_agg(jsonb_build_object(
           'email', p.email,
           'full_name', p.full_name,
           'phone', p.phone,
           'term', p.term,
           'gender', p.gender,
           'region_id', p.region_id,
           'region_name', (select r.name from public.regions r where r.id = p.region_id),
           'signed_in', exists (select 1 from public.members m where m.email = p.email and m.deleted_at is null))
           order by p.full_name nulls last, p.email), '[]'::jsonb)
    into v_total, v_rows
  from page p;

  perform private.write_audit('data.directory_search', 'student_directory', null, null,
    jsonb_build_object('query', btrim(p_query), 'results', v_total));

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

comment on function public.search_student_directory(text) is
  'Super Admin search of private.student_directory by name, email or phone. At most 50 rows; audited as data.directory_search.';

revoke execute on function public.search_student_directory(text) from public, anon, service_role;
grant execute on function public.search_student_directory(text) to authenticated;

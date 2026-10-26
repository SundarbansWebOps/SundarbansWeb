-- Directory search shows the live record beside the upload (owner, 2026-10-25).
-- * Each row keeps the 2026-10-23 upload as it was, and adds `live`: the student's member row when
--   they have signed in, otherwise their roster row, otherwise null. Super Admins compare the two
--   side by side; nothing is copied either way.
-- * Matching, the 50-row page, the audit row and the hourly meter are unchanged.

create or replace function public.search_student_directory(p_query text)
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
  ), joined as (
    select p.*,
           case
             when m.id is not null then jsonb_build_object(
               'source', 'member',
               'full_name', m.full_name,
               'preferred_name', m.preferred_name,
               'phone', m.phone,
               'term', m.cohort,
               'gender', m.gender,
               'region_id', m.region_id,
               'region_name', (select r.name from public.regions r where r.id = m.region_id))
             when ro.email is not null then jsonb_build_object(
               'source', 'roster',
               'full_name', ro.full_name,
               'preferred_name', null,
               'phone', ro.phone,
               'term', null,
               'gender', ro.gender,
               'region_id', ro.region_id,
               'region_name', (select r.name from public.regions r where r.id = ro.region_id))
           end as live
    from page p
    left join public.members m on m.email = p.email and m.deleted_at is null
    left join public.member_roster ro on ro.email = p.email
  )
  select (select count(*) from hits),
         coalesce(jsonb_agg(jsonb_build_object(
           'email', j.email,
           'full_name', j.full_name,
           'phone', j.phone,
           'term', j.term,
           'gender', j.gender,
           'region_id', j.region_id,
           'region_name', (select r.name from public.regions r where r.id = j.region_id),
           'signed_in', j.live->>'source' = 'member',
           'live', j.live)
           order by j.full_name nulls last, j.email), '[]'::jsonb)
    into v_total, v_rows
  from joined j;

  perform private.write_audit('data.directory_search', 'student_directory', null, null,
    jsonb_build_object('query', btrim(p_query), 'results', v_total));

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

comment on function public.search_student_directory(text) is
  'Super Admin search of private.student_directory by name, email or phone, with each student''s live member or roster row beside the upload. At most 50 rows; audited as data.directory_search.';

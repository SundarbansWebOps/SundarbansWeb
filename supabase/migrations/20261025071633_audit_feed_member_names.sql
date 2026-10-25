-- The audit feed showed "Former member" for active members whose full_name is empty (it is cleared
-- until a student fills it in, and some admin accounts never had one). Name people the way the rest
-- of the admin does: full name, else Lounge name, else email. Only a missing member row (a hard
-- delete) is left nameless. Search matches the same fields. Body otherwise unchanged from
-- 20261021201958_audit_feed.sql.
create or replace function public.admin_audit_feed(
  p_actions   text[]      default null,
  p_prefixes  text[]      default null,
  p_actor     uuid        default null,
  p_member    uuid        default null,
  p_role      text        default null,
  p_result    text        default null,
  p_from      timestamptz default null,
  p_to        timestamptz default null,
  p_q         text        default null,
  p_before_at timestamptz default null,
  p_before_id bigint      default null,
  p_limit     int         default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit    int    := least(greatest(coalesce(p_limit, 50), 1), 100);
  -- An empty selection means "no filter", like null.
  v_actions  text[] := nullif(p_actions, '{}'::text[]);
  v_prefixes text[];
  v_q        text   := nullif(btrim(p_q), '');
  v_like     text;
  v_rows     jsonb;
  v_next     jsonb;
begin
  if not coalesce((select private.is_super_admin()), false) then
    raise exception 'Only a Super Admin can read the audit log' using errcode = '42501';
  end if;
  if (p_before_at is null) <> (p_before_id is null) then
    raise exception 'The cursor needs both p_before_at and p_before_id' using errcode = '22023';
  end if;
  if p_role is not null and p_role not in ('super_admin', 'rc', 'head', 'co_head', 'member', 'system') then
    raise exception 'Unknown role filter' using errcode = '22023';
  end if;
  if p_result is not null and p_result not in ('success', 'failure') then
    raise exception 'Unknown result filter' using errcode = '22023';
  end if;

  -- Escape LIKE metacharacters ('_' appears in real action names) before adding the wildcard.
  select array_agg(replace(replace(replace(x.prefix, '\', '\\'), '%', '\%'), '_', '\_') || '.%')
    into v_prefixes
  from unnest(p_prefixes) as x(prefix)
  where x.prefix is not null and x.prefix <> '';
  if v_q is not null then
    v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with page as (
    select a.id, a.created_at, a.action, a.result, a.actor_id, a.actor_role, a.target_table,
           a.target_id, a.request_id, a.xact_id, a.old_values, a.new_values,
           t.target_uuid, s.subject_id,
           coalesce(nullif(btrim(am.full_name), ''), nullif(btrim(am.preferred_name), ''), am.email)
             as actor_name,
           am.member_code as actor_code,
           coalesce(nullif(btrim(sm.full_name), ''), nullif(btrim(sm.preferred_name), ''), sm.email)
             as subject_name,
           sm.member_code as subject_code
    from public.audit_log a
    cross join lateral (
      select case when a.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                  then a.target_id::uuid end as target_uuid
    ) t
    cross join lateral (
      select case a.target_table
        when 'members' then t.target_uuid
        when 'form_responses' then
          (select r.member_id from public.form_responses r where r.id = t.target_uuid)
        when 'member_region_requests' then
          (select r.member_id from public.member_region_requests r where r.id = t.target_uuid)
        when 'certificate_name_requests' then
          (select r.member_id from public.certificate_name_requests r where r.id = t.target_uuid)
      end as subject_id
    ) s
    left join public.members am on am.id = a.actor_id
    left join public.members sm on sm.id = s.subject_id
    where (p_before_at is null or (a.created_at, a.id) < (p_before_at, p_before_id))
      and ((v_actions is null and v_prefixes is null)
           or a.action = any (v_actions)
           or a.action like any (v_prefixes))
      and (p_actor is null or a.actor_id = p_actor)
      and (p_member is null or a.actor_id = p_member or s.subject_id = p_member)
      and (p_role is null or a.actor_role = p_role)
      and (p_result is null or a.result = p_result)
      and (p_from is null or a.created_at >= p_from)
      and (p_to is null or a.created_at < p_to)
      and (v_q is null
           or am.full_name ilike v_like escape '\'
           or am.preferred_name ilike v_like escape '\'
           or am.email ilike v_like escape '\'
           or am.member_code ilike v_like escape '\'
           or sm.full_name ilike v_like escape '\'
           or sm.preferred_name ilike v_like escape '\'
           or sm.email ilike v_like escape '\'
           or sm.member_code ilike v_like escape '\'
           or lower(a.target_id) = lower(v_q))
    order by a.created_at desc, a.id desc
    limit v_limit + 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'created_at', p.created_at,
      'action', p.action,
      'result', p.result,
      'actor_id', p.actor_id,
      'actor_name', p.actor_name,
      'actor_code', p.actor_code,
      'actor_role', p.actor_role,
      'target_table', p.target_table,
      'target_id', p.target_id,
      'target_label', case p.target_table
        when 'members' then p.subject_name
        when 'events' then (select e.name from public.events e where e.id = p.target_uuid)
        when 'announcements' then (select n.title from public.announcements n where n.id = p.target_uuid)
        when 'lounge_forms' then (select f.title from public.lounge_forms f where f.id = p.target_uuid)
        when 'form_responses' then (select f.title from public.form_responses r
          join public.lounge_forms f on f.id = r.form_id where r.id = p.target_uuid)
        when 'regions' then (select r.name from public.regions r
          where r.id = case when p.target_id ~ '^[0-9]{1,4}$' then p.target_id::smallint end)
      end,
      'subject_id', p.subject_id,
      'subject_name', p.subject_name,
      'subject_code', p.subject_code,
      'request_id', p.request_id,
      'xact_id', p.xact_id,
      'old_values', p.old_values,
      'new_values', p.new_values
    ) order by p.created_at desc, p.id desc), '[]'::jsonb)
    into v_rows
  from page p;

  -- One extra row was fetched only to learn whether another page exists.
  if jsonb_array_length(v_rows) > v_limit then
    v_rows := v_rows - v_limit;
    v_next := jsonb_build_object('at', v_rows -> (v_limit - 1) -> 'created_at',
                                 'id', v_rows -> (v_limit - 1) -> 'id');
  end if;

  return jsonb_build_object('rows', v_rows, 'next', v_next);
end;
$$;

comment on function public.admin_audit_feed(text[], text[], uuid, uuid, text, text, timestamptz, timestamptz, text, timestamptz, bigint, int) is
  'Super Admin audit feed: filtered, newest first, keyset cursor (created_at, id). Full old/new values.';

revoke execute on function public.admin_audit_feed(text[], text[], uuid, uuid, text, text, timestamptz, timestamptz, text, timestamptz, bigint, int)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_audit_feed(text[], text[], uuid, uuid, text, text, timestamptz, timestamptz, text, timestamptz, bigint, int)
  to authenticated;

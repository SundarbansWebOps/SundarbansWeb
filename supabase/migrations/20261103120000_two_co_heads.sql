-- A community has one Head and up to two Co-Heads.
-- Same pattern as the two-RC limit (20261009150000_member_lounge.sql): a unique index cannot
-- allow two active Co-Head rows, so a trigger counts them under a community row lock. The Head
-- keeps its one-per-community unique index.

drop index public.admin_assignments_one_active_per_community_position;

create unique index admin_assignments_one_active_head_per_community
  on public.admin_assignments (community_id)
  where position = 'head' and ended_at is null;

create function private.enforce_co_head_limit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.position = 'co_head' and new.ended_at is null then
    -- Serialise concurrent Co-Head assignments for the same community.
    perform 1 from public.communities where id = new.community_id for update;
    if (select count(*) from public.admin_assignments
        where position = 'co_head' and ended_at is null
          and community_id = new.community_id and id <> new.id) >= 2 then
      raise exception 'A community may have at most two Co-Heads' using errcode = '23505';
    end if;
  end if;
  return new;
end; $$;

create trigger admin_assignments_co_head_limit
  before insert or update on public.admin_assignments
  for each row execute function private.enforce_co_head_limit();

-- assign_position: the slot-free check blocked any second holder of a community position. Keep
-- the RC rule, and allow a Co-Head when fewer than two other Co-Heads hold the community.
-- The trigger above is the real guard; this only gives the clear error first.
do $$
declare
  body     text;
  patched  text;
begin
  select pg_get_functiondef('public.assign_position(uuid,public.admin_position,smallint)'::regprocedure)
    into body;

  patched := replace(body,
    '(p_position <> ''rc'' or (select count(*) from public.admin_assignments a where a.position = ''rc'' and a.region_id = v_region_id and a.ended_at is null and a.member_id <> p_member_id) >= 2)',
    '(p_position = ''head'' or (p_position = ''rc'' and (select count(*) from public.admin_assignments a where a.position = ''rc'' and a.region_id = v_region_id and a.ended_at is null and a.member_id <> p_member_id) >= 2) or (p_position = ''co_head'' and (select count(*) from public.admin_assignments a where a.position = ''co_head'' and a.community_id = p_community_id and a.ended_at is null and a.member_id <> p_member_id) >= 2))');

  if patched = body then
    raise exception 'assign_position slot check not found; two-Co-Head patch not applied';
  end if;
  execute patched;
end $$;

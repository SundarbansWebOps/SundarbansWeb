-- pgTAP: a community has one Head and at most two Co-Heads (migration two_co_heads).
-- Self-contained: fixtures are direct inserts, everything runs inside begin … rollback.
-- Fixture ids start with b9000000-, emails with 99f9100.
begin;
select no_plan();

-- ── Fixtures (as postgres) ──────────────────────────────────────────────────
-- The allowlist references auth.users; this fixture has no Auth account, so skip that FK for it.
set local session_replication_role = replica;
insert into public.super_admin_allowlist (user_id, label)
  values ('b9000000-0000-4000-8000-000000000001', 'two co-heads test');
set local session_replication_role = origin;

insert into public.members (id, member_code, full_name, email, phone, account_status)
values
  ('b9000000-0000-4000-8000-000000000001', '99f9100001', 'Test Super Admin', '99f9100001@ds.study.iitm.ac.in', '+919990100001', 'active'),
  ('b9000000-0000-4000-8000-000000000002', '99f9100002', 'Head One',         '99f9100002@ds.study.iitm.ac.in', '+919990100002', 'active'),
  ('b9000000-0000-4000-8000-000000000003', '99f9100003', 'Co-Head One',      '99f9100003@ds.study.iitm.ac.in', '+919990100003', 'active'),
  ('b9000000-0000-4000-8000-000000000004', '99f9100004', 'Co-Head Two',      '99f9100004@ds.study.iitm.ac.in', '+919990100004', 'active'),
  ('b9000000-0000-4000-8000-000000000005', '99f9100005', 'Co-Head Three',    '99f9100005@ds.study.iitm.ac.in', '+919990100005', 'active'),
  ('b9000000-0000-4000-8000-000000000006', '99f9100006', 'Esports Co-Head',   '99f9100006@ds.study.iitm.ac.in', '+919990100006', 'active'),
  ('b9000000-0000-4000-8000-000000000007', '99f9100007', 'Unassigned Member', '99f9100007@ds.study.iitm.ac.in', '+919990100007', 'active');

-- Community "cultural" starts with a Head and one Co-Head already.
insert into public.admin_assignments (member_id, position, community_id, assigned_by)
  select m.id, p.position::public.admin_position, c.id, 'b9000000-0000-4000-8000-000000000001'
  from (values ('b9000000-0000-4000-8000-000000000002', 'head'),
               ('b9000000-0000-4000-8000-000000000003', 'co_head')) as p(id, position)
  join public.members m on m.id = p.id::uuid
  cross join (select id from public.communities where code = 'cultural') c;

-- ── Trigger: the limit holds for any write, not only the RPC ────────────────
select lives_ok($$ insert into public.admin_assignments (member_id, position, community_id, assigned_by)
  values ('b9000000-0000-4000-8000-000000000004', 'co_head',
          (select id from public.communities where code = 'cultural'), 'b9000000-0000-4000-8000-000000000001') $$,
  'a second active Co-Head is allowed');

select throws_ok($$ insert into public.admin_assignments (member_id, position, community_id, assigned_by)
  values ('b9000000-0000-4000-8000-000000000005', 'co_head',
          (select id from public.communities where code = 'cultural'), 'b9000000-0000-4000-8000-000000000001') $$,
  '23505', 'A community may have at most two Co-Heads', 'a third active Co-Head is refused by the trigger');

select throws_ok($$ insert into public.admin_assignments (member_id, position, community_id, assigned_by)
  values ('b9000000-0000-4000-8000-000000000005', 'head',
          (select id from public.communities where code = 'cultural'), 'b9000000-0000-4000-8000-000000000001') $$,
  '23505', null, 'a second active Head is still refused');

-- A Co-Head in another community does not count against this one.
select lives_ok($$ insert into public.admin_assignments (member_id, position, community_id, assigned_by)
  values ('b9000000-0000-4000-8000-000000000006', 'co_head',
          (select id from public.communities where code = 'esports'), 'b9000000-0000-4000-8000-000000000001') $$,
  'the Co-Head limit is per community');

-- Ending one Co-Head frees a slot.
update public.admin_assignments set ended_at = now()
  where member_id = 'b9000000-0000-4000-8000-000000000004' and ended_at is null;

select lives_ok($$ insert into public.admin_assignments (member_id, position, community_id, assigned_by)
  values ('b9000000-0000-4000-8000-000000000005', 'co_head',
          (select id from public.communities where code = 'cultural'), 'b9000000-0000-4000-8000-000000000001') $$,
  'an ended Co-Head frees a slot');

-- ── RPC: the clear error comes before the trigger ───────────────────────────
-- assign_position is no longer granted to signed-in users (admin_panel_backend); it runs inside
-- approve_request. Call it as the owner under Super Admin claims, as 020 does.
set local request.jwt.claims = '{"sub":"b9000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($$ select public.assign_position('b9000000-0000-4000-8000-000000000007', 'co_head',
                     (select id from public.communities where code = 'cultural')::smallint) $$,
  '23505', null, 'assign_position refuses a third Co-Head in the community');

select throws_ok($$ select public.assign_position('b9000000-0000-4000-8000-000000000007', 'head',
                     (select id from public.communities where code = 'cultural')::smallint) $$,
  '23505', null, 'assign_position still refuses a second Head');

select * from finish();
rollback;

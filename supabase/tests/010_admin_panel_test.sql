-- pgTAP: admin panel backend (migrations admin_request_types + admin_panel_backend).
-- Self-contained: builds its own fixtures (no seed.sql) and runs inside begin … rollback, so it
-- leaves nothing behind. Fixture ids start with a9000000-, emails with 99f9.
begin;
select no_plan();
select vault.create_secret(repeat('local-pgtap-only-',3),'blacklist_hash_pepper') where not exists(select 1 from vault.decrypted_secrets where name='blacklist_hash_pepper');

-- ── Fixtures (as postgres) ──────────────────────────────────────────────────
create temp table fx (k text primary key, id uuid, email text);
insert into fx values
  ('sa1', 'a9000000-0000-4000-8000-000000000001', '99f9000001@ds.study.iitm.ac.in'),
  ('sa2', 'a9000000-0000-4000-8000-000000000002', '99f9000002@ds.study.iitm.ac.in'),
  ('rc',  'a9000000-0000-4000-8000-000000000003', '99f9000003@ds.study.iitm.ac.in'),
  ('s1',  'a9000000-0000-4000-8000-000000000004', '99f9000004@ds.study.iitm.ac.in'),
  ('s2',  'a9000000-0000-4000-8000-000000000005', '99f9000005@ds.study.iitm.ac.in');
grant select on fx to authenticated, service_role;

-- A stranger who is not on the roster cannot get an account.
select throws_ok($$ insert into auth.users (id, email, aud, role)
  values ('a9000000-0000-4000-8000-000000000009', '99f9000009@ds.study.iitm.ac.in', 'authenticated', 'authenticated') $$,
  '42501', 'This email is not on the house roster', 'sign-in is refused for an email that is not on the roster');

select throws_ok($$ insert into auth.users (id, email, aud, role)
  values ('a9000000-0000-4000-8000-000000000008', 'someone@gmail.com', 'authenticated', 'authenticated') $$,
  '42501', null, 'sign-in is refused for another email domain');

-- A fresh local database has no real Auth accounts. A fixture-only member supplies the
-- roster added_by FK, then the normal Google claim path creates the bootstrap admin.
insert into public.members(id,member_code,email,region_id) values('a9000000-0000-4000-8000-000000000098','99f9000098','99f9000098@ds.study.iitm.ac.in',(select id from public.regions where code='region_01'));
insert into public.member_roster(email,region_id,added_by) values('99f9000099@ds.study.iitm.ac.in',(select id from public.regions where code='region_01'),'a9000000-0000-4000-8000-000000000098');
insert into auth.users(id,email,aud,role,raw_app_meta_data) values('a9000000-0000-4000-8000-000000000099','99f9000099@ds.study.iitm.ac.in','authenticated','authenticated','{"provider":"google"}');
insert into public.super_admin_allowlist(user_id,label) values('a9000000-0000-4000-8000-000000000099','Test bootstrap');
-- Roster rows for everyone (added_by: any existing member).
insert into public.member_roster (email, full_name, phone, region_id, added_by)
  select fx.email, 'Fixture ' || fx.k, '+9199900000' || right(fx.id::text, 2),
       (select id from public.regions where code = case when fx.k = 's2' then 'region_02' else 'region_01' end),
       (select user_id from public.super_admin_allowlist limit 1)
from fx;

-- First (Google) sign-in: the member is created from the roster row, metadata is ignored.
insert into auth.users (id, email, aud, role, raw_user_meta_data,raw_app_meta_data)
  select fx.id, fx.email, 'authenticated', 'authenticated', '{"full_name":"Google Name"}'::jsonb,'{"provider":"google"}'::jsonb from fx;

select results_eq($$ select full_name, phone from public.members where id = 'a9000000-0000-4000-8000-000000000004' $$,
  $$ values ('Fixture s1'::text, '+919990000004'::text) $$, 'the member profile comes from the roster, not Google');
select is_empty($$ select 1 from public.member_roster where email like '99f9%' $$,
  'roster rows are removed once the student has signed in');

insert into public.super_admin_allowlist (user_id, label)
  select id, 'test ' || k from fx where k in ('sa1', 'sa2');
insert into public.admin_assignments (member_id, position, region_id, assigned_by)
  select (select id from fx where k = 'rc'), 'rc', (select id from public.regions where code = 'region_01'),
       (select id from fx where k = 'sa1');

-- ── Regional Coordinator ────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"a9000000-0000-4000-8000-000000000003","role":"authenticated"}';

select lives_ok($$ select public.roster_add('99f9000010@ds.study.iitm.ac.in', 'New Student', '+919990000010') $$,
  'RC adds a student to their own region');
select results_eq($$ select r.code from public.member_roster m join public.regions r on r.id = m.region_id
                     where m.email = '99f9000010@ds.study.iitm.ac.in' $$,
  $$ values ('region_01'::text) $$, 'the RC''s student lands in the RC''s region');
select throws_ok($$ select public.roster_add('99f9000011@ds.study.iitm.ac.in', 'Other', '+919990000011',
                     (select id from public.regions where code = 'region_02')) $$,
  '42501', null, 'RC cannot add to another region');
select throws_ok($$ select public.roster_add('x@gmail.com', 'Gmail', '+919990000012') $$,
  '22023', null, 'roster accepts IITM emails only');

select lives_ok($$ select public.request_member_update('a9000000-0000-4000-8000-000000000004',
                     '{"phone":"+919990000044"}', 'New number') $$, 'RC requests a change for a student in their region');
select throws_ok($$ select public.request_member_update('a9000000-0000-4000-8000-000000000005',
                     '{"phone":"+919990000055"}', 'x') $$, '42501', null, 'RC cannot request changes outside their region');
select results_eq($$ select phone from public.members where id = 'a9000000-0000-4000-8000-000000000004' $$,
  $$ values ('+919990000004'::text) $$, 'a request changes nothing until it is approved');
select throws_ok($$ select public.request_status_change('a9000000-0000-4000-8000-000000000004', 'suspend', 'x') $$,
  '42501', null, 'RC cannot file status changes');

select throws_ok($$ insert into public.events (name, starts_at, ends_at, community_id)
                   values ('Tech night', now() + interval '1 day', now() + interval '2 days',
                           (select id from public.communities where code = 'technical')) $$,
  '42501', null, 'RC cannot create another community event');
select lives_ok($$ insert into public.events (name, starts_at, ends_at, region_id)
                   values ('Region night', now() + interval '1 day', now() + interval '2 days',
                           (select id from public.regions where code = 'region_01')) $$,
  'RC creates an event in their own region');
select lives_ok($$ update public.events set description = 'Edited' where name = 'Region night' $$,
  'RC edits own-region event');
select results_eq($$ select description from public.events where name = 'Region night' $$,
  $$ values ('Edited'::text) $$, 'the RC edit is saved');
reset role;

-- ── Super Admins: two-person rule ───────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"a9000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok($$ select public.sa_set_suspended('a9000000-0000-4000-8000-000000000004', true, 'x') $$,
  '42501', null, 'direct suspend is no longer callable');
select throws_ok($$ select public.assign_position('a9000000-0000-4000-8000-000000000005', 'rc') $$,
  '42501', null, 'direct position assignment is no longer callable');

select throws_ok($$ update public.members set full_name = 'Sneaky' where id = 'a9000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'full_name has no direct write grant');
select results_eq($$ select full_name from public.members where id = 'a9000000-0000-4000-8000-000000000004' $$,
  $$ values ('Fixture s1'::text) $$, 'a Super Admin cannot edit another member directly');

select lives_ok($$ select public.request_status_change('a9000000-0000-4000-8000-000000000005', 'suspend', 'Test') $$,
  'Super Admin files a suspension');
select throws_ok($$ select public.request_position_change('a9000000-0000-4000-8000-000000000005', 'revoke', null, null, 'x') $$,
  'PT409', null, 'cannot revoke a position the member does not hold');

select throws_ok($$ select public.approve_request((select id from public.approval_requests
                     where target_member_id = 'a9000000-0000-4000-8000-000000000005' and status = 'pending')) $$,
  '42501', 'You cannot review your own request', 'a Super Admin cannot approve their own request');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a9000000-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok($$ select public.approve_request((select id from public.approval_requests
                    where target_member_id = 'a9000000-0000-4000-8000-000000000005'
                      and type = 'member_status_change' and status = 'pending'), 'ok') $$,
  'a second Super Admin approves the suspension');
select results_eq($$ select account_status::text from public.members where id = 'a9000000-0000-4000-8000-000000000005' $$,
  $$ values ('suspended'::text) $$, 'the approved suspension is applied');

select lives_ok($$ select public.approve_request((select id from public.approval_requests
                    where target_member_id = 'a9000000-0000-4000-8000-000000000004'
                      and type = 'member_profile_update' and status = 'pending')) $$,
  'a Super Admin approves the RC''s request');
select results_eq($$ select phone from public.members where id = 'a9000000-0000-4000-8000-000000000004' $$,
  $$ values ('+919990000044'::text) $$, 'the approved profile change is applied');

select lives_ok($$ select public.request_position_change('a9000000-0000-4000-8000-000000000004', 'assign', 'head',
                     (select id from public.communities where code = 'cultural'), 'Leads cultural') $$,
  'Super Admin files a position change');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a9000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$ select public.approve_request((select id from public.approval_requests
                    where target_member_id = 'a9000000-0000-4000-8000-000000000004'
                      and type = 'position_change' and status = 'pending')) $$,
  'the other Super Admin approves the position change');
select results_eq($$ select position::text from public.admin_assignments
                     where member_id = 'a9000000-0000-4000-8000-000000000004' and ended_at is null $$,
  $$ values ('head'::text) $$, 'the approved position is assigned');
select is((select count(*)::int from public.audit_log where action = 'request.approve'
           and request_id in (select id from public.approval_requests where target_member_id::text like 'a9000000%')),
  3, 'every approval is in the audit log');
reset role;

-- ── Phone is optional ───────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"a9000000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok($$ select public.roster_add('99f9000020@ds.study.iitm.ac.in', 'No Phone', null) $$,
  'RC adds a student without a phone number');
select lives_ok($$ select public.roster_add('99f9000021@ds.study.iitm.ac.in', 'Blank Phone', '  ') $$,
  'a blank phone counts as no phone');
select throws_ok($$ select public.roster_add('99f9000022@ds.study.iitm.ac.in', 'Bad Phone', '12345') $$,
  '22023', null, 'a phone that is given must still be valid');
reset role;

insert into auth.users (id, email, aud, role,raw_app_meta_data)
  values ('a9000000-0000-4000-8000-000000000020', '99f9000020@ds.study.iitm.ac.in', 'authenticated', 'authenticated','{"provider":"google"}');
select results_eq($$ select full_name, phone from public.members where id = 'a9000000-0000-4000-8000-000000000020' $$,
  $$ values ('No Phone'::text, null::text) $$, 'a student without a phone can sign in');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a9000000-0000-4000-8000-000000000003","role":"authenticated"}';
select results_eq($$ select full_name from public.search_members('No Phone') $$,
  $$ values ('No Phone'::text) $$, 'a student without a phone is still found by search');
select lives_ok($$ select public.request_blacklist('a9000000-0000-4000-8000-000000000020', 'Test') $$,
  'RC can ask to blacklist a student without a phone');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a9000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$ select public.approve_request((select id from public.approval_requests
                    where target_member_id = 'a9000000-0000-4000-8000-000000000020' and status = 'pending')) $$,
  'blacklisting a student without a phone can be approved');
select results_eq($$ select phone_hash is null from public.blacklist_entries
                     where member_id = 'a9000000-0000-4000-8000-000000000020' $$,
  $$ values (true) $$, 'their blacklist entry has no phone hash (email only)');
select lives_ok($$ select public.request_member_update('a9000000-0000-4000-8000-000000000004',
                     '{"phone":""}', 'No longer uses WhatsApp') $$, 'a phone number can be cleared by request');
reset role;

-- ── Login email change: one Super Admin files, another approves (Edge Function path) ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"a9000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$ select public.request_contact_change('a9000000-0000-4000-8000-000000000020',
                     '99f9000030@ds.study.iitm.ac.in', 'x') $$, '42501', null, 'an RC cannot request a login email change');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a9000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$ select public.request_contact_change('a9000000-0000-4000-8000-000000000005',
                     'someone@gmail.com', 'x') $$, '22023', null, 'the new login email must be an IITM email');
select lives_ok($$ select public.request_contact_change('a9000000-0000-4000-8000-000000000005',
                     '99f9000030@ds.study.iitm.ac.in', 'Roll number corrected') $$, 'a Super Admin files a login email change');
select throws_ok($$ select public.approve_request((select id from public.approval_requests
                     where type = 'member_contact_change' and status = 'pending')) $$,
  '42501', null, 'the filer cannot approve their own email change');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a9000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$ select public.approve_request((select id from public.approval_requests
                     where type = 'member_contact_change' and status = 'pending')) $$,
  '0A000', null, 'ordinary approval refuses email changes (they need the Edge Function)');
select throws_ok($$ select public.svc_contact_request_plan('a9000000-0000-4000-8000-000000000002',
                     (select id from public.approval_requests where type = 'member_contact_change' and status = 'pending')) $$,
  '42501', null, 'signed-in users cannot call the Edge Function''s database steps');
reset role;

set local role service_role;
select throws_ok($$ select public.svc_contact_request_plan('a9000000-0000-4000-8000-000000000001',
                     (select id from public.approval_requests where type = 'member_contact_change' and status = 'pending')) $$,
  '42501', 'A different Super Admin must approve this change', 'the Edge Function refuses the filer as approver');
select throws_ok($$ select public.svc_apply_contact_change('a9000000-0000-4000-8000-000000000002',
                     'a9000000-0000-4000-8000-000000000005', '99f9000031@ds.study.iitm.ac.in', null, '99f9000005@ds.study.iitm.ac.in') $$,
  '42501', null, 'the old direct change path is closed');
select results_eq($$ select public.svc_contact_request_plan('a9000000-0000-4000-8000-000000000002',
                     (select id from public.approval_requests where type = 'member_contact_change' and status = 'pending')) ->> 'new_email' $$,
  $$ values ('99f9000030@ds.study.iitm.ac.in'::text) $$, 'a second Super Admin gets the plan');
select lives_ok($$ select public.svc_complete_contact_request('a9000000-0000-4000-8000-000000000002',
                     (select id from public.approval_requests where type = 'member_contact_change' and status = 'pending'),
                     '99f9000005@ds.study.iitm.ac.in', 'ok') $$, 'the second Super Admin completes it');
reset role;
select results_eq($$ select m.email, r.status::text from public.members m
                     join public.approval_requests r on r.target_member_id = m.id and r.type = 'member_contact_change'
                     where m.id = 'a9000000-0000-4000-8000-000000000005' $$,
  $$ values ('99f9000030@ds.study.iitm.ac.in'::text, 'approved'::text) $$, 'the email changed and the request is approved');

-- ── Normal member ───────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"a9000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$ select public.roster_add('99f9000013@ds.study.iitm.ac.in', 'X', '+919990000013') $$,
  '42501', null, 'a member who is not an RC or Super Admin cannot add to the roster');
select is_empty($$ select 1 from public.member_roster $$, 'members cannot read the roster');
select lives_ok($$ update public.members set preferred_name = 'Me' where id = 'a9000000-0000-4000-8000-000000000004' $$,
  'members still edit their own safe fields');
reset role;

set local role anon;
select throws_ok($$ select public.roster_add('a@ds.study.iitm.ac.in', 'X', '+919990000014') $$,
  '42501', null, 'signed-out visitors cannot call roster_add');
reset role;

select * from finish();
rollback;

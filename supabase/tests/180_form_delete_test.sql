-- pgTAP: Super Admin hard-deletes a form; Head/RC ask through form_delete
-- (20261026150100_form_delete). Synthetic identities only (ids start with c1800000,
-- codes 99f965xxxx). Everything rolls back.
begin;
select no_plan();
select vault.create_secret(repeat('local-pgtap-only-',3),'blacklist_hash_pepper') where not exists(select 1 from vault.decrypted_secrets where name='blacklist_hash_pepper');

insert into public.members(id, member_code, email, region_id)
values ('c1800000-0000-4000-8000-000000000098', '99f9650098', '99f9650098@ds.study.iitm.ac.in', 1);
create temp table ct(k text primary key, id uuid, email text);
insert into ct values
 ('sa', 'c1800000-0000-4000-8000-000000000001', '99f9650001@ds.study.iitm.ac.in'),
 ('th', 'c1800000-0000-4000-8000-000000000002', '99f9650002@ds.study.iitm.ac.in'),
 ('rc', 'c1800000-0000-4000-8000-000000000003', '99f9650003@ds.study.iitm.ac.in'),
 ('st', 'c1800000-0000-4000-8000-000000000004', '99f9650004@ds.study.iitm.ac.in');
grant select on ct to authenticated;
insert into public.member_roster(email, region_id, added_by) select email, 1, 'c1800000-0000-4000-8000-000000000098' from ct;
insert into auth.users(id, email, aud, role, raw_app_meta_data)
select id, email, 'authenticated', 'authenticated', '{"provider":"google"}'::jsonb from ct;
insert into public.super_admin_allowlist(user_id, label) select id, 'Test SA form delete' from ct where k = 'sa';
insert into public.admin_assignments(member_id, position, region_id, community_id, assigned_by)
select id, 'head', null, (select id from public.communities where code = 'technical'), (select id from ct where k = 'sa') from ct where k = 'th';
insert into public.admin_assignments(member_id, position, region_id, community_id, assigned_by)
select id, 'rc', 1, null, (select id from ct where k = 'sa') from ct where k = 'rc';
create temp table tid as select (select id from public.communities where code = 'technical') as tech;
grant select on tid to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1800000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$insert into public.events(id, name, community_id, starts_at, ends_at, published_at, created_by, updated_by)
  values ('c1800000-0000-4000-8000-0000000000e1', 'Hack night', (select tech from tid),
          now() + interval '1 day', now() + interval '2 days', now() - interval '1 minute',
          'c1800000-0000-4000-8000-000000000001', 'c1800000-0000-4000-8000-000000000001')$$,
  'Super Admin publishes a community event');
select lives_ok($$select public.save_lounge_form(jsonb_build_object(
  'id','c1800000-0000-4000-8000-0000000000f1','title','Hack night signup',
  'event_id','c1800000-0000-4000-8000-0000000000e1','published_at',now() - interval '1 minute',
  'fields','[{"key":"name","label":"Name","type":"text"}]'::jsonb))$$,
  'Super Admin publishes the event form');
select lives_ok($$select public.save_lounge_form(jsonb_build_object(
  'id','c1800000-0000-4000-8000-0000000000f2','title','Join Technical',
  'community_id',(select tech from tid)))$$,
  'Super Admin saves a community draft');
reset role;

insert into public.form_responses(id, form_id, member_id, submitted_email, field_schema, answers)
values ('c1800000-0000-4000-8000-0000000000r1', 'c1800000-0000-4000-8000-0000000000f1',
        'c1800000-0000-4000-8000-000000000004', '99f9650004@ds.study.iitm.ac.in',
        '[]'::jsonb, '{"name":"Student"}'::jsonb);
insert into public.event_registrations(event_id, member_id, response_id, registered_email)
values ('c1800000-0000-4000-8000-0000000000e1', 'c1800000-0000-4000-8000-000000000004',
        'c1800000-0000-4000-8000-0000000000r1', '99f9650004@ds.study.iitm.ac.in');

-- ── Head cannot delete; Super Admin can ─────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1800000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.delete_lounge_form('c1800000-0000-4000-8000-0000000000f1')$$,
  '42501', null, 'Head cannot hard-delete a form');
select lives_ok($$select public.request_form_delete('c1800000-0000-4000-8000-0000000000f1')$$,
  'Head asks to remove the event form');
select throws_ok($$select public.request_form_delete('c1800000-0000-4000-8000-0000000000f1')$$,
  '23505', null, 'one pending request per form');
select throws_ok($$select public.save_lounge_form(jsonb_build_object(
  'id','c1800000-0000-4000-8000-0000000000f1','title','Changed',
  'event_id','c1800000-0000-4000-8000-0000000000e1'))$$,
  'PT409', null, 'the form is frozen while delete is pending');
select lives_ok($$select public.cancel_request(id) from public.approval_requests
  where target_form_id = 'c1800000-0000-4000-8000-0000000000f1'$$,
  'Head cancels the delete request');
select lives_ok($$select public.save_lounge_form(jsonb_build_object(
  'id','c1800000-0000-4000-8000-0000000000f1','title','Hack night signup',
  'event_id','c1800000-0000-4000-8000-0000000000e1',
  'published_at',(select published_at from public.lounge_forms where id = 'c1800000-0000-4000-8000-0000000000f1')))$$,
  'a cancelled request unfreezes the form');
select lives_ok($$select public.request_form_delete('c1800000-0000-4000-8000-0000000000f1')$$,
  'Head asks again');
reset role;

select is((select type::text || '/' || (requested_change->>'form_title') from public.approval_requests
  where target_form_id = 'c1800000-0000-4000-8000-0000000000f1' and status = 'pending'),
  'form_delete/Hack night signup', 'the request names the form');

-- ── RC: own region form, not the Head''s ────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1800000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok($$select public.save_lounge_form(jsonb_build_object(
  'id','c1800000-0000-4000-8000-0000000000f5','title','Patna meetup','region_id',1,'published_at',now()))$$,
  'RC publishes a region form');
select lives_ok($$select public.request_form_delete('c1800000-0000-4000-8000-0000000000f5')$$,
  'RC asks to remove their region form');
select throws_ok($$select public.delete_lounge_form('c1800000-0000-4000-8000-0000000000f5')$$,
  '42501', null, 'RC cannot hard-delete');
select throws_ok($$select public.request_form_delete('c1800000-0000-4000-8000-0000000000f2')$$,
  '42501', null, 'RC cannot ask for a Head''s form');
reset role;

-- ── Super Admin deletes directly; pending request is rejected ───────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1800000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.request_form_delete('c1800000-0000-4000-8000-0000000000f2')$$,
  '42501', null, 'a Super Admin removes a form directly instead');
select lives_ok($$select public.delete_lounge_form('c1800000-0000-4000-8000-0000000000f1')$$,
  'Super Admin deletes the event form and its responses');
reset role;

select is((select count(*)::int from public.lounge_forms where id = 'c1800000-0000-4000-8000-0000000000f1'), 0, 'the form is gone');
select is((select count(*)::int from public.form_responses where id = 'c1800000-0000-4000-8000-0000000000r1'), 0, 'responses are gone');
select is((select count(*)::int from public.event_registrations
  where event_id = 'c1800000-0000-4000-8000-0000000000e1'), 0, 'event registrations from the form are gone');
select is((select status::text from public.approval_requests
  where requested_change->>'form_id' = 'c1800000-0000-4000-8000-0000000000f1'),
  'rejected', 'the pending delete request is rejected because the form was removed');
select is((select count(*)::int from public.audit_log where action = 'form.delete'
  and target_id = 'c1800000-0000-4000-8000-0000000000f1'), 1, 'the delete is audited');

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1800000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$update public.events set entry_mode = 'open' where id = 'c1800000-0000-4000-8000-0000000000e1'$$,
  'the event becomes an open session once the form is gone');
reset role;

-- ── Approve a Head request ──────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1800000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select public.request_form_delete('c1800000-0000-4000-8000-0000000000f2')$$,
  'Head asks to remove the community draft');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1800000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.approve_request(id) from public.approval_requests
  where requested_change->>'form_id' = 'c1800000-0000-4000-8000-0000000000f2' and status = 'pending'$$,
  'Super Admin approves the delete request');
reset role;

select is((select count(*)::int from public.lounge_forms where id = 'c1800000-0000-4000-8000-0000000000f2'), 0,
  'approval deletes the form');
select is((select status::text || '/' || (executed_at is not null)::text || '/' || (target_form_id is null)::text
  from public.approval_requests where requested_change->>'form_id' = 'c1800000-0000-4000-8000-0000000000f2'),
  'approved/true/true', 'the request is approved, executed, and unlinked from the deleted form');

-- Pending publish and pending delete cannot coexist.
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1800000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select public.save_lounge_form(jsonb_build_object(
  'id','c1800000-0000-4000-8000-0000000000f3','title','Second draft',
  'community_id',(select tech from tid)))$$, 'Head saves another draft');
select lives_ok($$select public.request_form_publish('c1800000-0000-4000-8000-0000000000f3')$$,
  'Head asks to publish it');
select throws_ok($$select public.request_form_delete('c1800000-0000-4000-8000-0000000000f3')$$,
  '23505', null, 'a form waiting to publish cannot also wait to be removed');
reset role;

select * from finish();
rollback;

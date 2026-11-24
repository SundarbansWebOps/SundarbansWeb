-- pgTAP: Head and Co-Head forms are published by a Super Admin (migration
-- 20261024120100_form_publish_approval). Synthetic identities only (ids start with c1300000,
-- codes 99f963xxxx). Everything rolls back.
begin;
select no_plan();
select vault.create_secret(repeat('local-pgtap-only-',3),'blacklist_hash_pepper') where not exists(select 1 from vault.decrypted_secrets where name='blacklist_hash_pepper');

insert into public.members(id, member_code, email, region_id)
values ('c1300000-0000-4000-8000-000000000098', '99f9630098', '99f9630098@ds.study.iitm.ac.in', 1);
create temp table ct(k text primary key, id uuid, email text);
insert into ct values
 ('sa', 'c1300000-0000-4000-8000-000000000001', '99f9630001@ds.study.iitm.ac.in'),
 ('th', 'c1300000-0000-4000-8000-000000000002', '99f9630002@ds.study.iitm.ac.in'),
 ('rc', 'c1300000-0000-4000-8000-000000000003', '99f9630003@ds.study.iitm.ac.in');
grant select on ct to authenticated;
insert into public.member_roster(email, region_id, added_by) select email, 1, 'c1300000-0000-4000-8000-000000000098' from ct;
insert into auth.users(id, email, aud, role, raw_app_meta_data)
select id, email, 'authenticated', 'authenticated', '{"provider":"google"}'::jsonb from ct;
insert into public.super_admin_allowlist(user_id, label) select id, 'Test SA forms' from ct where k = 'sa';
insert into public.admin_assignments(member_id, position, region_id, community_id, assigned_by)
select id, 'head', null, (select id from public.communities where code = 'technical'), (select id from ct where k = 'sa') from ct where k = 'th';
insert into public.admin_assignments(member_id, position, region_id, community_id, assigned_by)
select id, 'rc', 1, null, (select id from ct where k = 'sa') from ct where k = 'rc';
create temp table tid as select (select id from public.communities where code = 'technical') as tech;
grant select on tid to authenticated;
insert into public.events(id, name, community_id, starts_at, ends_at, published_at, created_by, updated_by)
values ('c1300000-0000-4000-8000-0000000000e1', 'Hack night', (select tech from tid),
        now() + interval '1 day', now() + interval '2 days', now() - interval '1 minute', 'c1300000-0000-4000-8000-000000000001', 'c1300000-0000-4000-8000-000000000001');

-- A form the Super Admin published before this change; it stays live.
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1300000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.save_lounge_form(jsonb_build_object('id','c1300000-0000-4000-8000-0000000000f0','title','Live survey',
  'community_id',(select tech from tid),'published_at',now() - interval '1 minute'))$$, 'Super Admin publishes a community form directly');
reset role;

-- ── Head: drafts only ───────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1300000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c1300000-0000-4000-8000-0000000000f1','title','Join Technical',
  'community_id',(select tech from tid),'published_at',now()))$$, '42501', null, 'Head cannot publish a new form');
select lives_ok($$select public.save_lounge_form(jsonb_build_object('id','c1300000-0000-4000-8000-0000000000f1','title','Join Technical',
  'community_id',(select tech from tid)))$$, 'Head saves a draft');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c1300000-0000-4000-8000-0000000000f1','title','Join Technical',
  'community_id',(select tech from tid),'published_at',now()))$$, '42501', null, 'Head cannot publish their draft');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c1300000-0000-4000-8000-0000000000f4','title','Hack night signup',
  'event_id','c1300000-0000-4000-8000-0000000000e1','published_at',now()))$$, '42501', null, 'Head cannot publish a form on their community event');
select lives_ok($$select public.save_lounge_form(jsonb_build_object('id','c1300000-0000-4000-8000-0000000000f0','title','Live survey, edited',
  'community_id',(select tech from tid),'published_at',(select published_at from public.lounge_forms where id = 'c1300000-0000-4000-8000-0000000000f0')))$$,
  'Head edits a form that is already live');
select throws_ok($$select public.request_form_publish('c1300000-0000-4000-8000-0000000000f0')$$, 'PT409', null, 'a live form needs no request');

-- ── Asking ──────────────────────────────────────────────────────────────────
select lives_ok($$select public.request_form_publish('c1300000-0000-4000-8000-0000000000f1')$$, 'Head asks to publish the draft');
select throws_ok($$select public.request_form_publish('c1300000-0000-4000-8000-0000000000f1')$$, '23505', null, 'one pending request per form');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c1300000-0000-4000-8000-0000000000f1','title','Changed',
  'community_id',(select tech from tid)))$$, 'PT409', null, 'the form is frozen while it waits');
select lives_ok($$select public.save_lounge_form(jsonb_build_object('id','c1300000-0000-4000-8000-0000000000f2','title','Second draft',
  'community_id',(select tech from tid)))$$, 'Head saves another draft');
select lives_ok($$select public.request_form_publish('c1300000-0000-4000-8000-0000000000f2', 'Recruitment opens Monday')$$, 'a Head may have several forms waiting');
select lives_ok($$select public.cancel_request(id) from public.approval_requests where target_form_id = 'c1300000-0000-4000-8000-0000000000f2'$$, 'Head cancels one request');
select lives_ok($$select public.save_lounge_form(jsonb_build_object('id','c1300000-0000-4000-8000-0000000000f2','title','Second draft, fixed',
  'community_id',(select tech from tid)))$$, 'a cancelled request unfreezes the form');
select lives_ok($$select public.save_lounge_form(jsonb_build_object('id','c1300000-0000-4000-8000-0000000000f3','title','Closed draft',
  'community_id',(select tech from tid),'closes_at',now() - interval '1 hour'))$$, 'Head saves a draft that already closed');
select throws_ok($$select public.request_form_publish('c1300000-0000-4000-8000-0000000000f3')$$, 'PT409', null, 'a closed form cannot be sent');
reset role;
select is((select type::text || '/' || target_member_id::text || '/' || (requested_change->>'form_title') from public.approval_requests
  where target_form_id = 'c1300000-0000-4000-8000-0000000000f1'),
  'form_publish/c1300000-0000-4000-8000-000000000002/Join Technical', 'the request names the form and its requester');
select is((select count(*)::int from public.audit_log where action = 'request.create' and new_values->>'form_id' = 'c1300000-0000-4000-8000-0000000000f1'), 1, 'the request is audited');

-- ── RC: unchanged ───────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1300000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok($$select public.save_lounge_form(jsonb_build_object('id','c1300000-0000-4000-8000-0000000000f5','title','Patna meetup',
  'region_id',1,'published_at',now()))$$, 'RC still publishes a region form directly');
select throws_ok($$select public.request_form_publish('c1300000-0000-4000-8000-0000000000f5')$$, '42501', null, 'an RC form needs no request');
select throws_ok($$select public.request_form_publish('c1300000-0000-4000-8000-0000000000f2')$$, '42501', null, 'an RC cannot ask for a Head''s form');
reset role;

-- ── Approving ───────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1300000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.request_form_publish('c1300000-0000-4000-8000-0000000000f2')$$, '42501', null, 'a Super Admin publishes directly instead');
select lives_ok($$select public.approve_request(id) from public.approval_requests where target_form_id = 'c1300000-0000-4000-8000-0000000000f1' and status = 'pending'$$,
  'Super Admin approves the request');
reset role;
select ok((select published_at is not null and published_at <= now() from public.lounge_forms where id = 'c1300000-0000-4000-8000-0000000000f1'), 'approval publishes the form');
select is((select status::text || '/' || (executed_at is not null)::text from public.approval_requests where target_form_id = 'c1300000-0000-4000-8000-0000000000f1'),
  'approved/true', 'the request is approved and executed');

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1300000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select public.save_lounge_form(jsonb_build_object('id','c1300000-0000-4000-8000-0000000000f1','title','Join Technical 2026',
  'community_id',(select tech from tid),'published_at',(select published_at from public.lounge_forms where id = 'c1300000-0000-4000-8000-0000000000f1')))$$,
  'Head edits the approved form');
select lives_ok($$select public.save_lounge_form(jsonb_build_object('id','c1300000-0000-4000-8000-0000000000f1','title','Join Technical 2026',
  'community_id',(select tech from tid)))$$, 'Head unpublishes it');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c1300000-0000-4000-8000-0000000000f1','title','Join Technical 2026',
  'community_id',(select tech from tid),'published_at',now()))$$, '42501', null, 'publishing it again needs a new approval');
select lives_ok($$select public.request_form_publish('c1300000-0000-4000-8000-0000000000f1')$$, 'Head asks again');
reset role;

-- The Super Admin publishes it meanwhile; that publish closes the request (20261124180000).
set local request.jwt.claims = '{"sub":"c1300000-0000-4000-8000-000000000001","role":"authenticated"}';
update public.lounge_forms set published_at = now() where id = 'c1300000-0000-4000-8000-0000000000f1';
select is((select count(*)::int from public.approval_requests where target_form_id = 'c1300000-0000-4000-8000-0000000000f1' and status = 'pending'),
  0, 'a Super Admin publish leaves no stale request pending');
reset role;

select * from finish();
rollback;

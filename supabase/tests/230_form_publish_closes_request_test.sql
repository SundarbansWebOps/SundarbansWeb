-- pgTAP: a Super Admin publishing a form from the editor closes the Co-Head's pending publish
-- request (20261124180000_form_publish_closes_request). Synthetic identities only (ids start
-- with c2300000, codes 99f966xxxx). Everything rolls back.
begin;
select no_plan();
select vault.create_secret(repeat('local-pgtap-only-',3),'blacklist_hash_pepper') where not exists(select 1 from vault.decrypted_secrets where name='blacklist_hash_pepper');

insert into public.members(id, member_code, email, region_id)
values ('c2300000-0000-4000-8000-000000000098', '99f9660098', '99f9660098@ds.study.iitm.ac.in', 1);
create temp table ct(k text primary key, id uuid, email text);
insert into ct values
 ('sa', 'c2300000-0000-4000-8000-000000000001', '99f9660001@ds.study.iitm.ac.in'),
 ('ch', 'c2300000-0000-4000-8000-000000000002', '99f9660002@ds.study.iitm.ac.in');
grant select on ct to authenticated;
insert into public.member_roster(email, region_id, added_by) select email, 1, 'c2300000-0000-4000-8000-000000000098' from ct;
insert into auth.users(id, email, aud, role, raw_app_meta_data)
select id, email, 'authenticated', 'authenticated', '{"provider":"google"}'::jsonb from ct;
insert into public.super_admin_allowlist(user_id, label) select id, 'Test SA publish close' from ct where k = 'sa';
insert into public.admin_assignments(member_id, position, region_id, community_id, assigned_by)
select id, 'co_head', null, (select id from public.communities where code = 'technical'), (select id from ct where k = 'sa') from ct where k = 'ch';
create temp table tid as select (select id from public.communities where code = 'technical') as tech;
grant select on tid to authenticated;

-- Co-Head drafts two community forms and asks to publish both.
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2300000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select public.save_lounge_form(jsonb_build_object(
  'id','c2300000-0000-4000-8000-0000000000f1','title','Join Technical',
  'community_id',(select tech from tid)))$$, 'Co-Head saves a community draft');
select lives_ok($$select public.save_lounge_form(jsonb_build_object(
  'id','c2300000-0000-4000-8000-0000000000f2','title','Workshop signup',
  'community_id',(select tech from tid)))$$, 'Co-Head saves a second draft');
select lives_ok($$select public.request_form_publish('c2300000-0000-4000-8000-0000000000f1')$$,
  'Co-Head asks to publish form 1');
select lives_ok($$select public.request_form_publish('c2300000-0000-4000-8000-0000000000f2')$$,
  'Co-Head asks to publish form 2');
select throws_ok($$select public.save_lounge_form(jsonb_build_object(
  'id','c2300000-0000-4000-8000-0000000000f1','title','Join Technical v2',
  'community_id',(select tech from tid)))$$, 'PT409', null, 'pending request freezes the form for the Co-Head');
reset role;

-- Super Admin publishes form 1 straight from the editor.
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2300000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.save_lounge_form(jsonb_build_object(
  'id','c2300000-0000-4000-8000-0000000000f1','title','Join Technical',
  'community_id',(select tech from tid),'published_at',now()))$$, 'Super Admin publishes form 1 directly');
-- Form 2 goes through Requests as before.
select lives_ok($$select public.approve_request((select id from public.approval_requests
  where target_form_id='c2300000-0000-4000-8000-0000000000f2' and status='pending'), 'Looks good')$$,
  'Super Admin approves form 2 through Requests');
reset role;

select is((select status::text from public.approval_requests where target_form_id='c2300000-0000-4000-8000-0000000000f1'),
  'approved', 'direct publish closes the pending request');
select is((select reviewed_by from public.approval_requests where target_form_id='c2300000-0000-4000-8000-0000000000f1'),
  'c2300000-0000-4000-8000-000000000001'::uuid, 'the publishing Super Admin is the reviewer');
select is((select count(*)::int from public.audit_log where action='request.approve'
  and target_id=(select id::text from public.approval_requests where target_form_id='c2300000-0000-4000-8000-0000000000f1')),
  1, 'the closed request is audited once');
select is((select review_note from public.approval_requests where target_form_id='c2300000-0000-4000-8000-0000000000f2'),
  'Looks good', 'Requests approval keeps its own note');
select is((select count(*)::int from public.audit_log where action='request.approve'
  and target_id=(select id::text from public.approval_requests where target_form_id='c2300000-0000-4000-8000-0000000000f2')),
  1, 'Requests approval is audited once');

-- The Co-Head can edit the published form again.
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2300000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select public.save_lounge_form(jsonb_build_object(
  'id','c2300000-0000-4000-8000-0000000000f1','title','Join Technical v2',
  'community_id',(select tech from tid),'published_at',now()))$$, 'Co-Head edits the published form');
reset role;

select * from finish();
rollback;

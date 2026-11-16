-- pgTAP: PANBS events and public registration (20261116104419_panbs_events, spec 007).
-- Synthetic identities only (ids start with c2000000, codes 99f967xxxx). Everything rolls back.
begin;
select no_plan();
select vault.create_secret(repeat('local-pgtap-only-',3),'blacklist_hash_pepper') where not exists(select 1 from vault.decrypted_secrets where name='blacklist_hash_pepper');

insert into public.members(id, member_code, email, region_id)
values ('c2000000-0000-4000-8000-000000000098', '99f9670098', '99f9670098@ds.study.iitm.ac.in', 1);
create temp table ct(k text primary key, id uuid, email text);
insert into ct values
 ('sa', 'c2000000-0000-4000-8000-000000000001', '99f9670001@ds.study.iitm.ac.in'),
 ('rc', 'c2000000-0000-4000-8000-000000000002', '99f9670002@ds.study.iitm.ac.in'),
 ('st', 'c2000000-0000-4000-8000-000000000003', '99f9670003@es.study.iitm.ac.in');
grant select on ct to authenticated;
insert into public.member_roster(email, region_id, added_by) select email, 1, 'c2000000-0000-4000-8000-000000000098' from ct;
-- On the roster, never signed up.
insert into public.member_roster(email, region_id, added_by) values ('99f9670077@ds.study.iitm.ac.in', 1, 'c2000000-0000-4000-8000-000000000098');
insert into auth.users(id, email, aud, role, raw_app_meta_data)
select id, email, 'authenticated', 'authenticated', '{"provider":"google"}'::jsonb from ct;
insert into public.super_admin_allowlist(user_id, label) select id, 'Test SA panbs' from ct where k = 'sa';
insert into public.admin_assignments(member_id, position, region_id, community_id, assigned_by)
select id, 'rc', 1, null, (select id from ct where k = 'sa') from ct where k = 'rc';

-- ── Event shape ────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$insert into public.events(name, region_id, panbs, is_public, starts_at, ends_at)
  values ('Regional PANBS', 1, true, true, now() + interval '1 day', now() + interval '2 days')$$,
  '23514', null, 'a PANBS event is house-wide');
select throws_ok($$insert into public.events(name, panbs, is_public, starts_at, ends_at)
  values ('Hidden PANBS', true, false, now() + interval '1 day', now() + interval '2 days')$$,
  '23514', null, 'a PANBS event is public');
select lives_ok($$insert into public.events(name, panbs, is_public, starts_at, ends_at, published_at)
  values ('Paradox quiz', true, true, now() + interval '1 day', now() + interval '2 days', now() - interval '1 minute')$$,
  'Super Admin publishes a PANBS event');
reset role;
-- Fixed ids for the rest of the file (authenticated cannot choose an event id).
update public.events set id = 'c2000000-0000-4000-8000-0000000000e1' where name = 'Paradox quiz';
insert into public.events(id, name, is_public, starts_at, ends_at, published_at, created_by, updated_by)
values ('c2000000-0000-4000-8000-0000000000e2', 'House night', true,
        now() + interval '1 day', now() + interval '2 days', now() - interval '1 minute',
        'c2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claims = '{"sub":"c2000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.save_lounge_form(jsonb_build_object(
  'id','c2000000-0000-4000-8000-0000000000f1','title','Paradox quiz signup',
  'event_id','c2000000-0000-4000-8000-0000000000e1','published_at',now() - interval '1 minute',
  'fields','[{"key":"name","label":"Name","type":"text","required":true,"prefill":"name"},
             {"key":"level","label":"Level","type":"select","options":["Foundation","Diploma","Degree"],"required":true}]'::jsonb))$$,
  'Super Admin publishes its registration form');
select lives_ok($$select public.save_lounge_form(jsonb_build_object(
  'id','c2000000-0000-4000-8000-0000000000f2','title','House night signup',
  'event_id','c2000000-0000-4000-8000-0000000000e2','published_at',now() - interval '1 minute'))$$,
  'a house event form');
reset role;

-- An RC drafts a PANBS event; publishing it goes through a Super Admin.
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$insert into public.events(name, panbs, is_public, starts_at, ends_at)
  values ('RC PANBS', true, true, now() + interval '1 day', now() + interval '2 days')$$,
  'RC drafts a PANBS event');
do $$ begin
  update public.events set published_at = now() where name = 'RC PANBS';
exception when others then null;
end $$;
select lives_ok($$select public.request_event_publish((select id from public.events where name = 'RC PANBS'))$$,
  'RC asks a Super Admin to publish it');
reset role;
select is((select published_at from public.events where name = 'RC PANBS'), null, 'RC cannot publish it directly');
create temp table draft as select id from public.events where name = 'RC PANBS';
grant select on draft to anon;

-- ── Anonymous visitor ──────────────────────────────────────────────────────
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select (x->>'panbs')::boolean and (x->>'registers')::boolean from jsonb_array_elements(public.list_public_events()) x
  where x->>'id' = 'c2000000-0000-4000-8000-0000000000e1'), true, 'public listing marks the PANBS event as registering');
select is((select (x->>'registers')::boolean from jsonb_array_elements(public.list_public_events()) x
  where x->>'id' = 'c2000000-0000-4000-8000-0000000000e2'), false, 'a house event does not take public registrations');
select is(public.get_panbs_form('c2000000-0000-4000-8000-0000000000e1')->>'id',
  'c2000000-0000-4000-8000-0000000000f1', 'visitor reads the PANBS form');
select is(public.get_panbs_form('c2000000-0000-4000-8000-0000000000e2'), null, 'no public form for a house event');
select is(public.get_panbs_form((select id from draft)), null, 'no public form for an unpublished draft');
select is(public.get_panbs_join_link('c2000000-0000-4000-8000-0000000000e1'), null, 'no join link a day before the start');

select throws_ok($$select public.submit_panbs_registration('c2000000-0000-4000-8000-0000000000f1',
  'someone@gmail.com','Someone','Gir',null,'{"level":"Degree"}')$$, '22023', null, 'personal email refused');
select throws_ok($$select public.submit_panbs_registration('c2000000-0000-4000-8000-0000000000f2',
  '21f1000001@ds.study.iitm.ac.in','Guest','Gir',null,'{}')$$, '42501', null, 'house-only form refuses visitors');
select throws_ok($$select public.submit_panbs_registration('c2000000-0000-4000-8000-0000000000f1',
  '21f1000001@ds.study.iitm.ac.in','Guest','Hogwarts',null,'{"level":"Degree"}')$$, '22023', null, 'unknown house refused');
select throws_ok($$select public.submit_panbs_registration('c2000000-0000-4000-8000-0000000000f1',
  '21f1000001@ds.study.iitm.ac.in','Guest','Gir',null,'{}')$$, '22023', null, 'required form field enforced');

select is(public.submit_panbs_registration('c2000000-0000-4000-8000-0000000000f1',
  ' 21F1000001@DS.study.iitm.ac.in ','Guest One','Nallamala','+919876543210','{"level":"Degree"}')->>'kind',
  'guest', 'other-house student registers as a guest');
select throws_ok($$select public.submit_panbs_registration('c2000000-0000-4000-8000-0000000000f1',
  '21f1000001@ds.study.iitm.ac.in','Guest One','Nallamala',null,'{"level":"Degree"}')$$, 'PT409', null, 'one registration per email');
select is(public.submit_panbs_registration('c2000000-0000-4000-8000-0000000000f1',
  '99f9670077@ds.study.iitm.ac.in','Roster Kid','Gir',null,'{"level":"Diploma"}')->>'house',
  'Sundarbans', 'a rostered student is filed under Sundarbans whatever they picked');
select is(public.submit_panbs_registration('c2000000-0000-4000-8000-0000000000f1',
  '99f9670003@es.study.iitm.ac.in','Member','Kanha',null,'{"level":"Foundation"}')->>'kind',
  'member', 'a signed-up member is filed as a member response');
select throws_ok($$select public.submit_panbs_registration('c2000000-0000-4000-8000-0000000000f1',
  '99f9670003@es.study.iitm.ac.in','Member','Kanha',null,'{"level":"Foundation"}')$$, 'PT409', null, 'member registers once');
select throws_ok($$select * from public.form_guest_responses$$, '42501', null, 'visitors cannot read guests');
select throws_ok($$select public.list_form_guests('c2000000-0000-4000-8000-0000000000f1')$$, '42501', null, 'visitors cannot list guests');
reset role;

select is((select answers->>'name' from public.form_guest_responses where email = '21f1000001@ds.study.iitm.ac.in'),
  'Guest One', 'name-prefill field takes the fixed name');
select is((select phone from public.form_guest_responses where email = '21f1000001@ds.study.iitm.ac.in'),
  '+919876543210', 'phone is normalised');
select is((select on_roster from public.form_guest_responses where email = '99f9670077@ds.study.iitm.ac.in'), true, 'roster flag kept');
select is((select count(*)::int from public.form_responses r join public.event_registrations g on g.response_id = r.id
  where r.form_id = 'c2000000-0000-4000-8000-0000000000f1' and r.member_id = 'c2000000-0000-4000-8000-000000000003'), 1,
  'member response and event registration written');

-- ── Admin reads ────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(jsonb_array_length(public.list_form_guests('c2000000-0000-4000-8000-0000000000f1')), 2, 'Super Admin lists both guests');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select public.list_form_guests('c2000000-0000-4000-8000-0000000000f1')$$, '42501', null, 'a student cannot list guests');
select is((select (x->>'submitted')::boolean from jsonb_array_elements(public.list_lounge_forms()) x
  where x->>'id' = 'c2000000-0000-4000-8000-0000000000f1'), true, 'the member sees the form as submitted in the Lounge');
reset role;

-- Inside the join window the link is public for PANBS, never for a house event.
update public.events set gmail_link = 'https://meet.google.com/aaa-bbbb-ccc', starts_at = now() - interval '5 minutes'
 where id in ('c2000000-0000-4000-8000-0000000000e1', 'c2000000-0000-4000-8000-0000000000e2');
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is(public.get_panbs_join_link('c2000000-0000-4000-8000-0000000000e1'), 'https://meet.google.com/aaa-bbbb-ccc', 'visitor gets the live PANBS link');
select is(public.get_panbs_join_link('c2000000-0000-4000-8000-0000000000e2'), null, 'house event link stays private');
reset role;

-- Hard delete removes guest rows too.
select lives_ok($$select private.delete_lounge_form_rows('c2000000-0000-4000-8000-0000000000f1')$$, 'form rows delete');
select is((select count(*)::int from public.form_guest_responses where form_id = 'c2000000-0000-4000-8000-0000000000f1'), 0, 'guests cascade');

select * from finish();
rollback;

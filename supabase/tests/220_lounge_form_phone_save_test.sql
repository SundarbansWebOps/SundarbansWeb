-- "Save your phone number for later" never blocks a form response: a number already on another
-- account is left unsaved and the response still goes in. Synthetic identities only; rolls back.
begin;
select no_plan();
select vault.create_secret(repeat('local-pgtap-only-',3),'blacklist_hash_pepper') where not exists(select 1 from vault.decrypted_secrets where name='blacklist_hash_pepper');

insert into public.members(id, member_code, email, region_id)
values ('fa720000-0000-4000-8000-000000000098', '99f7200098', '99f7200098@ds.study.iitm.ac.in', 1);
create temp table ps_people(id uuid, email text, full_name text, region_id smallint);
insert into ps_people values
 ('fa720000-0000-4000-8000-000000000001', '99f7200001@ds.study.iitm.ac.in', 'Phone super', 1),
 ('fa720000-0000-4000-8000-000000000002', '99f7200002@ds.study.iitm.ac.in', 'Phone holder', 1),
 ('fa720000-0000-4000-8000-000000000003', '99f7200003@ds.study.iitm.ac.in', 'Phone taker', 1),
 ('fa720000-0000-4000-8000-000000000004', '99f7200004@ds.study.iitm.ac.in', 'Phone fresh', 1);
insert into public.member_roster(email, full_name, region_id, added_by)
select email, full_name, region_id, 'fa720000-0000-4000-8000-000000000098' from ps_people;
insert into auth.users(id, email, aud, role, raw_app_meta_data)
select id, email, 'authenticated', 'authenticated', '{"provider":"google"}'::jsonb from ps_people;
insert into public.super_admin_allowlist(user_id, label) values ('fa720000-0000-4000-8000-000000000001', 'Phone fixture');
-- Another account already holds the number, as a student's second login would.
update public.members set phone='+919876500001' where id='fa720000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claims = '{"sub":"fa720000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.save_lounge_form(jsonb_build_object('id','fa721000-0000-4000-8000-000000000001','title','Phone form','region_id',1,'published_at',now() - interval '1 hour',
 'fields',jsonb_build_array(jsonb_build_object('key','name','label','Name','type','text','required',true),
  jsonb_build_object('key','phone','label','Phone','type','phone','prefill','phone','required',true))))$$, 'super admin saves a form with a phone question');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"fa720000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok($$select public.submit_lounge_form('fa721000-0000-4000-8000-000000000001','{"name":"Taker","phone":"+919876500001"}',true)$$,
 'a number taken by another account does not block the response');
reset role;
select is((select count(*)::int from public.form_responses where form_id='fa721000-0000-4000-8000-000000000001' and member_id='fa720000-0000-4000-8000-000000000003'), 1, 'the response is saved');
select is((select answers->>'phone' from public.form_responses where form_id='fa721000-0000-4000-8000-000000000001' and member_id='fa720000-0000-4000-8000-000000000003'), '+919876500001', 'the answer keeps the number');
select is((select phone from public.members where id='fa720000-0000-4000-8000-000000000003'), null, 'the taken number is not saved to the profile');
select is((select phone from public.members where id='fa720000-0000-4000-8000-000000000002'), '+919876500001', 'the holder keeps their number');

set local role authenticated;
set local request.jwt.claims = '{"sub":"fa720000-0000-4000-8000-000000000004","role":"authenticated"}';
select lives_ok($$select public.submit_lounge_form('fa721000-0000-4000-8000-000000000001','{"name":"Fresh","phone":"+919876500002"}',true)$$, 'a free number submits');
reset role;
select is((select phone from public.members where id='fa720000-0000-4000-8000-000000000004'), '+919876500002', 'a free number is saved to the profile');

select * from finish();
rollback;

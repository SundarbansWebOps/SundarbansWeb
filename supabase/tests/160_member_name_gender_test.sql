-- Synthetic identities only. Every fixture rolls back.
begin;
select no_plan();
select vault.create_secret(repeat('local-pgtap-only-',3),'blacklist_hash_pepper') where not exists(select 1 from vault.decrypted_secrets where name='blacklist_hash_pepper');

insert into public.members(id, member_code, email, full_name, gender, region_id, cohort)
values
 ('e1600000-0000-4000-8000-000000000001', '99f1960001', '99f1960001@ds.study.iitm.ac.in', null, null, 1, '99F1'),
 ('e1600000-0000-4000-8000-000000000002', '99f1960002', '99f1960002@ds.study.iitm.ac.in', 'Already Named', 'Female', 1, '99F1');

set local role authenticated;
set local request.jwt.claims = '{"sub":"e1600000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$update public.members set full_name = 'Direct Write' where id = 'e1600000-0000-4000-8000-000000000001'$$, '42501', null, 'A student cannot write full_name directly');
select throws_ok($$update public.members set gender = 'Male' where id = 'e1600000-0000-4000-8000-000000000001'$$, '42501', null, 'A student cannot write gender directly');
select lives_ok($$update public.members set preferred_name = 'Nick' where id = 'e1600000-0000-4000-8000-000000000001'$$, 'The preferred name is still direct');

select throws_ok($$select public.complete_my_profile(null, null)$$, '22023', 'Add your full name or gender', 'Nothing to save is refused');
select throws_ok($$select public.complete_my_profile('A', null)$$, '22023', 'Full name must be 2 to 200 characters', 'One letter is too short');
select throws_ok($$select public.complete_my_profile(null, 'F')$$, '22023', 'Choose Female or Male', 'Gender is a fixed choice');

select is((public.complete_my_profile('  Asha   Rani  Das ', null)).full_name, 'Asha Rani Das', 'The name is trimmed and single-spaced');
select is((select gender from public.members where id = 'e1600000-0000-4000-8000-000000000001'), null, 'Gender stays empty when not sent');
select is((public.complete_my_profile('Asha Rani Das', 'Female')).gender, 'Female', 'Gender fills later; the same name again is harmless');
select throws_ok($$select public.complete_my_profile('Someone Else', null)$$, 'PT409', 'Your full name is already set. Ask your Regional Coordinator to correct it.', 'A set name cannot be changed by the student');
select throws_ok($$select public.complete_my_profile(null, 'Male')$$, 'PT409', 'Your gender is already set. Ask your Regional Coordinator to correct it.', 'A set gender cannot be changed by the student');

set local request.jwt.claims = '{"sub":"e1600000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((public.complete_my_profile('Already Named', 'Female')).full_name, 'Already Named', 'Resending what is stored changes nothing');
reset role;
set local role anon;
select throws_ok($$select public.complete_my_profile('Anon Person', null)$$, '42501', null, 'Signed-out visitors cannot call it');
reset role;

select is((select count(*)::int from public.audit_log where action = 'member.self_profile' and target_id = 'e1600000-0000-4000-8000-000000000001'), 2, 'Each fill is audited once');
select is((select new_values from public.audit_log where action = 'member.self_profile' and target_id = 'e1600000-0000-4000-8000-000000000001' order by id limit 1), '{"full_name": "Asha Rani Das"}'::jsonb, 'The audit row holds only what was filled');
select is((select count(*)::int from public.audit_log where action = 'member.self_profile' and target_id = 'e1600000-0000-4000-8000-000000000002'), 0, 'A no-op writes no audit row');

select throws_ok($$update public.members set gender = 'M' where id = 'e1600000-0000-4000-8000-000000000002'$$, '23514', null, 'Members keep gender to Female or Male');
select throws_ok($$insert into public.member_roster(email, gender, region_id, added_by) values ('99f1960009@ds.study.iitm.ac.in', 'Other', 1, 'e1600000-0000-4000-8000-000000000002')$$, '23514', null, 'The roster keeps gender to Female or Male');

select * from finish();
rollback;

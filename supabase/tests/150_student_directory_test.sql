-- Synthetic identities only. Every fixture rolls back.
begin;
select no_plan();
select vault.create_secret(repeat('local-pgtap-only-',3),'blacklist_hash_pepper') where not exists(select 1 from vault.decrypted_secrets where name='blacklist_hash_pepper');

insert into public.members(id, member_code, email, full_name, region_id, cohort)
values
 ('e1500000-0000-4000-8000-000000000098', '99f1950098', '99f1950098@ds.study.iitm.ac.in', 'Directory adder', 1, '99F1'),
 ('e1500000-0000-4000-8000-000000000002', '99f1950002', '99f1950002@ds.study.iitm.ac.in', 'Directory coordinator', 1, '99F1'),
 ('e1500000-0000-4000-8000-000000000005', '99f1950005', '99f1950005@ds.study.iitm.ac.in', 'Directory signed in', 2, '99F1');

-- The allowlist references auth.users, so the Super Admin signs up through the roster claim.
insert into public.member_roster(email, full_name, region_id, added_by)
values ('99f1950001@ds.study.iitm.ac.in', 'Directory super', 1, 'e1500000-0000-4000-8000-000000000098');
insert into auth.users(id, email, aud, role, raw_app_meta_data)
values ('e1500000-0000-4000-8000-000000000001', '99f1950001@ds.study.iitm.ac.in', 'authenticated', 'authenticated', '{"provider":"google"}'::jsonb);
insert into public.super_admin_allowlist(user_id, label) values ('e1500000-0000-4000-8000-000000000001', 'Directory fixture');
insert into public.admin_assignments(member_id, position, region_id, community_id, assigned_by)
values ('e1500000-0000-4000-8000-000000000002', 'rc', 1, null, 'e1500000-0000-4000-8000-000000000001');

insert into private.student_directory(email, full_name, phone, term, region_id, gender)
values
 ('99f1950005@ds.study.iitm.ac.in', 'Directory signed in', '+919150000005', '99F1', 2, 'Female'),
 ('99f1950006@ds.study.iitm.ac.in', 'Asha Waiting', '+919150000006', '99F2', 1, 'Female'),
 ('99f1950007@ds.study.iitm.ac.in', 'Ravi 100% Sure', '+919150000007', '99F3', 3, 'Male');

-- A cleaned roster row: email and region only. First sign-in copies it, so no name or phone.
insert into public.member_roster(email, region_id, added_by)
values ('99f1950006@ds.study.iitm.ac.in', 1, 'e1500000-0000-4000-8000-000000000098');

-- Nobody but a Super Admin reads the table or the search.
set local role authenticated;
set local request.jwt.claims = '{"sub":"e1500000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.search_student_directory('asha')$$, '42501', 'Only a Super Admin can search the student directory', 'An RC cannot search');
select throws_ok($$select * from private.student_directory$$, '42501', null, 'An RC cannot read the table');
set local request.jwt.claims = '{"sub":"e1500000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select * from private.student_directory$$, '42501', null, 'A Super Admin cannot read the table directly either');
reset role;
set local role anon;
select throws_ok($$select public.search_student_directory('asha')$$, '42501', null, 'Signed-out visitors cannot call the search');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"e1500000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.search_student_directory('asha')->>'total', '1', 'Name matches ignore case');
select is(public.search_student_directory('ASHA')->'rows'->0->>'phone', '+919150000006', 'The row carries the phone');
select is(public.search_student_directory('asha')->'rows'->0->>'region_name', (select name from public.regions where id = 1), 'The row carries the region name');
select is(public.search_student_directory('asha')->'rows'->0->>'signed_in', 'false', 'A roster student is not signed in');
select is(public.search_student_directory('signed in')->'rows'->0->>'signed_in', 'true', 'A member is signed in');
select is(public.search_student_directory('99f1950007')->'rows'->0->>'full_name', 'Ravi 100% Sure', 'Email fragments match');
select is(public.search_student_directory('+91 91500 00006')->'rows'->0->>'email', '99f1950006@ds.study.iitm.ac.in', 'Spaced phone input matches the digits');
select is(public.search_student_directory('0000007')->>'total', '1', 'A phone fragment matches');
select is(public.search_student_directory('99f195')->>'total', '3', 'A shared prefix finds everyone');
select is(public.search_student_directory('00%')->>'total', '1', 'Percent is a plain character, not a wildcard');
select is(public.search_student_directory('nobody here')->'rows', '[]'::jsonb, 'No match is an empty list');
-- The live record sits beside the upload: the member row once signed in, else the roster row.
select is(public.search_student_directory('signed in')->'rows'->0->'live'->>'source', 'member', 'A signed-in student shows their member row');
select is(public.search_student_directory('signed in')->'rows'->0->'live'->>'term', '99F1', 'The member row carries the cohort as the term');
select is(public.search_student_directory('signed in')->'rows'->0->'live'->>'region_name', (select name from public.regions where id = 2), 'The member row carries the live region');
select is(public.search_student_directory('asha')->'rows'->0->'live'->>'source', 'roster', 'A roster student shows their roster row');
select is(public.search_student_directory('asha')->'rows'->0->'live'->>'full_name', null, 'The cleaned roster row has no name');
select is(public.search_student_directory('asha')->'rows'->0->>'full_name', 'Asha Waiting', 'The upload keeps the name');
select is(public.search_student_directory('ravi')->'rows'->0->'live', 'null'::jsonb, 'A student on neither has no live record');
select throws_ok($$select public.search_student_directory('as')$$, '22023', 'Type at least 3 characters', 'Two characters are too few');
select throws_ok($$select public.search_student_directory(null)$$, '22023', 'Type at least 3 characters', 'Null is too few');
reset role;

select is((select new_values->>'results' from public.audit_log where action = 'data.directory_search'
  and new_values->>'query' = 'nobody here' and actor_id = 'e1500000-0000-4000-8000-000000000001'), '0', 'An empty search is audited with its count');
select is((select actor_role from public.audit_log where action = 'data.directory_search' order by id desc limit 1), 'super_admin', 'The audit row names the role');
select is((select count(*)::int from public.audit_log where action = 'data.directory_search' and new_values->>'query' = 'as'), 0, 'A refused search writes no audit row');

-- The audit trail is the meter.
insert into public.audit_log(actor_id, action, target_table, target_id, new_values)
select 'e1500000-0000-4000-8000-000000000001', 'data.directory_search', 'student_directory', null, '{}'::jsonb from generate_series(1, 300);
set local role authenticated;
set local request.jwt.claims = '{"sub":"e1500000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.search_student_directory('asha')$$, '54000', 'Too many searches in the last hour. Try again later.', 'Searches are rate limited');
reset role;

-- First Google sign-in of a cleaned student creates a member without name or phone.
insert into auth.users(id, email, aud, role, raw_app_meta_data)
values ('e1500000-0000-4000-8000-000000000006', '99f1950006@ds.study.iitm.ac.in', 'authenticated', 'authenticated', '{"provider":"google"}'::jsonb);
select is((select full_name from public.members where id = 'e1500000-0000-4000-8000-000000000006'), null, 'A cleaned student signs in with no name');
select is((select phone from public.members where id = 'e1500000-0000-4000-8000-000000000006'), null, 'A cleaned student signs in with no phone');
select is((select region_id from public.members where id = 'e1500000-0000-4000-8000-000000000006'), 1::smallint, 'The region comes across');
select is((select full_name from private.student_directory where email = '99f1950006@ds.study.iitm.ac.in'), 'Asha Waiting', 'The directory row stays');

select * from finish();
rollback;

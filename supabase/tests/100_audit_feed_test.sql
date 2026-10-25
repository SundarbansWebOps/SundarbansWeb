-- Super Admin audit feed: actor_role/xact_id snapshots, audited exports, feed filters, keyset
-- paging and access. Synthetic identities only. Every fixture rolls back.
begin;
select no_plan();
select vault.create_secret(repeat('local-pgtap-only-',3),'blacklist_hash_pepper') where not exists(select 1 from vault.decrypted_secrets where name='blacklist_hash_pepper');

insert into public.members(id, member_code, email, region_id)
values ('ad1c0000-0000-4000-8000-000000000098', '99f1930098', '99f1930098@ds.study.iitm.ac.in', 1);
create temp table feed_people(id uuid, email text, full_name text);
insert into feed_people values
 ('ad1c0000-0000-4000-8000-000000000001', '99f1930001@ds.study.iitm.ac.in', 'Feed admin'),
 ('ad1c0000-0000-4000-8000-000000000002', '99f1930002@ds.study.iitm.ac.in', 'Feed coordinator'),
 ('ad1c0000-0000-4000-8000-000000000003', '99f1930003@ds.study.iitm.ac.in', 'Feed head'),
 ('ad1c0000-0000-4000-8000-000000000004', '99f1930004@ds.study.iitm.ac.in', 'Feed student'),
 ('ad1c0000-0000-4000-8000-000000000005', '99f1930005@ds.study.iitm.ac.in', 'Feed other');
insert into public.member_roster(email, full_name, region_id, added_by)
select email, full_name, 1, 'ad1c0000-0000-4000-8000-000000000098' from feed_people;
insert into auth.users(id, email, aud, role, raw_app_meta_data)
select id, email, 'authenticated', 'authenticated', '{"provider":"google"}'::jsonb from feed_people;
insert into public.super_admin_allowlist(user_id, label) values ('ad1c0000-0000-4000-8000-000000000001', 'Feed fixture');
insert into public.admin_assignments(member_id, position, region_id, community_id, assigned_by)
values ('ad1c0000-0000-4000-8000-000000000002', 'rc', 1, null, 'ad1c0000-0000-4000-8000-000000000001'),
 ('ad1c0000-0000-4000-8000-000000000003', 'head', null, 1, 'ad1c0000-0000-4000-8000-000000000001');

insert into public.events(id, name, starts_at, ends_at, created_by, updated_by)
values ('ad1c0000-0000-4000-8000-0000000000e1', 'Feed event', now(), now() + interval '1 day',
 'ad1c0000-0000-4000-8000-000000000001', 'ad1c0000-0000-4000-8000-000000000001');
insert into public.announcements(id, title, body, created_by)
values ('ad1c0000-0000-4000-8000-0000000000a1', 'Feed notice', 'Body', 'ad1c0000-0000-4000-8000-000000000001');
insert into public.lounge_forms(id, title, created_by)
values ('ad1c0000-0000-4000-8000-0000000000f1', 'Feed form', 'ad1c0000-0000-4000-8000-000000000001');
insert into public.form_responses(id, form_id, member_id, submitted_email, field_schema, answers)
values ('ad1c0000-0000-4000-8000-0000000000b1', 'ad1c0000-0000-4000-8000-0000000000f1', 'ad1c0000-0000-4000-8000-000000000004',
 '99f1930004@ds.study.iitm.ac.in', '[]', '{"secret":"ANSWER-XYZ"}');
insert into public.member_region_requests(id, member_id, from_region_id, to_region_id, reason)
values ('ad1c0000-0000-4000-8000-0000000000c1', 'ad1c0000-0000-4000-8000-000000000005', 1, 2, 'Moving');
insert into public.certificate_name_requests(id, member_id, new_name, reason)
values ('ad1c0000-0000-4000-8000-0000000000d1', 'ad1c0000-0000-4000-8000-000000000005', 'Feed Other Name', 'Spelling');

-- ── Schema ──────────────────────────────────────────────────────────────────
select has_column('public', 'audit_log', 'actor_role', 'audit_log has actor_role');
select has_column('public', 'audit_log', 'xact_id', 'audit_log has xact_id');
select col_default_is('public', 'audit_log', 'xact_id', '((pg_current_xact_id())::text)::bigint', 'xact_id defaults to the writing transaction');
select ok(not exists(select 1 from pg_indexes where schemaname='public' and indexname='audit_log_created_at_idx'), 'created_at-only index replaced');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='audit_log_created_at_id_idx'), 'feed order index exists');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='audit_log_action_idx'), 'action prefix index exists');
select throws_ok($$insert into public.audit_log(action, actor_role) values ('feed.bad_role', 'owner')$$, '23514', null, 'actor_role rejects unknown roles');

-- ── write_audit records the role at write time ─────────────────────────────
create temp table ids(k text primary key, id bigint);
set local request.jwt.claims = '{"sub":"ad1c0000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into ids values
 ('sa', private.write_audit('member.feedtest', 'members', 'ad1c0000-0000-4000-8000-000000000004', '{"phone":"111"}', '{"phone":"222"}')),
 ('cert', private.write_audit('certificate_name.review', 'certificate_name_requests', 'ad1c0000-0000-4000-8000-0000000000d1')),
 ('event', private.write_audit('events.update', 'events', 'ad1c0000-0000-4000-8000-0000000000e1')),
 ('notice', private.write_audit('notice.save', 'announcements', 'ad1c0000-0000-4000-8000-0000000000a1')),
 ('form', private.write_audit('form.save', 'lounge_forms', 'ad1c0000-0000-4000-8000-0000000000f1')),
 ('response', private.write_audit('form.review', 'form_responses', 'ad1c0000-0000-4000-8000-0000000000b1')),
 ('noresponse', private.write_audit('form.review', 'form_responses', 'ad1c0000-0000-4000-8000-0000000000b9')),
 ('region', private.write_audit('feed.region', 'regions', '1')),
 ('bad', private.write_audit('member.feedtest', 'members', 'not-a-uuid', null, null, null, 'failure')),
 ('badregion', private.write_audit('feed.region', 'regions', '99999999999')),
 ('roster', private.write_audit('roster.add', 'member_roster', '99f1930077@ds.study.iitm.ac.in')),
 ('wild', private.write_audit('regionxrequest.test'));
set local request.jwt.claims = '{"sub":"ad1c0000-0000-4000-8000-000000000002","role":"authenticated"}';
insert into ids values ('rc', private.write_audit('region_request.review', 'member_region_requests', 'ad1c0000-0000-4000-8000-0000000000c1'));
set local request.jwt.claims = '{"sub":"ad1c0000-0000-4000-8000-000000000003","role":"authenticated"}';
insert into ids values ('head', private.write_audit('form.review', 'form_responses', 'ad1c0000-0000-4000-8000-0000000000b1'));
set local request.jwt.claims = '{"sub":"ad1c0000-0000-4000-8000-000000000004","role":"authenticated"}';
insert into ids values ('member', private.write_audit('member.group_forms_hidden', 'members', 'ad1c0000-0000-4000-8000-000000000004'));
set local request.jwt.claims = '';
insert into ids values ('system', private.write_audit('feed.system'));
insert into ids values ('svc', private.write_audit('feed.service', null, null, null, null, null, 'success', 'ad1c0000-0000-4000-8000-000000000002'));
do $$ begin perform set_config('app.actor_id', 'ad1c0000-0000-4000-8000-000000000003', true); end $$;
insert into ids values ('bound', private.write_audit('feed.bound'));
do $$ begin perform set_config('app.actor_id', '', true); end $$;

select is((select actor_role from public.audit_log where id=(select id from ids where k='sa')), 'super_admin', 'Super Admin session records super_admin');
select is((select actor_role from public.audit_log where id=(select id from ids where k='rc')), 'rc', 'RC session records rc');
select is((select actor_role from public.audit_log where id=(select id from ids where k='head')), 'head', 'Head session records head');
select is((select actor_role from public.audit_log where id=(select id from ids where k='member')), 'member', 'member session records member');
select is((select actor_role from public.audit_log where id=(select id from ids where k='system')), 'system', 'no actor records system');
select is((select actor_id::text || '/' || actor_role from public.audit_log where id=(select id from ids where k='svc')),
 'ad1c0000-0000-4000-8000-000000000002/rc', 'service path p_actor_id records that actor and role');
select is((select actor_id::text || '/' || actor_role from public.audit_log where id=(select id from ids where k='bound')),
 'ad1c0000-0000-4000-8000-000000000003/head', 'bound app.actor_id records that actor and role');
select is((select xact_id from public.audit_log where id=(select id from ids where k='sa')), pg_current_xact_id()::text::bigint, 'xact_id is the writing transaction');
select is((select count(distinct xact_id)::int from public.audit_log where id in (select id from ids)), 1, 'rows from one transaction share xact_id');
select throws_ok($$update public.audit_log set actor_role='system' where id=(select id from ids where k='sa')$$, '42501', null, 'audit_log stays append-only (update)');
select throws_ok($$delete from public.audit_log where id=(select id from ids where k='sa')$$, '42501', null, 'audit_log stays append-only (delete)');

-- ── Privileges ──────────────────────────────────────────────────────────────
select ok(has_function_privilege('authenticated', 'public.admin_audit_feed(text[],text[],uuid,uuid,text,text,timestamptz,timestamptz,text,timestamptz,bigint,int)', 'execute'), 'authenticated may call the feed');
select ok(not has_function_privilege('anon', 'public.admin_audit_feed(text[],text[],uuid,uuid,text,text,timestamptz,timestamptz,text,timestamptz,bigint,int)', 'execute'), 'anon may not call the feed');
select ok(not has_function_privilege('service_role', 'public.admin_audit_feed(text[],text[],uuid,uuid,text,text,timestamptz,timestamptz,text,timestamptz,bigint,int)', 'execute'), 'service_role may not call the feed');
select ok(not exists(select 1 from pg_proc p, aclexplode(p.proacl) x where p.oid in ('public.admin_audit_feed(text[],text[],uuid,uuid,text,text,timestamptz,timestamptz,text,timestamptz,bigint,int)'::regprocedure,
 'public.export_form_responses(uuid)'::regprocedure, 'public.export_event_records(uuid)'::regprocedure, 'private.write_audit(text,text,text,jsonb,jsonb,uuid,text,uuid)'::regprocedure) and x.grantee = 0), 'no PUBLIC execute grant on new or changed functions');
select ok(not has_function_privilege('authenticated', 'private.write_audit(text,text,text,jsonb,jsonb,uuid,text,uuid)', 'execute'), 'authenticated still cannot call write_audit');
select ok(not has_function_privilege('anon', 'private.write_audit(text,text,text,jsonb,jsonb,uuid,text,uuid)', 'execute'), 'anon still cannot call write_audit');
select ok(has_function_privilege('service_role', 'private.write_audit(text,text,text,jsonb,jsonb,uuid,text,uuid)', 'execute'), 'service_role keeps write_audit');
select ok(has_function_privilege('authenticated', 'public.export_form_responses(uuid)', 'execute') and has_function_privilege('authenticated', 'public.export_event_records(uuid)', 'execute'), 'authenticated keeps the exports');
select ok(not has_function_privilege('anon', 'public.export_form_responses(uuid)', 'execute') and not has_function_privilege('service_role', 'public.export_event_records(uuid)', 'execute'), 'anon and service_role still lack the exports');
select is((select string_agg(proname || ':' || provolatile::text || ':' || prosecdef::text || ':' || array_to_string(proconfig, ','), ' ' order by proname) from pg_proc
 where oid in ('public.admin_audit_feed(text[],text[],uuid,uuid,text,text,timestamptz,timestamptz,text,timestamptz,bigint,int)'::regprocedure,
 'public.export_form_responses(uuid)'::regprocedure, 'public.export_event_records(uuid)'::regprocedure, 'private.write_audit(text,text,text,jsonb,jsonb,uuid,text,uuid)'::regprocedure)),
 'admin_audit_feed:s:true:search_path="" export_event_records:v:true:search_path="" export_form_responses:v:true:search_path="" write_audit:v:true:search_path=""',
 'definer, empty search_path; feed stable, exports volatile');

-- ── Access ──────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"ad1c0000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.admin_audit_feed()$$, '42501', null, 'RC cannot read the feed');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"ad1c0000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select public.admin_audit_feed()$$, '42501', null, 'member cannot read the feed');
reset role;
set local role anon;
select throws_ok($$select public.admin_audit_feed()$$, '42501', null, 'anon has no execute grant');
reset role;
set local role service_role;
select throws_ok($$select public.admin_audit_feed()$$, '42501', null, 'service_role has no execute grant');
reset role;
update public.members set account_status = 'suspended' where id = 'ad1c0000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"ad1c0000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.admin_audit_feed()$$, '42501', null, 'suspended Super Admin cannot read the feed');
reset role;
update public.members set account_status = 'active' where id = 'ad1c0000-0000-4000-8000-000000000001';

-- ── Feed as Super Admin ─────────────────────────────────────────────────────
grant select on ids to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"ad1c0000-0000-4000-8000-000000000001","role":"authenticated"}';
create temp view f_sa as select r from jsonb_array_elements(public.admin_audit_feed(p_actor=>'ad1c0000-0000-4000-8000-000000000001', p_limit=>100)->'rows') r;

select is((select array_agg(k order by k) from jsonb_object_keys(public.admin_audit_feed(p_limit=>1)->'rows'->0) k),
 array['action','actor_code','actor_id','actor_name','actor_role','created_at','id','new_values','old_values','request_id','result',
       'subject_code','subject_id','subject_name','target_id','target_label','target_table','xact_id'], 'row carries every contract key');
select is(jsonb_array_length(public.admin_audit_feed(p_actor=>'ad1c0000-0000-4000-8000-000000000001', p_limit=>100)->'rows'),
 (select count(*)::int from public.audit_log where actor_id='ad1c0000-0000-4000-8000-000000000001'), 'p_actor returns every row by that actor');
select ok(public.admin_audit_feed(p_actor=>'ad1c0000-0000-4000-8000-000000000001', p_limit=>100)->'next' = 'null'::jsonb, 'next is null when nothing more exists');

select is((select r from f_sa where (r->>'id')::bigint=(select id from ids where k='sa')) - 'created_at' - 'xact_id' - 'id',
 jsonb_build_object('action','member.feedtest','result','success','actor_id','ad1c0000-0000-4000-8000-000000000001','actor_name','Feed admin',
  'actor_code','99f1930001','actor_role','super_admin','target_table','members','target_id','ad1c0000-0000-4000-8000-000000000004',
  'target_label','Feed student','subject_id','ad1c0000-0000-4000-8000-000000000004','subject_name','Feed student','subject_code','99f1930004',
  'request_id',null,'old_values','{"phone":"111"}'::jsonb,'new_values','{"phone":"222"}'::jsonb),
 'member target row: names, role, subject and full unmasked values');
select is((select r->>'target_label' from f_sa where (r->>'id')::bigint=(select id from ids where k='event')), 'Feed event', 'event label is the event name');
select is((select r->>'target_label' from f_sa where (r->>'id')::bigint=(select id from ids where k='notice')), 'Feed notice', 'notice label is the title');
select is((select r->>'target_label' from f_sa where (r->>'id')::bigint=(select id from ids where k='form')), 'Feed form', 'form label is the title');
select is((select r->>'target_label' from f_sa where (r->>'id')::bigint=(select id from ids where k='response')), 'Feed form', 'response label is its form title');
select is((select r->'target_label' from f_sa where (r->>'id')::bigint=(select id from ids where k='noresponse')), 'null'::jsonb, 'missing response yields a null label');
select is((select r->>'target_label' from f_sa where (r->>'id')::bigint=(select id from ids where k='region')), (select name from public.regions where id=1), 'region label is the region name');
select is((select (r->'target_label') || (r->'subject_id') from f_sa where (r->>'id')::bigint=(select id from ids where k='bad')), '[null, null]'::jsonb, 'non-uuid member target yields null label and subject');
select is((select r->'target_label' from f_sa where (r->>'id')::bigint=(select id from ids where k='badregion')), 'null'::jsonb, 'out-of-range region id yields a null label');
select is((select (r->'target_label') || (r->'subject_id') from f_sa where (r->>'id')::bigint=(select id from ids where k='roster')), '[null, null]'::jsonb, 'roster email target yields null label and subject');
select is((select r->>'subject_name' from f_sa where (r->>'id')::bigint=(select id from ids where k='cert')), 'Feed other', 'certificate request resolves its member');

-- Filters
select is((select array_agg(distinct r->>'action') from jsonb_array_elements(public.admin_audit_feed(p_actions=>array['region_request.review'], p_limit=>100)->'rows') r), array['region_request.review'], 'p_actions matches exact names');
select ok(exists(select 1 from jsonb_array_elements(public.admin_audit_feed(p_prefixes=>array['region_request'], p_limit=>100)->'rows') r where (r->>'id')::bigint=(select id from ids where k='rc'))
 and not exists(select 1 from jsonb_array_elements(public.admin_audit_feed(p_prefixes=>array['region_request'], p_limit=>100)->'rows') r where r->>'action'='regionxrequest.test'),
 'p_prefixes matches the prefix and escapes the underscore wildcard');
select is((select array_agg(distinct r->>'action' order by r->>'action') from jsonb_array_elements(public.admin_audit_feed(p_actions=>array['feed.system'], p_prefixes=>array['certificate_name'], p_limit=>100)->'rows') r),
 array['certificate_name.review','feed.system'], 'p_actions and p_prefixes OR together');
select is(jsonb_array_length(public.admin_audit_feed(p_actions=>'{}', p_actor=>'ad1c0000-0000-4000-8000-000000000001', p_limit=>100)->'rows'),
 (select count(*)::int from public.audit_log where actor_id='ad1c0000-0000-4000-8000-000000000001'), 'empty action list means no action filter');
select is((select array_agg((r->>'id')::bigint order by (r->>'id')::bigint) from jsonb_array_elements(public.admin_audit_feed(p_role=>'rc', p_from=>now(), p_limit=>100)->'rows') r),
 (select array_agg(id order by id) from ids where k in ('rc','svc')), 'p_role filters by the stored role');
select is((select array_agg((r->>'id')::bigint) from jsonb_array_elements(public.admin_audit_feed(p_actor=>'ad1c0000-0000-4000-8000-000000000001', p_result=>'failure')->'rows') r),
 (select array_agg(id) from ids where k='bad'), 'p_result filters failures');
select is(jsonb_array_length(public.admin_audit_feed(p_actor=>'ad1c0000-0000-4000-8000-000000000001', p_from=>now(), p_limit=>100)->'rows'),
 (select count(*)::int from public.audit_log where actor_id='ad1c0000-0000-4000-8000-000000000001'), 'p_from is inclusive');
select is(jsonb_array_length(public.admin_audit_feed(p_actor=>'ad1c0000-0000-4000-8000-000000000001', p_to=>now())->'rows'), 0, 'p_to is exclusive');
select ok((select array_agg((r->>'id')::bigint) from jsonb_array_elements(public.admin_audit_feed(p_member=>'ad1c0000-0000-4000-8000-000000000004', p_from=>now(), p_limit=>100)->'rows') r) @> (select array_agg(id) from ids where k in ('sa','head','member'))
 and not ((select array_agg((r->>'id')::bigint) from jsonb_array_elements(public.admin_audit_feed(p_member=>'ad1c0000-0000-4000-8000-000000000004', p_from=>now(), p_limit=>100)->'rows') r) && (select array_agg(id) from ids where k in ('rc','cert','event','system'))), 'p_member matches actor, member target and form response subject');
select ok((select array_agg((r->>'id')::bigint) from jsonb_array_elements(public.admin_audit_feed(p_member=>'ad1c0000-0000-4000-8000-000000000005', p_from=>now(), p_limit=>100)->'rows') r) @> (select array_agg(id) from ids where k in ('rc','cert'))
 and not ((select array_agg((r->>'id')::bigint) from jsonb_array_elements(public.admin_audit_feed(p_member=>'ad1c0000-0000-4000-8000-000000000005', p_from=>now(), p_limit=>100)->'rows') r) && (select array_agg(id) from ids where k in ('sa','head','member','event'))), 'p_member resolves region and certificate requests');
select ok((select array_agg((r->>'id')::bigint) from jsonb_array_elements(public.admin_audit_feed(p_q=>'  feed COORD ', p_from=>now(), p_limit=>100)->'rows') r) @> (select array_agg(id) from ids where k in ('rc','svc'))
 and not ((select array_agg((r->>'id')::bigint) from jsonb_array_elements(public.admin_audit_feed(p_q=>'  feed COORD ', p_from=>now(), p_limit=>100)->'rows') r) && (select array_agg(id) from ids where k in ('sa','head','member','system'))), 'p_q matches actor name case-insensitively');
select ok((select array_agg((r->>'id')::bigint) from jsonb_array_elements(public.admin_audit_feed(p_q=>'99f1930005', p_from=>now(), p_limit=>100)->'rows') r) @> (select array_agg(id) from ids where k in ('rc','cert'))
 and not ((select array_agg((r->>'id')::bigint) from jsonb_array_elements(public.admin_audit_feed(p_q=>'99f1930005', p_from=>now(), p_limit=>100)->'rows') r) && (select array_agg(id) from ids where k in ('sa','head','member','system'))), 'p_q matches subject member code');
select is((select array_agg((r->>'id')::bigint) from jsonb_array_elements(public.admin_audit_feed(p_q=>'99F1930077@ds.study.iitm.ac.in')->'rows') r),
 (select array_agg(id) from ids where k='roster'), 'p_q matches an exact target id');
select is(jsonb_array_length(public.admin_audit_feed(p_q=>'%', p_actor=>'ad1c0000-0000-4000-8000-000000000001')->'rows'), 0, 'p_q escapes %');
select is(jsonb_array_length(public.admin_audit_feed(p_q=>'_', p_actor=>'ad1c0000-0000-4000-8000-000000000001')->'rows'), 0, 'p_q escapes _');
select is(jsonb_array_length(public.admin_audit_feed(p_q=>'ANSWER', p_actor=>'ad1c0000-0000-4000-8000-000000000001')->'rows'), 0, 'p_q does not search payload JSON');

-- Paging
select is(jsonb_array_length(public.admin_audit_feed(p_limit=>0)->'rows'), 1, 'p_limit clamps up to 1');
select is(jsonb_array_length(public.admin_audit_feed(p_limit=>1000)->'rows'), least(100, (select count(*)::int from public.audit_log)), 'p_limit clamps down to 100');
select is(jsonb_array_length(public.admin_audit_feed(p_limit=>null)->'rows'), least(50, (select count(*)::int from public.audit_log)), 'null p_limit means 50');
select throws_ok($$select public.admin_audit_feed(p_before_at=>now())$$, '22023', null, 'half a cursor is rejected');
select throws_ok($$select public.admin_audit_feed(p_role=>'owner')$$, '22023', null, 'unknown role filter is rejected');
select throws_ok($$select public.admin_audit_feed(p_result=>'maybe')$$, '22023', null, 'unknown result filter is rejected');
with recursive pages(n, res) as (
  select 1, public.admin_audit_feed(p_actor=>'ad1c0000-0000-4000-8000-000000000001', p_limit=>4)
  union all
  select n + 1, public.admin_audit_feed(p_actor=>'ad1c0000-0000-4000-8000-000000000001', p_limit=>4,
    p_before_at=>(res->'next'->>'at')::timestamptz, p_before_id=>(res->'next'->>'id')::bigint)
  from pages where res->'next' <> 'null'::jsonb and n < 20)
select is((select array_agg((e.r->>'id')::bigint order by p.n, e.ord) from pages p, jsonb_array_elements(p.res->'rows') with ordinality e(r, ord)),
 (select array_agg(id order by created_at desc, id desc) from public.audit_log where actor_id='ad1c0000-0000-4000-8000-000000000001'),
 'keyset pages cover every row once, newest first, across created_at ties');
select ok((public.admin_audit_feed(p_actor=>'ad1c0000-0000-4000-8000-000000000001', p_limit=>4)->'rows'->3->'id')
 = (public.admin_audit_feed(p_actor=>'ad1c0000-0000-4000-8000-000000000001', p_limit=>4)->'next'->'id'), 'next points at the last returned row');

-- Dashboard overview audit read still works
select ok(jsonb_array_length(public.admin_dashboard_summary()->'audit') between 1 and 6, 'dashboard audit preview still reads');

-- ── Audited exports ─────────────────────────────────────────────────────────
select lives_ok($$select public.export_form_responses('ad1c0000-0000-4000-8000-0000000000f1')$$, 'Super Admin exports form responses');
select is((select new_values from public.audit_log where action='data.export' and target_table='lounge_forms' and target_id='ad1c0000-0000-4000-8000-0000000000f1' order by id desc limit 1),
 '{"rows":1}'::jsonb, 'form export audit carries only the row count');
select is((select actor_role from public.audit_log where action='data.export' and target_id='ad1c0000-0000-4000-8000-0000000000f1' order by id desc limit 1), 'super_admin', 'export audit records the role');
select lives_ok($$select public.export_event_records('ad1c0000-0000-4000-8000-0000000000e1')$$, 'Super Admin exports event records');
select is((select new_values from public.audit_log where action='data.export' and target_table='events' and target_id='ad1c0000-0000-4000-8000-0000000000e1' order by id desc limit 1),
 '{"rows":0,"attendance_rows":0}'::jsonb, 'event export audit carries only counts');
select is((select r->>'target_label' from jsonb_array_elements(public.admin_audit_feed(p_actions=>array['data.export'])->'rows') r where r->>'target_table'='lounge_forms' limit 1), 'Feed form', 'export rows show in the feed with a label');
select ok(not exists(select 1 from public.audit_log where action='data.export' and (new_values::text like '%ANSWER-XYZ%' or new_values::text like '%@%')), 'export audit never holds answers or emails');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"ad1c0000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok($$select public.export_form_responses('ad1c0000-0000-4000-8000-0000000000f1')$$, '42501', null, 'member still cannot export responses');
select throws_ok($$select public.export_event_records('ad1c0000-0000-4000-8000-0000000000e1')$$, '42501', null, 'member still cannot export event records');
reset role;
select is((select count(*)::int from public.audit_log where action='data.export' and actor_id='ad1c0000-0000-4000-8000-000000000005'), 0, 'a refused export writes no audit row');

-- ── Names: full name, else Lounge name, else email ─────────────────────────
update public.members set full_name = null, preferred_name = 'Feed lounge' where id = 'ad1c0000-0000-4000-8000-000000000002';
update public.members set full_name = null, preferred_name = null where id = 'ad1c0000-0000-4000-8000-000000000005';
set local role authenticated;
set local request.jwt.claims = '{"sub":"ad1c0000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select array_agg(distinct r->>'actor_name') from jsonb_array_elements(public.admin_audit_feed(p_actor=>'ad1c0000-0000-4000-8000-000000000002', p_limit=>100)->'rows') r),
 array['Feed lounge'], 'an actor with no full name shows their Lounge name, not Former member');
select is((select r->>'subject_name' from jsonb_array_elements(public.admin_audit_feed(p_limit=>100)->'rows') r where (r->>'id')::bigint=(select id from ids where k='cert')),
 '99f1930005@ds.study.iitm.ac.in', 'a subject with no name at all shows their email');
select ok((select array_agg((r->>'id')::bigint) from jsonb_array_elements(public.admin_audit_feed(p_q=>'feed LOUNGE', p_from=>now(), p_limit=>100)->'rows') r) @> (select array_agg(id) from ids where k in ('rc','svc')),
 'p_q matches the Lounge name');
select ok((select array_agg((r->>'id')::bigint) from jsonb_array_elements(public.admin_audit_feed(p_q=>'99f1930005@ds', p_from=>now(), p_limit=>100)->'rows') r) @> (select array_agg(id) from ids where k='cert'),
 'p_q matches part of an email');
reset role;

select * from finish();
rollback;

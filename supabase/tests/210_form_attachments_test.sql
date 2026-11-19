-- pgTAP: form attachments (20261119120000): banner, file/section/page_break fields, upload start
-- checks, submit attaching ready files, manager-only view target, sweep and hard delete.
-- Synthetic identities only (ids start with c2100000, codes 99f967xxxx). Everything rolls back.
begin;
select no_plan();
select vault.create_secret(repeat('local-pgtap-only-',3),'blacklist_hash_pepper') where not exists(select 1 from vault.decrypted_secrets where name='blacklist_hash_pepper');

insert into public.members(id, member_code, email, region_id)
values ('c2100000-0000-4000-8000-000000000098', '99f9670098', '99f9670098@ds.study.iitm.ac.in', 1);
create temp table ct(k text primary key, id uuid, email text, region smallint);
insert into ct values
 ('sa',  'c2100000-0000-4000-8000-000000000001', '99f9670001@ds.study.iitm.ac.in', 1),
 ('rc',  'c2100000-0000-4000-8000-000000000002', '99f9670002@ds.study.iitm.ac.in', 1),
 ('st1', 'c2100000-0000-4000-8000-000000000003', '99f9670003@ds.study.iitm.ac.in', 1),
 ('st2', 'c2100000-0000-4000-8000-000000000004', '99f9670004@ds.study.iitm.ac.in', 1),
 ('far', 'c2100000-0000-4000-8000-000000000005', '99f9670005@ds.study.iitm.ac.in', 2),
 ('st4', 'c2100000-0000-4000-8000-000000000006', '99f9670006@ds.study.iitm.ac.in', 1);
grant select on ct to authenticated;
insert into public.member_roster(email, region_id, added_by) select email, region, 'c2100000-0000-4000-8000-000000000098' from ct;
insert into auth.users(id, email, aud, role, raw_app_meta_data)
select id, email, 'authenticated', 'authenticated', '{"provider":"google"}'::jsonb from ct;
insert into public.super_admin_allowlist(user_id, label) select id, 'Test SA attachments' from ct where k = 'sa';
insert into public.admin_assignments(member_id, position, region_id, community_id, assigned_by)
select id, 'rc', 1, null, (select id from ct where k = 'sa') from ct where k = 'rc';
-- File ids made during the test, by label.
create temp table ff(k text primary key, id uuid);
grant select on ff to authenticated;
grant select, insert on ff to service_role;

-- ── Field validation and banner ─────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2100000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.save_lounge_form(jsonb_build_object('id','c2100000-0000-4000-8000-0000000000f1','title','Camp sign-up','region_id',1,
 'published_at',now() - interval '1 hour','banner_url','https://res.cloudinary.com/l59gy0g2/image/upload/v1/sundarbans/forms/x.png','banner_alt','Camp',
 'fields','[{"key":"name","label":"Name","type":"text"},
  {"key":"proof","label":"Payment proof","type":"file","required":true,"accept":"image","max_files":2},
  {"key":"s_info","label":"About you","type":"section","description":"Tell us more"},
  {"key":"p_2","label":"Page 2","type":"page_break"},
  {"key":"doc","label":"Resume","type":"file","accept":"pdf","max_files":1,"description":"PDF only"}]'::jsonb))$$,
 'a form with file, section and page_break fields saves');
select is((select banner_url || '|' || banner_alt from public.lounge_forms where id='c2100000-0000-4000-8000-0000000000f1'),
 'https://res.cloudinary.com/l59gy0g2/image/upload/v1/sundarbans/forms/x.png|Camp', 'the banner is stored');
select lives_ok($$select public.save_lounge_form(jsonb_build_object('id','c2100000-0000-4000-8000-0000000000f1','title','Camp sign-up','region_id',1,
 'published_at',(select published_at from public.lounge_forms where id='c2100000-0000-4000-8000-0000000000f1'),
 'fields',(select fields from public.lounge_forms where id='c2100000-0000-4000-8000-0000000000f1')))$$, 'a save that omits the banner');
select is((select banner_alt from public.lounge_forms where id='c2100000-0000-4000-8000-0000000000f1'), 'Camp', 'keeps the stored banner');
select lives_ok($$select public.save_lounge_form_banner('c2100000-0000-4000-8000-0000000000f1',
 'https://res.cloudinary.com/l59gy0g2/image/upload/v1/sundarbans/forms/replacement.png','Updated alt')$$,
 'a banner-only save updates the existing form');
select ok((select published_at is not null and title='Camp sign-up' and jsonb_array_length(fields)=5 and banner_alt='Updated alt'
 from public.lounge_forms where id='c2100000-0000-4000-8000-0000000000f1'), 'a banner-only save keeps the publication and questions');
select throws_ok($$select public.save_lounge_form_banner('c2100000-0000-4000-8000-0000000000f9',null)$$,
 'P0002', null, 'a banner-only save cannot recreate a missing form');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c2100000-0000-4000-8000-0000000000f9','title','x','region_id',1,'banner_url','https://example.com/a.png'))$$,
 '23514', null, 'a non-Cloudinary banner is refused');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c2100000-0000-4000-8000-0000000000f9','title','x','region_id',1,'banner_alt',repeat('a',301)))$$,
 '23514', null, 'banner alt text is capped');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c2100000-0000-4000-8000-0000000000f9','title','x','region_id',1,
 'fields','[{"key":"a","label":"A","type":"file","max_files":1}]'::jsonb))$$, '22023', null, 'file needs accept');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c2100000-0000-4000-8000-0000000000f9','title','x','region_id',1,
 'fields','[{"key":"a","label":"A","type":"file","accept":"video","max_files":1}]'::jsonb))$$, '22023', null, 'file accept must be image, pdf or any');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c2100000-0000-4000-8000-0000000000f9','title','x','region_id',1,
 'fields','[{"key":"a","label":"A","type":"file","accept":"any","max_files":11}]'::jsonb))$$, '22023', null, 'max_files above 10 is refused');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c2100000-0000-4000-8000-0000000000f9','title','x','region_id',1,
 'fields','[{"key":"a","label":"A","type":"file","accept":"any","max_files":0}]'::jsonb))$$, '22023', null, 'max_files below 1 is refused');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c2100000-0000-4000-8000-0000000000f9','title','x','region_id',1,
 'fields','[{"key":"a","label":"A","type":"file","accept":"any","max_files":"3"}]'::jsonb))$$, '22023', null, 'max_files must be a number');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c2100000-0000-4000-8000-0000000000f9','title','x','region_id',1,
 'fields','[{"key":"a","label":"A","type":"text"},{"key":"s","label":"S","type":"section","required":true}]'::jsonb))$$, '22023', null, 'a section cannot be required');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c2100000-0000-4000-8000-0000000000f9','title','x','region_id',1,
 'fields',('[{"key":"a","label":"A","type":"text","description":"' || repeat('d',2001) || '"}]')::jsonb))$$, '22023', null, 'a description is capped at 2000');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c2100000-0000-4000-8000-0000000000f9','title','x','region_id',1,
 'fields','[{"key":"p","label":"P","type":"page_break"},{"key":"a","label":"A","type":"text"}]'::jsonb))$$, '22023', null, 'a form cannot start with a page break');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c2100000-0000-4000-8000-0000000000f9','title','x','region_id',1,
 'fields','[{"key":"a","label":"A","type":"text"},{"key":"p","label":"P","type":"page_break"}]'::jsonb))$$, '22023', null, 'a form cannot end with a page break');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c2100000-0000-4000-8000-0000000000f9','title','x','region_id',1,
 'fields','[{"key":"a","label":"A","type":"text"},{"key":"p","label":"P","type":"page_break"},{"key":"q","label":"Q","type":"page_break"},{"key":"b","label":"B","type":"text"}]'::jsonb))$$, '22023', null, 'two page breaks in a row are refused');
select throws_ok($$select public.save_lounge_form(jsonb_build_object('id','c2100000-0000-4000-8000-0000000000f9','title','x','region_id',1,
 'fields','[{"key":"a","label":"A","type":"video"}]'::jsonb))$$, '22023', null, 'an unknown field type is still refused');
reset role;

-- ── The svc_ functions are service-role only ───────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2100000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select public.svc_form_file_start('c2100000-0000-4000-8000-000000000003','c2100000-0000-4000-8000-0000000000f1','proof','a.webp','image/webp',100)$$,
 '42501', null, 'a member cannot call svc_form_file_start directly');
select throws_ok($$select public.svc_form_files_sweep(10)$$, '42501', null, 'a member cannot sweep');
reset role;

-- ── Start checks (run as the service role, acting as the member) ───────────
set local role service_role;
select lives_ok($$insert into ff select 'a', (public.svc_form_file_start('c2100000-0000-4000-8000-000000000003','c2100000-0000-4000-8000-0000000000f1','proof','../../etc/pa*ss\wd.webp','image/webp',1000)->>'file_id')::uuid$$,
 'start: a photo for a photo question');
reset role;
select ok((select original_name !~ '[/\\*]' and left(original_name,1) <> '.' from public.form_files where id=(select id from ff where k='a')), 'the name is sanitised');
select is((select status from public.form_files where id=(select id from ff where k='a')), 'uploading', 'the row starts as uploading');
set local role service_role;
insert into ff select 'b', (r->>'file_id')::uuid from public.svc_form_file_start('c2100000-0000-4000-8000-000000000003','c2100000-0000-4000-8000-0000000000f1','proof','b.png','image/png',2000) r
 where r->>'drive_name' = '99f9670003 – Payment proof – 2.png';
select ok(exists(select 1 from ff where k='b'), 'the Drive name is "<email local> – <label> – <n>.<ext>"');
select throws_ok($$select public.svc_form_file_start('c2100000-0000-4000-8000-000000000003','c2100000-0000-4000-8000-0000000000f1','proof','c.png','image/png',10)$$,
 '22023', null, 'start: max_files is enforced');
select throws_ok($$select public.svc_form_file_start('c2100000-0000-4000-8000-000000000003','c2100000-0000-4000-8000-0000000000f1','name','c.png','image/png',10)$$,
 '22023', null, 'start: not a file question');
select throws_ok($$select public.svc_form_file_start('c2100000-0000-4000-8000-000000000003','c2100000-0000-4000-8000-0000000000f1','nope','c.png','image/png',10)$$,
 '22023', null, 'start: unknown question');
select throws_ok($$select public.svc_form_file_start('c2100000-0000-4000-8000-000000000004','c2100000-0000-4000-8000-0000000000f1','proof','c.pdf','application/pdf',10)$$,
 '22023', null, 'start: a PDF for a photo-only question');
select throws_ok($$select public.svc_form_file_start('c2100000-0000-4000-8000-000000000003','c2100000-0000-4000-8000-0000000000f1','doc','c.png','image/png',10)$$,
 '22023', null, 'start: a photo for a PDF-only question');
select throws_ok($$select public.svc_form_file_start('c2100000-0000-4000-8000-000000000004','c2100000-0000-4000-8000-0000000000f1','proof','c.webp','image/webp',5242881)$$,
 '22023', null, 'start: photo over 5 MB');
select throws_ok($$select public.svc_form_file_start('c2100000-0000-4000-8000-000000000004','c2100000-0000-4000-8000-0000000000f1','doc','c.pdf','application/pdf',10485761)$$,
 '22023', null, 'start: PDF over 10 MB');
select throws_ok($$select public.svc_form_file_start('c2100000-0000-4000-8000-000000000004','c2100000-0000-4000-8000-0000000000f1','proof','c.gif','image/gif',10)$$,
 '22023', null, 'start: a mime type outside the allowed four');
select throws_ok($$select public.svc_form_file_start('c2100000-0000-4000-8000-000000000005','c2100000-0000-4000-8000-0000000000f1','proof','c.png','image/png',10)$$,
 '42501', null, 'start: a member outside the audience');

-- Finish: only the owner; only a pending row.
select throws_ok($$select public.svc_form_file_finish_target('c2100000-0000-4000-8000-000000000004',(select id from ff where k='a'))$$,
 'P0002', null, 'finish: another member cannot touch the row');
select lives_ok($$select public.svc_form_file_finish_ok('c2100000-0000-4000-8000-000000000003',(select id from ff where k='a'),'DRIVEFILEAAAA0001')$$, 'finish: owner marks ready');
select lives_ok($$select public.svc_form_file_finish_ok('c2100000-0000-4000-8000-000000000003',(select id from ff where k='b'),'DRIVEFILEBBBB0002')$$, 'finish: second file ready');
select throws_ok($$select public.svc_form_file_finish_ok('c2100000-0000-4000-8000-000000000003',(select id from ff where k='b'),'DRIVEFILEOTHER003')$$,
 'PT409', null, 'finish: a ready file cannot be re-pointed at another Drive file');
insert into ff select 'doc1', (public.svc_form_file_start('c2100000-0000-4000-8000-000000000003','c2100000-0000-4000-8000-0000000000f1','doc','cv.pdf','application/pdf',3000)->>'file_id')::uuid;
select public.svc_form_file_finish_ok('c2100000-0000-4000-8000-000000000003',(select id from ff where k='doc1'),'DRIVEFILEDOC10004');
-- Student two: one ready photo (x), one still uploading (y), one ready PDF (z).
insert into ff select 'x', (public.svc_form_file_start('c2100000-0000-4000-8000-000000000004','c2100000-0000-4000-8000-0000000000f1','proof','x.png','image/png',10)->>'file_id')::uuid;
insert into ff select 'y', (public.svc_form_file_start('c2100000-0000-4000-8000-000000000004','c2100000-0000-4000-8000-0000000000f1','proof','y.png','image/png',10)->>'file_id')::uuid;
insert into ff select 'z', (public.svc_form_file_start('c2100000-0000-4000-8000-000000000004','c2100000-0000-4000-8000-0000000000f1','doc','z.pdf','application/pdf',10)->>'file_id')::uuid;
select public.svc_form_file_finish_ok('c2100000-0000-4000-8000-000000000004',(select id from ff where k='x'),'DRIVEFILEXXXX0005');
select public.svc_form_file_finish_ok('c2100000-0000-4000-8000-000000000004',(select id from ff where k='z'),'DRIVEFILEZZZZ0006');

reset role;
-- Existing valid file records can outnumber the current question cap after an edit.
with extra as (
 insert into public.form_files(form_id, field_key, member_id, original_name, mime, size_bytes, drive_file_id, status)
 values ('c2100000-0000-4000-8000-0000000000f1','proof','c2100000-0000-4000-8000-000000000003',
  'extra.png','image/png',10,'DRIVEFILEEXTRA001','ready') returning id
)
insert into ff select 'extra', id from extra;

set local role service_role;
select is((select count(*)::int from jsonb_array_elements(public.svc_form_file_list(
 'c2100000-0000-4000-8000-000000000004','c2100000-0000-4000-8000-0000000000f1')) r
 where r->>'file_id' in (select id::text from ff where k in ('x','y','z'))
  and not (r ? 'drive_file_id' or r ? 'upload_session_url')), 3, 'restore lists only safe metadata, including interrupted uploads');
reset role;

-- ── Submit ──────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2100000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select public.submit_lounge_form('c2100000-0000-4000-8000-0000000000f1',jsonb_build_object('name','S One'))$$,
 '22023', null, 'submit: a required file question needs a file');
select throws_ok($$select public.submit_lounge_form('c2100000-0000-4000-8000-0000000000f1',jsonb_build_object('proof',jsonb_build_array((select id from ff where k='x'))))$$,
 '22023', null, 'submit: another member''s file is refused');
select throws_ok($$select public.submit_lounge_form('c2100000-0000-4000-8000-0000000000f1',jsonb_build_object('proof',jsonb_build_array((select id from ff where k='doc1'))))$$,
 '22023', null, 'submit: a file from another question is refused');
select throws_ok($$select public.submit_lounge_form('c2100000-0000-4000-8000-0000000000f1',jsonb_build_object('proof',jsonb_build_array((select id from ff where k='a'),(select id from ff where k='a'))))$$,
 '22023', null, 'submit: the same file twice is refused');
select throws_ok($$select public.submit_lounge_form('c2100000-0000-4000-8000-0000000000f1',jsonb_build_object('proof',jsonb_build_array((select id from ff where k='a'),(select id from ff where k='b'),(select id from ff where k='extra'))))$$,
 '22023', null, 'submit: more than max_files is refused');
select throws_ok($$select public.submit_lounge_form('c2100000-0000-4000-8000-0000000000f1',jsonb_build_object('proof',jsonb_build_array((select id from ff where k='a')),'s_info','x'))$$,
 '22023', null, 'submit: a section key cannot carry an answer');
select throws_ok($$select public.submit_lounge_form('c2100000-0000-4000-8000-0000000000f1',jsonb_build_object('proof',jsonb_build_array('not-a-uuid')))$$,
 '22023', null, 'submit: a malformed file id is refused');
select lives_ok($$select public.submit_lounge_form('c2100000-0000-4000-8000-0000000000f1',jsonb_build_object('name','S One','proof',jsonb_build_array((select id from ff where k='a'),(select id from ff where k='b')),'doc',jsonb_build_array((select id from ff where k='doc1'))))$$,
 'submit: ready files attach');
select is(
 (public.submit_lounge_form('c2100000-0000-4000-8000-0000000000f1',jsonb_build_object('name','S One','proof',jsonb_build_array((select id from ff where k='a'),(select id from ff where k='b')),'doc',jsonb_build_array((select id from ff where k='doc1'))))->>'response_id')::uuid,
 (select id from public.form_responses where member_id=auth.uid() and form_id='c2100000-0000-4000-8000-0000000000f1'),
 'submit replay returns the original response with files now attached');
reset role;
select is((select count(*)::int from public.form_files where member_id='c2100000-0000-4000-8000-000000000003' and status='attached' and response_id is not null), 3, 'all three files are attached to the response');
select is((select answers->'proof'->0->>'name' || '/' || (answers->'proof'->0->>'size') from public.form_responses where member_id='c2100000-0000-4000-8000-000000000003' and form_id='c2100000-0000-4000-8000-0000000000f1'),
 (select original_name from public.form_files where id=(select id from ff where k='a')) || '/1000', 'the answer stores name and size');
select is((select answers->'proof'->0->>'file_id' from public.form_responses where member_id='c2100000-0000-4000-8000-000000000003' and form_id='c2100000-0000-4000-8000-0000000000f1'),
 (select id::text from ff where k='a'), 'the answer stores the file id');

-- Student two: an uploading file cannot be submitted.
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2100000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select public.submit_lounge_form('c2100000-0000-4000-8000-0000000000f1',jsonb_build_object('proof',jsonb_build_array((select id from ff where k='y'))))$$,
 '22023', null, 'submit: a file that is still uploading is refused');
reset role;

-- Student two's valid ready PDF must be refused if the form changes to photos.
set local request.jwt.claims = '{"sub":"c2100000-0000-4000-8000-000000000001","role":"authenticated"}';
update public.lounge_forms set fields = jsonb_set(fields, '{4,accept}', '"image"')
 where id='c2100000-0000-4000-8000-0000000000f1';
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2100000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select public.submit_lounge_form('c2100000-0000-4000-8000-0000000000f1',jsonb_build_object('proof',jsonb_build_array((select id from ff where k='x')),'doc',jsonb_build_array((select id from ff where k='z'))))$$,
 '22023', 'Choose available files of the allowed type for this question', 'submit: current accept policy rejects a previously ready PDF');
reset role;

set local role service_role;
-- No more uploads once submitted.
select throws_ok($$select public.svc_form_file_start('c2100000-0000-4000-8000-000000000003','c2100000-0000-4000-8000-0000000000f1','proof','late.png','image/png',10)$$,
 'PT409', null, 'start: nothing after the member has submitted');
select throws_ok($$select public.svc_form_file_discard('c2100000-0000-4000-8000-000000000003',(select id from ff where k='a'))$$,
 'PT409', null, 'remove: a submitted file cannot be removed');
select is(public.svc_form_file_discard('c2100000-0000-4000-8000-000000000003',(select id from ff where k='a'),true),
 false, 'failed verification cannot discard a submitted attachment');

-- ── View authorisation ──────────────────────────────────────────────────────
select is(public.svc_form_file_view_target('c2100000-0000-4000-8000-000000000001',(select id from ff where k='a'))->>'drive_file_id', 'DRIVEFILEAAAA0001', 'view: a Super Admin may open it');
select is(public.svc_form_file_view_target('c2100000-0000-4000-8000-000000000002',(select id from ff where k='a'))->>'mime', 'image/webp', 'view: the region RC may open it');
select throws_ok($$select public.svc_form_file_view_target('c2100000-0000-4000-8000-000000000003',(select id from ff where k='a'))$$,
 '42501', null, 'view: the submitter cannot open their own file');
select throws_ok($$select public.svc_form_file_view_target('c2100000-0000-4000-8000-000000000004',(select id from ff where k='a'))$$,
 '42501', null, 'view: another member cannot open it');
select throws_ok($$select public.svc_form_file_view_target('c2100000-0000-4000-8000-000000000001',(select id from ff where k='x'))$$,
 'P0002', null, 'view: a file that was never submitted is not served');
select throws_ok($$select public.svc_form_banner_target('c2100000-0000-4000-8000-000000000004','c2100000-0000-4000-8000-0000000000f1')$$,
 '42501', null, 'banner: a member who cannot manage the form cannot sign');
select is(public.svc_form_banner_target('c2100000-0000-4000-8000-000000000002','c2100000-0000-4000-8000-0000000000f1')->>'form_id', 'c2100000-0000-4000-8000-0000000000f1', 'banner: the region RC can sign');
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2100000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.get_form_drive_folder('c2100000-0000-4000-8000-0000000000f1')$$, '42501', null, 'only a Super Admin gets the Drive folder');
select ok((select (f->>'has_files')::boolean from jsonb_array_elements(public.list_lounge_forms()) f where f->>'id'='c2100000-0000-4000-8000-0000000000f1'), 'list: a manager sees has_files');
set local request.jwt.claims = '{"sub":"c2100000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select f->>'has_files' from jsonb_array_elements(public.list_lounge_forms()) f where f->>'id'='c2100000-0000-4000-8000-0000000000f1'), 'false', 'list: a member never sees has_files');
reset role;

-- Folders: first writer wins.
set local role service_role;
select is(public.svc_form_drive_root_set('ROOTFOLDER0000001'), 'ROOTFOLDER0000001', 'the root folder is stored');
select is(public.svc_form_drive_root_set('ROOTFOLDER0000002'), 'ROOTFOLDER0000001', 'a second writer gets the stored root');
select is(public.svc_form_drive_folder_set('c2100000-0000-4000-8000-0000000000f1','FORMFOLDER000001'), 'FORMFOLDER000001', 'the form folder is stored');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c2100000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.get_form_drive_folder('c2100000-0000-4000-8000-0000000000f1'), 'FORMFOLDER000001', 'a Super Admin can get the stored folder');
reset role;
set local role service_role;

-- ── Sweep ───────────────────────────────────────────────────────────────────
-- y (uploading) and x (ready) are abandoned once older than 24 h; a fresh row is left alone.
select is(jsonb_array_length(public.svc_form_files_sweep(10)), 0, 'sweep: nothing is old enough yet');
reset role;
update public.form_files set created_at = now() - interval '25 hours' where id in (select id from ff where k in ('x','y','a'));
set local role service_role;
select is((select jsonb_agg(r->>'id' order by r->>'id') from jsonb_array_elements(public.svc_form_files_sweep(10)) r),
 (select jsonb_agg(id::text order by id::text) from ff where k in ('x','y')), 'sweep: picks the abandoned uploads, not the attached ones');
reset role;
select is((select count(*)::int from public.form_files where status='delete_pending' and id in (select id from ff where k in ('x','y'))), 2, 'sweep: claimed rows are delete_pending (cannot be attached)');
set local role service_role;
select is(public.svc_form_files_done((select array_agg(id) from ff where k in ('x','y'))), 2, 'done: drops the rows');
reset role;
select is((select count(*)::int from public.form_files where id in (select id from ff where k in ('x','y'))), 0, 'the abandoned rows are gone');
select is((select count(*)::int from public.form_files where status='attached' and member_id='c2100000-0000-4000-8000-000000000003'), 3, 'attached files are untouched');
set local role service_role;
select is(jsonb_array_length(public.svc_form_files_sweep(10)), 0, 'sweep: attached files are never selected');
-- Reclaim an expired reservation before checking the single-file quota, even without a sweep.
reset role;
update public.form_files set created_at = now() - interval '25 hours' where id = (select id from ff where k='z');
set local role service_role;
select lives_ok($$select public.svc_form_file_start('c2100000-0000-4000-8000-000000000004','c2100000-0000-4000-8000-0000000000f1','doc','new.png','image/png',10)$$,
 'start: an expired reservation does not consume quota');
reset role;

-- Discarding frees the max_files slot but not the weekly start budget (3 x max_files + 5).
update public.form_files set status = 'delete_pending' where member_id = 'c2100000-0000-4000-8000-000000000004' and field_key = 'doc';
insert into private.form_file_starts(member_id, form_id, field_key)
select 'c2100000-0000-4000-8000-000000000004','c2100000-0000-4000-8000-0000000000f1','doc' from generate_series(1, 8 - (
  select count(*) from private.form_file_starts where member_id = 'c2100000-0000-4000-8000-000000000004' and field_key = 'doc'));
set local role service_role;
select throws_ok($$select public.svc_form_file_start('c2100000-0000-4000-8000-000000000004','c2100000-0000-4000-8000-0000000000f1','doc','again.pdf','application/pdf',10)$$,
 '22023', 'Too many uploads for this question this week; ask the form''s organisers for help', 'start: discarded uploads still count toward the weekly cap');
reset role;
update private.form_file_starts set started_at = now() - interval '8 days' where member_id = 'c2100000-0000-4000-8000-000000000004';
set local role service_role;
select lives_ok($$select public.svc_form_file_start('c2100000-0000-4000-8000-000000000004','c2100000-0000-4000-8000-0000000000f1','doc','again.pdf','application/pdf',10)$$,
 'start: starts older than a week no longer count');
reset role;

-- ── Hard delete queues files even after the form has gone ───────────────────
insert into public.form_files(id, form_id, field_key, member_id, original_name, mime, size_bytes, drive_file_id, status, attached_at, upload_session_url)
values
 ('c2100000-0000-4000-8000-0000000000a1','c2100000-0000-4000-8000-0000000000f1','proof','c2100000-0000-4000-8000-000000000006','secret-name.png','image/png',10,'DRIVEFILEHARD0007','attached',now(),null),
 ('c2100000-0000-4000-8000-0000000000a2','c2100000-0000-4000-8000-0000000000f1','proof','c2100000-0000-4000-8000-000000000006','queued.png','image/png',10,'DRIVEFILEHARD0008','delete_pending',null,'https://www.googleapis.com/upload/drive/v3/files?upload_id=fixture');
select private.delete_lounge_form_rows('c2100000-0000-4000-8000-0000000000f1');
select is((select delete_pending from private.form_file_erasure where id='c2100000-0000-4000-8000-0000000000a1'), false, 'form deletion keeps the attachment');
select is((select delete_pending from private.form_file_erasure where id='c2100000-0000-4000-8000-0000000000a2'), true, 'form deletion preserves already queued cleanup');
set local session_replication_role=replica;
update public.members set account_status='deleted',deleted_at=now()-interval '31 days' where id='c2100000-0000-4000-8000-000000000006';
set local session_replication_role=origin;
insert into public.approval_requests(id,type,target_member_id,target_snapshot,reason,requested_by) values('c2100000-0000-4000-8000-0000000000b1','member_hard_delete','c2100000-0000-4000-8000-000000000006','{}','Erase','c2100000-0000-4000-8000-000000000002');
set local role service_role;
select is(public.svc_execute_hard_delete('c2100000-0000-4000-8000-000000000001','c2100000-0000-4000-8000-0000000000b1')->>'form_files', '2', 'hard delete counts both archived files');
select is((select array_agg(r->>'drive_file_id' order by r->>'drive_file_id') from jsonb_array_elements(public.svc_form_files_sweep(10, 'c2100000-0000-4000-8000-000000000006')) r),
 array['DRIVEFILEHARD0007','DRIVEFILEHARD0008'], 'sweep returns both archived Drive IDs');
select is(public.svc_form_files_remaining('c2100000-0000-4000-8000-000000000006'), 2, 'remaining includes claimed work until Drive reconciliation');
select is(public.svc_form_files_done(array['c2100000-0000-4000-8000-0000000000a1'::uuid,'c2100000-0000-4000-8000-0000000000a2'::uuid]), 2, 'done closes both reconciled erasure records');
select is(public.svc_form_files_remaining('c2100000-0000-4000-8000-000000000006'), 0, 'completed records leave no remaining work');
reset role;

select * from finish();
rollback;

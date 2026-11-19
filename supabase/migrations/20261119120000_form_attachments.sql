-- Spec 008: form banner, file uploads (private Google Drive), section and page_break field types.
-- Extends the live bodies by anchored patch (as 20261023202050, 20261024130000 and 20261023120000
-- did): each anchor must match exactly once, so a changed function fails the migration loudly
-- instead of silently resurrecting an older body.

-- ── Banner ──────────────────────────────────────────────────────────────────
alter table public.lounge_forms
  add column banner_url text,
  add column banner_alt text,
  add constraint lounge_forms_banner_cloudinary check (
    banner_url is null or (banner_url ~ '^https://res\.cloudinary\.com/l59gy0g2/image/upload/[^[:space:]<>"''[:cntrl:]]+$' and length(banner_url) <= 2048)),
  add constraint lounge_forms_banner_alt_len check (banner_alt is null or length(banner_alt) <= 300);

-- ── Member files ────────────────────────────────────────────────────────────
create table public.form_files (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.lounge_forms(id) on delete cascade,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  member_id uuid not null references public.members(id),
  -- Set null (not cascade) so deleting a form's responses never trips over a file row; the form's
  -- own delete still cascades. Drive files are kept either way (spec D6).
  response_id uuid references public.form_responses(id) on delete set null,
  original_name text not null check (length(original_name) between 1 and 200),
  mime text not null check (mime in ('image/webp','image/jpeg','image/png','application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  drive_file_id text unique check (drive_file_id is null or drive_file_id ~ '^[A-Za-z0-9_-]{10,100}$'),
  status text not null default 'uploading' check (status in ('uploading','ready','attached','delete_pending')),
  created_at timestamptz not null default now(),
  attached_at timestamptz,
  upload_session_url text,
  next_sweep_at timestamptz not null default '-infinity'
);
create index form_files_member_form on public.form_files (member_id, form_id, field_key);
create index form_files_sweep on public.form_files (created_at) where status <> 'attached';
alter table public.form_files enable row level security;
revoke all on public.form_files from public, anon, authenticated, service_role;
comment on table public.form_files is
  'Member uploads for form file questions; bytes live in the house Drive. Reached only through svc_form_file_* RPCs (Edge Function form-file).';

-- Form deletion keeps the bytes. Preserve only the information needed for later erasure.
create table private.form_file_erasure (
  id uuid primary key,
  member_id uuid not null,
  drive_file_id text,
  upload_session_url text,
  delete_pending boolean not null,
  next_sweep_at timestamptz not null
);
create index form_file_erasure_member on private.form_file_erasure (member_id);
create index form_file_erasure_sweep on private.form_file_erasure (next_sweep_at) where delete_pending;
alter table private.form_file_erasure enable row level security;
revoke all on private.form_file_erasure from public, anon, authenticated, service_role;

-- Every upload start, kept for a week. Discarding a file frees its max_files slot, but Drive keeps the
-- resumable upload URL alive for up to a week, so starts themselves are capped (svc_form_file_start).
create table private.form_file_starts (
  member_id uuid not null references public.members(id) on delete cascade,
  form_id uuid not null,
  field_key text not null,
  started_at timestamptz not null default now()
);
create index form_file_starts_member on private.form_file_starts (member_id, form_id, field_key, started_at);
alter table private.form_file_starts enable row level security;
revoke all on private.form_file_starts from public, anon, authenticated, service_role;

create function private.preserve_form_file_erasure() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.lounge_forms where id = old.form_id) then
  insert into private.form_file_erasure (id, member_id, drive_file_id, upload_session_url, delete_pending, next_sweep_at)
  values (old.id, old.member_id, old.drive_file_id, old.upload_session_url, old.status = 'delete_pending', old.next_sweep_at);
 end if;
 return old;
end; $$;
revoke execute on function private.preserve_form_file_erasure() from public, anon, authenticated, service_role;
create trigger form_file_preserve_erasure after delete on public.form_files
for each row execute function private.preserve_form_file_erasure();

-- One-row table: the root "Sundarbans Forms" Drive folder (created lazily by the function).
create table private.form_drive_root (
  singleton boolean primary key default true check (singleton),
  folder_id text not null check (folder_id ~ '^[A-Za-z0-9_-]{10,100}$')
);
create table private.form_drive_folders (
  form_id uuid primary key references public.lounge_forms(id) on delete cascade,
  folder_id text not null check (folder_id ~ '^[A-Za-z0-9_-]{10,100}$')
);
alter table private.form_drive_root enable row level security;
alter table private.form_drive_folders enable row level security;
revoke all on private.form_drive_root, private.form_drive_folders from public, anon, authenticated, service_role;

-- Display-safe file name: no path separators, control or bidi characters, no leading dots, <= p_max.
create function private.clean_file_name(p_name text, p_max integer default 200) returns text
language sql immutable set search_path = '' as $$
 select coalesce(nullif(btrim(left(regexp_replace(
   regexp_replace(coalesce(p_name, ''), '[/\\:*?"<>|[:cntrl:]​-‏‪-‮⁦-⁩﻿]', '_', 'g'),
   '^[.[:space:]]+', ''), p_max)), ''), 'file');
$$;
revoke execute on function private.clean_file_name(text, integer) from public, anon, authenticated, service_role;

-- ── Anchored-patch helper (session-local) ──────────────────────────────────
create function pg_temp.patch_once(p_body text, p_anchor text, p_new text) returns text
language plpgsql as $$
begin
 if (length(p_body) - length(replace(p_body, p_anchor, ''))) / length(p_anchor) <> 1 then
  raise exception 'anchor not found exactly once, update this migration: %', left(p_anchor, 80);
 end if;
 return replace(p_body, p_anchor, p_new);
end; $$;

-- ── save_lounge_form: banner, new field types, description, page-break placement ──
do $patch$
declare b text := pg_get_functiondef('public.save_lounge_form(jsonb)'::regprocedure);
begin
 b := pg_temp.patch_once(b, $a$group_purpose,archived_at)$a$, $a$group_purpose,archived_at,banner_url,banner_alt)$a$);
 b := pg_temp.patch_once(b, $a$,(p_form->>'archived_at')::timestamptz)$a$,
  $a$,(p_form->>'archived_at')::timestamptz,nullif(btrim(p_form->>'banner_url'),''),nullif(btrim(p_form->>'banner_alt'),''))$a$);
 b := pg_temp.patch_once(b, $a$else lounge_forms.archived_at end,updated_at=now();$a$,
  $a$else lounge_forms.archived_at end,banner_url=case when p_form ? 'banner_url' then excluded.banner_url else lounge_forms.banner_url end,banner_alt=case when p_form ? 'banner_alt' then excluded.banner_alt else lounge_forms.banner_alt end,updated_at=now();$a$);
 b := pg_temp.patch_once(b, $a$(field->>'type') not in('text','textarea','email','phone','select','checkbox','multiselect')$a$,
  $a$(field->>'type') not in('text','textarea','email','phone','select','checkbox','multiselect','file','section','page_break')$a$);
 b := pg_temp.patch_once(b, $a$if field->>'type'='phone' then phone_count:=phone_count+1; end if;$a$,
  $a$if field ? 'description' and (jsonb_typeof(field->'description') is distinct from 'string' or length(field->>'description')>2000) then raise exception 'A description must be text of at most 2000 characters' using errcode='22023'; end if;
  if field->>'type' in('section','page_break') and coalesce((field->>'required')::boolean,false) then raise exception 'Sections and page breaks cannot be required' using errcode='22023'; end if;
  if field->>'type'='file' and (coalesce(field->>'accept','') not in('image','pdf','any') or jsonb_typeof(field->'max_files') is distinct from 'number' or (field->>'max_files') !~ '^([1-9]|10)$') then raise exception 'File questions need accept (image, pdf or any) and max_files from 1 to 10' using errcode='22023'; end if;
  if field->>'type'='phone' then phone_count:=phone_count+1; end if;$a$);
 b := pg_temp.patch_once(b, $a$if phone_count>1 then raise exception 'Use one phone field per form' using errcode='22023'; end if;$a$,
  $a$if phone_count>1 then raise exception 'Use one phone field per form' using errcode='22023'; end if;
 if fs->0->>'type'='page_break' or fs->(jsonb_array_length(fs)-1)->>'type'='page_break'
    or exists(select 1 from jsonb_array_elements(fs) with ordinality a(v,i) join jsonb_array_elements(fs) with ordinality n(v,i) on n.i=a.i+1 where a.v->>'type'='page_break' and n.v->>'type'='page_break')
 then raise exception 'A page break cannot be first, last or next to another page break' using errcode='22023'; end if;$a$);
 execute b;
end $patch$;

-- ── submit_lounge_form: file answers ────────────────────────────────────────
do $patch$
declare b text := pg_get_functiondef('public.submit_lounge_form(uuid,jsonb,boolean)'::regprocedure);
begin
 b := pg_temp.patch_once(b, $a$v_status text; v_wrote boolean:=false;$a$,
  $a$v_status text; v_wrote boolean:=false; v_file_ids uuid[]:='{}'; v_ids uuid[]; n integer;$a$);
 b := pg_temp.patch_once(b, $a$then raise exception 'Unknown answer field' using errcode='22023'; end if;$a$,
  $a$then raise exception 'Unknown answer field' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(a) q(key) join jsonb_array_elements(f.fields) x on x->>'key'=q.key where x->>'type' in('section','page_break')) then raise exception 'Unknown answer field' using errcode='22023'; end if;$a$);
 b := pg_temp.patch_once(b, $a$k:=field->>'key'; val:=a->k;$a$,
  $a$k:=field->>'key'; val:=a->k;
  if field->>'type' in('section','page_break') then continue; end if;
  if field->>'type'='file' then
   if val is null or val='null'::jsonb or val='[]'::jsonb then
    if coalesce((field->>'required')::boolean,false) then raise exception 'Required field: %',field->>'label' using errcode='22023'; end if;
    continue;
   end if;
   if jsonb_typeof(val)<>'array' then raise exception 'Invalid file answer' using errcode='22023'; end if;
   if jsonb_array_length(val)>coalesce((field->>'max_files')::integer,1) or exists(select 1 from jsonb_array_elements(val) x where jsonb_typeof(x)<>'string' or (x#>>'{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'Invalid file answer' using errcode='22023'; end if;
   select coalesce(array_agg(t::uuid),'{}') into v_ids from jsonb_array_elements_text(val) t;
   if (select count(distinct i) from unnest(v_ids) i)<>cardinality(v_ids) then raise exception 'Invalid file answer' using errcode='22023'; end if;
   perform 1 from public.form_files ff
    where ff.id=any(v_ids) and ff.member_id=auth.uid() and ff.form_id=f.id and ff.field_key=k
     and ff.status='ready' and ff.created_at >= now() - interval '24 hours'
     and (field->>'accept'='any' or (field->>'accept'='pdf' and ff.mime='application/pdf')
          or (field->>'accept'='image' and ff.mime like 'image/%'))
    order by ff.id for update;
   get diagnostics n=row_count;
   if n<>cardinality(v_ids) then raise exception 'Choose available files of the allowed type for this question' using errcode='22023'; end if;
   a:=jsonb_set(a,array[k],(select jsonb_agg(jsonb_build_object('file_id',ff.id,'name',ff.original_name,'mime',ff.mime,'size',ff.size_bytes) order by array_position(v_ids,ff.id)) from public.form_files ff where ff.id=any(v_ids)));
   v_file_ids:=v_file_ids||v_ids;
   continue;
  end if;$a$);
 -- Move the existing member lock and response lookup before validation. The form and
 -- event share locks are already held. A successful replay can reference attached files.
 b := pg_temp.patch_once(b, $a$
 -- Serialize per-member writes; repeated submission returns the original response unchanged.
 perform 1 from public.members where id=auth.uid() for update;
 -- Region and suspension may have changed while waiting for the member lock. Authorize
 -- against that committed state; the held member/event/form locks then preserve it.
 if not private.is_active_member() or not private.can_submit_form(f.id) then raise exception 'This form is closed or outside your audience' using errcode='42501'; end if;
 select id,review_status into rid,v_status from public.form_responses where form_id=f.id and member_id=auth.uid() for update;
$a$, E'\n');
 b := pg_temp.patch_once(b, $a$if jsonb_typeof(a) is distinct from 'object'$a$,
  $a$-- Serialize per-member writes; repeated submission returns the original response unchanged.
 perform 1 from public.members where id=auth.uid() for update;
 -- Region and suspension may have changed while waiting for the member lock. Authorize
 -- against that committed state; the held member/event/form locks then preserve it.
 if not private.is_active_member() or not private.can_submit_form(f.id) then raise exception 'This form is closed or outside your audience' using errcode='42501'; end if;
 select id,review_status into rid,v_status from public.form_responses where form_id=f.id and member_id=auth.uid() for update;
 if rid is not null and v_status is distinct from 'rejected' then
  return jsonb_build_object('response_id',rid,'invite_url',public.get_lounge_form_invite(f.id),'registered',f.event_id is not null);
 end if;
 if jsonb_typeof(a) is distinct from 'object'$a$);
 b := pg_temp.patch_once(b, $a$if v_wrote and p_save_phone and v_phone is not null then$a$,
  $a$if v_wrote and cardinality(v_file_ids)>0 then
  update public.form_files set status='attached',response_id=rid,attached_at=now() where id=any(v_file_ids);
 end if;
 if v_wrote and p_save_phone and v_phone is not null then$a$);
 execute b;
end $patch$;

-- Signed-out PANBS answers never carry files or layout items.
do $patch$
declare b text := pg_get_functiondef('private.clean_form_answers(jsonb,jsonb)'::regprocedure);
begin
 b := pg_temp.patch_once(b, $a$k:=field->>'key'; val:=a->k;$a$,
  $a$k:=field->>'key'; val:=a->k;
  if field->>'type' in('file','section','page_break') then
   if val is not null and val<>'null'::jsonb then raise exception 'Unknown answer field' using errcode='22023'; end if;
   continue;
  end if;$a$);
 execute b;
end $patch$;

do $patch$
declare b text := pg_get_functiondef('public.submit_panbs_registration(uuid,text,text,text,text,jsonb)'::regprocedure);
begin
 b := pg_temp.patch_once(b, $a$for field in select value from jsonb_array_elements(f.fields) loop$a$,
  $a$for field in select value from jsonb_array_elements(f.fields) loop
    if field->>'type' in ('file','section','page_break') then continue; end if;$a$);
 execute b;
end $patch$;

-- ── list_lounge_forms: managers see whether a form holds files ──────────────
-- (banner_url / banner_alt arrive through to_jsonb(f).)
do $patch$
declare b text := pg_get_functiondef('public.list_lounge_forms()'::regprocedure);
begin
 b := pg_temp.patch_once(b, $a$'accepting_responses',private.can_submit_form(f.id),$a$,
  $a$'accepting_responses',private.can_submit_form(f.id),'has_files',(private.manages_form(f.id) and exists(select 1 from public.form_files ff where ff.form_id=f.id and ff.status='attached')),$a$);
 execute b;
end $patch$;

-- ── Hard delete: the member's files are queued for Drive deletion ───────────
do $patch$
declare b text := pg_get_functiondef('public.svc_execute_hard_delete(uuid,uuid)'::regprocedure);
begin
 b := pg_temp.patch_once(b, $a$update public.regional_registrations  set answers = '{}'::jsonb where member_id = v_member.id;$a$,
  $a$update public.form_files set status = 'delete_pending', original_name = 'deleted'
   where member_id = v_member.id;
  update private.form_file_erasure set delete_pending = true where member_id = v_member.id;
  update public.regional_registrations  set answers = '{}'::jsonb where member_id = v_member.id;$a$);
 b := pg_temp.patch_once(b, $a$return jsonb_build_object('member_id', v_member.id, 'state', 'executed');$a$,
  $a$return jsonb_build_object('member_id', v_member.id, 'state', 'executed',
    'form_files', (select count(*) from public.form_files where member_id = v_member.id and status = 'delete_pending')
     + (select count(*) from private.form_file_erasure where member_id = v_member.id and delete_pending));$a$);
 execute b;
end $patch$;

-- ── Super Admin: the form's Drive folder link ───────────────────────────────
create function public.get_form_drive_folder(p_form_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
 if not private.is_active_member() or not private.is_super_admin() then raise exception 'Only a Super Admin can open the Drive folder' using errcode = '42501'; end if;
 return (select folder_id from private.form_drive_folders where form_id = p_form_id);
end; $$;
revoke execute on function public.get_form_drive_folder(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_form_drive_folder(uuid) to authenticated;

create function public.save_lounge_form_banner(p_form_id uuid, p_url text, p_alt text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare oldf public.lounge_forms; newf public.lounge_forms;
begin
 perform pg_advisory_xact_lock(hashtextextended('form:' || p_form_id::text, 0));
 select * into oldf from public.lounge_forms where id = p_form_id for update;
 if not found then raise exception 'Form not found' using errcode = 'no_data_found'; end if;
 perform 1 from public.events where id = oldf.event_id for share;
 if not private.is_active_member() or private.manages_form(p_form_id) is not true then
  raise exception 'This form is outside your organizer scope' using errcode = '42501';
 end if;
 update public.lounge_forms
 set banner_url = nullif(btrim(p_url), ''),
     banner_alt = case when p_url is null then banner_alt else nullif(btrim(p_alt), '') end,
     updated_at = now()
 where id = p_form_id returning * into newf;
 perform private.write_audit('form.save', 'lounge_forms', p_form_id::text, to_jsonb(oldf),
   jsonb_build_object('id', p_form_id, 'banner_url', newf.banner_url, 'banner_alt', newf.banner_alt));
end; $$;
revoke execute on function public.save_lounge_form_banner(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.save_lounge_form_banner(uuid, text, text) to authenticated;

-- ── svc_* RPCs for the Edge Functions (service role only) ───────────────────
-- Each impersonates the verified caller (as svc_event_image_target does) so the site's own checks run.

-- Banner signing: same rule as saving the form.
create function public.svc_form_banner_target(p_actor uuid, p_form_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform set_config('request.jwt.claims', jsonb_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
 if not exists(select 1 from public.lounge_forms where id = p_form_id) then raise exception 'Form not found' using errcode = 'no_data_found'; end if;
 if not private.is_active_member() or private.manages_form(p_form_id) is not true then raise exception 'You cannot change this form' using errcode = 'insufficient_privilege'; end if;
 if exists(select 1 from public.approval_requests r where r.target_form_id = p_form_id and r.status = 'pending' and r.type in ('form_publish','form_delete')) and not private.is_super_admin() then
  raise exception 'This form is waiting for approval; cancel the request to change it' using errcode = 'PT409';
 end if;
 return jsonb_build_object('form_id', p_form_id);
end; $$;

-- Match submit's form → event → member lock order, including the member-wide quota.
create function public.svc_form_file_start(p_actor uuid, p_form_id uuid, p_field_key text, p_name text, p_mime text, p_size bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 f public.lounge_forms; fld jsonb; v_accept text; v_max integer; v_rev text; v_id uuid := gen_random_uuid();
 v_name text := private.clean_file_name(p_name, 200); v_email text; v_n integer; v_ext text;
begin
 perform set_config('request.jwt.claims', jsonb_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
 if not private.is_active_member() then raise exception 'Account is not active' using errcode = '42501'; end if;
 if p_mime is null or p_mime not in ('image/webp','image/jpeg','image/png','application/pdf') then raise exception 'This file type is not allowed' using errcode = '22023'; end if;
 if p_size is null or p_size < 1 or p_size > (case when p_mime = 'application/pdf' then 10485760 else 5242880 end) then raise exception 'This file is too large' using errcode = '22023'; end if;
 select * into f from public.lounge_forms where id = p_form_id for share;
 if not found then raise exception 'This form is closed or outside your audience' using errcode = '42501'; end if;
 if f.event_id is not null then perform 1 from public.events where id = f.event_id for share; end if;
 select email into v_email from public.members where id = p_actor for update;
 if not private.is_active_member() or not private.can_submit_form(f.id) then raise exception 'This form is closed or outside your audience' using errcode = '42501'; end if;
 select x into fld from jsonb_array_elements(f.fields) x where x->>'key' = p_field_key and x->>'type' = 'file';
 if fld is null then raise exception 'This question does not take files' using errcode = '22023'; end if;
 v_accept := fld->>'accept'; v_max := coalesce((fld->>'max_files')::integer, 1);
 if (v_accept = 'image' and p_mime = 'application/pdf') or (v_accept = 'pdf' and p_mime <> 'application/pdf') then raise exception 'This question does not accept that kind of file' using errcode = '22023'; end if;
 -- A rejected application is corrected in place (submit_lounge_form), so it may attach new files.
 select review_status into v_rev from public.form_responses where form_id = p_form_id and member_id = p_actor;
 if found and v_rev <> 'rejected' then raise exception 'You have already submitted this form' using errcode = 'PT409'; end if;
 update public.form_files set status = 'delete_pending' where member_id = p_actor
   and status in ('uploading','ready') and created_at < now() - interval '24 hours';
 select count(*) into v_n from public.form_files where member_id = p_actor and form_id = p_form_id and field_key = p_field_key and status in ('uploading','ready');
 if v_n >= v_max then raise exception 'You can attach at most % file(s) to this question', v_max using errcode = '22023'; end if;
 -- Room for retries and swaps (3x the limit + 5), but a bounded number of live Drive upload URLs.
 delete from private.form_file_starts where member_id = p_actor and started_at < now() - interval '7 days';
 if (select count(*) from private.form_file_starts where member_id = p_actor and form_id = p_form_id
     and field_key = p_field_key) >= v_max * 3 + 5
 then raise exception 'Too many uploads for this question this week; ask the form''s organisers for help' using errcode = '22023'; end if;
 insert into private.form_file_starts(member_id, form_id, field_key) values (p_actor, p_form_id, p_field_key);
 if (select count(*) from public.form_files where member_id = p_actor and status in ('uploading','ready')) >= 50 then raise exception 'Too many pending uploads; submit a form or remove some files' using errcode = '22023'; end if;
 v_ext := case p_mime when 'image/webp' then 'webp' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else 'pdf' end;
 insert into public.form_files(id, form_id, field_key, member_id, original_name, mime, size_bytes) values (v_id, p_form_id, p_field_key, p_actor, v_name, p_mime, p_size);
 return jsonb_build_object('file_id', v_id, 'form_id', p_form_id, 'name', v_name,
   'drive_name', private.clean_file_name(split_part(v_email, '@', 1), 40) || ' – ' || private.clean_file_name(fld->>'label', 60) || ' – ' || (v_n + 1) || '.' || v_ext,
   'form_title', private.clean_file_name(f.title, 120),
   'root_id', (select folder_id from private.form_drive_root),
   'folder_id', (select folder_id from private.form_drive_folders where form_id = p_form_id));
end; $$;

-- Persist the session before exposing its URL. Recheck authorization after the Drive calls.
create function public.svc_form_file_session(p_actor uuid, p_file_id uuid, p_drive_file_id text, p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.lounge_forms; r public.form_files;
begin
 perform set_config('request.jwt.claims', jsonb_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
 select * into r from public.form_files where id = p_file_id and member_id = p_actor;
 if not found then raise exception 'This upload can no longer be started' using errcode = 'PT409'; end if;
 select * into f from public.lounge_forms where id = r.form_id for share;
 if f.event_id is not null then perform 1 from public.events where id = f.event_id for share; end if;
 perform 1 from public.members where id = p_actor for update;
 if not private.is_active_member() or not private.can_submit_form(f.id) then
  raise exception 'This form is closed or outside your audience' using errcode = '42501';
 end if;
 if not exists(select 1 from jsonb_array_elements(f.fields) x where x->>'key' = r.field_key
     and x->>'type' = 'file' and (x->>'accept' = 'any'
          or (x->>'accept' = 'pdf' and r.mime = 'application/pdf')
          or (x->>'accept' = 'image' and r.mime like 'image/%')))
    or exists(select 1 from public.form_responses where form_id = f.id and member_id = p_actor and review_status <> 'rejected')
 then raise exception 'This upload can no longer be started' using errcode = 'PT409'; end if;
 update public.form_files set drive_file_id = p_drive_file_id, upload_session_url = p_url
 where id = p_file_id and member_id = p_actor and status = 'uploading' and drive_file_id is null
   and created_at >= now() - interval '24 hours';
 if not found then raise exception 'This upload can no longer be started' using errcode = 'PT409'; end if;
end; $$;

-- Only metadata for the caller's pending files is returned. Interrupted uploads can be removed.
create function public.svc_form_file_list(p_actor uuid, p_form_id uuid) returns jsonb
language sql security definer set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object('file_id',id,'field_key',field_key,'name',original_name,
   'mime',mime,'size',size_bytes,'status',status) order by created_at,id), '[]'::jsonb)
 from public.form_files
 where member_id = p_actor and form_id = p_form_id and status in ('uploading','ready')
   and created_at >= now() - interval '24 hours'
   and exists(select 1 from public.members m where m.id = p_actor and m.account_status = 'active' and m.deleted_at is null);
$$;

-- First writer wins; the loser deletes its own (empty) Drive folder and uses the returned id.
create function public.svc_form_drive_root_set(p_folder_id text) returns text
language plpgsql security definer set search_path = '' as $$
begin
 insert into private.form_drive_root(folder_id) values (p_folder_id) on conflict do nothing;
 return (select folder_id from private.form_drive_root);
end; $$;
create function public.svc_form_drive_folder_set(p_form_id uuid, p_folder_id text) returns text
language plpgsql security definer set search_path = '' as $$
begin
 insert into private.form_drive_folders(form_id, folder_id) values (p_form_id, p_folder_id) on conflict do nothing;
 return (select folder_id from private.form_drive_folders where form_id = p_form_id);
end; $$;

-- Finish: the caller's own row, still pending. Returns what Drive must match.
create function public.svc_form_file_finish_target(p_actor uuid, p_file_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.form_files;
begin
 select * into r from public.form_files where id = p_file_id and member_id = p_actor for update;
 if not found then raise exception 'File not found' using errcode = 'no_data_found'; end if;
 if r.status not in ('uploading','ready') then raise exception 'This file can no longer be changed' using errcode = 'PT409'; end if;
 return jsonb_build_object('file_id', r.id, 'form_id', r.form_id, 'mime', r.mime, 'size_bytes', r.size_bytes, 'status', r.status,
   'drive_file_id', r.drive_file_id, 'folder_id', (select folder_id from private.form_drive_folders where form_id = r.form_id));
end; $$;

create function public.svc_form_file_finish_ok(p_actor uuid, p_file_id uuid, p_drive_file_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.form_files;
begin
 select * into r from public.form_files where id = p_file_id and member_id = p_actor for update;
 if not found then raise exception 'File not found' using errcode = 'no_data_found'; end if;
 if r.status = 'ready' and r.drive_file_id = p_drive_file_id then null;
 elsif r.status = 'uploading' and (r.drive_file_id is null or r.drive_file_id = p_drive_file_id) then
  update public.form_files set status = 'ready', drive_file_id = p_drive_file_id, upload_session_url = null where id = r.id;
 else raise exception 'This file can no longer be changed' using errcode = 'PT409'; end if;
 return jsonb_build_object('file_id', r.id, 'name', r.original_name, 'mime', r.mime, 'size', r.size_bytes);
end; $$;

-- Verification failure can only queue an uploading row. Explicit removal may queue a ready row.
create function public.svc_form_file_discard(p_actor uuid, p_file_id uuid, p_uploading_only boolean default false) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
 select status into v_status from public.form_files where id = p_file_id and member_id = p_actor for update;
 if p_uploading_only and v_status is distinct from 'uploading' then return false; end if;
 if not found then return false; end if;
 if v_status = 'attached' then raise exception 'A submitted file cannot be removed' using errcode = 'PT409'; end if;
 update public.form_files set status = 'delete_pending' where id = p_file_id;
 return true;
end; $$;

-- View: only people who manage the form, only submitted files.
create function public.svc_form_file_view_target(p_actor uuid, p_file_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.form_files;
begin
 perform set_config('request.jwt.claims', jsonb_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
 select * into r from public.form_files where id = p_file_id;
 if not found or r.status <> 'attached' or r.drive_file_id is null then raise exception 'File not found' using errcode = 'no_data_found'; end if;
 if not private.is_active_member() or private.manages_form(r.form_id) is not true then raise exception 'This file is outside your organizer scope' using errcode = '42501'; end if;
 return jsonb_build_object('file_id', r.id, 'drive_file_id', r.drive_file_id, 'mime', r.mime, 'name', r.original_name, 'size', r.size_bytes);
end; $$;

-- Claim rows before any Drive calls. A short retry interval lets other work progress
-- even if a session is still live, a worker exits, or a Drive request fails.
create function public.svc_form_files_sweep(p_limit integer default 10, p_member_id uuid default null, p_file_id uuid default null) returns jsonb
language sql security definer set search_path = '' as $$
 with live as (
  select id from public.form_files
  where next_sweep_at <= clock_timestamp()
    and (p_file_id is null or id = p_file_id)
    and (p_member_id is null or member_id = p_member_id)
    and (status = 'delete_pending' or (p_member_id is null and p_file_id is null
      and status in ('uploading','ready') and created_at < now() - interval '24 hours'))
  order by next_sweep_at, created_at, id
  limit greatest(1, least(coalesce(p_limit, 10), 200))
  for update skip locked
 ), claimed as (
  update public.form_files f set status = 'delete_pending', next_sweep_at = clock_timestamp() + interval '2 minutes'
  from live where f.id = live.id returning f.id, f.drive_file_id, f.upload_session_url
 ), archived as (
  select id from private.form_file_erasure
  where delete_pending and next_sweep_at <= clock_timestamp()
    and (p_file_id is null or id = p_file_id)
    and (p_member_id is null or member_id = p_member_id)
  order by next_sweep_at, id
  limit (select greatest(0, greatest(1, least(coalesce(p_limit, 10), 200)) - count(*)) from claimed)
  for update skip locked
 ), archived_claimed as (
  update private.form_file_erasure f set next_sweep_at = clock_timestamp() + interval '2 minutes'
  from archived where f.id = archived.id returning f.id, f.drive_file_id, f.upload_session_url
 )
 select coalesce(jsonb_agg(to_jsonb(rows)), '[]'::jsonb)
 from (select * from claimed union all select * from archived_claimed) rows;
$$;

create function public.svc_form_files_remaining(p_member_id uuid) returns integer
language sql security definer set search_path = '' as $$
 select (select count(*) from public.form_files where member_id = p_member_id and status = 'delete_pending')
      + (select count(*) from private.form_file_erasure where member_id = p_member_id and delete_pending);
$$;

-- Separate statements let an erasure moved by a concurrent form delete still be reconciled.
create function public.svc_form_files_done(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer; m integer;
begin
 delete from public.form_files where id = any(p_ids) and status = 'delete_pending';
 get diagnostics n = row_count;
 delete from private.form_file_erasure where id = any(p_ids) and delete_pending;
 get diagnostics m = row_count;
 return n + m;
end; $$;

revoke execute on function
 public.svc_form_banner_target(uuid, uuid),
 public.svc_form_file_start(uuid, uuid, text, text, text, bigint),
 public.svc_form_drive_root_set(text),
 public.svc_form_drive_folder_set(uuid, text),
 public.svc_form_file_finish_target(uuid, uuid),
 public.svc_form_file_finish_ok(uuid, uuid, text),
 public.svc_form_file_discard(uuid, uuid, boolean),
 public.svc_form_file_session(uuid, uuid, text, text),
 public.svc_form_file_list(uuid, uuid),
 public.svc_form_file_view_target(uuid, uuid),
 public.svc_form_files_sweep(integer, uuid, uuid),
 public.svc_form_files_remaining(uuid),
 public.svc_form_files_done(uuid[])
 from public, anon, authenticated;
grant execute on function
 public.svc_form_banner_target(uuid, uuid),
 public.svc_form_file_start(uuid, uuid, text, text, text, bigint),
 public.svc_form_drive_root_set(text),
 public.svc_form_drive_folder_set(uuid, text),
 public.svc_form_file_finish_target(uuid, uuid),
 public.svc_form_file_finish_ok(uuid, uuid, text),
 public.svc_form_file_discard(uuid, uuid, boolean),
 public.svc_form_file_session(uuid, uuid, text, text),
 public.svc_form_file_list(uuid, uuid),
 public.svc_form_file_view_target(uuid, uuid),
 public.svc_form_files_sweep(integer, uuid, uuid),
 public.svc_form_files_remaining(uuid),
 public.svc_form_files_done(uuid[])
 to service_role;

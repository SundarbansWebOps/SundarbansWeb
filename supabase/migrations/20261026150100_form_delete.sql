-- Super Admin hard-deletes a lounge form (and its responses). Anyone else who manages the form
-- asks through a form_delete request. After the form is gone, a linked event can be set to No form.

-- Completed requests keep their row after the form is wiped.
alter table public.approval_requests drop constraint approval_requests_target_form_id_fkey;
alter table public.approval_requests add constraint approval_requests_target_form_id_fkey
  foreign key (target_form_id) references public.lounge_forms (id) on delete set null;

alter table public.approval_requests drop constraint approval_requests_target_shape;
alter table public.approval_requests add constraint approval_requests_target_shape check (
  (type in ('member_deletion','member_blacklist','member_hard_delete','member_profile_update','member_status_change','position_change','member_contact_change','community_tag_removal')
   and target_registration_id is null and target_event_id is null and target_form_id is null)
  or (type in ('community_record_update','community_record_deletion')
      and target_registration_id is not null and target_event_id is null and target_form_id is null)
  or (type='event_publish' and target_event_id is not null and target_registration_id is null and target_form_id is null)
  or (type in ('form_publish','form_delete')
      and target_registration_id is null and target_event_id is null
      and (target_form_id is not null or status <> 'pending')));

-- One pending publish or delete per form. A Head may still have several forms waiting.
drop index public.approval_requests_one_pending_per_form;
create unique index approval_requests_one_pending_per_form on public.approval_requests (target_form_id)
 where status='pending' and type in ('form_publish','form_delete');

-- Freeze the form while any form request is pending (publish or delete). Super Admin still edits.
create or replace function private.gate_form_publish() returns trigger language plpgsql security definer set search_path='' as $$
declare v_was_published boolean;
begin
 if auth.uid() is null or private.is_super_admin() then return new; end if;
 if exists(select 1 from public.approval_requests r where r.target_form_id=new.id and r.status='pending' and r.type in ('form_publish','form_delete')) then
  raise exception 'This form is waiting for a Super Admin; cancel the request to edit it' using errcode='PT409';
 end if;
 if tg_op='UPDATE' then v_was_published:=old.published_at is not null;
 else v_was_published:=exists(select 1 from public.lounge_forms f where f.id=new.id and f.published_at is not null); end if;
 if new.published_at is not null and not v_was_published and private.form_needs_publish_approval(new.community_id,new.event_id) then
  raise exception 'A Super Admin publishes Head and Co-Head forms; send it for approval' using errcode='42501';
 end if;
 return new;
end; $$;

-- ── Wipe ────────────────────────────────────────────────────────────────────

-- Registrations point at responses; responses point at the form. Invites cascade from the form.
create function private.delete_lounge_form_rows(p_form_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 delete from public.event_registrations
  where response_id in (select id from public.form_responses where form_id=p_form_id);
 delete from public.form_responses where form_id=p_form_id;
 delete from public.lounge_forms where id=p_form_id;
end; $$;
revoke execute on function private.delete_lounge_form_rows(uuid) from public,anon,authenticated,service_role;

create function private.reject_pending_form_requests(p_form_id uuid, p_keep uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare v_row public.approval_requests%rowtype;
begin
 for v_row in
  select * from public.approval_requests
   where target_form_id=p_form_id and status='pending' and (p_keep is null or id<>p_keep)
  for update
 loop
  update public.approval_requests
     set status='rejected', reviewed_by=auth.uid(), reviewed_at=now(),
         review_note='The form was removed'
   where id=v_row.id;
  perform private.write_audit('request.reject','approval_requests',v_row.id::text,
   jsonb_build_object('status','pending'),
   jsonb_build_object('status','rejected','type',v_row.type,'review_note','The form was removed'),
   v_row.id);
 end loop;
end; $$;
revoke execute on function private.reject_pending_form_requests(uuid,uuid) from public,anon,authenticated,service_role;

create function public.delete_lounge_form(p_form_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_form public.lounge_forms%rowtype;
declare v_responses integer;
begin
 if not private.is_super_admin() then
  raise exception 'Only a Super Admin can remove a form' using errcode='42501';
 end if;
 select * into v_form from public.lounge_forms where id=p_form_id for update;
 if not found then raise exception 'This form is outside your organizer scope' using errcode='42501'; end if;
 select count(*)::int into v_responses from public.form_responses where form_id=v_form.id;
 perform private.reject_pending_form_requests(v_form.id);
 perform private.write_audit('form.delete','lounge_forms',v_form.id::text,
  to_jsonb(v_form)||jsonb_build_object('response_count',v_responses),null);
 perform private.delete_lounge_form_rows(v_form.id);
end; $$;
revoke execute on function public.delete_lounge_form(uuid) from public,anon,service_role;
grant execute on function public.delete_lounge_form(uuid) to authenticated;

create function public.request_form_delete(p_form_id uuid, p_reason text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 v_form public.lounge_forms%rowtype;
 v_reason text:=coalesce(private.clean_reason(p_reason,false),'Remove this form');
 v_request public.approval_requests%rowtype;
 v_responses integer;
begin
 select * into v_form from public.lounge_forms where id=p_form_id for update;
 if not found or not private.is_active_member() or not private.manages_form(v_form.id)
    or private.is_super_admin() then
  raise exception 'Only an organizer who manages this form can ask a Super Admin to remove it'
    using errcode='42501';
 end if;
 select count(*)::int into v_responses from public.form_responses where form_id=v_form.id;
 begin
  insert into public.approval_requests(type,target_member_id,target_form_id,target_snapshot,requested_change,reason,requested_by)
  values('form_delete',auth.uid(),v_form.id,
         jsonb_build_object('form',to_jsonb(v_form),'response_count',v_responses),
         jsonb_build_object('form_id',v_form.id,'form_title',v_form.title,'event_id',v_form.event_id,
                            'response_count',v_responses),
         v_reason,auth.uid())
  returning * into v_request;
 exception when unique_violation then
  raise exception 'This form is already waiting for approval' using errcode='unique_violation';
 end;
 perform private.write_audit('request.create','approval_requests',v_request.id::text,null,
  jsonb_build_object('type',v_request.type,'form_id',v_form.id,'form_title',v_form.title,'reason',v_reason),
  v_request.id);
 return v_request.id;
end; $$;
revoke execute on function public.request_form_delete(uuid,text) from public,anon,service_role;
grant execute on function public.request_form_delete(uuid,text) to authenticated;

create function private.approve_form_delete(p_request public.approval_requests, p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_form public.lounge_forms%rowtype;
declare v_responses integer;
begin
 select * into v_form from public.lounge_forms where id=p_request.target_form_id for update;
 if not found then raise exception 'The form was already removed; reject this request instead' using errcode='PT409'; end if;
 select count(*)::int into v_responses from public.form_responses where form_id=v_form.id;
 perform private.reject_pending_form_requests(v_form.id, p_request.id);
 update public.approval_requests
    set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),review_note=p_note,executed_at=now()
  where id=p_request.id;
 perform private.write_audit('request.approve','approval_requests',p_request.id::text,
  jsonb_build_object('form',to_jsonb(v_form),'response_count',v_responses),
  jsonb_build_object('type',p_request.type,'form_id',v_form.id,'form_title',v_form.title,'review_note',p_note),
  p_request.id);
 perform private.write_audit('form.delete','lounge_forms',v_form.id::text,
  to_jsonb(v_form)||jsonb_build_object('response_count',v_responses),null,p_request.id);
 perform private.delete_lounge_form_rows(v_form.id);
 return p_request.id;
end; $$;
revoke execute on function private.approve_form_delete(public.approval_requests,text) from public,anon,authenticated,service_role;

-- Same anchor as form_publish / event_publish (20261024120100, 20261013194628).
do $patch$ declare body text:=pg_get_functiondef('public.approve_request(uuid,text)'::regprocedure); anchor text:='  -- Re-check the target now; things may have changed since the request was filed.'; begin
 if position(anchor in body)=0 then raise exception 'approve_request changed: anchor not found, update this migration'; end if;
 execute replace(body,anchor,
  '  if v_request.type = ''form_delete'' then'||chr(10)||
  '    return private.approve_form_delete(v_request, v_note);'||chr(10)||
  '  end if;'||chr(10)||chr(10)||anchor);
end $patch$;

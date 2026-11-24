-- A Super Admin who publishes a form straight from the editor while a Head or Co-Head's
-- form_publish request is pending left that request pending (live: "Prompt To Web", 2026-11-24).
-- The form showed as published and waiting for approval at once, and the pending request froze it,
-- so its Co-Head could no longer edit it. Publishing it is the approval: close the request.

-- approve_form_publish (20261024120100) closes its own request after publishing; the flag tells the
-- trigger below to leave that one alone. Body unchanged apart from the set_config line.
create or replace function private.approve_form_publish(p_request public.approval_requests,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_form public.lounge_forms%rowtype;
begin
 select * into v_form from public.lounge_forms where id=p_request.target_form_id for update;
 if not found then raise exception 'The form was removed; reject this request instead' using errcode='PT409'; end if;
 if v_form.published_at is not null then raise exception 'The form is already published; reject this request instead' using errcode='PT409'; end if;
 if v_form.archived_at is not null then raise exception 'The form was archived; reject this request instead' using errcode='PT409'; end if;
 if v_form.closes_at is not null and v_form.closes_at<=now() then
  raise exception 'The form has already closed; reject this request instead' using errcode='PT409';
 end if;
 perform set_config('sundarbans.approving_form_request',p_request.id::text,true);
 update public.lounge_forms set published_at=now(),updated_at=now() where id=v_form.id;
 update public.approval_requests
    set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),review_note=p_note,executed_at=now()
  where id=p_request.id;
 perform private.write_audit('request.approve','approval_requests',p_request.id::text,
  jsonb_build_object('form',to_jsonb(v_form)),
  jsonb_build_object('type',p_request.type,'form_id',v_form.id,'form_title',v_form.title,'published',true,'review_note',p_note),
  p_request.id);
 return p_request.id;
end; $$;
revoke execute on function private.approve_form_publish(public.approval_requests,text) from public,anon,authenticated,service_role;

-- From 20261026150100, with the Super Admin publish closing a pending form_publish request.
create or replace function private.gate_form_publish() returns trigger language plpgsql security definer set search_path='' as $$
declare v_was_published boolean; v_row public.approval_requests%rowtype;
begin
 if tg_op='UPDATE' then v_was_published:=old.published_at is not null;
 else v_was_published:=exists(select 1 from public.lounge_forms f where f.id=new.id and f.published_at is not null); end if;
 if auth.uid() is null then return new; end if;
 if private.is_super_admin() then
  if new.published_at is not null and not v_was_published then
   for v_row in
    select * from public.approval_requests
     where target_form_id=new.id and type='form_publish' and status='pending'
       and id::text is distinct from nullif(current_setting('sundarbans.approving_form_request',true),'')
    for update
   loop
    update public.approval_requests
       set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),executed_at=now(),
           review_note='Published by a Super Admin from the form editor'
     where id=v_row.id;
    perform private.write_audit('request.approve','approval_requests',v_row.id::text,
     jsonb_build_object('status','pending'),
     jsonb_build_object('type',v_row.type,'form_id',new.id,'form_title',new.title,'published',true,
                        'review_note','Published by a Super Admin from the form editor'),
     v_row.id);
   end loop;
  end if;
  return new;
 end if;
 if exists(select 1 from public.approval_requests r where r.target_form_id=new.id and r.status='pending' and r.type in ('form_publish','form_delete')) then
  raise exception 'This form is waiting for a Super Admin; cancel the request to edit it' using errcode='PT409';
 end if;
 if new.published_at is not null and not v_was_published and private.form_needs_publish_approval(new.community_id,new.event_id) then
  raise exception 'A Super Admin publishes Head and Co-Head forms; send it for approval' using errcode='42501';
 end if;
 return new;
end; $$;
revoke execute on function private.gate_form_publish() from public,anon,authenticated,service_role;

-- Repair: close publish requests whose form a Super Admin already published, crediting the
-- Super Admin whose save published it (from the audit log). No such save found: left pending.
do $repair$
declare v_row record;
begin
 for v_row in
  select r.id, r.type, f.id form_id, f.title,
         (select a.actor_id from public.audit_log a
           where a.action='form.save' and a.target_id=f.id::text
             and a.new_values->>'published_at' is not null
             and private.is_super_admin_id(a.actor_id)
           order by a.created_at desc limit 1) actor
    from public.approval_requests r
    join public.lounge_forms f on f.id=r.target_form_id
   where r.type='form_publish' and r.status='pending' and f.published_at is not null
 loop
  continue when v_row.actor is null;
  update public.approval_requests
     set status='approved',reviewed_by=v_row.actor,reviewed_at=now(),executed_at=now(),
         review_note='Published by a Super Admin from the form editor'
   where id=v_row.id;
  perform private.write_audit('request.approve','approval_requests',v_row.id::text,
   jsonb_build_object('status','pending'),
   jsonb_build_object('type',v_row.type,'form_id',v_row.form_id,'form_title',v_row.title,'published',true,
                      'review_note','Published by a Super Admin from the form editor','repair',true),
   v_row.id);
 end loop;
end $repair$;

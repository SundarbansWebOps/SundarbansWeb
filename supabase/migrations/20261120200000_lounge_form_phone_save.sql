-- "Save your phone number for later" must never cost a member their form response. The old check
-- looked only at the admin roster, while members.phone is unique across every account, so a number
-- already on another account (often the same student's second login) slipped past it. The update
-- then raised members_phone_key and rolled back the whole submission. Now a number that is taken
-- anywhere is simply not saved; the answer still carries it, and the response goes in.
create or replace function pg_temp.patch_once(p_body text, p_anchor text, p_new text) returns text
language plpgsql as $$
begin
 if (length(p_body) - length(replace(p_body, p_anchor, ''))) / length(p_anchor) <> 1 then
  raise exception 'anchor not found exactly once, update this migration: %', left(p_anchor, 80);
 end if;
 return replace(p_body, p_anchor, p_new);
end; $$;

do $patch$
declare b text := pg_get_functiondef('public.submit_lounge_form(uuid,jsonb,boolean)'::regprocedure);
begin
 -- Anchored on statements, not lines, so the patch does not depend on the body's indentation.
 b := pg_temp.patch_once(b,
  $a$if exists(select 1 from public.member_roster where phone=v_phone) then raise exception 'Phone already belongs to another student' using errcode='23505'; end if;$a$,
  $a$if not exists(select 1 from public.members where phone=v_phone and id<>auth.uid())
     and not exists(select 1 from public.member_roster where phone=v_phone) then
   -- Another account can take the number between the check and the write.
   begin$a$);
 b := pg_temp.patch_once(b,
  $a$update public.members set phone=v_phone where id=auth.uid();$a$,
  $a$update public.members set phone=v_phone where id=auth.uid();
   exception when unique_violation then null;
   end;
  end if;$a$);
 execute b;
end $patch$;

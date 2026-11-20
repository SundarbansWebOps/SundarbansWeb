-- A guest who registers for a PAN BS event gets the form's WhatsApp invite as the last step, as a
-- member does after a Lounge submit. Only a fresh registration returns it; nobody proves they own
-- the email here, so the invite is as open as the form itself.
create or replace function pg_temp.patch_once(p_body text, p_anchor text, p_new text) returns text
language plpgsql as $$
begin
 if (length(p_body) - length(replace(p_body, p_anchor, ''))) / length(p_anchor) <> 1 then
  raise exception 'anchor not found exactly once, update this migration: %', left(p_anchor, 80);
 end if;
 return replace(p_body, p_anchor, p_new);
end; $$;

do $patch$
declare b text := pg_get_functiondef('public.submit_panbs_registration(uuid,text,text,text,text,jsonb)'::regprocedure);
begin
 b := pg_temp.patch_once(b, $a$return jsonb_build_object('registered', true);$a$,
  $a$return jsonb_build_object('registered', true, 'invite_url',
    (select i.invite_url from private.lounge_form_invites i where i.form_id = f.id));$a$);
 execute b;
end $patch$;

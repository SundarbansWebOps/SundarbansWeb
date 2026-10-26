-- Open sessions: members join without a registration form (owner, 2026-10-26).
-- * register: current path. Link a form; Lounge shows Register; certificates stay possible.
-- * open: Lounge shows "Open to all"; Join on Meet when live. No form. Public visitors still
--   do not get the Meet link.

alter table public.events add column entry_mode text not null default 'register';
alter table public.events add constraint events_entry_mode_known
  check (entry_mode in ('register', 'open'));
comment on column public.events.entry_mode is
  'register: members sign up on a linked form; open: walk-in for the event audience, no form';
grant insert (entry_mode), update (entry_mode) on public.events to authenticated;

-- An open session cannot carry a registration form, and a form cannot be bound to one.
create function private.forbid_open_session_form() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'lounge_forms' then
    if new.event_id is not null and exists (
      select 1 from public.events e where e.id = new.event_id and e.entry_mode = 'open'
    ) then
      raise exception 'Open sessions do not take a registration form' using errcode = '22023';
    end if;
    return new;
  end if;
  if new.entry_mode = 'open' and exists (
    select 1 from public.lounge_forms f where f.event_id = new.id
  ) then
    raise exception 'Remove the registration form before making this an open session'
      using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke execute on function private.forbid_open_session_form() from public, anon, authenticated, service_role;

create trigger lounge_forms_open_session
  before insert or update on public.lounge_forms
  for each row execute function private.forbid_open_session_form();
create trigger events_open_session_form
  before insert or update on public.events
  for each row execute function private.forbid_open_session_form();

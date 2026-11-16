-- PANBS events (spec 007): house-wide public events every IITM BS student can register for
-- without signing in. A signed-out registration is always a guest row (members included; the admin
-- list flags them). Signed-in members register through the Lounge as usual.

alter table public.events add column panbs boolean not null default false;
alter table public.events add constraint events_panbs_house_wide_public
  check (not panbs or (is_public and region_id is null and community_id is null
                       and cardinality(audience_cohorts) = 0));
comment on column public.events.panbs is
  'PANBS: open to every IITM BS student; listed publicly and takes registrations without sign-in';
grant insert (panbs), update (panbs) on public.events to authenticated;

create table public.form_guest_responses (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.lounge_forms(id) on delete cascade,
  email        text not null check (email = lower(btrim(email)) and length(email) <= 320),
  full_name    text not null check (full_name = btrim(full_name) and length(full_name) between 1 and 200),
  phone        text,
  house        text not null,
  on_roster    boolean not null default false,
  field_schema jsonb not null,
  answers      jsonb not null check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 60000),
  submitted_at timestamptz not null default now(),
  unique (form_id, email)
);
comment on table public.form_guest_responses is
  'Signed-out PANBS registrations (anyone with an IITM email, members included). Read via list_form_guests.';
alter table public.form_guest_responses enable row level security;
revoke all on table public.form_guest_responses from public, anon, authenticated, service_role;

-- The 12 IITM BS houses, as the public form offers them.
create function private.iitm_houses() returns text[]
language sql immutable set search_path = '' as $$
  select array['Bandipur','Corbett','Gir','Kanha','Kaziranga','Namdapha','Nallamala','Nilgiri',
               'Pichavaram','Saranda','Sundarbans','Wayanad'];
$$;
revoke execute on function private.iitm_houses() from public, anon, authenticated, service_role;

-- A PANBS event's form that is taking registrations right now (no sign-in needed).
create function private.panbs_form_open(p_form uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lounge_forms f join public.events e on e.id = f.event_id
    where f.id = p_form and e.panbs and e.published_at is not null and e.published_at <= now()
      and e.deleted_at is null and e.cancelled_at is null and not e.archive and e.ends_at > now()
      and f.is_open and f.archived_at is null and f.published_at is not null and f.published_at <= now()
      and (f.opens_at is null or f.opens_at <= now()) and (f.closes_at is null or f.closes_at > now())
      and cardinality(f.audience_cohorts) = 0);
$$;
revoke execute on function private.panbs_form_open(uuid) from public, anon, authenticated, service_role;

-- Same answer rules as submit_lounge_form; returns the answers with phone numbers normalised.
create function private.clean_form_answers(p_fields jsonb, p_answers jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare field jsonb; k text; val jsonb; a jsonb := p_answers;
begin
 if jsonb_typeof(a) is distinct from 'object' or octet_length(a::text) > 60000 then raise exception 'Invalid answers' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(a) q(key) where not exists(select 1 from jsonb_array_elements(p_fields) x where x->>'key'=q.key)) then raise exception 'Unknown answer field' using errcode='22023'; end if;
 for field in select value from jsonb_array_elements(p_fields) loop
  k:=field->>'key'; val:=a->k;
  if coalesce((field->>'required')::boolean,false) and (val is null or val='null'::jsonb or (jsonb_typeof(val)='string' and nullif(btrim(a->>k),'') is null) or (field->>'type'='checkbox' and val<>'true'::jsonb)) then raise exception 'Required field: %',field->>'label' using errcode='22023'; end if;
  if val is null or val='null'::jsonb then continue; end if;
  if field->>'type'='checkbox' then
   if jsonb_typeof(val)<>'boolean' then raise exception 'Checkbox must be true or false' using errcode='22023'; end if;
  elsif field->>'type'='multiselect' then
   if jsonb_typeof(val)<>'array' or jsonb_array_length(val)>100 or exists(select 1 from jsonb_array_elements(val) x where jsonb_typeof(x)<>'string' or length(x#>>'{}')>300) or (select count(*) from jsonb_array_elements(val))<>(select count(distinct x) from jsonb_array_elements(val) x) then raise exception 'Choose distinct listed options' using errcode='22023'; end if;
   if exists(select 1 from jsonb_array_elements_text(val) x where not exists(select 1 from jsonb_array_elements_text(field->'options') o where o=x) and not(coalesce((field->>'allow_other')::boolean,false) and x like 'Other:%' and length(x)>6)) then raise exception 'Choose a listed option or permitted Other answer' using errcode='22023'; end if;
   if coalesce((field->>'required')::boolean,false) and jsonb_array_length(val)=0 then raise exception 'Required field: %',field->>'label' using errcode='22023'; end if;
  else
   if jsonb_typeof(val)<>'string' or length(a->>k)>10000 then raise exception 'Answer must be text, at most 10000 characters' using errcode='22023'; end if;
   if field->>'type'='select' and (a->>k)<>'' and not exists(select 1 from jsonb_array_elements_text(field->'options') o where o=a->>k) and not(coalesce((field->>'allow_other')::boolean,false) and (a->>k) like 'Other:%' and length(a->>k)>6) then raise exception 'Choose a listed option' using errcode='22023'; end if;
   if field->>'type'='email' and (a->>k)<>'' and (a->>k) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid email answer' using errcode='22023'; end if;
   if field->>'type'='phone' then a:=jsonb_set(a,array[k],coalesce(to_jsonb(private.normalise_phone_optional(a->>k)),'null')); end if;
  end if;
 end loop;
 return a;
end; $$;
revoke execute on function private.clean_form_answers(jsonb, jsonb) from public, anon, authenticated, service_role;

-- The public form for a PANBS event, or null when it is not taking registrations.
create function public.get_panbs_form(p_event_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', f.id, 'title', f.title, 'description', f.description,
                            'fields', f.fields, 'closes_at', f.closes_at, 'houses', to_jsonb(private.iitm_houses()))
  from public.lounge_forms f
  where f.event_id = p_event_id and private.panbs_form_open(f.id)
  order by f.created_at desc limit 1;
$$;
revoke execute on function public.get_panbs_form(uuid) from public;
grant execute on function public.get_panbs_form(uuid) to anon, authenticated, service_role;

-- A live PANBS event is joined straight from the public event page, no sign-in or registration.
-- The meeting link is released from 15 minutes before the start until the end, and never earlier.
create function public.get_panbs_join_link(p_event_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select nullif(btrim(e.gmail_link), '')
  from public.events e
  where e.id = p_event_id and e.panbs and e.is_public
    and e.published_at is not null and e.published_at <= now()
    and e.deleted_at is null and e.cancelled_at is null and not e.archive
    and now() >= e.starts_at - interval '15 minutes' and now() < e.ends_at;
$$;
revoke execute on function public.get_panbs_join_link(uuid) from public;
grant execute on function public.get_panbs_join_link(uuid) to anon, authenticated, service_role;

create function public.submit_panbs_registration(p_form_id uuid, p_email text, p_name text,
                                                 p_house text, p_phone text, p_answers jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  f public.lounge_forms; field jsonb;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name  text := btrim(coalesce(p_name, ''));
  v_phone text := private.normalise_phone_optional(p_phone);
  v_house text := btrim(coalesce(p_house, ''));
  a jsonb := coalesce(p_answers, '{}'::jsonb);
  v_on_roster boolean;
begin
  if v_email !~ '^[a-z0-9._%+-]+@([a-z0-9-]+\.)*study\.iitm\.ac\.in$' then
    raise exception 'Use your IITM student email (ending in study.iitm.ac.in)' using errcode='22023';
  end if;
  if length(v_name) not between 1 and 200 then raise exception 'Enter your name' using errcode='22023'; end if;

  select * into f from public.lounge_forms where id = p_form_id for share;
  if found then perform 1 from public.events where id = f.event_id for share; end if;
  if f.id is null or not private.panbs_form_open(f.id) then
    raise exception 'Registration for this event is closed' using errcode='42501';
  end if;

  if jsonb_typeof(a) is distinct from 'object' then raise exception 'Invalid answers' using errcode='22023'; end if;
  -- Fields that prefill name/email/phone take the fixed answers, so nobody types them twice.
  for field in select value from jsonb_array_elements(f.fields) loop
    if field->>'prefill' = 'name' then a := jsonb_set(a, array[field->>'key'], to_jsonb(v_name));
    elsif field->>'prefill' = 'email' then a := jsonb_set(a, array[field->>'key'], to_jsonb(v_email));
    elsif field->>'prefill' = 'phone' then a := jsonb_set(a, array[field->>'key'], coalesce(to_jsonb(v_phone), 'null'));
    end if;
  end loop;
  a := private.clean_form_answers(f.fields, a);

  -- One registration per email per form; serialise racing submits for the same email.
  perform pg_advisory_xact_lock(hashtextextended('panbs:' || f.id::text || ':' || v_email, 0));

  -- Nobody proves they own the email here, so a public registration never writes into a member's
  -- account: everyone is a guest row, and the admin list marks which guests are members. The reply
  -- is the same for every email, so the form cannot be used to probe who is a member or rostered.
  -- The house is checked for everyone before the roster lookup, so no reply depends on the roster.
  if not (v_house = any (private.iitm_houses())) then
    raise exception 'Choose your house' using errcode='22023';
  end if;
  -- Roster and member emails are stored lower-case (constraints), so plain equality uses the index.
  v_on_roster := exists (select 1 from public.member_roster where email = v_email);
  if v_on_roster then v_house := 'Sundarbans'; end if;
  -- A ceiling against scripted floods: no house event comes near this many sign-ups.
  if (select count(*) from public.form_guest_responses where form_id = f.id) >= 5000 then
    raise exception 'Registration for this event is closed' using errcode='42501';
  end if;

  begin
    insert into public.form_guest_responses (form_id, email, full_name, phone, house, on_roster, field_schema, answers)
    values (f.id, v_email, v_name, v_phone, v_house, v_on_roster, f.fields, a);
  exception when unique_violation then
    raise exception 'This email is already registered for this event' using errcode='PT409';
  end;
  return jsonb_build_object('registered', true);
end; $$;
revoke execute on function public.submit_panbs_registration(uuid, text, text, text, text, jsonb) from public;
grant execute on function public.submit_panbs_registration(uuid, text, text, text, text, jsonb) to anon, authenticated, service_role;

-- Guests for a form, for whoever manages it.
create function public.list_form_guests(p_form_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.manages_form(p_form_id) is not true then
    raise exception 'This form is outside your organizer scope' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', g.id, 'email', g.email, 'full_name', g.full_name, 'phone', g.phone, 'house', g.house,
      'on_roster', g.on_roster,
      'is_member', exists (select 1 from public.members m where m.email = g.email and m.deleted_at is null),
      -- The member also registered in the Lounge, so they appear in the member responses too.
      'in_lounge', exists (select 1 from public.members m join public.form_responses r
                             on r.member_id = m.id and r.form_id = g.form_id where m.email = g.email),
      'answers', g.answers, 'field_schema', g.field_schema,
      'submitted_at', g.submitted_at) order by g.submitted_at, g.id)
    from public.form_guest_responses g where g.form_id = p_form_id), '[]');
end; $$;
revoke execute on function public.list_form_guests(uuid) from public, anon;
grant execute on function public.list_form_guests(uuid) to authenticated, service_role;

-- Public listing: adds `panbs` and `registers` (the PANBS form is taking registrations).
create or replace function public.list_public_events()
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'name', e.name, 'description', e.description,
           'registration_link', e.registration_link, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
           'community_id', e.community_id, 'region_id', e.region_id, 'source_key', e.source_key,
           'display_date', e.display_date, 'image_url', e.image_url, 'event_type', e.event_type,
           'wing', e.wing, 'location', e.location, 'image_width', e.image_width,
           'image_height', e.image_height, 'attendee_count', e.attendee_count,
           'attendee_display', e.attendee_display, 'archive', e.archive, 'is_public', e.is_public,
           'panbs', e.panbs,
           'registers', e.panbs and exists (select 1 from public.lounge_forms f
                                            where f.event_id = e.id and private.panbs_form_open(f.id)),
           'community_code', (select c.code from public.communities c where c.id = e.community_id),
           'community_wing', (select c.wing from public.communities c where c.id = e.community_id),
           'stage', case when e.archive or e.ends_at <= now() then 'past'
                         when e.starts_at <= now() then 'live' else 'upcoming' end)
         order by e.starts_at desc nulls last, e.display_date desc), '[]'::jsonb)
  from public.events e
  where e.deleted_at is null and e.published_at is not null and e.published_at <= now()
    and (e.archive or e.ends_at <= now() or (e.is_public and e.cancelled_at is null))
    and (e.community_id is null or not exists (select 1 from public.communities c where c.id = e.community_id and c.members_only));
$function$;

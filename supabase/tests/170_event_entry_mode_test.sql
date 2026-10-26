-- pgTAP: events.entry_mode register|open, and open sessions refuse a form.
-- Self-contained: builds its own fixtures and runs inside begin … rollback. Ids start with c1.
begin;
select no_plan();

create temp table fx (k text primary key, id uuid, email text, region text);
insert into fx values
  ('sa1', 'c1000000-0000-4000-8000-000000000001', '99f9417001@ds.study.iitm.ac.in', 'region_01'),
  ('rc1', 'c1000000-0000-4000-8000-000000000003', '99f9417003@ds.study.iitm.ac.in', 'region_01');
grant select on fx to authenticated, service_role;

insert into public.member_roster (email, full_name, phone, region_id, added_by)
  select fx.email, 'Fixture ' || fx.k, null, (select id from public.regions where code = fx.region),
         (select user_id from public.super_admin_allowlist limit 1)
  from fx;
insert into auth.users (id, email, aud, role, raw_app_meta_data)
  select fx.id, fx.email, 'authenticated', 'authenticated', '{"provider":"google"}'::jsonb from fx;
insert into public.super_admin_allowlist (user_id, label)
  select id, 'test ' || k from fx where k = 'sa1';
insert into public.admin_assignments (member_id, position, region_id, assigned_by)
  select fx.id, 'rc', (select id from public.regions where code = fx.region), (select id from fx where k = 'sa1')
  from fx where k = 'rc1';

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}';

select lives_ok($$ insert into public.events (id, name, starts_at, ends_at, region_id, published_at)
                   values ('c1000000-0000-4000-8000-000000000010', 'Register meetup',
                           now() + interval '2 days', now() + interval '3 days',
                           (select id from public.regions where code = 'region_01'), now()) $$,
  'RC publishes a register event for their own region');
select is((select entry_mode from public.events where id = 'c1000000-0000-4000-8000-000000000010'),
  'register', 'entry_mode defaults to register');

select lives_ok($$ insert into public.events (id, name, starts_at, ends_at, region_id, published_at, entry_mode)
                   values ('c1000000-0000-4000-8000-000000000011', 'Open house hour',
                           now() + interval '2 days', now() + interval '3 days',
                           (select id from public.regions where code = 'region_01'), now(), 'open') $$,
  'RC publishes an open session for their own region');

select throws_ok($$ insert into public.events (name, starts_at, ends_at, region_id, entry_mode)
                   values ('Bad mode', now() + interval '2 days', now() + interval '3 days',
                           (select id from public.regions where code = 'region_01'), 'public') $$,
  '23514', null, 'entry_mode only allows register or open');

select lives_ok($$ select public.save_lounge_form(jsonb_build_object(
                   'id','c1000000-0000-4000-8000-0000000000f1','title','Meetup signup',
                   'event_id','c1000000-0000-4000-8000-000000000010','published_at',now())) $$,
  'a register event can take a form');

select throws_ok($$ select public.save_lounge_form(jsonb_build_object(
                   'title','Open signup','event_id','c1000000-0000-4000-8000-000000000011')) $$,
  '22023', 'Open sessions do not take a registration form',
  'an open session refuses a registration form');

select throws_ok($$ update public.events set entry_mode = 'open'
                   where id = 'c1000000-0000-4000-8000-000000000010' $$,
  '22023', 'Remove the registration form before making this an open session',
  'a linked form blocks switching to open');

select lives_ok($$ select public.save_lounge_form(jsonb_build_object(
                   'id','c1000000-0000-4000-8000-0000000000f1','title','Meetup signup',
                   'region_id',(select id from public.regions where code = 'region_01'))) $$,
  'the form can leave the event');
select lives_ok($$ update public.events set entry_mode = 'open'
                   where id = 'c1000000-0000-4000-8000-000000000010' $$,
  'the event becomes open once no form is linked');

reset role;
select * from finish();
rollback;

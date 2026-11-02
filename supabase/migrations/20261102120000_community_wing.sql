-- Community wing: the event wing that a community's events take (poster colour, filter, label).
-- Owned by the backend so a new community is one row with a wing, not a frontend id map.
-- * communities.wing backfills from code. NOT NULL, so a community cannot exist without a wing.
--   House-wide events have no community and are talks, decided in the frontend (lib/wing.js).
-- * list_public_events and list_lounge_events return community_code and community_wing. Each body
--   copies the latest definition (20261023120000) and only adds those two fields.

-- ── Schema ──────────────────────────────────────────────────────────────────

alter table public.communities add column wing text;
update public.communities set wing = case code
  when 'esports' then 'games'
  when 'technical' then 'tech'
  when 'cultural' then 'cultural'
  when 'girls' then 'girls'
end;
alter table public.communities alter column wing set not null;
alter table public.communities add constraint communities_wing_check check (wing in ('cultural', 'games', 'tech', 'girls'));
comment on column public.communities.wing is
  'Event wing of this community''s events (cultural, games, tech or girls). Read by the public and Lounge event RPCs as community_wing.';

-- ── Events ──────────────────────────────────────────────────────────────────

-- From 20261023120000; adds community_code and community_wing.
create or replace function public.list_public_events()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'name', e.name, 'description', e.description,
           'registration_link', e.registration_link, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
           'community_id', e.community_id, 'region_id', e.region_id, 'source_key', e.source_key,
           'display_date', e.display_date, 'image_url', e.image_url, 'event_type', e.event_type,
           'wing', e.wing, 'location', e.location, 'image_width', e.image_width,
           'image_height', e.image_height, 'attendee_count', e.attendee_count,
           'attendee_display', e.attendee_display, 'archive', e.archive, 'is_public', e.is_public,
           'community_code', (select c.code from public.communities c where c.id = e.community_id),
           'community_wing', (select c.wing from public.communities c where c.id = e.community_id),
           'stage', case when e.archive or e.ends_at <= now() then 'past'
                         when e.starts_at <= now() then 'live' else 'upcoming' end)
         order by e.starts_at desc nulls last, e.display_date desc), '[]'::jsonb)
  from public.events e
  where e.deleted_at is null and e.published_at is not null and e.published_at <= now()
    and (e.archive or e.ends_at <= now() or (e.is_public and e.cancelled_at is null))
    and (e.community_id is null or not exists (select 1 from public.communities c where c.id = e.community_id and c.members_only));
$$;

-- From 20261023120000; adds community_code and community_wing.
create or replace function public.list_lounge_events() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_active_member() then raise exception 'Account is not active' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('stage',case when e.archive or e.ends_at<=now() then 'past' when e.starts_at<=now() then 'live' else 'upcoming' end,'community_code',(select c.code from public.communities c where c.id=e.community_id),'community_wing',(select c.wing from public.communities c where c.id=e.community_id),'can_manage',private.manages_event(e.id),'registration',(select to_jsonb(r) from public.event_registrations r where r.event_id=e.id and r.member_id=auth.uid()),'attendance',(select to_jsonb(a)-'raw_row'-'imported_by' from public.event_attendance a where a.event_id=e.id and a.member_id=auth.uid()),'certificate',(select to_jsonb(c) from public.issued_certificates c where c.event_id=e.id and c.member_id=auth.uid()),'needs_certificate_name',e.certificates_released_at is not null and exists(select 1 from public.event_registrations r join public.event_attendance a on a.event_id=r.event_id and a.member_id=r.member_id where r.event_id=e.id and r.member_id=auth.uid() and ((e.attendance_mode='meet' and a.duration_seconds>=1200) or (e.attendance_mode='reviewed' and a.reviewed_eligible))) and (select certificate_name is null from public.members where id=auth.uid())) order by e.starts_at desc nulls last) from public.events e where e.deleted_at is null and (private.manages_event(e.id) or (e.published_at is not null and e.published_at<=now() and (e.archive or e.ends_at<=now() or private.in_audience(e.region_id,e.audience_cohorts)) and private.sees_community(e.community_id)))),'[]');
end; $$;

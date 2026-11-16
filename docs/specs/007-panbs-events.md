# Spec 007 — PANBS events (open to every IITM BS student)

> Status: building 2026-11-16 on `feat/events-panbs-registration`. Owner decisions: Raja, 2026-11-16.

## What a PANBS event is

A house-wide event for all of IITM BS, not only Sundarbans. It is listed on the public Events
page, looks different from house events, and anyone with an IITM student email can register on
the event page without signing in.

- `events.panbs = true`. A PANBS event is always house-wide (no region, community or cohort) and
  always Public (`is_public`). The admin only picks the type **PANBS**; there is no extra "public"
  label.
- **Who creates it:** Super Admins create and publish directly. An RC drafts it like any other
  house-wide event and asks a Super Admin to publish it (existing `event_publish` request, spec
  004). It stays hidden until approved.
- **Registration form:** the event's linked Lounge form (`lounge_forms.event_id`). No new form type.

## Registering

| Who | Where | What happens |
| --- | --- | --- |
| Signed-in member | Register on the event → opens the form in the Lounge | Existing member flow (`submit_lounge_form`) |
| Anyone else | Register on the event → form opens on the event page | `submit_panbs_registration` (callable without sign-in) |

The public form has fixed fields first — **Name**, **Student email**, **Your house** (the 12 IITM BS
houses), **Phone** (optional) — then the form's own fields. Form fields that prefill name, email or
phone are filled from the fixed fields and not asked twice.

**Email rule:** must end in `study.iitm.ac.in` (`ds.`, `es.`, `mg.`, `ae.` … subdomains included).
Personal Gmail is refused.

**How the server files a public registration** (by email, not by what the visitor picked):

| Email is… | Stored as |
| --- | --- |
| a signed-up Sundarbans member (`members`) | a normal member response + event registration; shows in the Lounge as registered |
| on the house roster (`member_roster`) but not signed up | guest row, house = Sundarbans, `on_roster = true` |
| anything else | guest row with the house they picked (`on_roster = false`) |

A guest who picks Sundarbans but is not on the roster is kept as picked; the admin can filter it.

**One registration per email per form**, for guests and members alike. A repeat answers
"already registered". No captcha or rate limit (owner decision: small audience).

## Admin

- Event editor: **Type → PANBS** switch; turning it on clears region/community/cohorts and sets
  Public. Lists show a PANBS badge.
- Form responses: members as today; a separate **Guests** list (name, email, house, roster flag,
  answers) with a house filter. CSV export includes guests in their own file.
- Guests are not members: no certificates, attendance import or Lounge access.

## Data

- `events.panbs boolean` + check: panbs ⇒ is_public, no region/community/cohorts.
- `public.form_guest_responses(id, form_id, event_id, email, full_name, phone, house, on_roster,
  field_schema, answers, submitted_at)`; unique `(form_id, email)`. No table grants; reads only
  through `list_form_guests(form_id)` for whoever manages the form.
- `get_panbs_form(event_id)` (anon): the open form's title, description and fields.
- `list_public_events()` adds `panbs` and `registers` (an open form accepts registrations).

## Joining a live PANBS event

- From 15 minutes before `starts_at` until `ends_at`, the public event sheet shows **Join now** to
  everyone (signed in or not, registered or not). `get_panbs_join_link(event_id)` (anon) returns the
  event's meeting link only inside that window, and only for a published, public PANBS event.
  House events never expose their link publicly.
- Outside the window the sheet shows one **Register** button right under the event facts, above the
  description, so a long description never pushes it down. It opens the form in a pop-up (event art
  banner, title, date, fields); its submit button reads "Count me in". Signed-in members go to the Lounge form instead.
- After registering, or when the email is already registered (PT409), the pop-up says "You're
  registered" or "Already registered" with one line: join from this page when it starts. The sheet
  button turns into a quiet registered row. Copy stays short; the email hint is "Use your IITM
  email only."
- Public copy calls the members' area the **Members Lounge**.

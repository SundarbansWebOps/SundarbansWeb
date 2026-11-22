# Spec 007 — PANBS events (open to every IITM BS student)

> Status: building 2026-11-16 on `feat/events-panbs-registration`. Owner decisions: Raja, 2026-11-16.

## What a PANBS event is

A house-wide event for all of IITM BS, not only Sundarbans. It is listed on the public Events
page, looks different from house events, and anyone with an IITM student email can register on
the event page without signing in.

- `events.panbs = true`. A PANBS event is always house-wide (no region, community or cohort) and
  always Public (`is_public`). The admin picks **PAN BS (every IITM BS student)** as the event's
  Scope (a fourth option after House, A region, A community); there is no separate checkbox or
  "public" label. Shown to people as "PAN BS" (pan as in pan-India; BS as in the degree).
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
houses, plus **Not allotted yet** for students without a house), **Phone** (optional) — then the form's own fields. Form fields that prefill name, email or
phone are filled from the fixed fields and not asked twice.

**Email rule:** must end in `study.iitm.ac.in` (`ds.`, `es.`, `mg.`, `ae.` … subdomains included).
Personal Gmail is refused.

**How the server files a signed-out registration:** always as a guest row. Nobody proves they own
the email on the public form, so it never writes into a member's account (owner decision
2026-11-16, after review: otherwise anyone could register a member under their name with made-up
answers). The reply is the same `{registered: true}` for every email, so the form cannot be used to
find out who is a member or on the roster.

| Email is… | Guest row |
| --- | --- |
| a signed-up Sundarbans member (`members`) | flagged **member** in the admin list (computed when listed); the member can still register in the Lounge |
| on the house roster (`member_roster`) | house = Sundarbans, `on_roster = true` |
| anything else | the house they picked (`on_roster = false`) |

A guest who picks Sundarbans but is not on the roster is kept as picked; the admin can filter it.

**One registration per email per form**. A repeat answers "already registered". No captcha or rate
limit (owner decision: small audience); a form stops taking guests at 5000 rows as a flood ceiling.

## Admin

- Event editor: **Scope → PAN BS**; picking it clears region/community/cohorts and sets Public and
  registration mode. Lists show a PAN BS badge.
- Form responses: members as today; a separate **Guests** list (name, email, house, member and
  roster flags, answers) with a house filter. CSV export includes guests in their own file.
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
- The browser remembers each PANBS event it registered for (localStorage key
  `sundarbans-panbs-registered`, a list of event ids), so after a refresh the sheet still says
  "Already registered" instead of Register. It is a convenience only: the server's one-per-email
  rule stays the authority, and cleared or blocked storage just shows Register again. Inside the
  join window everyone sees Join now, registered or not.
- Live events carry no badge on the poster; the "Live now" section heading already says so.
- Public copy calls the members' area the **Members Lounge**.

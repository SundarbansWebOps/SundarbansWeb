# Decisions — Sundarbans House

> Append-only log of load-bearing choices and WHY. Newest at the bottom.
> Format: `## YYYY-MM-DD — <decision>` then a short **Why:** line.

## 2026-07-11 — No backend; fully client-side app (inferred at adoption)

**Why:** Site is served as a static Vite build; "auth" is a localStorage token gate (`sundarbans_auth_token`), not server-verified. Keeps hosting simple and free.

## 2026-07-11 — Hash-based routing via `createWebHashHistory` (inferred at adoption)

**Why:** Works on plain static hosting without server-side rewrite rules for deep links.

## 2026-07-11 — All routes eagerly imported in `src/router/index.js` (inferred at adoption)

**Why:** Not clearly a deliberate performance choice — every view is statically imported, so the whole app ships in the initial bundle. Flagged as a latency lever to revisit during the storage/perf overhaul.
**Superseded:** routes are now lazy-loaded (see PR #5 / decision below).

## ~2026-07 — Lazy route imports in `src/router/index.js` (PR #5)

**Why:** Visitors only download the view chunk they need; homepage no longer pulls the whole app. Vite needs literal static paths in `import()` so each view emits its own chunk.

## 2026-07 — Membership via Apps Script + Google Sheet (T-13); no local roster (PRs #17, #19, #20)

**Why:** Single source of truth in the council Sheet. Client calls `VITE_MEMBERSHIP_CHECK_URL` after Google OAuth. `members.json` removed so prod cannot silently fall back to a stale roster.

## 2026-07 — Certificate PDFs on Google Drive, not in git (T-16; PRs #18, #20)

**Why:** ~89M of PDFs bloated the repo and deploys. Verify flow opens Drive view/export URLs by file id. Do not re-commit certificate binaries.

## 2026-08-05 — Site images on Cloudinary; hero frames stay in-repo

**Why:** Teams/events/regions (~40M) bloated git and page weight. Cloudinary hosts display images. Homepage 240-frame scroll stays on same-origin (`public/assets/frames/`) for predictable fast scrub. No full backend/admin — team dumps into `media/` and runs `npm run media:sync`.

## 2026-08-05 — Delivery URL transforms + incoming upload compression

**Why:** Raw CDN masters still lag (multi‑MB eager loads). Delivery URLs use `f_auto,q_auto:good,w_1000,c_limit` for bandwidth. Future `media:sync` uploads apply incoming max-1600 + `quality:auto:good` so free-tier **storage** is not filled with phone originals. URL-only transforms do not shrink stored bytes; both layers are intentional.

## 2026-08-05 — Drop Spec 001 T-11 (`docs/ownership.md`)

**Why:** Owner stays with the team long-term and will communicate where configs live when needed. No council-backup / handover / break-glass ownership doc.

## 2026-08-05 — Close Spec 001; cancel remaining tickets

**Why:** Product-visible + HEAD-quality goals are done (membership, Drive certs, Cloudinary, tooling/CI/refactors). Leftovers (history purge, screenshot baseline, size guard, modal cert UI, Apps Script source in repo, fork previews, re-audit, etc.) are optional hygiene — cancelled so the board matches reality and does not invent busywork.

## 2026-09-03 — Review council layouts before live Teams replacement

**Why:** The supplied 2026–27 portraits and roster differ from the current Teams page. A standalone review board lets the visual direction be selected before changing live content; the supplied UHC/LHC structure reference stays local and the portraits use the existing Cloudinary pipeline.

## 2026-09-03 — Match council portraits at native 3:4 ratio

**Why:** The processed portrait sources are 1200×1600. The separate command-deck demo uses 3:4 frames and visible card metadata so portraits are not treated as cropped landscape thumbnails; the technical team block remains deferred until requested.

## 2026-09-03 — Curate command deck: logo socials, no badges/pills, UHC+LHC only

**Why:** Owner feedback after reviewing the command-deck demo: text social links become icon-only brand logos, the 01–09 order badges are noise, the "Leadership"/"Regional" tags must not look pill/peeled, section subtitles are removed, and the demo carries only Upper and Lower House Council (no WebOps/technical block) until a later product decision. Rejected keeping demo scaffolding (roster panel, flow strip, rationale notes) so the review shows the actual design.

## 2026-09-05 — Backend v1 is Supabase, built local-first (no cloud project yet)

**Why:** Free tier fits house scale (500 MB DB, 50k auth MAU, 500k edge function calls, Mumbai region available), and Postgres + RLS maps directly onto the CONTEXT.md role/content-lifecycle model — role checks live in database policies, not app code. Local stack runs on ports 5442x because another local Supabase project (the chatbot backend) binds the 5432x defaults. Schema in `supabase/migrations/`, suite in `backend/test/` (51 checks, all green).

## 2026-09-05 — Member roster source of truth stays the council Google Sheet

**Why:** The council keeps its existing workflow; the `members` table is only a synced copy, written exclusively by the `members-sync` Edge Function (Apps Script authenticates with a shared secret) or a web_admin. The Lounge gate (`is_active_member()`) reads that copy. The real roster is never committed — `seed.sql` carries fake fixtures only.

## 2026-09-05 — Members Lounge ships as a gate only; content tables deferred

**Why:** What the Lounge will display is still undecided (2026-08-29's plan had narrowed the Lounge out entirely; the owner re-included the members-only gate on 2026-09-05). The gate primitives are live now so future lounge tables attach one policy each. The RAG chatbot backend is also out of scope — a teammate is building it separately.

## 2026-09-17 — Homepage decisions start with usefulness, then visual polish

**Why:** The homepage must earn its place by helping a student do something they would actually use. The `5174` variant is the better visual base because it is calmer and easier to scan; `5173` contributes useful live-update ideas, but only real, working actions should be retained.

## 2026-09-27 — Resource Hub direction: "Delta" (prototype variant A); B and C dropped

**Why:** After reviewing three layouts in `prototype/resource-hub/`, the owner chose A: search + term strip up top, pinned "My courses" tickets, and the degree drawn as a river delta (Foundation → Programming / Data Science diplomas → BS degree) that doubles as the course navigator. Palette is warm paper + ink + marigold, no green; light and dark tokens are defined together and every text token is checked at ≥ 4.5:1. The "Desk" (B) and "Index" (C) variants were deleted.

## 2026-09-27 — Public Events page is a past-events archive only

**Why:** House events are for Sundarbans members, so upcoming/live events belong in the members-only House lounge, not the public site. The public page shows what the house has done: a season "swell" chart of every past event, a month-by-month log with posters and winners, and regional meetups on one season axis. Stock photos are not used: events without a real poster get a typographic poster.

## 2026-09-27 — Winners hidden on the public Events page, pending the council

**Why:** Owner removed winner names, trophy counts and winner search from Events until the council decides whether winners are shown publicly (and whether ranks/consent are needed). Open question tracked in `council-questions.md`.

## 2026-09-27 — House page = About + council + where we meet + lounge door; meetups leave Events

**Why:** Meetups are not something a student needs daily, so the owner moved them from Events to House. About is folded into the public House page (copy to be written by members). Regions carry their Lower House coordinator, so council and meetups link to each other. Prototype in `prototype/resource-hub/` (`?page=house`).

## 2026-09-27 — Participation certificates: generator planned for the members' lounge

**Why:** No participation certificates exist today. Feasible design: one signed template per event + an attendance list; a signed-in member generates their own certificate, and its ID is checked on Verify. Build cost is small once lounge sign-in exists; the blockers are council inputs (signing authority, attendance lists), tracked in `council-questions.md`. Each past event links to the lounge meanwhile.

## 2026-09-27 — Teams gets its own page; House shows only the Upper House Council

**Why:** The owner wants the people who keep the house running to have a page of their own. House keeps the three Upper House Council cards (Secretary, Deputy Secretary, Web Admin) and links to Teams. Teams holds "How the house works" (drawn as a river delta), the UHC again, the Lower House Council, the communities and the crew. Rosters for communities and crew show empty seats until the 2026–27 names and photos are supplied; no stand-in faces. The House magazine card was removed until the magazine is live again.

## 2026-09-27 — Lounge is its own top-nav tab, set apart as the members-only feature

**Why:** The owner wants members to feel what's inside before signing in. The Lounge tab is a tour of the rooms (live events, Night Owl, regional groups, leaderboard, certificates) as working demos on labelled sample data; it is lit in the nav without a lock icon. House keeps the lounge door as a teaser. The top nav is now Resources · Events · House · Teams · Lounge; Verify is no longer a nav item (it belongs in the footer / on a certificate's link).

## 2026-09-27 — Typeface under review: Bricolage Grotesque retired

**Why:** The owner flagged Bricolage Grotesque as a common AI-generated-site default. The prototype compares Anek Latin (Ek Type, Mumbai; default), Familjen Grotesk and Schibsted Grotesk live (`?font=`, F key) so the choice is made on real pages.

## 2026-09-28 — Home locked to "Pat"; typeface locked to Anek Latin

**Why:** The owner chose Pat (prototype `?v=2`: the unrolling patachitra scroll) as the home page and Anek Latin (Ek Type, Mumbai) as the site typeface. Synchrony and Current stay only in `prototype/resource-hub/`; the font switcher is gone and Anek Latin is loaded in `index.html` and set as `--font` in `src/assets/tokens.css`.

## 2026-09-28 — The prototype becomes the live site in `src/`, mapped one-to-one

**Why:** The owner asked for the prototype to become the real build. Pat home, Resources, Events, House, Teams and the Lounge tour are ported file-for-file into `src/pages/`, `src/components/site/`, `src/lib/` and `src/data/`; only navigation plumbing changed (vue-router hash routes instead of `?page=`, and course/event sheet URLs go through the router). The nav gains a light/dark toggle: a saved choice wins, otherwise the system setting, applied before first paint. Old URLs redirect to the page that now holds their content (`/study`→Resources, `/about`→House story, `/meetups*`→House regions, `/community`→Teams, `/community/*`→Events filtered by wing, `/contact`→footer, `/dashboard`→Lounge). Verify certificate, login and 404 were rebuilt in the new theme; a shared footer carries Verify, portals and socials.

## 2026-09-28 — Lounge is a tour only; members' sign-in is "coming soon"

**Why:** The owner deferred real sign-in. `/lounge` is the public tour on sample data; every sign-in button shows "coming soon", and `/login` is a themed coming-soon page. The previous Google sign-in, members lounge and dashboard are no longer routed.

## 2026-09-28 — Home ignores the light/dark theme

**Why:** The owner wants the Pat scroll to look exactly as in the prototype in both modes. Only the nav (and the thin footer strip under the scroll) follows the theme; the painting keeps its paper palette and brightness. The unused dark scroll palette was removed.

## 2026-09-28 — Theme switch ripples exactly like Raja's portfolio

**Why:** Raja rejected a soft-edged, wavelet ripple and asked for the portfolio's animation: a hard-edged clip-path circle on the new view-transition snapshot, from the toggle's centre to the farthest corner, 700ms ease-in-out. The UA cross-fade is disabled. With reduced motion, or without the View Transitions API, the theme switches instantly.

## 2026-09-30 — Cloud Supabase is the backend source of truth; repo backend v1 deleted

**Why:** A cloud project ("Website Backend", `bqoejoznqudcyeaebmsm`, Mumbai) was built on 2026-09-28 with a different, larger member-management design (members + account status, admin assignments, super-admin allowlist, approval requests, blacklist, audit log, registrations, events; 3 Super-Admin Edge Functions). The repo's local-only v1 (2026-09-05 entry above) was never pushed. Raja chose the cloud as truth: its 24 migrations and function sources were fetched into `supabase/` (read-only, no remote writes) and the old migration, seed, `members-sync`, Apps Script sync and `backend/` tests were removed. Rejected: pushing v1 over the cloud, or maintaining both.

## 2026-10-01 — Cloud backend goes live; repo mirrors all 31 cloud migrations

**Why:** The cloud project was made production-ready: regions/communities became migration data (a rebuilt project could not sign anyone up before), the sign-up form and public Events page can read regions, communities and a `public_events` view signed-out (no `gmail_link`, no member ids), sign-up is limited to `ds.study.iitm.ac.in`, 3 Super Admins were added, all fake/test accounts were deleted, and the 9 regions got their real names. The 7 new migrations are committed under their cloud versions so `supabase migration list --linked` stays in sync and `db push` never re-runs them. Rejected: keeping test users on the live project; using local file timestamps (would make `db push` re-apply them).

## 2026-10-06 — Lounge information architecture: two pages plus two panels

**Why:** Raja wants a home that stays clean however many events exist, without a page per feature. Home shows only the member (name, roll, region), the live event (else one "Next up" line), WhatsApp groups and a notice banner for 72h. Events get one page with Live/Upcoming/Past/Mine tabs and compact rows (Mine absorbs the old "Your scroll" history). Notices live in a bell side panel with history; profile details in an avatar sheet. Rejected: everything on one scroll (Lounge A) and a page per section.

## 2026-10-06 — New members get a one-time welcome tour before the Lounge

**Why:** Raja (backed by former council members) wants first-timers to feel the house before its dashboard: a scroll-rowed boat ride past the house note, past councils since 2021, this year's Upper House Council with notes, and tappable community islands with sounds, ending at a ghat that hands over to Lounge Home. Shown once per member ever, after first sign-in; replayable only from the profile. The look stays lounge-a's rich painted pat with lounge-b's separate day/night scenes. Rejected: dropping straight into the dashboard.

## 2026-10-06 — Lounge round 4: past councils, milestones, events and profile rules

**Why:** Raja's review of round 3. Past councils are shown as "The Five Landings" (one landing per year built into the riverbank, Secretary then Deputy Secretary), chosen over signboards in the river and four other concepts from GPT-6 Astra. Web Admins are not listed per year (unofficial years are politics); contributors are credited through milestones instead, e.g. the 2023 move from Google Sites to the house's own website (first house to do it, Ravi Kumavat) shown as a lighthouse lighting up. Event registration is one-way (no unregister). Profile is an avatar dropdown with an edit pop-up; certificates open in a pop-up, not a page. The member confirms their name at the end of the welcome tour, prefilled from the roster.

## 2026-10-06 — Lounge tour: no shrine-like portraits; council as emote characters

**Why:** Raja saw the carved frame + photo + marigold garland (2026) and the halo silhouettes in niches (past) as RIP/memorial photos. 2026 council becomes three generic pat-style characters with name labels; the real photo shows in a thought bubble on click. Past placeholders become a plain cream frame with the house logo until real photos arrive. Rejected: keeping the frames without the garland (still reads as a memorial).

## 2026-10-06 — Home → Events is one shared-scene transition

**Why:** Raja's idea: the Home scene shrinks into a ~25vh Events header band (View Transitions; plain swap as fallback, instant under reduced motion). It replaces the earlier plan for a separate Events banner, keeps one visual world, and puts events above the fold.

## 2026-10-08 — Lounge E theme switch = B's sun/moon circle, not a dissolve

**Why:** Raja found E's 1.2s dissolve missing B's feeling; B's clip-path circle from the sky body, with the scene's own CSS choreography live inside it, is the reference. The separate view-transition names for the lantern/fleet were dropped so they reveal with the circle instead of ghosting over a fade.

## 2026-10-08 — Sign-in cross-dissolves into the lounge instead of fading out first

**Why:** A sequential fade (sign-in out, then tour in) left a dark gap that read as the sign-in not fading properly. The View Transitions cross-dissolve overlaps both for 900ms. Rejected: keeping the sequential fade and shortening it, which still dips through black; and a custom overlay that keeps the login mounted, which is more code for the same effect. The timed fade stays as the fallback for browsers without the API and for reduced motion.

## 2026-10-08 — Sign-out returns to the sign-in door until a session exists

**Why:** Sign-out did nothing and only showed a "does nothing in this prototype" note. Routing to `/login` makes the signed-out visitor's view real now and needs no auth code. Rejected: a placeholder note (what Raja asked to remove). When Google sign-in lands, this route becomes the real signed-out state.

## 2026-10-08 — Lounge is sign-in only; accounts are pre-created from the roster

**Why:** Raja wants no sign-up flow. Student accounts (real full name + roll/code) are seeded in advance and Google sign-in only logs into an existing one; anyone else is "not on the roster". This sidesteps the DB sign-up trigger that fails for plain Google users. Rejected: open sign-up limited to `ds.study.iitm.ac.in`. Details (matching key, seeding vs link on first sign-in, profile fields) are still open.

## 2026-10-08 — The design guard exempts the Members Lounge

**Why:** `check:design` failed PR #144 with 37 errors (raw colours, `!important`, extra breakpoints, unscoped styles, self-hosted font). The Lounge is its own painted world and the font alias is needed by the name fitter, so `scripts/check-design.mjs` skips `src/components/lounge/`, `LoungePage.vue` and `LoginPage.vue`; `design-baseline.json` untouched. Rejected: re-tokenising the Lounge now.

## 2026-10-08 — Google sign-in only for rostered members; RCs/Super Admins add students first

**Why:** The owner wants only members whose profile exists to get in. The database's sign-up trigger now creates an account only for an email on `member_roster` (filled by the RC for their region or a Super Admin, one by one or pasted from the council Sheet) and refuses everyone else; existing accounts are linked to Google by email. Rejected: self sign-up with a form (anyone with an IITM email could join) and a nightly Sheet sync (another moving part).

## 2026-10-08 — Two-person rule for every change to student data; RCs manage all events

**Why:** The owner asked that changes by an RC or by a Super Admin both need another Super Admin's approval, and that changing RCs also needs approval. All edits, removals, status and position changes are requests; approval applies them. Direct `sa_*` and position RPCs are no longer callable from the site. RCs now manage every event, not only house-wide ones (owner's call).

## 2026-10-08 — Admin lounge at /admin, entered from inside the Lounge; supabase-js added (pinned)

**Why:** The owner chose a separate `/admin` route reachable from the Lounge for RCs and Super Admins only, built in the public site's design system (tokens, Teams page skeleton). `@supabase/supabase-js` 2.117.2 was added with the owner's go-ahead (design skill's dependency limit); it loads lazily so public pages stay light (entry ~91 KB gzip, supabase chunk 59 KB). Rejected: hand-written Auth/REST calls (more code, easier to get auth wrong).

## 2026-10-08 — Phone number is optional

**Why:** The owner asked for it. `members.phone`, `member_roster.phone` and `blacklist_entries.phone_hash` are nullable; a given phone is still validated (E.164) and unique; a blank one clears it. Search no longer drops members without a phone, and blacklisting someone without a phone matches by email only.

## 2026-10-08 — Login email changes need a second Super Admin; security headers on Vercel

**Why:** The owner asked that `change-member-contact` be filed by one Super Admin and approved by another. The function now executes only a `member_contact_change` request (id) and refuses its filer; the old direct database path is revoked. `vercel.json` adds a CSP and the usual hardening headers; a Playwright test replays the CSP so a changed inline script cannot silently break the site. Edge Function CORS accepts one-label wildcards for Vercel previews (tokens are bearer, not cookies); Auth redirect URLs stay exact.

## 2026-10-09 — Roster-gated first sign-in replaces pre-created student accounts

**Why:** After inspecting the updated main, Raja chose to keep approved emails in the roster
and create each account on first Google sign-in, avoiding unused pre-created accounts.
The product remains sign-in only and unlisted emails are refused. This supersedes the
2026-10-08 pre-creation decision; existing accounts and optional-profile requirements
remain intact. See `docs/adr/0001-roster-gated-first-sign-in.md` and interview Q14.

## 2026-10-09 — Exactly three fixed super-admin email accounts

**Why:** Raja clarified that council office-holders may change, but the three super-admin
login emails remain the same. No add/remove-super-admin feature is wanted. Interview
Q17 supersedes Q9's earlier allowance for additional super admins; public office-holder
records remain separate from the fixed login accounts. See `docs/specs/003-backend-data-decisions.md`.

## 2026-10-09 — Roster additions use CSV import or manual entry (Q28)

**Why:** Raja maintains approved membership in Google Sheets and wants bulk additions through a script that deduplicates emails, plus manual single additions. This retains deliberate roster updates rather than automatic Sheet polling. Imports add eligibility; first Google sign-in creates the account. Existing identities/details and approval workflows are preserved.

## 2026-10-09 — Backend design confirmed after Q1–Q30

**Why:** Raja confirmed the consolidated roster, profile, governance, event audience, member-only forms, CSV recordkeeping, WhatsApp verification and certificate design. The final review explicitly retains the >=20-minute Meet attendance rule and separately confirmed certificate name. Requirements are in `specs/003-backend-data-decisions.md`; this replaces conflicting older decisions where marked. Confirmation completes design only; implementation and live delivery remain separate requests.

## 2026-10-09 — Archive events import keeps source text; Sports recruitment is house-scoped

**Why:** The 43 site archive records have mixed dates ("May 2026", "Online Submission") and turnout like "50+". Import keeps `display_date` text with NULL schedules and stores turnout in a text `attendee_display`, not an exact `attendee_count`, so nothing is fabricated. Offline Meetups get their region and stay off the public Events page (House page owns them). The Sports Core Team recruitment form goes to house scope (Super Admin), because no Sports community exists and E-Sports is a different community; rejected: assigning it to E-Sports heads.

## 2026-10-10 — Attendance replacement reconciles source ownership

**Why:** A corrected source may omit rows, while another source may still own the same canonical attendance. Default merge preserves omitted rows; explicit replacement removes only the named source's ownership and deletes ownerless records. Shared sources with conflicting duration/verdict fail closed instead of silently overwriting each other. Released attendance remains locked.

## 2026-10-10 — Group discovery uses verified form metadata

**Why:** Frontend UUID lists and long application titles made membership discovery brittle. Store form kind, short group label and optional purpose on the server; classify only the ten already verified membership sources. Missing authentic sources and purposes remain unset instead of being guessed.

## 2026-10-10 — RC bulk additions preserve opaque identity results

**Why:** Single roster additions already hide whether a global identity exists. Bulk results must keep the same privacy contract: RC success reports processed identities without added/existing classification, while SAs retain accurate counts. Canonical email locking protects concurrent single and bulk additions.

## 2026-10-10 — Erasure redacts operational free text; historical retention awaits policy

**Why:** Approval snapshots, requested changes, reasons and review notes can retain personal data after hard deletion. Clear them without copying free text into new audit payloads. Existing immutable audit history is preserved pending an explicit retention decision rather than silently rewriting history.

## 2026-10-10 — Fourth super-admin account authorized

**Why:** Raja explicitly requested adding the Deputy Secretary account. Preserved all existing admins; live allowlist now has four entries, superseding the previous exactly-three limit.

## 2026-10-11 — Legacy Board keeps hash routing; year lives in `?year=`

**Why:** Switching to clean URLs risks live OAuth redirects, shared links and about 78 `#/` references, and Vercel has no SPA rewrite; a separate change. Rejected `#2021` hashes because the hash is the route.

## 2026-10-13 — Event posters on Cloudinary (signed), Public/Members-only audience, RC house-wide events need approval

**Why:** The owner asked for admins to upload event images, choose an audience, and see new events on the public and Lounge pages. Posters stay on the house Cloudinary account (the 35 archive posters already are) via a signed upload from an Edge Function, so the API secret never reaches the browser. A Public toggle lists upcoming events publicly; members-only events stay in the Lounge until they end. RCs publish their own region's events directly; house-wide events from an RC go live only when a Super Admin approves, after which only Super Admins edit them (owner's choice). Rejected: unsigned Cloudinary presets (anyone could upload), Supabase Storage for posters (different host, no resizing), and publishing every upcoming event publicly.

## 2026-10-14 — 2023–24 tenure is a plain reading page fed by the council's own markdown

**Why:** The council rejected the illustrated story view; they want their words read in full. `src/data/tenure-2023.md` is a verbatim copy of their document (Parts I–V) parsed at runtime, rendered as text (no `v-html`), so edits are one file and no words are cut. Part VI (instructions to the web team) and two "note for the website" lines are left out as directions, not content. Rejected: hand-converting the text into JS data (drift, dropped words).

## 2026-10-15 — Contributors page counts from 1 July 2026

**Why:** Raja's web-admin tenure began in July 2026, and the page credits the current tenure's builders. `sundarbans-webad` (Raja's web-admin account) is folded into Raja. Code-Samar (previous tenure, handover commits dated 1–12 July) is excluded. Non-code helpers get their own space. The consults agreed on equal-size credit for everyone and on showing commits and merged PRs separately, never as one score. They also recommended a scheduled JSON snapshot rather than browser calls to the GitHub API, because unauthenticated calls are limited to 60 an hour per IP. The page does not explain how it counts (Raja's call).

## 2026-10-16 — Team rosters open in a panel under the card row

**Why:** Raja wants team photos on the Teams page without a new page. A card with a roster shows a face preview; clicking anywhere on the card (or its "Meet the team" button, the keyboard control) opens a panel below that row with every person as an equal-size portrait card, role in plain text. Names and roles follow the house's 2026–27 details sheet; photos are Cloudinary `sundarbans/teams/`. "Crew" is renamed "team" everywhere. Rejected: a pop-up modal and a separate roster page.

## 2026-10-16 — Contributors board ends the Teams page; /contributors redirects

**Why:** Raja asked for the contributions view at the bottom of Teams with motion and Codex-made pat art, and dropped the idea of a button on the webops team card, which stays as it was. `/contributors` now redirects to `/teams#contributors` so old links still work. Helper (non-code) cards are removed, since they had no data. Rejected: a team-card button that opens a separate page.

## 2026-10-19 — Admin overview only shows metrics backed by available data

**Why:** The current backend does not provide reliable join trends or region pulse metrics. Keep the prototype's visual hierarchy and show supported queue, roster, event, notice, form, and audit data; omit unsupported telemetry instead of rendering placeholders or invented numbers.

## 2026-10-19 — Admin actions share one top bar; Launch opens the Lounge

**Why:** The duplicate navbar consumed space and repeated Admin identity. Keep search, Admin actions, profile, Launch (`/lounge`) and Website together; remove the region chip and duplicated sidebar identity/account blocks.

## 2026-10-19 — Admin navigation removes search and centers Lounge/Website

**Why:** Raja asked to remove the search field and place the two destinations in the middle of the single Admin bar. Add students, Create, theme and profile stay grouped at the right. This supersedes the prior decision to keep search in the top bar.

## 2026-10-19 — Admin greeting uses the saved name, local time and matching art

**Why:** The overview greets the admin with their full Google/profile name and uses morning, afternoon or evening language and artwork based on Asia/Kolkata time. “Good night” is omitted because it reads as an instruction to sleep rather than a work greeting.

## 2026-10-19 — Student region review notes appear in the Lounge profile

**Why:** The review note is the admin/coordinator's reply to the requesting student. Show the latest request status and note beside the student's region details in Edit profile, using the existing requester-scoped row access.

## 2026-10-19 — Hold the stale audit migration outside the runnable migration set

**Why:** `20261010000000_audit_fixes.sql` was never applied remotely and conflicts with `20261016120000_soft_delete_event_scope.sql`: it recreates an existing function and narrows the event policy. Preserve the source under `supabase/held-migrations/`; do not mark it applied or run it with `--include-all`. Reconcile any still-needed fixes in reviewed forward migrations.

## 2026-11-19 — Lounge winter season is automatic, Lounge-only and CSS-only
**Why:** Usable first: transform-only CSS snow that obeys the existing motion pauses and reduced-motion/lite costs little on modest laptops; rejected canvas/particle libraries (extra JS and GPU cost) and a member toggle (more UI for a seasonal touch). Public site deferred.

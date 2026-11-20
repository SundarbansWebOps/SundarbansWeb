# Sundarbans House — State

> IITM BS frontend/backend · Last checkpoint: 2026-11-20 14:56 IST

## In progress / next

- **Custom scrollbars (try)** — branch `feat/ui-custom-scrollbars`, worktree `../SundarbansWeb-wt/custom-scrollbars`. Public + Lounge scrollbars; Raja verifies locally, then ship. See `sessions/2026-11-20.md`.
- **PAN BS registration — PRs #236–#239 merged (last `191eb54`), migration `20261120180000_panbs_registration_invite.sql` live.** Guests get the form's WhatsApp invite as the last step; signed-in Register opens the Lounge form. Open question for Raja: show the invite on "Already registered" too (today only a fresh registration returns it).
- **Lounge winter season — PR #235 merged (`e93da1d`).** Next: Raja is weighing a site-wide winter theme (public site deferred so far); decide scope before building. See `sessions/2026-11-19.md`.
- **Leaderboard page** — uncommitted WIP in the main checkout on `feat/leaderboard-page` (spec `specs/006-leaderboard-points.md`). Don't disturb it.
- **Mobile navbar repair — `fix/mobile-navigation`, worktree `~/Anuraj-dev/Frontend-mobile-navigation`, based on production main `519c075`.** Lounge header now uses two mobile columns; its bottom bar/header height switch together at 760px. Admin mobile destinations stay in normal flow with readable 12px text, spaced links and 32px action buttons. Public navbar audited without source changes. User requested fix, preview server, commit and PR. **Next:** Review the PR and required CI; deployment remains outside this request. See `sessions/2026-10-19.md`.
- **Admin Command Desk — PR #204 merged into upstream main (`519c075`).** Production art is on Cloudinary under `sundarbans/admin-command-desk/`. Throwaway admin HTML stays local and is gitignored.
- **Admin backend rollout.** Remote Website Backend now has migrations `20261019110000_notice_publishing.sql`, `20261019120000_admin_dashboard_reads.sql`, and `20261019130000_member_google_avatars.sql`; `supabase migration list --linked` confirmed all three applied. The dashboard hides unpublished notices, and anonymization clears cached avatars. `20261010000000_audit_fixes.sql` is preserved under `supabase/held-migrations/` and excluded from the active migration set because it conflicts with the live Oct 16 event policy. Add migrations using the workflow in `conventions.md`; port any still-needed held fixes through a separate forward migration.
- **Legacy Board portraits** — branch `feat/legacy-council-portraits`, separate worktree, uncommitted. Raja to review; 2022 Secretary remains blank pending his confirmed name.
- **Tenure story** — PR #163 is open for review. **Contributors board** — PR is open against upstream `main`. **Resources page** — local work remains uncommitted for Raja's review. See dated session logs.

## Status

- Admin entry is `/#/admin`; shell and panels live in `src/pages/AdminPage.vue` and `src/components/admin/`. The throwaway Command Desk HTML is not in git.
- Mobile repair: production build, design, lint and formatting pass; 83 Playwright tests cover navigation geometry, themes and transitions with mocked Supabase accounts. Real Chrome public phone view verified; real signed-in Admin/Lounge and physical phones remain unverified. No database or production mutation.
- Older Lounge, Resources, Teams and audit decisions remain in `sessions/` and `decisions.md`; certificates are deferred.

## Architecture map

- Lounge winter: `src/components/lounge/home/{season.js,WinterLayer.vue,art.js}`; winter art = `*-winter-{day,night}` twins beside the normal art.
- Auth, client, router: `src/lib/{auth,auth-profile,supabase}.js`, `src/router/index.js`.
- Admin: `src/pages/AdminPage.vue`, `src/components/admin/`, `src/lib/admin.js`.
- Lounge: `src/lib/lounge.js`, `src/components/lounge/`, `src/pages/{LoungePage,FormPage}.vue`.
- Teams and Legacy: `src/pages/{TeamsPage,LegacyPage,TenureReadPage}.vue`, `src/data/`, `src/assets/legacy/`.
- Public archive: `src/lib/events.js`, `src/data/events.data.js`.
- PAN BS guest pop-up: `src/components/site/PanbsRegister.vue`; RPCs in `src/lib/lounge.js`. Dev mock: `?local-lounge=1` (`src/lib/local-lounge.js`), `&local-guest=1` = signed out, has two mock PAN BS events.

## Stack & run

- Vue 3, vue-router 4, Vite 6, Supabase JS. Node 22 is declared; host currently has Node 26.8.2.
- Run: `npm run dev` · Build: `npm run build` · Design: `npm run check:design` · Lint: `npm run lint`.
- Mobile fix preview: `http://localhost:5173/#/resources`; Vite PID 2303629 from `Frontend-mobile-navigation`. Leave it running for Raja. Replaced the old Admin preview on this port at his request.

## Key decisions

- Lounge winter is automatic Nov 1–end Feb IST, no member toggle; `?winter` / `?winter=0` override. CSS/DOM snow only, no library or canvas.
- Admin prototype A remains selected; reuse public design tokens and the shared navigation frame.
- Admin profile matches Lounge's avatar treatment: use a Google photo when available, otherwise the circular Sundarbans crest; member Google photos remain optional, and anonymization clears cached photos.
- Keep the old Oct 10 audit migration out of the active Supabase migration directory until its remaining fixes are reconciled; it conflicts with the Oct 16 event scope policy.
- Overview only shows metrics supported by current backend data; no invented telemetry.
- No commit, push, PR, deployment or live database migration without explicit authorization.

## Gotchas

- Winter art.js swap is Lounge-wide: winter plates also show on the Events band and WelcomeTour (keeps the Home↔Events morph consistent).
- Night snow is masked to light pools measured from `.h-mine`/`.h-boat` offsets; moving those elements in `lounge.css` needs `WinterLayer.vue` measure() kept in sync.
- Preserve unrelated changes in every worktree; don't reset or clean.
- The local IAB session has no admin credentials and redirects to sign-in for Admin and Lounge; verify those signed-in views in Raja's browser.
- Vite can retain stale scoped CSS after HMR; use a fresh page load for visual review.
- Keep `padding: 0` on the Admin avatar button so its image fills the circle like Lounge's profile button.
- The local shadow database diff stops at `20260928183510_revoke_rls_auto_enable_execute.sql` because Supabase's platform `public.rls_auto_enable()` is absent there; remote migrations were verified by the linked project and schema dump.
- Migrations run in one session: a `pg_temp` helper redefined by a later migration must use `create or replace` (else `db push` fails).
- Local Supabase (`project_id = "Frontend"`) has a diverged migration history; `migration up --local` refuses. Verify migrations in a throwaway copy with another `project_id`, plus a stub `public.rls_auto_enable()`.
- In the local mock, auth only starts after visiting `#/lounge`; public pages look signed out until then.
- Admin merges need `--admin` (branch policy requires a review); Raja runs that himself.

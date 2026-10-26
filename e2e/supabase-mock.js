// Browser tests never touch the real Supabase project: every request to it is answered here.
// `signedIn` puts a session in storage (as supabase-js would after Google sign-in);
// `google` decides what the Google round-trip returns ('ok' or 'refused' for an email that is
// not on the roster, which Supabase reports as "Database error saving new user").
import { Buffer } from 'node:buffer';
import { expect } from '@playwright/test';

const REF = 'bqoejoznqudcyeaebmsm';
const ORIGIN = `https://${REF}.supabase.co`;
const STORAGE_KEY = `sb-${REF}-auth-token`;

export const PEOPLE = {
  member: {
    id: 'a9000000-0000-4000-8000-000000000004',
    email: '99f9000004@ds.study.iitm.ac.in',
    full_name: 'Riya Venkataraman',
    dashboard: { role: 'normal', position: null, region_id: null, community_id: null },
  },
  rc: {
    id: 'a9000000-0000-4000-8000-000000000003',
    email: '99f9000003@ds.study.iitm.ac.in',
    full_name: 'Arjun Rao',
    dashboard: { role: 'admin', position: 'rc', region_id: 1, community_id: null },
  },
  head: {
    id: 'a9000000-0000-4000-8000-000000000005',
    email: '99f9000005@ds.study.iitm.ac.in',
    full_name: 'Meera Nair',
    dashboard: { role: 'admin', position: 'head', region_id: null, community_id: 2 },
  },
  sa: {
    id: 'a9000000-0000-4000-8000-000000000001',
    email: '99f9000001@ds.study.iitm.ac.in',
    full_name: 'House Secretary',
    dashboard: { role: 'super_admin', position: null, region_id: null, community_id: null },
  },
};

const REGIONS = [
  'Patna',
  'Delhi NCR',
  'Mumbai',
  'Chandigarh',
  'Kolkata',
  'Hyderabad',
  'Lucknow',
  'Bengaluru',
  'Chennai',
].map((name, i) => ({ id: i + 1, code: `region_0${i + 1}`, name }));
const COMMUNITIES = [
  { id: 1, code: 'esports', name: 'E-Sports' },
  { id: 2, code: 'technical', name: 'Technical' },
  { id: 3, code: 'cultural', name: 'Cultural' },
];

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function sessionFor(person, photo) {
  const exp = Math.floor(Date.now() / 1000) + 24 * 3600;
  return {
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: person.id, email: person.email, role: 'authenticated', aud: 'authenticated', exp })}.test`,
    token_type: 'bearer',
    expires_in: 24 * 3600,
    expires_at: exp,
    refresh_token: 'test-refresh',
    user: {
      id: person.id,
      email: person.email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: photo ? { avatar_url: photo } : {},
      created_at: '2026-10-01T00:00:00Z',
    },
  };
}

function profileOf(person) {
  return {
    id: person.id,
    member_code: person.email.split('@')[0],
    full_name: person.full_name,
    preferred_name: person.full_name,
    email: person.email,
    phone: '+919990000004',
    cohort: '26F1',
    tour_seen_at: '2026-10-01T00:00:00Z',
    group_forms_hidden: false,
    certificate_name: null,
    certificate_name_confirmed_at: null,
    gender: 'Female',
    region_id: 1,
    account_status: 'active',
    deleted_at: null,
    created_at: '2026-10-01T00:00:00Z',
    last_login_at: null,
    region: { code: 'region_01', name: 'Patna' },
  };
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,HEAD,OPTIONS',
  'access-control-expose-headers': 'content-range',
};

// What the Lounge hydrates from when a test supplies nothing. A data value may be a function
// `(body) => result` to model server state that changes between calls.
const LOUNGE_DEFAULTS = {
  list_lounge_events: [],
  list_lounge_forms: [],
  list_my_notices: [],
  list_my_certificates: [],
  list_public_past_events: [],
  get_available_cohorts: { current: '26F2', next: '26F3', options: ['26F1', '26F2'] },
  // The admin Students tab, empty unless a test supplies students.
  list_students: { total: 0, rows: [] },
};

// `profile` overrides members columns (e.g. tour_seen_at: null for a first-time member, or
// full_name/gender null for one who has not filled them in). The profile is mutable so
// update_my_profile / complete_my_profile / set_my_tour_seen persist across reloads like the
// real rows do.
export async function mockSupabase(
  page,
  { as = 'member', signedIn = true, google = 'ok', data = {}, profile = {}, photo } = {}
) {
  const person = PEOPLE[as];
  const row = { ...profileOf(person), ...profile };
  const calls = [];
  if (signedIn) {
    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [STORAGE_KEY, JSON.stringify(sessionFor(person, photo))]
    );
  }

  await page.route(`${ORIGIN}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    calls.push({ method: req.method(), path, url: req.url(), body: req.postData() });
    const json = (body, status = 200, headers = {}) =>
      route.fulfill({
        status,
        headers: { ...CORS, 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });

    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

    // Google round-trip: Supabase would send the visitor to Google and back to redirect_to.
    if (path === '/auth/v1/authorize') {
      const back = new URL(url.searchParams.get('redirect_to'));
      if (google === 'ok') back.searchParams.set('code', 'test-code');
      else back.searchParams.set('error_description', 'Database error saving new user');
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: `<script>location.replace(${JSON.stringify(back.toString())})</script>`,
      });
    }
    if (path === '/auth/v1/token') return json(sessionFor(person));
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS });
    if (path === '/auth/v1/user') return json(sessionFor(person).user);

    if (path.startsWith('/functions/v1/')) return json(data[path] ?? { ok: true });
    if (path === '/rest/v1/rpc/get_my_dashboard') return json(person.dashboard);
    if (path.startsWith('/rest/v1/rpc/')) {
      const name = path.slice('/rest/v1/rpc/'.length);
      const args = req.postData() ? JSON.parse(req.postData()) : {};
      if (!(name in data)) {
        if (name === 'set_my_tour_seen') {
          row.tour_seen_at = args.p_seen ? new Date().toISOString() : null;
          return json(row.tour_seen_at);
        }
        // Persists on the member row like the real RPC, so a reload reads it back.
        if (name === 'set_group_forms_hidden') {
          row.group_forms_hidden = !!args.p_hidden;
          return json(row.group_forms_hidden);
        }
        // Fills only empty fields, like the real RPC.
        if (name === 'complete_my_profile') {
          row.full_name ??= args.p_full_name;
          row.gender ??= args.p_gender;
          return json(row);
        }
        if (name === 'update_my_profile') {
          row.preferred_name = args.p_preferred_name;
          row.phone = args.p_phone;
          return json(row);
        }
        if (name in LOUNGE_DEFAULTS) return json(LOUNGE_DEFAULTS[name]);
        // The desk falls back to the older table/RPC reads when these functions are absent.
        if (name === 'admin_dashboard_summary' || name === 'admin_dashboard_requests') {
          return json(
            {
              code: 'PGRST202',
              details: null,
              hint: null,
              message: `Could not find the function public.${name} in the schema cache`,
            },
            404
          );
        }
      }
      const value = data[name];
      return json((typeof value === 'function' ? value(args) : value) ?? null);
    }

    const table = path.replace('/rest/v1/', '');
    if (req.method() === 'HEAD')
      return route.fulfill({
        status: 200,
        headers: { ...CORS, 'content-range': `*/${(data[table] ?? []).length}` },
      });
    if (table === 'regions') return json(REGIONS);
    if (table === 'communities') return json(COMMUNITIES);
    if (table === 'members' && url.searchParams.get('id') === `eq.${person.id}`)
      // .single() asks PostgREST for one object, not an array.
      return json(/pgrst\.object/.test(req.headers().accept ?? '') ? row : [row]);
    // Single-row lookups (?id=eq.…) get only that row.
    const id = url.searchParams.get('id')?.replace(/^eq\./, '');
    if (id && req.method() === 'GET') return json((data[table] ?? []).filter((r) => r.id === id));
    return json(data[table] ?? [], 200, { 'content-range': `0-0/${(data[table] ?? []).length}` });
  });

  return calls;
}

// The first recorded request whose path matches, once it has arrived (the UI click returns
// before the request leaves the browser, so reading `calls` straight away races).
export async function callTo(calls, path, method) {
  const match = (c) => c.path === path && (!method || c.method === method);
  await expect.poll(() => calls.some(match), { message: `request to ${path}` }).toBe(true);
  return calls.find(match);
}

export function adminSections(page) {
  return page.getByRole('navigation', { name: 'Admin sections' });
}

// Admin dropdowns (AdminSelect) are comboboxes: open one by its label, then click an option.
export async function pick(scope, label, option) {
  await scope.getByRole('combobox', { name: label }).click();
  await scope.getByRole('option', { name: option, exact: true }).click();
}

// PANBS events: open to every IITM BS student, registration in a pop-up on the event page (spec 007).
// Supabase is mocked.
import { test, expect } from '@playwright/test';
import { callTo, mockSupabase, pick } from './supabase-mock.js';

test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }));

const EVENT_ID = 'e7000000-0000-4000-8000-000000000001';
const FORM_ID = 'f7000000-0000-4000-8000-000000000001';
const soon = (days) => new Date(Date.now() + days * 864e5).toISOString();

const PANBS_EVENT = {
  id: EVENT_ID,
  name: 'Paradox quiz',
  description: 'A quiz for all of IITM BS',
  starts_at: soon(5),
  ends_at: soon(6),
  event_type: 'Quiz',
  is_public: true,
  panbs: true,
  registers: true,
  stage: 'upcoming',
};
const FORM = {
  id: FORM_ID,
  title: 'Paradox quiz signup',
  description: null,
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, prefill: 'name' },
    {
      key: 'level',
      label: 'Level',
      type: 'select',
      options: ['Foundation', 'Diploma', 'Degree'],
      required: true,
    },
  ],
  houses: ['Bandipur', 'Gir', 'Nallamala', 'Sundarbans'],
};

test('a signed-out student registers for a PANBS event on the event page', async ({ page }) => {
  const calls = await mockSupabase(page, {
    signedIn: false,
    data: {
      list_public_events: [PANBS_EVENT],
      get_panbs_join_link: null,
      get_panbs_form: FORM,
      submit_panbs_registration: { registered: true },
    },
  });
  await page.goto('/#/events');
  const soonSection = page.getByRole('region', { name: /Coming up/ });
  await expect(soonSection.getByText('Open to all IITM BS')).toBeVisible();
  await soonSection.getByText('Paradox quiz').first().click();

  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('PAN BS · Open to all IITM BS')).toBeVisible();
  await expect(
    sheet.getByRole('button', { name: /Log in to the Members Lounge to join/ })
  ).toHaveCount(0);
  // Register opens the form in a pop-up over the sheet.
  await sheet.getByRole('button', { name: 'Register' }).click();
  const pop = page.locator('dialog[open]');
  await expect(pop.getByRole('heading', { name: 'Paradox quiz' })).toBeVisible();
  // The name-prefill question is not asked twice.
  await expect(pop.getByLabel('Name', { exact: true })).toHaveCount(1);

  await pop.getByLabel('Name', { exact: true }).fill('Guest One');
  await pop.getByLabel('Student email').fill('guest@gmail.com');
  await pop.getByLabel('Your house').selectOption('Nallamala');
  await pop.getByLabel('Level').selectOption('Degree');
  await pop.getByRole('button', { name: 'Count me in' }).click();
  await expect(pop.getByRole('alert')).toContainText('Use your IITM email only');
  expect(calls.some((c) => c.path === '/rest/v1/rpc/submit_panbs_registration')).toBe(false);

  await pop.getByLabel('Student email').fill('21f1000001@ds.study.iitm.ac.in');
  await pop.getByLabel(/Phone/).fill('98765 43210');
  await pop.getByRole('button', { name: 'Count me in' }).click();
  await expect(pop.getByRole('status')).toContainText('You’re registered');
  await pop.getByRole('button', { name: 'Done' }).click();
  // Closing the pop-up keeps the sheet open, now marked registered.
  await expect(sheet.getByRole('status')).toContainText('You’re registered');

  const sent = JSON.parse(
    (await callTo(calls, '/rest/v1/rpc/submit_panbs_registration', 'POST')).body
  );
  expect(sent).toMatchObject({
    p_form_id: FORM_ID,
    p_email: '21f1000001@ds.study.iitm.ac.in',
    p_name: 'Guest One',
    p_house: 'Nallamala',
    p_phone: '+919876543210',
    p_answers: { level: 'Degree' },
  });

  // This browser remembers the registration, so a refresh (which reopens the sheet from the URL)
  // still says registered.
  await page.reload();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Already registered');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Register' })).toHaveCount(0);
});

test('the PANBS pop-up shows the form banner in place of the event poster', async ({ page }) => {
  const banner =
    'https://res.cloudinary.com/l59gy0g2/image/upload/f_auto,q_auto:good,w_1600,c_limit/v1/forms/b.jpg';
  await mockSupabase(page, {
    signedIn: false,
    data: {
      list_public_events: [PANBS_EVENT],
      get_panbs_join_link: null,
      get_panbs_form: { ...FORM, banner_url: banner, banner_alt: 'Quiz night banner' },
    },
  });
  await page.goto('/#/events');
  await page
    .getByRole('region', { name: /Coming up/ })
    .getByText('Paradox quiz')
    .first()
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Register' }).click();
  const pop = page.locator('dialog[open]');
  await expect(pop.getByRole('img', { name: 'Quiz night banner' })).toHaveAttribute('src', banner);
});

test('a Super Admin picks PAN BS as the event scope', async ({ page }) => {
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: { events: [{ id: EVENT_ID }] },
  });
  await page.goto('/#/admin?tab=events');
  await page.getByRole('button', { name: 'New event' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Paradox quiz');
  await pick(page, 'Scope', 'PAN BS (every IITM BS student)');
  await expect(page.getByText(/Anyone with an IITM student email registers/)).toBeVisible();
  await expect(page.getByText('Public: also list it on the public Events page')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save draft' }).click();

  const saved = JSON.parse((await callTo(calls, '/rest/v1/events', 'POST')).body);
  expect(saved).toMatchObject({
    name: 'Paradox quiz',
    panbs: true,
    is_public: true,
    region_id: null,
    community_id: null,
    audience_cohorts: [],
  });
});

test('a live PANBS event shows Join instead of the form', async ({ page }) => {
  // Registered from this browser earlier: Join still shows, for registered and unregistered alike.
  await page.addInitScript(
    (id) => localStorage.setItem('sundarbans-panbs-registered', JSON.stringify([id])),
    EVENT_ID
  );
  await mockSupabase(page, {
    signedIn: false,
    data: {
      list_public_events: [{ ...PANBS_EVENT, starts_at: soon(-0.05), stage: 'live' }],
      get_panbs_join_link: 'https://meet.google.com/abc-defg-hij',
      get_panbs_form: FORM,
    },
  });
  await page.goto('/#/events');
  const liveSection = page.getByRole('region', { name: /Live now/ });
  // The section heading says it is live; the poster itself carries no second Live badge.
  await expect(liveSection.getByRole('button', { name: /Paradox quiz/ })).not.toContainText(
    'Live now'
  );
  await liveSection.getByText('Paradox quiz').first().click();

  const sheet = page.getByRole('dialog');
  const join = sheet.getByRole('link', { name: 'Join now' });
  await expect(join).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
  await expect(sheet.getByRole('button', { name: 'Register' })).toHaveCount(0);
});

test('a tap on Register while the form is still loading opens it once it arrives', async ({
  page,
}) => {
  await mockSupabase(page, {
    signedIn: false,
    data: { list_public_events: [PANBS_EVENT], get_panbs_join_link: null, get_panbs_form: FORM },
  });
  // Hold the form back until the tap has landed; fallback hands it to the mock above.
  let release;
  const held = new Promise((r) => (release = r));
  await page.route('**/rest/v1/rpc/get_panbs_form', async (route) => {
    await held;
    await route.fallback();
  });
  await page.goto('/#/events');
  await page
    .getByRole('region', { name: /Coming up/ })
    .getByText('Paradox quiz')
    .first()
    .click();
  const sheet = page.getByRole('dialog', { name: 'Paradox quiz' });
  await sheet.getByRole('button', { name: 'Loading…' }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  release();
  await expect(page.locator('dialog[open]').getByLabel('Student email')).toBeVisible();
});

test('a signed-in member taps Register and lands on the Lounge form', async ({ page }) => {
  // Closing the sheet pops a history entry; a lounge push made at the same moment used to lose.
  await mockSupabase(page, {
    data: { list_public_events: [PANBS_EVENT], get_panbs_join_link: null, get_panbs_form: FORM },
  });
  await page.goto('/#/events');
  await page
    .getByRole('region', { name: /Coming up/ })
    .getByText('Paradox quiz')
    .first()
    .click();
  await page.getByRole('dialog').getByRole('link', { name: 'Register' }).click();
  await expect(page).toHaveURL(new RegExp(`#/lounge/forms/${FORM_ID}`));
  await page.waitForTimeout(500); // a late back navigation would land here
  await expect(page).toHaveURL(new RegExp(`#/lounge/forms/${FORM_ID}`));
});

test('registering twice says already registered', async ({ page }) => {
  await mockSupabase(page, {
    signedIn: false,
    data: { list_public_events: [PANBS_EVENT], get_panbs_join_link: null, get_panbs_form: FORM },
  });
  // Registered after the mock, so this route wins for the duplicate-registration error.
  await page.route('**/rest/v1/rpc/submit_panbs_registration', (route) =>
    route.fulfill({
      status: 409,
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      contentType: 'application/json',
      body: JSON.stringify({ code: 'PT409', message: 'Already registered' }),
    })
  );
  await page.goto('/#/events');
  await page
    .getByRole('region', { name: /Coming up/ })
    .getByText('Paradox quiz')
    .first()
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Register' }).click();
  const pop = page.locator('dialog[open]');
  await pop.getByLabel('Name', { exact: true }).fill('Guest One');
  await pop.getByLabel('Student email').fill('21f1000001@ds.study.iitm.ac.in');
  await pop.getByLabel('Your house').selectOption('Nallamala');
  await pop.getByLabel('Level').selectOption('Degree');
  await pop.getByRole('button', { name: 'Count me in' }).click();
  await expect(pop.getByRole('status')).toContainText('Already registered');
});

test('a live PANBS event with no link yet keeps the open form while it checks for Join', async ({
  page,
}) => {
  await page.clock.install();
  const calls = await mockSupabase(page, {
    signedIn: false,
    data: {
      list_public_events: [{ ...PANBS_EVENT, starts_at: soon(-0.01), stage: 'live' }],
      get_panbs_join_link: null,
      get_panbs_form: FORM,
    },
  });
  await page.goto('/#/events');
  await page
    .getByRole('region', { name: /Live now/ })
    .getByText('Paradox quiz')
    .first()
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Register' }).click();
  const pop = page.locator('dialog[open]');
  await pop.getByLabel('Name', { exact: true }).fill('Guest One');

  const before = calls.filter((c) => c.path === '/rest/v1/rpc/get_panbs_join_link').length;
  await page.clock.runFor(95_000);
  // It kept checking for the link, and the visitor's half-filled form is untouched.
  await expect
    .poll(() => calls.filter((c) => c.path === '/rest/v1/rpc/get_panbs_join_link').length)
    .toBeGreaterThan(before);
  await expect(pop.getByLabel('Name', { exact: true })).toHaveValue('Guest One');
});

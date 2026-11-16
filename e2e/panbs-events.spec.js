// PANBS events: open to every IITM BS student, registration on the event page (spec 007).
// Supabase is mocked.
import { test, expect } from '@playwright/test';
import { callTo, mockSupabase } from './supabase-mock.js';

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
      get_panbs_form: FORM,
      submit_panbs_registration: { kind: 'guest', house: 'Nallamala' },
    },
  });
  await page.goto('/#/events');
  const soonSection = page.getByRole('region', { name: /Coming up/ });
  await expect(soonSection.getByText('Open to all IITM BS')).toBeVisible();
  await soonSection.getByText('Paradox quiz').first().click();

  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('PANBS · Open to all IITM BS')).toBeVisible();
  await expect(sheet.getByRole('button', { name: /Log in to Launch to join/ })).toHaveCount(0);
  // The name-prefill question is not asked twice.
  await expect(sheet.getByLabel('Name', { exact: true })).toHaveCount(1);

  await sheet.getByLabel('Name', { exact: true }).fill('Guest One');
  await sheet.getByLabel('Student email').fill('guest@gmail.com');
  await sheet.getByLabel('Your house').selectOption('Nallamala');
  await sheet.getByLabel('Level').selectOption('Degree');
  await sheet.getByRole('button', { name: 'Register' }).click();
  await expect(sheet.getByRole('alert')).toContainText('IITM student email');
  expect(calls.some((c) => c.path === '/rest/v1/rpc/submit_panbs_registration')).toBe(false);

  await sheet.getByLabel('Student email').fill('21f1000001@ds.study.iitm.ac.in');
  await sheet.getByLabel(/Phone/).fill('98765 43210');
  await sheet.getByRole('button', { name: 'Register' }).click();
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
});

test('a Super Admin makes an event PANBS', async ({ page }) => {
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: { events: [{ id: EVENT_ID }] },
  });
  await page.goto('/#/admin?tab=events');
  await page.getByRole('button', { name: 'New event' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Paradox quiz');
  await page.getByLabel(/Type: PANBS/).check();
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

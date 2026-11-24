// An admin can copy a link to an event's registration; following it opens that event's
// register sheet in the Lounge. Supabase is mocked.
import { test, expect } from '@playwright/test';
import { mockSupabase } from './supabase-mock.js';

const EVENT_ID = '55555555-5555-4555-8555-555555555555';
const FORM_ID = '66666666-6666-4666-8666-666666666666';
const title = 'Prompt To Web';

const data = {
  list_lounge_events: [
    {
      id: EVENT_ID,
      name: title,
      stage: 'upcoming',
      starts_at: '2099-01-01T10:00:00Z',
      ends_at: '2099-01-01T12:00:00Z',
      community_id: 2,
      description: 'Build your own portfolio site with AI, step by step.',
      registration: null,
    },
  ],
  list_lounge_forms: [
    {
      id: FORM_ID,
      title,
      form_kind: 'event',
      event_id: EVENT_ID,
      fields: [
        {
          key: 'level',
          label: 'Level',
          type: 'select',
          required: true,
          options: ['Beginner', 'Pro'],
        },
        {
          key: 'portfolio',
          label: 'Do you already have an online portfolio',
          type: 'multiselect',
          required: true,
          options: ['Yes', 'No'],
        },
      ],
      is_open: true,
      accepting_responses: true,
      published_at: '2026-10-01T00:00:00Z',
      submitted: false,
    },
  ],
};

test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }));

const openRegister = async (page) => {
  await page.goto('/#/lounge?view=events');
  await page.getByRole('tab', { name: /Upcoming/ }).click();
  await page.getByRole('button', { name: title, exact: true }).first().click();
};

test('members register from a full-width button and see no Copy link', async ({ page }) => {
  await mockSupabase(page, { data });
  await openRegister(page);
  const register = page.getByRole('button', { name: 'Register', exact: true });
  const [r, s] = [await register.boundingBox(), await page.locator('.evd').boundingBox()];
  expect(r.width).toBeGreaterThan(s.width * 0.7);
  await expect(page.getByRole('button', { name: 'Copy link' })).toHaveCount(0);
  await register.click();
  await expect(page.locator('dialog[open]').getByText('Registering is final')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy link' })).toHaveCount(0);
});

test('an admin copies the register link from the form and it opens the register sheet', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockSupabase(page, { as: 'rc', data });
  await openRegister(page);
  // Not on the event's first page, only inside the form, beside the title.
  await expect(page.getByRole('button', { name: 'Copy link' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  const copy = page.getByRole('button', { name: 'Copy link' });
  const [c, h] = [await copy.boundingBox(), await page.locator('#ed-h').boundingBox()];
  expect(c.x).toBeGreaterThan(h.x + h.width);
  await page.screenshot({ path: 'test-results/share/admin-form.png' });

  await copy.click();
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain(`#/lounge?view=events&register=${EVENT_ID}`);

  // Pasted into a tab already on the Lounge (same document), then opened fresh.
  await page.goto('/#/lounge');
  await expect(page.getByRole('link', { name: 'Events', exact: true })).toBeVisible();
  await page.goto(url);
  await expect(page.locator('dialog[open]').getByText('Registering is final')).toBeVisible();
  await expect(page).not.toHaveURL(/register=/);
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.locator('dialog[open]').getByText('Registering is final')).toBeVisible();
  await expect(page).not.toHaveURL(/register=/);
});

// A student sees what the admins decided about their WhatsApp group forms: a rejected one says
// why and can be filled in again, an approved one leaves the Lounge, and "I've joined all my
// groups" hides the section (saved on the member row). Supabase is mocked; the backend contract
// is list_lounge_forms review_status / review_reason and submit_lounge_form replacing a
// rejected response.
import { test, expect } from '@playwright/test';
import { callTo, mockSupabase } from './supabase-mock.js';

const TECH = '41a00000-0000-4000-8000-000000000001';
const CULT = '41a00000-0000-4000-8000-000000000002';
const INVITE = 'https://chat.whatsapp.com/TESTINVITE';

test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }));

const group = (id, label, extra = {}) => ({
  id,
  title: `${label} application`,
  form_kind: 'group',
  group_label: label,
  group_purpose: 'Build things together.',
  fields: [{ key: 'name', label: 'Name', type: 'text', required: true, prefill: 'name' }],
  region_id: null,
  community_id: 2,
  event_id: null,
  is_open: true,
  accepting_responses: true,
  published_at: '2026-10-01T00:00:00Z',
  submitted: false,
  review_status: null,
  review_reason: null,
  ...extra,
});
const approved = (id, label) => group(id, label, { submitted: true, review_status: 'approved' });
const rejected = (id, label, reason = 'Please use your full name.') =>
  group(id, label, { submitted: true, review_status: 'rejected', review_reason: reason });

test('a rejected form shows the reason and can be filled in again', async ({ page }) => {
  let form = rejected(TECH, 'Technical Circle');
  await mockSupabase(page, {
    data: {
      list_lounge_forms: () => [form],
      get_lounge_form_invite: INVITE,
      submit_lounge_form: () => {
        form = group(TECH, 'Technical Circle', { submitted: true, review_status: 'pending' });
        return { response_id: 'resp-2', invite_url: INVITE, registered: false };
      },
    },
  });
  await page.goto('/#/lounge?room=groups');
  const card = page.locator('.moor');
  await expect(card).toContainText('Technical Circle');
  await expect(card).toContainText('Not approved');
  await expect(card).toContainText('Note from the admins: Please use your full name.');
  await expect(card).toContainText('Fill again');
  await expect(card).not.toContainText('Open invite');

  await card.getByRole('link', { name: /Technical Circle/ }).click();
  await expect(page.getByRole('heading', { name: 'Technical Circle' })).toBeVisible();
  await expect(page.getByRole('status').first()).toContainText('Please use your full name.');
  await expect(page.getByText(/already saved|Your application is saved/)).toHaveCount(0);
  await page.getByLabel(/Name/).fill('Riya Venkataraman');
  await page.getByRole('button', { name: 'Send again' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'One step left' })).toBeVisible();

  await page.goto('/#/lounge?room=groups');
  await expect(page.locator('.moor')).toContainText('Under review');
  await expect(page.locator('.moor')).not.toContainText('Not approved');
  await expect(page.locator('.moor a.mb')).toHaveAttribute('href', INVITE);
});

test('a pending form keeps its invite and says it is under review', async ({ page }) => {
  await mockSupabase(page, {
    data: {
      list_lounge_forms: [
        group(TECH, 'Technical Circle', { submitted: true, review_status: 'pending' }),
      ],
      get_lounge_form_invite: INVITE,
    },
  });
  await page.goto('/#/lounge?room=groups');
  await expect(page.locator('.moor')).toContainText('Under review');
  await expect(page.locator('.moor a.mb')).toHaveAttribute('href', INVITE);
  await expect(page.locator('.moor')).toContainText('Open invite');
});

test('an approved group card leaves the section; the others stay', async ({ page }) => {
  await mockSupabase(page, {
    data: {
      list_lounge_forms: [
        approved(TECH, 'Technical Circle'),
        group(CULT, 'Cultural Circle', { community_id: 3 }),
      ],
    },
  });
  await page.goto('/#/lounge?room=groups');
  await expect(page.locator('.moor')).toContainText('Cultural Circle');
  await expect(page.locator('.moor')).not.toContainText('Technical Circle');
});

test('when every group form is approved the whole section is removed', async ({ page }) => {
  await mockSupabase(page, {
    data: { list_lounge_forms: [approved(TECH, 'Technical Circle'), approved(CULT, 'Cultural')] },
  });
  await page.goto('/#/lounge');
  await expect(page.getByRole('button', { name: /^Your profile/ })).toBeVisible();
  await expect(page.locator('#groups')).toHaveCount(0);
  await expect(page.locator('.moor')).toHaveCount(0);
  await expect(page.locator('.h-cue')).toHaveCount(0);
});

test('groups not published yet keep the waiting note', async ({ page }) => {
  await mockSupabase(page, { data: { list_lounge_forms: [] } });
  await page.goto('/#/lounge');
  await expect(page.locator('#groups')).toContainText('will appear here when available');
});

test('"I\'ve joined all my groups" hides the section, saves, and can be undone', async ({
  page,
}) => {
  const calls = await mockSupabase(page, {
    data: { list_lounge_forms: [group(TECH, 'Technical Circle')] },
  });
  await page.goto('/#/lounge');
  await expect(page.locator('#groups')).toContainText('Technical Circle');

  await page.getByRole('button', { name: /^Your profile/ }).click();
  const sw = page.getByRole('switch', { name: /I've joined all my groups/ });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  const call = await callTo(calls, '/rest/v1/rpc/set_group_forms_hidden', 'POST');
  expect(JSON.parse(call.body)).toEqual({ p_hidden: true });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#groups')).toHaveCount(0);
  await expect(page.locator('.h-cue')).toHaveCount(0);

  // It is on the member row: a reload keeps it hidden.
  await page.reload();
  await expect(page.getByRole('button', { name: /^Your profile/ })).toBeVisible();
  await expect(page.locator('#groups')).toHaveCount(0);

  await page.getByRole('button', { name: /^Your profile/ }).click();
  const back = page.getByRole('switch', { name: /I've joined all my groups/ });
  await expect(back).toHaveAttribute('aria-checked', 'true');
  await back.click();
  await expect(back).toHaveAttribute('aria-checked', 'false');
  const hides = calls
    .filter((c) => c.path === '/rest/v1/rpc/set_group_forms_hidden')
    .map((c) => JSON.parse(c.body).p_hidden);
  expect(hides).toEqual([true, false]);
  await expect(page.locator('#groups')).toContainText('Technical Circle');
});

test('hidden still surfaces a rejected form as a small notice', async ({ page }) => {
  await mockSupabase(page, {
    profile: { group_forms_hidden: true },
    data: {
      list_lounge_forms: [
        rejected(TECH, 'Technical Circle', 'Phone number missing.'),
        group(CULT, 'Cultural Circle', { community_id: 3 }),
        { ...approved('41a00000-0000-4000-8000-000000000003', 'Esports') },
      ],
      get_lounge_form_invite: INVITE,
    },
  });
  await page.goto('/#/lounge?room=groups');
  const card = page.locator('.moor');
  await expect(card).toContainText("A group form wasn't approved");
  await expect(card).toContainText('Phone number missing.');
  await expect(card).toContainText('Fill again');
  await expect(card).not.toContainText('Cultural Circle');
});

test('a rejected form that has since closed says why, offers no way to fill it again', async ({
  page,
}) => {
  const closed = rejected(TECH, 'Technical Circle', 'Please use your full name.');
  closed.is_open = false;
  closed.accepting_responses = false;
  await mockSupabase(page, { data: { list_lounge_forms: [closed] } });
  await page.goto('/#/lounge?room=groups');
  const card = page.locator('.moor');
  await expect(card).toContainText('Not approved');
  await expect(card).toContainText('Note from the admins: Please use your full name.');
  await expect(card).not.toContainText('Fill again');
  await expect(card).not.toContainText('send it again');

  await card.getByRole('link', { name: /Technical Circle/ }).click();
  await expect(page.getByRole('status').first()).toContainText('Please use your full name.');
  await expect(page.getByText(/Fill it in again/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Send/ })).toHaveCount(0);
});

test('hidden keeps only a rejected form that can still be fixed', async ({ page }) => {
  const closed = rejected(CULT, 'Cultural Circle', 'Too late.');
  closed.is_open = false;
  closed.accepting_responses = false;
  closed.community_id = 3;
  await mockSupabase(page, {
    profile: { group_forms_hidden: true },
    data: {
      list_lounge_forms: [rejected(TECH, 'Technical Circle', 'Phone number missing.'), closed],
    },
  });
  await page.goto('/#/lounge?room=groups');
  await expect(page.locator('.moor')).toContainText('Technical Circle');
  await expect(page.locator('.moor')).not.toContainText('Cultural Circle');
});

test('hidden with only a closed rejected form removes the section', async ({ page }) => {
  const closed = rejected(CULT, 'Cultural Circle', 'Too late.');
  closed.is_open = false;
  closed.accepting_responses = false;
  closed.community_id = 3;
  await mockSupabase(page, {
    profile: { group_forms_hidden: true },
    data: { list_lounge_forms: [closed] },
  });
  await page.goto('/#/lounge');
  await expect(page.getByRole('button', { name: /^Your profile/ })).toBeVisible();
  await expect(page.locator('#groups')).toHaveCount(0);
  await expect(page.locator('.h-cue')).toHaveCount(0);
});

test('"Under review" is only for group forms', async ({ page }) => {
  const GENERAL = '41a00000-0000-4000-8000-0000000000aa';
  await mockSupabase(page, {
    data: {
      list_lounge_forms: [
        group(TECH, 'Technical Circle', { submitted: true, review_status: 'pending' }),
        group(GENERAL, 'Feedback', {
          form_kind: 'general',
          community_id: null,
          submitted: true,
          review_status: 'pending',
        }),
      ],
      get_lounge_form_invite: INVITE,
    },
  });
  await page.goto(`/#/lounge/forms/${GENERAL}`);
  await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Send/ })).toHaveCount(0);
  await expect(page.getByText('Under review')).toHaveCount(0);

  await page.goto(`/#/lounge/forms/${TECH}`);
  await expect(page.getByRole('heading', { name: 'Technical Circle' })).toBeVisible();
  await expect(page.getByText('Under review')).toBeVisible();
});

test('a rejected event registration says "Not approved", never "Registered"', async ({ page }) => {
  const EVENT_ID = '33333333-3333-4333-8333-333333333333';
  const FORM_ID = '44444444-4444-4444-8444-444444444444';
  const title = 'Build night: your first portfolio site';
  const event = (id, name, registered) => ({
    id,
    name,
    stage: 'upcoming',
    starts_at: '2099-01-01T10:00:00Z',
    ends_at: '2099-01-01T11:00:00Z',
    community_id: 2,
    registration: registered ? { event_id: id } : null,
  });
  await mockSupabase(page, {
    data: {
      list_lounge_events: [event(EVENT_ID, title, true)],
      list_lounge_forms: [
        {
          ...group(FORM_ID, title),
          form_kind: 'event',
          event_id: EVENT_ID,
          submitted: true,
          review_status: 'rejected',
          review_reason: 'Wrong roll number.',
        },
      ],
    },
  });
  await page.goto('/#/lounge?view=events');
  await page.getByRole('tab', { name: /Mine/ }).click();
  const row = page
    .locator('.er')
    .filter({ has: page.getByRole('button', { name: title, exact: true }) });
  await expect(row.getByText('Not approved', { exact: true })).toBeVisible();
  await expect(row.getByText('Registered', { exact: true })).toHaveCount(0);

  await row.getByRole('button', { name: title, exact: true }).click();
  await expect(page.getByText('Wrong roll number.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Register again' })).toBeVisible();
});

test('a Super Admin does not get the groups switch', async ({ page }) => {
  await mockSupabase(page, {
    as: 'sa',
    data: { list_lounge_forms: [group(TECH, 'Technical Circle')] },
  });
  await page.goto('/#/lounge');
  await page.getByRole('button', { name: /^Your profile/ }).click();
  await expect(page.getByRole('button', { name: /Edit profile/ })).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(0);
});

test('a refresh already in flight cannot undo the saved switch', async ({ page }) => {
  let release;
  const gate = new Promise((r) => (release = r));
  const calls = await mockSupabase(page, {
    data: { list_lounge_forms: [group(TECH, 'Technical Circle')] },
  });
  await page.goto('/#/lounge');
  await expect(page.locator('#groups')).toContainText('Technical Circle');
  // Opening Edit profile refreshes the Lounge. That refresh reads the member as "shown" and
  // then waits on the forms list while the student flips the switch.
  await page.route('**/rest/v1/rpc/list_lounge_forms', async (route) => {
    await gate;
    await route.fallback();
  });
  await page.getByRole('button', { name: /^Your profile/ }).click();
  await page.getByRole('button', { name: /Edit profile/ }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: /^Your profile/ }).click();
  const sw = page.getByRole('switch', { name: /I've joined all my groups/ });
  await sw.click();
  await callTo(calls, '/rest/v1/rpc/set_group_forms_hidden', 'POST');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  release();
  await expect
    .poll(() => calls.filter((c) => c.path.endsWith('/list_lounge_forms')).length)
    .toBe(2);
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#groups')).toHaveCount(0);
});

test('a group an admin added you to leaves the Lounge until "Show groups I\'m in"', async ({
  page,
}) => {
  const calls = await mockSupabase(page, {
    data: {
      list_lounge_forms: [
        group(TECH, 'Technical Circle', { submitted: true, tracks_adds: true, added: true }),
        group(CULT, 'Cultural Circle', { community_id: 3, submitted: true, tracks_adds: true }),
      ],
      get_lounge_form_invite: INVITE,
    },
  });
  await page.goto('/#/lounge?room=groups');
  await expect(page.locator('.moor')).toContainText('Cultural Circle');
  await expect(page.locator('.moor')).toContainText('Waiting for an admin to add you.');
  await expect(page.locator('.moor')).not.toContainText('Technical Circle');

  await page.getByRole('button', { name: /^Your profile/ }).click();
  const sw = page.getByRole('switch', { name: /Show groups I'm in/ });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  const call = await callTo(calls, '/rest/v1/rpc/set_joined_groups_shown', 'POST');
  expect(JSON.parse(call.body)).toEqual({ p_shown: true });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('.moor')).toContainText('Technical Circle');
  await expect(page.locator('.moor')).toContainText("You're in this group.");
});

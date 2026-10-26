import { test, expect } from '@playwright/test';
import { callTo, mockSupabase, PEOPLE, pick } from './supabase-mock.js';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('https://res.cloudinary.com/**', (route) => route.fulfill({ status: 204 }));
});

const EVENT_ID = 'e1800000-0000-4000-8000-0000000000e1';
const FORM_ID = 'f1800000-0000-4000-8000-0000000000f1';
const REQUEST_ID = 'b1800000-0000-4000-8000-0000000000a1';
const soon = (days) => new Date(Date.now() + days * 864e5).toISOString();

const event = {
  id: EVENT_ID,
  name: 'Hack night',
  community_id: 2,
  region_id: null,
  starts_at: soon(2),
  ends_at: soon(3),
  published_at: soon(-1),
  audience_cohorts: [],
  attendance_mode: 'meet',
  archive: false,
  is_public: false,
  entry_mode: 'register',
  created_by: PEOPLE.head.id,
};

const bound = {
  id: FORM_ID,
  title: 'Hack night signup',
  event_id: EVENT_ID,
  fields: [{ key: 'name', label: 'Name', type: 'text' }],
  published_at: soon(-1),
  is_open: true,
  can_manage: true,
};

test('a Head asks a Super Admin to remove the event form', async ({ page }) => {
  const approval_requests = [];
  const calls = await mockSupabase(page, {
    as: 'head',
    data: {
      events: [event],
      approval_requests,
      list_lounge_forms: [bound],
      request_form_delete: () => {
        approval_requests.push({
          id: REQUEST_ID,
          type: 'form_delete',
          status: 'pending',
          target_form_id: FORM_ID,
        });
        return REQUEST_ID;
      },
      cancel_request: () => {
        approval_requests.length = 0;
        return REQUEST_ID;
      },
    },
  });
  await page.goto('/#/admin?tab=events');
  await page.getByRole('button', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit event' });
  await expect(dialog.getByRole('button', { name: 'Remove form' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Ask Super Admin to remove' }).click();
  await page.getByRole('button', { name: 'Ask Super Admin', exact: true }).click();
  await expect(dialog.getByText('Waiting for a Super Admin to remove this form.')).toBeVisible();
  const asked = await callTo(calls, '/rest/v1/rpc/request_form_delete');
  expect(JSON.parse(asked.body).p_form_id).toBe(FORM_ID);

  await dialog.getByRole('button', { name: 'Cancel request' }).click();
  const cancel = await callTo(calls, '/rest/v1/rpc/cancel_request');
  expect(JSON.parse(cancel.body).p_request_id).toBe(REQUEST_ID);
  await expect(dialog.getByRole('button', { name: 'Ask Super Admin to remove' })).toBeVisible();
});

test('a Super Admin removes the form and can set the event to No form', async ({ page }) => {
  const forms = [bound];
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: {
      events: [{ ...event, created_by: PEOPLE.sa.id }],
      approval_requests: [],
      list_lounge_forms: () => forms,
      delete_lounge_form: () => {
        forms.length = 0;
        return null;
      },
    },
  });
  await page.goto('/#/admin?tab=events');
  await page.getByRole('button', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit event' });
  await expect(dialog.getByRole('button', { name: 'Ask Super Admin to remove' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Remove form' }).click();
  await page
    .getByRole('dialog', { name: /Remove “Hack night signup”/ })
    .getByRole('button', {
      name: 'Remove form',
    })
    .click();
  await expect(dialog.getByText('No form yet.')).toBeVisible();
  const deleted = await callTo(calls, '/rest/v1/rpc/delete_lounge_form');
  expect(JSON.parse(deleted.body).p_form_id).toBe(FORM_ID);

  await pick(dialog, 'Registration', 'No form');
  await dialog.getByLabel("Members' meeting link").fill('https://meet.google.com/abc-defg-hij');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  const saved = JSON.parse((await callTo(calls, '/rest/v1/events', 'PATCH')).body);
  expect(saved.entry_mode).toBe('open');
});

test('a Super Admin sees the remove request and opens the form from it', async ({ page }) => {
  const request = {
    id: REQUEST_ID,
    type: 'form_delete',
    status: 'pending',
    reason: 'Remove this form',
    requested_change: { form_id: FORM_ID, form_title: 'Hack night signup' },
    target_snapshot: {},
    review_note: null,
    requested_at: '2026-10-26T10:00:00Z',
    reviewed_at: null,
    requested_by: PEOPLE.head.id,
    reviewed_by: null,
    target_member_id: PEOPLE.head.id,
    target_form_id: FORM_ID,
    target: { full_name: 'Meera Nair', member_code: '99f9000005' },
    requester: { full_name: 'Meera Nair' },
  };
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: {
      approval_requests: [request],
      list_lounge_forms: [bound],
      approve_request: REQUEST_ID,
    },
  });
  await page.goto('/#/admin?tab=requests');
  await expect(page.getByText('Remove form').first()).toBeVisible();
  await expect(page.getByText('Hack night signup').first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Deleted forever' })).toBeVisible();

  await page.getByRole('button', { name: 'Open the form' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit form' });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText('An organizer asked to remove this form. Approve or reject it in Requests.')
  ).toBeVisible();
  expect(calls.some((c) => c.path === '/rest/v1/rpc/approve_request')).toBe(false);
});

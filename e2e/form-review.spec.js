import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { callTo, mockSupabase, pick } from './supabase-mock.js';

test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }));

const FORM_ID = 'f1000000-0000-4000-8000-0000000000aa';
const SCHEMA = [{ key: 'name', label: 'Name', type: 'text' }];
const ids = [1, 2, 3].map((n) => `a1000000-0000-4000-8000-00000000000${n}`);

// A stateful stand-in for export_form_responses / review_form_response.
function reviewDesk() {
  const rows = ['Asha', 'Bilal', 'Chitra'].map((name, i) => ({
    id: ids[i],
    serial: i + 1,
    email: `26f100000${i + 1}@ds.study.iitm.ac.in`,
    member_full_name: `${name} Full`,
    member_preferred_name: name,
    submitted_at: `2026-10-0${i + 1}T10:00:00Z`,
    resubmitted_at: null,
    answers: { name },
    field_schema: SCHEMA,
    review_status: 'pending',
    review_reason: null,
    reviewed_at: null,
    reviewer_name: null,
    reviewer_email: null,
  }));
  return {
    list_lounge_forms: [
      {
        id: FORM_ID,
        title: 'Patna group',
        fields: SCHEMA,
        published_at: '2026-10-01T00:00:00Z',
        is_open: true,
        can_manage: true,
      },
    ],
    export_form_responses: () => rows,
    review_form_response: (args) => {
      const row = rows.find((r) => r.id === args.p_response_id);
      if (args.p_expected_at !== (row.resubmitted_at ?? row.submitted_at))
        throw new Error('stale expected_at');
      row.review_status = args.p_status;
      row.review_reason = args.p_status === 'rejected' ? args.p_reason : null;
      row.reviewed_at = args.p_status === 'pending' ? null : '2026-10-10T09:00:00Z';
      row.reviewer_name = args.p_status === 'pending' ? null : 'House Secretary';
      return {
        id: row.id,
        review_status: row.review_status,
        review_reason: row.review_reason,
        reviewed_at: row.reviewed_at,
      };
    },
    get_available_cohorts: { current: '26F3', next: '27F1', options: ['26F3', '27F1'] },
  };
}

async function openResponses(page, data = reviewDesk()) {
  const calls = await mockSupabase(page, { as: 'sa', data });
  await page.goto('/#/admin?tab=forms');
  await page.getByRole('button', { name: 'Responses' }).click();
  return { calls, dialog: page.getByRole('dialog', { name: 'Patna group responses' }) };
}

const serialsInOrder = (dialog) => dialog.locator('tbody .serial').allTextContents();

test('responses show arrival serials; sort and filter never renumber them', async ({ page }) => {
  const { dialog } = await openResponses(page);
  await expect(dialog.locator('tbody tr')).toHaveCount(3);
  expect(await serialsInOrder(dialog)).toEqual(['#3', '#2', '#1']);
  await expect(dialog.getByText('Asha Full')).toBeVisible();

  await pick(dialog, 'Sort', 'Oldest first');
  expect(await serialsInOrder(dialog)).toEqual(['#1', '#2', '#3']);

  await dialog.getByRole('button', { name: 'Approve 26f1000002@ds.study.iitm.ac.in' }).click();
  await dialog.getByRole('combobox', { name: 'Review' }).click();
  await expect(dialog.getByRole('option', { name: 'Any status · 3' })).toBeVisible();
  await expect(dialog.getByRole('option', { name: 'Pending · 2' })).toBeVisible();
  // An empty status stays listed but cannot be picked.
  await expect(dialog.getByRole('option', { name: 'Rejected · 0' })).toHaveAttribute(
    'aria-disabled',
    'true'
  );
  await dialog.getByRole('option', { name: 'Approved · 1', exact: true }).click();
  expect(await serialsInOrder(dialog)).toEqual(['#2']);

  await pick(dialog, 'Review', 'Pending · 2');
  await pick(dialog, 'Sort', 'Newest first');
  expect(await serialsInOrder(dialog)).toEqual(['#3', '#1']);
  await dialog.getByRole('button', { name: 'Approve 26f1000003@ds.study.iitm.ac.in' }).click();
  await dialog.getByRole('button', { name: 'Approve 26f1000001@ds.study.iitm.ac.in' }).click();
  await expect(dialog.getByText('Nobody matches this filter.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(dialog.locator('tbody tr')).toHaveCount(3);
});

test('a resent response keeps its serial and place, and says when it was resent', async ({
  page,
}) => {
  const data = reviewDesk();
  const rows = data.export_form_responses();
  rows[0].resubmitted_at = '2026-10-12T08:00:00Z';
  const { dialog } = await openResponses(page, data);
  await expect(dialog.locator('tbody tr')).toHaveCount(3);
  // Resent #1 stays #1: serial and order follow the first-received time.
  expect(await serialsInOrder(dialog)).toEqual(['#3', '#2', '#1']);
  await expect(dialog.getByText(/^Resent /)).toHaveCount(1);
  await expect(
    dialog
      .locator('tbody tr')
      .nth(2)
      .getByText(/^Resent /)
  ).toBeVisible();
  await pick(dialog, 'Sort', 'Oldest first');
  expect(await serialsInOrder(dialog)).toEqual(['#1', '#2', '#3']);
});

test('approve sends the decision and shows who made it', async ({ page }) => {
  const { calls, dialog } = await openResponses(page);
  await dialog.getByRole('button', { name: 'Approve 26f1000001@ds.study.iitm.ac.in' }).click();
  const call = await callTo(calls, '/rest/v1/rpc/review_form_response');
  expect(JSON.parse(call.body)).toEqual({
    p_response_id: ids[0],
    p_status: 'approved',
    p_expected_at: '2026-10-01T10:00:00Z',
    p_reason: null,
  });
  const row = dialog.locator('tbody tr', { hasText: '#1' });
  await expect(row.getByText('Approved', { exact: true })).toBeVisible();
  await expect(row.getByText(/House Secretary/)).toBeVisible();
  await row.getByRole('button', { name: /^Undo review/ }).click();
  await expect(row.getByText('Pending', { exact: true })).toBeVisible();
});

test('reject needs a reason, accepts a quick pick, and undo clears it', async ({ page }) => {
  const { calls, dialog } = await openResponses(page);
  await dialog.getByRole('button', { name: 'Reject 26f1000003@ds.study.iitm.ac.in' }).click();
  const reject = page.getByRole('dialog', { name: 'Reject #3' });
  const submit = reject.getByRole('button', { name: 'Reject response' });
  await expect(submit).toBeDisabled();

  await reject.getByRole('button', { name: 'Wrong region for this group' }).click();
  await expect(reject.getByRole('textbox')).toHaveValue('Wrong region for this group');
  await reject.getByRole('textbox').fill('  Wrong region for this group — try Delhi NCR  ');
  await submit.click();

  const call = await callTo(calls, '/rest/v1/rpc/review_form_response');
  expect(JSON.parse(call.body)).toEqual({
    p_response_id: ids[2],
    p_status: 'rejected',
    p_expected_at: '2026-10-03T10:00:00Z',
    p_reason: 'Wrong region for this group — try Delhi NCR',
  });
  await expect(reject).toHaveCount(0);
  const row = dialog.locator('tbody tr', { hasText: '#3' });
  await expect(row.getByText('Rejected', { exact: true })).toBeVisible();
  await expect(row.getByText('Wrong region for this group — try Delhi NCR')).toBeVisible();
  await expect(row.getByRole('button', { name: /^Reject / })).toHaveCount(0);

  await row.getByRole('button', { name: /^Undo review/ }).click();
  await expect(row.getByText('Pending', { exact: true })).toBeVisible();
  await expect(row.getByText('Wrong region')).toHaveCount(0);
});

// Answers one RPC with a database error, still letting the CORS preflight through.
function failRpc(page, name, status, error, before = () => {}) {
  return page.route(`**/rest/v1/rpc/${name}`, (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      });
    before();
    return route.fulfill({
      status,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify(error),
    });
  });
}

test('a failed review shows the error and leaves the row alone', async ({ page }) => {
  const { dialog } = await openResponses(page);
  await failRpc(page, 'review_form_response', 403, {
    code: '42501',
    message: 'This response is outside your organizer scope',
  });
  await dialog.getByRole('button', { name: 'Approve 26f1000001@ds.study.iitm.ac.in' }).click();
  await expect(dialog.getByRole('alert')).toContainText('outside your organizer scope');
  await expect(
    dialog.locator('tbody tr', { hasText: '#1' }).getByText('Pending', { exact: true })
  ).toBeVisible();
});

test('a response that changed since it loaded is refused, reloaded and explained', async ({
  page,
}) => {
  const data = reviewDesk();
  const rows = data.export_form_responses();
  const { dialog } = await openResponses(page, data);
  await failRpc(
    page,
    'review_form_response',
    409,
    {
      code: 'PT409',
      message: 'This response changed since you loaded it. Refresh and review again.',
    },
    () => {
      rows[0].resubmitted_at = '2026-10-12T08:00:00Z';
    }
  );
  await dialog.getByRole('button', { name: 'Approve 26f1000001@ds.study.iitm.ac.in' }).click();
  await expect(dialog.getByRole('alert')).toContainText('changed since you loaded it');
  const row = dialog.locator('tbody tr', { hasText: '#1' });
  await expect(row.getByText(/^Resent /)).toBeVisible();
  await expect(row.getByText('Pending', { exact: true })).toBeVisible();
});

test('a failed refresh after a saved review is a notice, not a failed review', async ({ page }) => {
  const { dialog } = await openResponses(page);
  await failRpc(page, 'export_form_responses', 500, { code: 'XX000', message: 'boom' });
  await dialog.getByRole('button', { name: 'Approve 26f1000001@ds.study.iitm.ac.in' }).click();
  const row = dialog.locator('tbody tr', { hasText: '#1' });
  await expect(row.getByText('Approved', { exact: true })).toBeVisible();
  await expect(dialog.getByText("Saved, but couldn't refresh the list.")).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
});

test('CSV export carries the serial and review columns', async ({ page }) => {
  const { dialog } = await openResponses(page);
  await dialog.getByRole('button', { name: 'Approve 26f1000001@ds.study.iitm.ac.in' }).click();
  await expect(dialog.locator('tbody tr', { hasText: '#1' }).getByText('Approved')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download CSV' }).click();
  const csv = await readFile(await (await downloadPromise).path(), 'utf8');
  const [header, first] = csv.split('\n');
  expect(header).toBe(
    'serial,email,full_name,preferred_name,submitted_at,review_status,review_reason,reviewed_by,reviewed_at,Name'
  );
  expect(first).toBe(
    '1,26f1000001@ds.study.iitm.ac.in,Asha Full,Asha,2026-10-01T10:00:00Z,approved,,House Secretary,2026-10-10T09:00:00Z,Asha'
  );
});

// PAN BS guests (signed-out registrations) sit in the same list as member responses.
function panbsDesk() {
  const data = reviewDesk();
  const guest = (n, email, house, extra = {}) => ({
    id: `b1000000-0000-4000-8000-00000000000${n}`,
    email,
    full_name: `Guest ${n}`,
    phone: null,
    house,
    on_roster: false,
    is_member: false,
    in_lounge: false,
    answers: { name: `Guest ${n}` },
    field_schema: SCHEMA,
    submitted_at: `2026-10-0${n + 3}T10:00:00Z`,
    ...extra,
  });
  data.list_form_guests = [
    guest(1, 'gir1@ds.study.iitm.ac.in', 'Gir'),
    guest(2, 'kanha1@ds.study.iitm.ac.in', 'Kanha'),
    guest(3, 'roster1@ds.study.iitm.ac.in', 'Sundarbans', { on_roster: true, is_member: true }),
    // Also answered in the Lounge as member #1: listed once, as the member.
    guest(4, '26f1000001@ds.study.iitm.ac.in', 'Sundarbans', { in_lounge: true, is_member: true }),
  ];
  return data;
}

test('guests and members share one list, labelled and filterable', async ({ page }) => {
  const { dialog } = await openResponses(page, panbsDesk());
  await expect(dialog.getByText(/6\s+registrations/)).toBeVisible();
  await expect(dialog.locator('tbody tr')).toHaveCount(6);
  // Anyone on the member list is a Member, even when they signed up on the event page.
  await expect(dialog.locator('tbody .adm-badge', { hasText: /^Member$/ })).toHaveCount(4);
  await expect(dialog.locator('tbody .adm-badge', { hasText: /^Guest$/ })).toHaveCount(2);
  await expect(
    dialog
      .locator('tbody tr', { hasText: 'roster1@ds.study.iitm.ac.in' })
      .getByText('Signed up on the event page, so not reviewed.')
  ).toBeVisible();
  // The member who also registered as a guest appears once.
  await expect(dialog.getByText('26f1000001@ds.study.iitm.ac.in')).toHaveCount(1);

  await dialog.getByRole('button', { name: /^Members\s*4$/ }).click();
  await expect(dialog.getByRole('button', { name: /^Members/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(dialog.locator('tbody tr')).toHaveCount(4);
  await pick(dialog, 'Review', 'Signed up on event page · 1');
  await expect(dialog.locator('tbody tr')).toHaveCount(1);

  // Switching who clears the refinement; guests are filtered by house, never by review.
  await dialog.getByRole('button', { name: /^Guests\s*2$/ }).click();
  await expect(dialog.locator('tbody tr')).toHaveCount(2);
  await expect(dialog.getByRole('combobox', { name: 'Review' })).toHaveCount(0);
  await pick(dialog, 'House', 'Gir · 1');
  await expect(dialog.locator('tbody tr')).toHaveCount(1);

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download CSV' }).click();
  const csv = await readFile(await (await downloadPromise).path(), 'utf8');
  const [header, first] = csv.split('\n');
  expect(header).toBe(
    'serial,registered_as,signed_up_via,email,full_name,preferred_name,house,phone,on_roster,submitted_at,review_status,review_reason,reviewed_by,reviewed_at,Name'
  );
  expect(first).toBe(
    ',guest,event page,gir1@ds.study.iitm.ac.in,Guest 1,,Gir,,no,2026-10-04T10:00:00Z,,,,,Guest 1'
  );
});

test('a house form without guests shows no member or guest labels', async ({ page }) => {
  const { dialog } = await openResponses(page);
  await expect(dialog.locator('tbody tr')).toHaveCount(3);
  await expect(dialog.getByRole('button', { name: /^Guests/ })).toHaveCount(0);
  await expect(dialog.getByRole('combobox', { name: 'Review' })).toBeVisible();
  await expect(dialog.locator('tbody .adm-badge', { hasText: /^Member$/ })).toHaveCount(0);
});

// A form with a WhatsApp invite: the Review column becomes "Added to group".
function groupDesk() {
  const data = reviewDesk();
  const adds = [
    {
      email: '26f1000003@ds.study.iitm.ac.in',
      added_at: '2026-10-05T09:00:00Z',
      added_by: 'x',
      added_by_name: 'House Secretary',
    },
  ];
  return {
    ...data,
    list_form_adds: () => ({ tracks: true, adds }),
    mark_form_added: (args) => {
      const mark = {
        email: args.p_email,
        added_at: '2026-10-10T09:00:00Z',
        added_by: 'me',
        added_by_name: 'Super Admin',
      };
      adds.push(mark);
      return { ...mark, created: true };
    },
    undo_form_added: (args) => {
      adds.splice(
        adds.findIndex((a) => a.email === args.p_email),
        1
      );
      return true;
    },
  };
}

test('on a group form admins mark who was added, with a short undo', async ({ page }) => {
  const { calls, dialog } = await openResponses(page, groupDesk());
  await expect(dialog.getByRole('columnheader', { name: 'Added to group' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Approve/ })).toHaveCount(0);
  await expect(dialog.getByText(/1 added/)).toBeVisible();
  const done = dialog.locator('tbody tr', { hasText: '#3' });
  await expect(done.getByText('Added', { exact: true })).toBeVisible();
  await expect(done.getByText(/House Secretary/)).toBeVisible();

  await dialog
    .getByRole('button', { name: 'Mark 26f1000001@ds.study.iitm.ac.in added to the group' })
    .click();
  const call = await callTo(calls, '/rest/v1/rpc/mark_form_added');
  expect(JSON.parse(call.body)).toEqual({
    p_form_id: FORM_ID,
    p_email: '26f1000001@ds.study.iitm.ac.in',
  });
  const first = dialog.locator('tbody tr', { hasText: '#1' });
  await expect(first.getByText('Added', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('status')).toContainText('Asha Full marked as added to the group.');

  await pick(dialog, 'Group', 'Not added yet · 1');
  await expect(dialog.locator('tbody tr')).toHaveCount(1);
  await pick(dialog, 'Group', 'Anyone · 3');

  await dialog.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await callTo(calls, '/rest/v1/rpc/undo_form_added');
  await expect(first.getByRole('button', { name: /^Mark .* added to the group$/ })).toBeVisible();
  await expect(dialog.getByRole('status')).not.toContainText('marked as added');

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download CSV' }).click();
  const csv = await readFile(await (await downloadPromise).path(), 'utf8');
  expect(csv.split('\n')[0]).toContain('added_to_group,added_by,added_at');
  expect(csv).not.toContain('review_status');
});

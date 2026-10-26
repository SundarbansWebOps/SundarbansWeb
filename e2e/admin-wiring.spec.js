import { Buffer } from 'node:buffer';
import { test, expect } from '@playwright/test';
import { adminSections, mockSupabase, PEOPLE, callTo, pick } from './supabase-mock.js';

test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }));

test('students page through the server and search by roll number or email', async ({ page }) => {
  const rows = Array.from({ length: 1101 }, (_, i) => ({
    kind: i % 2 ? 'roster' : 'member',
    id: i % 2 ? null : `c0000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    email: `99f90${String(i).padStart(5, '0')}@ds.study.iitm.ac.in`,
    member_code: null,
    full_name: i === 1100 ? 'Search Target' : null,
    preferred_name: null,
    phone: null,
    gender: null,
    region_id: 1,
    account_status: i % 2 ? 'not_signed_in' : 'active',
    joined_at: '2026-10-09T00:00:00Z',
    communities: [],
  }));
  // Stand-in for list_students: 50 a page, the query matched against the email.
  const list_students = ({ p_query, p_offset }) => {
    const matched = p_query ? rows.filter((r) => r.email.includes(p_query)) : rows;
    return { total: matched.length, rows: matched.slice(p_offset, p_offset + 50) };
  };
  const calls = await mockSupabase(page, { as: 'sa', data: { list_students } });
  const sent = () =>
    calls.filter((c) => c.path === '/rest/v1/rpc/list_students').map((c) => JSON.parse(c.body));
  await page.goto('/#/admin?tab=students');
  await expect(page.getByText(/Showing 50 of 1101 students/)).toBeVisible();
  await page.getByRole('button', { name: 'Show more (1051 left)' }).click();
  await expect(page.getByText(/Showing 100 of 1101 students/)).toBeVisible();
  // Row numbers run on across pages, so the last row shown counts the rows.
  await expect(page.locator('td.serial').first()).toHaveText('1');
  await expect(page.locator('td.serial').last()).toHaveText('100');
  expect(sent().at(-1)).toEqual({
    p_query: null,
    p_status: 'current',
    p_region: null,
    p_community: null,
    p_offset: 50,
  });

  const search = page.getByLabel('Search', { exact: true });
  // Under three characters the server is not asked.
  const before = sent().length;
  await search.fill('99');
  await expect(page.getByText('Type at least 3 characters to search.')).toBeVisible();
  expect(sent()).toHaveLength(before);
  await search.fill('99f9001100');
  await expect(page.getByText(/Showing 1 of 1 student\./)).toBeVisible();
  await expect(page.getByText(rows[1100].email, { exact: true })).toBeVisible();
  expect(sent().at(-1)).toMatchObject({ p_query: '99f9001100', p_offset: 0 });
  await search.fill('missing');
  await expect(page.getByText('No student matches that search.')).toBeVisible();
  await search.fill('');
  await expect(page.getByText(/Showing 50 of 1101 students/)).toBeVisible();
});

test('roster accepts an email without a name and maps a CSV', async ({ page }) => {
  const calls = await mockSupabase(page, {
    as: 'rc',
    data: {
      roster_add_many: (args) =>
        (args.p_rows || []).map((r) => ({ email: r.email, ok: true, category: 'processed' })),
    },
  });
  await page.goto('/#/admin?tab=students');
  await expect(page.getByText('Loading admin data...')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add students' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add students' });
  await expect(dialog.getByText('Added to Patna.')).toBeVisible();
  await dialog.getByLabel('IITM email').fill('21f1000099@ds.study.iitm.ac.in');
  await dialog.getByRole('button', { name: 'Add to roster' }).click();
  await expect(
    dialog.getByText('1 processed, 0 invalid. Existing identities are preserved.')
  ).toBeVisible();
  const added = await callTo(calls, '/rest/v1/rpc/roster_add_many');
  expect(JSON.parse(added.body).p_rows[0]).toMatchObject({
    email: '21f1000099@ds.study.iitm.ac.in',
    full_name: '',
    region_id: null,
  });

  await dialog.getByRole('button', { name: 'Upload CSV' }).click();
  await dialog.getByLabel('Upload roster CSV').setInputFiles({
    name: 'members.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Student_Email,Allocated_Region\n21f1000100@ds.study.iitm.ac.in,Patna\n'),
  });
  await expect(dialog.getByText('1 row after de-duplicating this file.')).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Email' })).toHaveText('Student_Email');
  await dialog.getByRole('button', { name: /Import/ }).click();
  await expect(
    page.getByText('1 processed, 0 invalid. Existing identities are preserved.')
  ).toBeVisible();
  expect(calls.some((c) => c.path === '/rest/v1/rpc/roster_add_many')).toBe(true);
});

test('event editor saves a draft, publishes, and shows the Future badge on the next cohort', async ({
  page,
}) => {
  const eventId = 'e0000000-0000-4000-8000-000000000001';
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: {
      events: [{ id: eventId }],
      get_available_cohorts: {
        current: '26F3',
        next: '27F1',
        options: ['25F1', '25F2', '25F3', '26F1', '26F2', '26F3', '27F1'],
      },
    },
  });
  await page.goto('/#/admin?tab=events');
  await page.getByRole('button', { name: 'New event' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'New event' })).toBeVisible();
  await dialog.getByLabel('Name').fill('House meetup');
  await pick(dialog, 'Year', '2027');
  await expect(dialog.getByText('Future', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: /F1/ }).click();
  await dialog.getByRole('button', { name: 'Save draft' }).click();
  const saved = await callTo(calls, '/rest/v1/events', 'POST');
  expect(saved).toBeTruthy();
  const body = JSON.parse(saved.body);
  expect(body.published_at).toBeUndefined();
  expect(body.audience_cohorts).toEqual(['27F1']);
  expect(body.attendance_mode).toBe('meet');
  expect(body.entry_mode).toBe('register');
});

test('event editor saves an open session with no registration form', async ({ page }) => {
  const eventId = 'e0000000-0000-4000-8000-000000000021';
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: { events: [{ id: eventId }] },
  });
  await page.goto('/#/admin?tab=events');
  await page.getByRole('button', { name: 'New event' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('House hour');
  await pick(dialog, 'How members attend', 'Open to all — no form');
  await expect(
    dialog.getByText(
      'Members join when it starts. No registration form. The Meet link stays in the Lounge.'
    )
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Save draft' }).click();
  const saved = await callTo(calls, '/rest/v1/events', 'POST');
  expect(JSON.parse(saved.body)).toMatchObject({
    name: 'House hour',
    entry_mode: 'open',
    certificate_template_url: null,
  });
});

test('publishing an open session without a Meet link is refused', async ({ page }) => {
  const eventId = 'e0000000-0000-4000-8000-000000000022';
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: { events: [{ id: eventId }] },
  });
  await page.goto('/#/admin?tab=events');
  await page.getByRole('button', { name: 'New event' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('House hour');
  await pick(dialog, 'How members attend', 'Open to all — no form');
  await dialog.getByRole('button', { name: 'Publish' }).click();
  await expect(
    dialog.getByText('Open sessions need a meeting link that starts with https://')
  ).toBeVisible();
  expect(calls.some((c) => c.path === '/rest/v1/events' && /^(POST|PATCH)$/.test(c.method))).toBe(
    false
  );
});

test('switching an event to open clears the certificate template', async ({ page }) => {
  const eventId = 'e0000000-0000-4000-8000-000000000023';
  const event = {
    id: eventId,
    name: 'Workshop',
    starts_at: '2026-12-01T10:00:00Z',
    ends_at: '2026-12-01T12:00:00Z',
    published_at: '2026-10-01T00:00:00Z',
    attendance_mode: 'meet',
    certificate_template_url: 'https://res.cloudinary.com/demo/cert.png',
    certificates_released_at: null,
    entry_mode: 'register',
    archive: false,
    cancelled_at: null,
    community_id: null,
    region_id: null,
    gmail_link: 'https://meet.google.com/abc-defg-hij',
  };
  const calls = await mockSupabase(page, { as: 'sa', data: { events: [event] } });
  await page.goto('/#/admin?tab=events');
  await page.getByRole('button', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog');
  await pick(dialog, 'How members attend', 'Open to all — no form');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  const saved = await callTo(calls, '/rest/v1/events', 'PATCH');
  expect(JSON.parse(saved.body)).toMatchObject({
    entry_mode: 'open',
    certificate_template_url: null,
  });
});

test('an event-scoped form cannot bind to an open session', async ({ page }) => {
  const eventId = 'e0000000-0000-4000-8000-000000000024';
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: {
      list_lounge_forms: [],
      events: [
        {
          id: eventId,
          name: 'House hour',
          published_at: '2026-10-01T00:00:00Z',
          ends_at: '2026-12-01T12:00:00Z',
          archive: false,
          cancelled_at: null,
          entry_mode: 'open',
          community_id: null,
          region_id: null,
        },
      ],
    },
  });
  await page.goto('/#/admin?tab=forms');
  await page.getByRole('button', { name: 'New form' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill('Open signup');
  await pick(dialog, 'Scope', 'Bound to an event');
  await expect(dialog.getByText('No event can take a form.')).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Event' }).click();
  await expect(dialog.getByRole('option', { name: /House hour/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Publish' }).click();
  await expect(dialog.getByText('Open sessions do not take a form.')).toBeVisible();
  expect(calls.some((c) => c.path === '/rest/v1/rpc/save_lounge_form')).toBe(false);
});

test('form builder keeps field order, types, options and a post-submit invite', async ({
  page,
}) => {
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: {
      list_lounge_forms: [],
      save_lounge_form: 'f0000000-0000-4000-8000-000000000001',
      get_available_cohorts: { current: '26F3', next: '27F1', options: ['26F3', '27F1'] },
    },
  });
  await page.goto('/#/admin?tab=forms');
  await page.getByRole('button', { name: 'New form' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill('Community join');
  await dialog.getByLabel('WhatsApp invite (optional)').fill('https://chat.whatsapp.com/AbC123xyz');
  await dialog.getByRole('button', { name: 'Add question' }).click();
  await dialog.getByLabel('Question', { exact: true }).fill('Which games');
  await pick(dialog, 'Answer type', 'Choose many');
  await dialog.getByLabel('Options (one per line)').fill('Valorant\nBGMI');
  await dialog.getByText('Allow “Other”').click();
  await dialog.getByRole('button', { name: 'Publish' }).click();
  const saved = await callTo(calls, '/rest/v1/rpc/save_lounge_form');
  expect(saved).toBeTruthy();
  const payload = JSON.parse(saved.body).p_form;
  expect(payload.title).toBe('Community join');
  expect(payload.invite_url).toBe('https://chat.whatsapp.com/AbC123xyz');
  expect(payload.published_at).toBeTruthy();
  expect(payload.fields[0]).toMatchObject({
    label: 'Which games',
    type: 'multiselect',
    allow_other: true,
    options: ['Valorant', 'BGMI'],
  });
});

test('attendance preview classifies Meet rows before save', async ({ page }) => {
  const eventId = 'e0000000-0000-4000-8000-000000000002';
  const event = {
    id: eventId,
    name: 'Town hall',
    starts_at: '2026-12-01T10:00:00Z',
    ends_at: '2026-12-01T12:00:00Z',
    published_at: '2026-10-01T00:00:00Z',
    attendance_mode: 'meet',
    archive: false,
    cancelled_at: null,
    community_id: null,
    region_id: null,
  };
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: {
      events: [event],
      event_registrations: [
        { event_id: eventId, registered_email: '21f1000001@ds.study.iitm.ac.in' },
      ],
      import_event_attendance: { matched: 1, unregistered: 1, unresolved: 1 },
    },
  });
  await page.goto('/#/admin?tab=events');
  await page.getByRole('button', { name: 'Attendance' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'meet.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'First name,Last name,Email,Duration',
        'A,One,21f1000001@ds.study.iitm.ac.in,25 min',
        'B,Two,21f1000002@ds.study.iitm.ac.in,5 min',
        'C,Three,r****@ds.study.iitm.ac.in,40 min',
      ].join('\n')
    ),
  });
  await expect(dialog.getByText(/registered and attended/)).toBeVisible();
  await expect(dialog.getByRole('cell', { name: 'unresolved', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save attendance' }).click();
  const imported = await callTo(calls, '/rest/v1/rpc/import_event_attendance');
  expect(imported).toBeTruthy();
  const rows = JSON.parse(imported.body).p_rows;
  expect(
    rows.some((r) => r.email === '21f1000001@ds.study.iitm.ac.in' && r.duration_seconds === 1500)
  ).toBe(true);
  expect(rows.filter((r) => r.email.includes('*'))).toEqual([
    expect.objectContaining({
      email: 'r****@ds.study.iitm.ac.in',
      source_row_id: '3',
      duration_seconds: 2400,
    }),
  ]);
});

test('notices publish in scope and positions keep the two-RC cap with no Super Admin add', async ({
  page,
}) => {
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: {
      save_announcement: 'n0000000-0000-4000-8000-000000000001',
      admin_assignments: [
        {
          id: 'p1',
          position: 'rc',
          region_id: 1,
          community_id: null,
          started_at: '2026-01-01T00:00:00Z',
          member: { id: PEOPLE.rc.id, full_name: 'Arjun Rao', member_code: '99f9000003' },
        },
      ],
    },
  });
  await page.goto('/#/admin?tab=notices');
  await page.getByRole('button', { name: 'New notice' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill('Meet this week');
  await dialog.getByLabel('Body').fill('Patna ghat, Saturday.');
  await dialog.getByRole('button', { name: 'Publish now' }).click();
  const saved = await callTo(calls, '/rest/v1/rpc/save_announcement');
  expect(JSON.parse(saved.body).p_announcement).toMatchObject({
    title: 'Meet this week',
    region_id: null,
    community_id: null,
    audience_cohorts: [],
  });

  await adminSections(page).getByRole('button', { name: 'Positions' }).click();
  await expect(page.getByRole('heading', { name: 'Positions' })).toBeVisible();
  await expect(page.getByText('Two slots per region.', { exact: false })).toBeVisible();
  await expect(
    page.getByText('Super Admin login emails stay the three fixed accounts.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Add Super Admin/i })).toHaveCount(0);
});

test('a current-region RC reviews a student region request without the two-person queue', async ({
  page,
}) => {
  const request = {
    id: 'd0000000-0000-4000-8000-000000000001',
    member_id: PEOPLE.member.id,
    from_region_id: 1,
    to_region_id: 2,
    reason: 'Moved for work',
    status: 'pending',
    requested_at: '2026-10-08T10:00:00Z',
    reviewed_at: null,
    review_note: null,
    member: {
      full_name: 'Riya Venkataraman',
      member_code: '99f9000004',
      email: PEOPLE.member.email,
    },
  };
  const calls = await mockSupabase(page, {
    as: 'rc',
    data: { member_region_requests: [request], review_region_change: request.id },
  });
  await page.goto('/#/admin?tab=requests');
  await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible();
  await expect(page.getByRole('article').getByText('Region change')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Patna' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Delhi NCR' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Region change applied.' })
  ).toBeVisible();
  const reviewed = await callTo(calls, '/rest/v1/rpc/review_region_change');
  expect(JSON.parse(reviewed.body)).toMatchObject({ p_request_id: request.id, p_approve: true });
  expect(calls.some((c) => c.path === '/rest/v1/rpc/approve_request')).toBe(false);
});

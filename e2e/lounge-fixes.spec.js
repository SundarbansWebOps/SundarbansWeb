import { test, expect } from '@playwright/test';
import { mockSupabase } from './supabase-mock.js';

const EVENT = '31a00000-0000-4000-8000-000000000001';
const FORM = '31a00000-0000-4000-8000-000000000002';

test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }));

function eventRow(overrides = {}) {
  return {
    id: EVENT,
    name: 'Boundary check',
    description: 'A member event used to verify the attendance and lifecycle display.',
    starts_at: '2026-10-10T03:30:00Z',
    ends_at: '2026-10-10T04:00:00Z',
    stage: 'past',
    community_id: 2,
    registration: { id: 'registration-1' },
    attendance: { duration_seconds: 1199 },
    attendance_mode: 'meet',
    ...overrides,
  };
}

test('attendance verdict uses exact seconds while the displayed duration stays separate', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-10T05:00:00Z') });
  const cases = [
    {
      name: '1169 seconds',
      duration_seconds: 1169,
      attendance_mode: 'meet',
      verdict: 'Left early',
    },
    {
      name: '1170 seconds',
      duration_seconds: 1170,
      attendance_mode: 'meet',
      verdict: 'Left early',
    },
    {
      name: '1199 seconds',
      duration_seconds: 1199,
      attendance_mode: 'meet',
      verdict: 'Left early',
    },
    { name: '1200 seconds', duration_seconds: 1200, attendance_mode: 'meet', verdict: 'Attended' },
    {
      name: 'reviewed eligible',
      duration_seconds: 0,
      attendance_mode: 'reviewed',
      reviewed_eligible: true,
      verdict: 'Attended',
    },
    {
      name: 'reviewed ineligible',
      duration_seconds: 1200,
      attendance_mode: 'reviewed',
      reviewed_eligible: false,
      verdict: 'Left early',
    },
  ];
  const events = cases.map((item, index) =>
    eventRow({
      id: `31a00000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      name: item.name,
      attendance: {
        duration_seconds: item.duration_seconds,
        reviewed_eligible: item.reviewed_eligible,
      },
      attendance_mode: item.attendance_mode,
    })
  );
  await mockSupabase(page, { data: { list_lounge_events: events } });
  await page.goto('/#/lounge?view=events');
  await page.getByRole('tab', { name: /Past/ }).click();
  for (const item of cases) {
    const row = page.locator('.er').filter({ hasText: item.name });
    await expect(row).toContainText(item.verdict);
    if (item.attendance_mode === 'meet' && item.duration_seconds < 1200)
      await expect(row).toContainText('19 min');
  }
  await page.getByRole('button', { name: '1199 seconds', exact: true }).click();
  await expect(page.getByText(/You were in the call for 19 minutes/)).toBeVisible();
  await expect(page.getByText('You attended.')).toHaveCount(0);
});

test('scheduled stage follows the clock and cancellation disables member actions', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-10T03:29:30Z') });
  const scheduled = eventRow({
    starts_at: '2026-10-10T03:30:00Z',
    ends_at: '2026-10-10T04:00:00Z',
    stage: 'past',
    registration: null,
    attendance: null,
  });
  const cancelled = eventRow({
    id: '31a00000-0000-4000-8000-000000000003',
    name: 'Cancelled meeting',
    starts_at: '2026-10-10T03:30:00Z',
    ends_at: '2026-10-10T04:00:00Z',
    stage: 'upcoming',
    cancelled_at: '2026-10-10T03:00:00Z',
    registration: null,
    attendance: null,
  });
  const form = {
    id: FORM,
    event_id: EVENT,
    is_open: true,
    accepting_responses: false,
    fields: [],
  };
  await mockSupabase(page, {
    data: { list_lounge_events: [scheduled, cancelled], list_lounge_forms: [form] },
  });
  await page.goto('/#/lounge?view=events');
  await page.getByRole('tab', { name: /Upcoming/ }).click();
  await expect(page.locator('.er')).toHaveCount(1);
  await expect(page.getByText('Registration closed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Register for Boundary check' })).toHaveCount(0);
  await page.clock.runFor(91_000);
  await page.getByRole('tab', { name: /Live/ }).click();
  await expect(page.locator('.er')).toContainText('Live now');

  await page.getByRole('tab', { name: /Past/ }).click();
  await page.getByRole('button', { name: 'Cancelled meeting', exact: true }).click();
  await expect(page.getByText('This event was cancelled.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Join on Meet/ })).toHaveCount(0);
});

test('an open session shows Open to all and ignores a linked form', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-10T03:00:00Z') });
  const open = eventRow({
    name: 'House hour',
    starts_at: '2026-10-10T04:00:00Z',
    ends_at: '2026-10-10T05:00:00Z',
    stage: 'upcoming',
    entry_mode: 'open',
    registration: null,
    attendance: null,
  });
  const closed = eventRow({
    id: '31a00000-0000-4000-8000-000000000009',
    name: 'Workshop',
    starts_at: '2026-10-10T06:00:00Z',
    ends_at: '2026-10-10T07:00:00Z',
    stage: 'upcoming',
    entry_mode: 'register',
    registration: null,
    attendance: null,
  });
  await mockSupabase(page, {
    data: {
      list_lounge_events: [open, closed],
      list_lounge_forms: [
        {
          id: FORM,
          event_id: open.id,
          is_open: true,
          accepting_responses: true,
          fields: [],
          review_status: 'rejected',
          review_reason: 'Turned down',
        },
      ],
    },
  });
  await page.goto('/#/lounge?view=events');
  await page.getByRole('tab', { name: /Upcoming/ }).click();
  const openRow = page.locator('.er').filter({ hasText: 'House hour' });
  await expect(openRow).toContainText('Open to all');
  await expect(openRow.getByRole('button', { name: /Register/ })).toHaveCount(0);
  await expect(page.locator('.er').filter({ hasText: 'Workshop' })).toContainText(
    'Registration closed'
  );
  await openRow.getByRole('button', { name: 'House hour', exact: true }).click();
  await expect(page.getByText(/Open to all members/)).toBeVisible();
  await expect(page.getByText('Not approved.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Register', exact: true })).toHaveCount(0);
});

test('month-only archive dates keep their year and source text without inventing a day', async ({
  page,
}) => {
  const archive = eventRow({
    starts_at: null,
    ends_at: null,
    archive: true,
    stage: 'past',
    name: 'River archive',
    display_date: 'October 2024',
    registration: null,
    attendance: null,
  });
  await mockSupabase(page, { data: { list_lounge_events: [archive] } });
  await page.goto('/#/lounge?view=events');
  await page.getByRole('tab', { name: /Past/ }).click();
  await expect(page.getByRole('heading', { name: '2024' })).toBeVisible();
  await expect(page.getByLabel('Filter by cohort')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Region' })).toHaveCount(0);
  const row = page.locator('.er');
  await expect(row.locator('.er-date')).toContainText('Oct');
  await expect(row.locator('.er-date')).not.toContainText('1');
  await page.getByRole('button', { name: 'River archive', exact: true }).click();
  await expect(page.locator('.evd-when')).toContainText('October 2024');
});

test('past events stay under their year when some rows have no timestamp', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-10T05:00:00Z') });
  const dated = eventRow({
    starts_at: '2026-02-15T14:30:00Z',
    ends_at: '2026-02-15T16:00:00Z',
    stage: 'past',
    name: 'Winter meet',
    registration: null,
    attendance: null,
  });
  const monthOnly = eventRow({
    id: '31a00000-0000-4000-8000-000000000011',
    starts_at: null,
    ends_at: null,
    archive: true,
    stage: 'past',
    name: 'May meet',
    display_date: 'May 2026',
    registration: null,
    attendance: null,
  });
  const older = eventRow({
    id: '31a00000-0000-4000-8000-000000000012',
    starts_at: '2025-11-20T14:30:00Z',
    ends_at: '2025-11-20T16:00:00Z',
    stage: 'past',
    name: 'Older meet',
    registration: null,
    attendance: null,
  });
  await mockSupabase(page, {
    data: { list_lounge_events: [monthOnly, older, dated] },
  });
  await page.goto('/#/lounge?view=events');
  await page.getByRole('tab', { name: /Past/ }).click();
  await expect(page.locator('.ev-group')).toHaveText(['2026', '2025']);
  await expect(page.locator('.er-hit')).toHaveText(['May meet', 'Winter meet', 'Older meet']);
});

test('required multiselect blocks submission and identifies the field accessibly', async ({
  page,
}) => {
  const groupForm = {
    id: FORM,
    title: 'Pick a path',
    form_kind: 'general',
    fields: [
      {
        key: 'areas',
        label: 'Areas',
        type: 'multiselect',
        required: true,
        allow_other: true,
        options: ['Design', 'Engineering'],
      },
    ],
    region_id: null,
    community_id: null,
    event_id: null,
    is_open: true,
    accepting_responses: true,
    submitted: false,
  };
  const calls = await mockSupabase(page, { data: { list_lounge_forms: [groupForm] } });
  await page.goto(`/#/lounge/forms/${FORM}`);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('alert')).toContainText('Areas is required');
  await page.getByRole('checkbox', { name: 'Other' }).check();
  await page.getByRole('textbox', { name: 'Other answer for Areas' }).fill('   ');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('alert')).toContainText('Areas is required');
  expect(calls.some((call) => call.path.endsWith('/rpc/submit_lounge_form'))).toBe(false);
});

test('initial region is hydrated before scoped groups render, and profile can reopen the picker', async ({
  page,
}) => {
  let regionChosen = false;
  await mockSupabase(page, {
    profile: { preferred_name: 'Riya', region_id: null, region: null },
    data: {
      list_lounge_forms: [
        {
          id: FORM,
          title: 'Long Bengaluru source name',
          form_kind: 'group',
          group_label: 'Delhi Study Circle',
          group_purpose: 'Meet students in your region.',
          region_id: 2,
          community_id: null,
          event_id: null,
          fields: [],
          submitted: false,
          is_open: true,
          accepting_responses: true,
        },
      ],
    },
  });
  const profile = (regionId) => ({
    id: 'a9000000-0000-4000-8000-000000000004',
    member_code: '99F9000004',
    full_name: 'Riya Venkataraman',
    preferred_name: 'Riya',
    email: '99f9000004@ds.study.iitm.ac.in',
    phone: '+919990000004',
    cohort: '26F1',
    tour_seen_at: '2026-10-01T00:00:00Z',
    region_id: regionId,
    region: regionId ? { code: 'region_02', name: 'Delhi NCR' } : null,
  });
  await page.route('**/rest/v1/rpc/select_my_initial_region', (route) => {
    regionChosen = true;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(profile(2)),
    });
  });
  await page.route('**/rest/v1/members?**', (route) => {
    const row = profile(regionChosen ? 2 : null);
    const objectResponse = /pgrst\.object/.test(route.request().headers().accept || '');
    return route.fulfill({
      status: 200,
      headers: {
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
        'content-range': '0-0/1',
      },
      body: JSON.stringify(objectResponse ? row : [row]),
    });
  });

  await page.goto('/#/lounge');
  await page
    .getByRole('dialog', { name: 'Which region are you in?' })
    .getByLabel('Region')
    .selectOption('2');
  await page.getByRole('button', { name: 'Save region' }).click();
  await expect(page.getByRole('button', { name: /Your profile, Riya/ })).toBeVisible();
  await page.goto('/#/lounge?room=groups');
  await expect(page.locator('.moor')).toContainText('Delhi Study Circle');

  await page.goto('/#/lounge');
  await page.getByRole('button', { name: /Your profile, Riya/ }).click();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByRole('button', { name: 'Request a change' }).click();
  await expect(page.getByText(/already your saved region/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request change' })).toBeDisabled();
});

test('a cancelled first region pick can be reopened from Edit profile', async ({ page }) => {
  await mockSupabase(page, {
    profile: { preferred_name: 'Riya', region_id: null, region: null },
  });
  await page.goto('/#/lounge');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: /Your profile, Riya/ }).click();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByRole('button', { name: 'Choose your region' }).click();
  await expect(page.getByRole('heading', { name: 'Which region are you in?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save region' })).toBeEnabled();
});

test('group metadata drives short copy and an applied response survives without an invite', async ({
  page,
}) => {
  const groupForm = {
    id: FORM,
    title: 'Long internal source title that should not appear on the boat',
    description: 'Full application details live in the source description.',
    form_kind: 'group',
    group_label: 'Technical Circle',
    group_purpose: 'Build things together.',
    fields: [],
    region_id: null,
    community_id: 2,
    event_id: null,
    is_open: true,
    accepting_responses: false,
    submitted: true,
  };
  await mockSupabase(page, {
    data: {
      list_lounge_forms: [groupForm],
      get_lounge_form_invite: null,
    },
  });
  await page.goto(`/#/lounge/forms/${FORM}`);
  await expect(page.getByRole('heading', { name: 'Technical Circle' })).toBeVisible();
  await expect(page.getByText(/No invite link is available for this group yet/)).toBeVisible();
  await expect(page.locator('.nav, .tabbar, footer')).toHaveCount(0);
  await expect(page.locator('.lounge-form-nav')).toBeVisible();
  const originalTheme = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: /Switch to (day|night)/ }).click();
  const selectedTheme = await page.locator('html').getAttribute('data-theme');
  expect(selectedTheme).not.toBe(originalTheme);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', selectedTheme);
  // The theme is restored before Vue boots; wait for the form route itself, or its pending
  // initial navigation can overwrite the hash change below.
  await expect(page.getByText(/No invite link is available for this group yet/)).toBeVisible();
  await page.goto('/#/lounge?room=groups');
  await expect(page.locator('#groups')).toBeVisible();
  await expect(page.locator('.moor')).toContainText('Technical Circle');
  await expect(page.locator('.moor')).toContainText('Applied');
  await expect(page.locator('.moor')).toContainText(
    'No invite link is available yet. Your application is saved.'
  );
  await expect(page.locator('.moor')).not.toContainText('Long internal source title');
});

test('notices expose their saved link and surface failed read updates', async ({ page }) => {
  const notices = [
    {
      id: 'notice-1',
      title: 'Room change',
      body: 'The event room changed.',
      link: 'https://example.com/room',
      starts_at: new Date().toISOString(),
      posted_at: new Date().toISOString(),
      read_at: null,
    },
  ];
  await mockSupabase(page, { data: { list_my_notices: notices } });
  await page.route('**/rest/v1/rpc/set_my_notice_state', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Offline"}' })
  );
  await page.goto('/#/lounge');
  await page.getByRole('button', { name: /Notices/ }).click();
  await page.locator('.nt-hit').click();
  await expect(page.getByRole('alert')).toContainText('Offline');
  await expect(page.getByRole('link', { name: 'Open notice link' })).toHaveAttribute(
    'href',
    'https://example.com/room'
  );
});

test('line breaks typed into event descriptions and notices survive on screen', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-10T05:00:00Z') });
  const notice = {
    id: 'notice-lines',
    title: 'Two lines',
    body: 'First line.\nSecond line.',
    starts_at: '2026-10-10T04:00:00Z',
    posted_at: '2026-10-10T04:00:00Z',
    read_at: null,
  };
  await mockSupabase(page, {
    data: {
      list_lounge_events: [eventRow({ description: 'Agenda:\n- Talk\n\n- Quiz' })],
      list_my_notices: [notice],
    },
  });
  await page.goto('/#/lounge?view=events');
  await page.getByRole('tab', { name: /Past/ }).click();
  await page.getByRole('button', { name: 'Boundary check', exact: true }).click();
  // innerText follows the rendered layout, so collapsed newlines would read as spaces.
  const desc = page.locator('.evd-desc');
  await expect(desc).toBeVisible();
  expect(await desc.evaluate((el) => el.innerText)).toBe('Agenda:\n- Talk\n\n- Quiz');

  await page.goto('/#/lounge');
  await page.getByRole('button', { name: /Notices/ }).click();
  await page.locator('.nt-hit').click();
  const body = page.locator('.nt-body p').first();
  await expect(body).toBeVisible();
  expect(await body.evaluate((el) => el.innerText)).toBe('First line.\nSecond line.');
});

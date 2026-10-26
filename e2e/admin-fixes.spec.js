import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { callTo, mockSupabase, pick } from './supabase-mock.js';

test('roster import blocks unrecognized region labels until corrected', async ({ page }) => {
  await mockSupabase(page, { as: 'sa' });
  await page.goto('/#/admin?tab=students');
  await expect(page.getByText('Loading admin data...')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add students' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add students' });
  await dialog.getByRole('button', { name: 'Upload CSV' }).click();
  await dialog.getByLabel('Upload roster CSV').setInputFiles({
    name: 'members.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Email,Region\n26f1000001@ds.study.iitm.ac.in,Atlantis\n'),
  });

  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Fix unknown region or gender labels before importing.' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import 1' })).toBeDisabled();
});

test('attendance defaults to merge and preserves duplicate unresolved source rows', async ({
  page,
}) => {
  const eventId = 'e1000000-0000-4000-8000-000000000001';
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: {
      events: [
        {
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
        },
      ],
      event_attendance: [
        {
          row_key: 'unresolved:attendance:1',
          import_source: 'attendance',
          import_sources: ['attendance'],
          email: 'r****@ds.study.iitm.ac.in',
        },
        {
          row_key: 'omitted@ds.study.iitm.ac.in',
          import_source: 'attendance',
          import_sources: ['attendance'],
          email: 'omitted@ds.study.iitm.ac.in',
        },
      ],
      import_event_attendance: { matched: 0, unregistered: 0, unresolved: 2 },
    },
  });
  await page.goto('/#/admin?tab=events');
  await page.getByRole('button', { name: 'Attendance' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox', { name: 'Import behavior' })).toHaveText(
    'Merge; keep omitted rows'
  );
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'attendance.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Email,Duration\nr****@ds.study.iitm.ac.in,10 min\nr****@ds.study.iitm.ac.in,10 min\n'
    ),
  });
  await expect(dialog.getByText(/2 unresolved/)).toBeVisible();
  await pick(dialog, 'Import behavior', 'Replace one named source');
  await expect(
    dialog.getByText(/Preview: 1 omitted row will lose this source's ownership/)
  ).toBeVisible();
  await pick(dialog, 'Import behavior', 'Merge; keep omitted rows');
  await dialog.getByRole('button', { name: 'Save attendance' }).click();
  const call = await callTo(calls, '/rest/v1/rpc/import_event_attendance');
  const payload = JSON.parse(call.body);
  expect(payload.p_mode).toBe('merge');
  expect(payload.p_source_id).toBe('attendance');
  expect(payload.p_rows.map((row) => row.source_row_id)).toEqual(['1', '2']);
});

test('editing an event preserves an exact zero attendee count', async ({ page }) => {
  const eventId = 'e1000000-0000-4000-8000-000000000002';
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: {
      events: [
        {
          id: eventId,
          name: 'Empty event',
          starts_at: '2026-12-01T10:00:00Z',
          ends_at: '2026-12-01T12:00:00Z',
          published_at: '2026-10-01T00:00:00Z',
          attendance_mode: 'meet',
          archive: false,
          attendee_count: 0,
          cancelled_at: null,
          community_id: null,
          region_id: null,
        },
      ],
    },
  });
  await page.goto('/#/admin?tab=events');
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  const call = await callTo(calls, '/rest/v1/events', 'PATCH');
  expect(JSON.parse(call.body).attendee_count).toBe(0);
});

test('form response export keeps same-label fields and safely encodes headers', async ({
  page,
}) => {
  const formId = 'f1000000-0000-4000-8000-000000000001';
  await mockSupabase(page, {
    as: 'sa',
    data: {
      list_lounge_forms: [
        {
          id: formId,
          title: 'Feedback',
          fields: [],
          published_at: '2026-10-01T00:00:00Z',
          is_open: true,
        },
      ],
      export_form_responses: [
        {
          id: 'r1000000-0000-4000-8000-000000000001',
          email: '26f1000001@ds.study.iitm.ac.in',
          submitted_at: '2026-10-09T00:00:00Z',
          answers: { first: 'A', second: 'B' },
          field_schema: [
            { key: 'first', label: '=label, Same' },
            { key: 'second', label: '=label, Same' },
          ],
        },
        {
          id: 'r1000000-0000-4000-8000-000000000002',
          email: '26f1000002@ds.study.iitm.ac.in',
          submitted_at: '2026-10-09T00:01:00Z',
          answers: { first: 'C', second: 'D' },
          field_schema: [
            { key: 'first', label: 'Renamed formula' },
            { key: 'second', label: '=label, Same' },
          ],
        },
      ],
      get_available_cohorts: { current: '26F3', next: '27F1', options: ['26F3', '27F1'] },
    },
  });
  await page.goto('/#/admin?tab=forms');
  await page.getByRole('button', { name: 'Responses' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('columnheader', { name: '=label, Same [first]' })).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: '=label, Same [second]' })).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: 'Renamed formula' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download CSV' }).click();
  const download = await downloadPromise;
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain('"\'=label, Same [first]"');
  expect(csv).toContain('"\'=label, Same [second]"');
  expect(csv).toContain(',A,B,');
  expect(csv).toContain(',D,C');
});

test('organizers can explicitly remove an invite while preserving the form source', async ({
  page,
}) => {
  const id = 'f1000000-0000-4000-8000-000000000009';
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: {
      list_lounge_forms: [
        {
          id,
          title: 'Group application',
          form_kind: 'group',
          group_label: 'Technical',
          source_url: 'https://example.com/source',
          fields: [],
          can_manage: true,
          is_open: true,
        },
      ],
      save_lounge_form: id,
      get_available_cohorts: { current: '26F3', next: '27F1', options: ['26F3', '27F1'] },
    },
  });
  await page.goto('/#/admin?tab=forms');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Remove the saved WhatsApp invite').check();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  const call = await callTo(calls, '/rest/v1/rpc/save_lounge_form');
  const payload = JSON.parse(call.body).p_form;
  expect(payload.invite_url).toBeNull();
  expect(payload.source_url).toBe('https://example.com/source');
});

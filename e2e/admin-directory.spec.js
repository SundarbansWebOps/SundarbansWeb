import { test, expect } from '@playwright/test';
import { adminSections, mockSupabase, callTo } from './supabase-mock.js';

test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }));

const ROWS = [
  {
    email: '25f1000020@ds.study.iitm.ac.in',
    full_name: 'Asha Menon',
    phone: '+919810000020',
    term: '25F1',
    gender: 'Female',
    region_id: 9,
    region_name: 'Chennai',
    signed_in: false,
    live: {
      source: 'roster',
      full_name: null,
      preferred_name: null,
      phone: null,
      term: null,
      gender: null,
      region_id: 9,
      region_name: 'Chennai',
    },
  },
  {
    email: '24f2000021@ds.study.iitm.ac.in',
    full_name: 'Ashok Rao',
    phone: '+919810000021',
    term: '24F2',
    gender: 'Male',
    region_id: 6,
    region_name: 'Hyderabad',
    signed_in: true,
    live: {
      source: 'member',
      full_name: 'Ashok Kumar Rao',
      preferred_name: 'Ashok',
      phone: '+91 98100 00021',
      term: '24F2',
      gender: 'Male',
      region_id: 7,
      region_name: 'Bengaluru',
    },
  },
];
const directory = (args) =>
  args.p_query.toLowerCase().startsWith('ash')
    ? { total: ROWS.length, rows: ROWS }
    : { total: 0, rows: [] };

for (const as of ['rc', 'head']) {
  test(`a ${as} has no Directory tab`, async ({ page }) => {
    await mockSupabase(page, { as });
    await page.goto('/#/admin');
    await expect(
      adminSections(page).getByRole('button', { name: 'Overview', exact: true })
    ).toBeVisible();
    await expect(adminSections(page).getByRole('button', { name: /^Directory/ })).toHaveCount(0);
  });
}

test('a Super Admin opens Directory to an empty search', async ({ page }) => {
  await mockSupabase(page, { as: 'sa', data: { search_student_directory: directory } });
  await page.goto('/#/admin');
  await adminSections(page).getByRole('button', { name: 'Directory' }).click();
  await expect(page.getByRole('heading', { name: 'Directory' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('a search shows the live record beside the upload and marks what disagrees', async ({
  page,
}) => {
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: { search_student_directory: directory },
  });
  await page.goto('/#/admin?tab=directory');
  await page.getByLabel('Name, email or phone').fill('  Ash ');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const asha = page.getByRole('article', { name: 'Asha Menon' });
  await expect(asha.getByText('Not signed in')).toBeVisible();
  await expect(asha.getByRole('columnheader', { name: 'Live, roster' })).toBeVisible();
  // The cleaned roster row is empty where the upload has the name and phone; that is no clash.
  const ashaPhone = asha.getByRole('row', { name: /^Phone/ });
  await expect(ashaPhone.getByRole('cell').nth(0)).toHaveText('–');
  await expect(ashaPhone.getByRole('cell').nth(1)).toHaveText('+919810000020');
  await expect(asha.locator('tr.differs')).toHaveCount(0);

  const ashok = page.getByRole('article', { name: 'Ashok Rao' });
  await expect(ashok.getByText('Signed in', { exact: true })).toBeVisible();
  await expect(ashok.getByRole('columnheader', { name: 'Live, member' })).toBeVisible();
  await expect(ashok.getByText('Lounge: Ashok')).toBeVisible();
  // Name and region disagree; the phone matches once spacing is ignored.
  await expect(ashok.locator('tr.differs th')).toHaveText(['Name', 'Region']);
  await expect(ashok.getByRole('row', { name: /^Region/ })).toContainText('Bengaluru');
  await expect(ashok.getByRole('row', { name: /^Region/ })).toContainText('Hyderabad');
  await expect(page.getByText('2 students', { exact: false })).toBeVisible();
  const call = await callTo(calls, '/rest/v1/rpc/search_student_directory');
  expect(JSON.parse(call.body)).toEqual({ p_query: 'Ash' });
});

test('a short query is stopped before any request; no match and errors are shown', async ({
  page,
}) => {
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: { search_student_directory: directory },
  });
  await page.goto('/#/admin?tab=directory');
  await page.getByLabel('Name, email or phone').fill('as');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('at least 3 characters');
  expect(calls.some((c) => c.path === '/rest/v1/rpc/search_student_directory')).toBe(false);
  await page.getByLabel('Name, email or phone').fill('zzz');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('No student in the directory matches this.')).toBeVisible();

  await page.route('**/rest/v1/rpc/search_student_directory', (route) =>
    route.fulfill({
      status: 400,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify({
        code: '54000',
        message: 'Too many searches in the last hour. Try again later.',
      }),
    })
  );
  await page.getByLabel('Name, email or phone').fill('asha');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Too many searches in the last hour.');
  await expect(page.getByRole('table')).toHaveCount(0);
});

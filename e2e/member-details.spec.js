import { test, expect } from '@playwright/test';
import { callTo, mockSupabase, pick } from './supabase-mock.js';

test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }));

const strip = (page) => page.getByRole('region', { name: 'Your details' });
const rpcs = (calls, name) => calls.filter((c) => c.path === `/rest/v1/rpc/${name}`);

test('a member without a full name or gender is asked once, from the strip', async ({ page }) => {
  const calls = await mockSupabase(page, {
    profile: { full_name: null, gender: null, preferred_name: 'Riya' },
  });
  await page.goto('/#/lounge');
  await expect(strip(page)).toContainText('Add your full name and gender.');
  await expect(page.locator('html.has-banner')).toHaveCount(1);

  await strip(page).getByRole('button').click();
  const dialog = page.getByRole('dialog', { name: 'What should we call you?' });
  // One name box: the Lounge name is the full name.
  const name = dialog.getByLabel('Your full name');
  await expect(name).toBeFocused();
  await expect(name).toHaveValue('Riya');
  // An empty full name is stopped before anything is sent.
  await name.fill('');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Add your full name as on your IITM records.');
  expect(rpcs(calls, 'complete_my_profile')).toHaveLength(0);
  expect(rpcs(calls, 'update_my_profile')).toHaveLength(0);

  await name.fill('  Riya   Venkataraman ');
  await dialog.getByLabel('Gender').selectOption('Female');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  const call = await callTo(calls, '/rest/v1/rpc/complete_my_profile');
  expect(JSON.parse(call.body)).toEqual({ p_full_name: 'Riya Venkataraman', p_gender: 'Female' });
  const profile = await callTo(calls, '/rest/v1/rpc/update_my_profile');
  expect(JSON.parse(profile.body)).toMatchObject({ p_preferred_name: 'Riya Venkataraman' });
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(strip(page)).toHaveCount(0);
  await expect(page.locator('html.has-banner')).toHaveCount(0);

  // Once set, gender reads as a fact; the name stays the one box.
  await page.getByRole('button', { name: /^Your profile/ }).click();
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  const again = page.getByRole('dialog', { name: 'What should we call you?' });
  await expect(again.getByLabel('Your full name')).toBeFocused();
  await expect(again.getByLabel('Your full name')).toHaveValue('Riya Venkataraman');
  await expect(again.getByLabel('Gender')).toHaveCount(0);
  await expect(again.getByText('Female', { exact: true })).toBeVisible();
});

test('a member with only gender missing may save without it; the strip stays', async ({ page }) => {
  const calls = await mockSupabase(page, { profile: { gender: null, preferred_name: 'Riya' } });
  await page.goto('/#/lounge');
  await expect(strip(page)).toContainText('Add your gender.');
  await strip(page).getByRole('button').click();
  const dialog = page.getByRole('dialog', { name: 'What should we call you?' });
  await expect(dialog.getByLabel('Your full name')).toHaveValue('Riya');
  await dialog.getByLabel('Phone').fill('+919990000099');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await callTo(calls, '/rest/v1/rpc/update_my_profile');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(rpcs(calls, 'complete_my_profile')).toHaveLength(0);
  await expect(strip(page)).toContainText('Add your gender.');
});

test('a member with both set sees no strip', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/#/lounge');
  await expect(page.locator('.home')).toBeVisible();
  await expect(strip(page)).toHaveCount(0);
});

test('adding students takes gender from a dropdown and reads spreadsheet words', async ({
  page,
}) => {
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: {
      roster_add_many: (args) =>
        (args.p_rows || []).map((r) => ({ email: r.email, ok: true, category: 'added' })),
    },
  });
  await page.goto('/#/admin?tab=students');
  await expect(page.getByText('Loading admin data...')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add students' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add students' });
  await dialog.getByLabel('IITM email').fill('26f1000030@ds.study.iitm.ac.in');
  await pick(dialog, 'Gender', 'Male');
  await dialog.getByRole('button', { name: 'Add to roster' }).click();
  const one = await callTo(calls, '/rest/v1/rpc/roster_add_many');
  expect(JSON.parse(one.body).p_rows[0]).toMatchObject({
    email: '26f1000030@ds.study.iitm.ac.in',
    gender: 'Male',
  });

  await dialog.getByRole('button', { name: 'Paste from Sheets' }).click();
  const paste = dialog.getByLabel('One student per line');
  await paste.fill(
    '26f1000031@ds.study.iitm.ac.in\tAsha\t\t\tgirl\n26f1000032@ds.study.iitm.ac.in\tRavi\t\t\tX'
  );
  await expect(dialog.getByRole('alert')).toContainText(
    'Fix unknown region or gender labels before adding students.'
  );
  await expect(dialog.getByRole('button', { name: 'Add 2 to roster' })).toBeDisabled();
  await paste.fill(
    '26f1000031@ds.study.iitm.ac.in\tAsha\t\t\tgirl\n26f1000032@ds.study.iitm.ac.in\tRavi\t\t\tM'
  );
  await dialog.getByRole('button', { name: 'Add 2 to roster' }).click();
  await expect.poll(() => rpcs(calls, 'roster_add_many').length).toBe(2);
  const many = JSON.parse(rpcs(calls, 'roster_add_many')[1].body).p_rows;
  expect(many.map((r) => r.gender)).toEqual(['Female', 'Male']);
});

test('an admin edits gender from a dropdown', async ({ page }) => {
  const id = 'a9000000-0000-4000-8000-000000000020';
  const kavya = {
    id,
    member_code: '21f1000020',
    full_name: 'Kavya Menon',
    preferred_name: 'Kavya',
    email: '21f1000020@ds.study.iitm.ac.in',
    phone: '+919800000020',
    gender: null,
    region_id: 1,
    account_status: 'active',
    deleted_at: null,
    created_at: '2026-10-20T00:00:00Z',
    last_login_at: null,
  };
  const calls = await mockSupabase(page, {
    as: 'sa',
    data: {
      list_students: {
        total: 1,
        rows: [{ ...kavya, kind: 'member', joined_at: kavya.created_at, communities: [] }],
      },
      members: [kavya],
      request_member_update: 'b0000000-0000-4000-8000-000000000031',
    },
  });
  await page.goto('/#/admin?tab=students');
  await page.getByRole('button', { name: 'Open Kavya' }).click();
  await page.getByRole('button', { name: 'Edit details' }).click();
  await pick(page, 'Gender', 'Female');
  await page.getByLabel('Why').fill('Told us at the town hall');
  await page.getByRole('button', { name: 'Send for approval' }).click();
  const call = await callTo(calls, '/rest/v1/rpc/request_member_update');
  expect(JSON.parse(call.body).p_changes).toEqual({ gender: 'Female' });
});

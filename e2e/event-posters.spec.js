// Event audience, posters and RC house-wide approval (spec 004). Supabase and Cloudinary are mocked.
import { Buffer } from 'node:buffer';
import { test, expect } from '@playwright/test';
import { callTo, mockSupabase, pick } from './supabase-mock.js';

test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }));

const EVENT_ID = 'e4000000-0000-4000-8000-000000000001';
const soon = (days) => new Date(Date.now() + days * 864e5).toISOString();

test('an RC asks a Super Admin to publish a house-wide event', async ({ page }) => {
  const calls = await mockSupabase(page, {
    as: 'rc',
    data: { events: [{ id: EVENT_ID }], request_event_publish: 'r1' },
  });
  await page.goto('/#/admin?tab=events');
  await page.getByRole('button', { name: 'New event' }).click();
  await page.getByLabel('Name', { exact: true }).fill('House fest');
  await pick(page, 'Scope', 'Whole house');
  await expect(page.getByText('A Super Admin approves house-wide events.')).toBeVisible();
  await pick(page, 'Registration', 'No form');
  await page.getByLabel("Members' meeting link").fill('https://meet.google.com/abc-defg-hij');
  await page.getByLabel('Public: also list it on the public Events page').check();
  await page.getByRole('button', { name: 'Ask a Super Admin to publish' }).click();
  await expect(page.getByRole('status')).toContainText('Sent to a Super Admin');

  const saved = JSON.parse((await callTo(calls, '/rest/v1/events', 'POST')).body);
  expect(saved).toMatchObject({
    name: 'House fest',
    region_id: null,
    community_id: null,
    is_public: true,
  });
  expect(saved.published_at ?? null).toBeNull();
  const asked = JSON.parse(
    (await callTo(calls, '/rest/v1/rpc/request_event_publish', 'POST')).body
  );
  expect(asked.p_event_id).toBe(EVENT_ID);
});

test('a poster uploads to Cloudinary through a signed request', async ({ page }) => {
  const event = {
    id: EVENT_ID,
    name: 'Patna quiz',
    region_id: 1,
    community_id: null,
    starts_at: soon(2),
    ends_at: soon(3),
    published_at: soon(-1),
    audience_cohorts: [],
    attendance_mode: 'meet',
    archive: false,
    is_public: false,
    created_by: 'x',
  };
  const calls = await mockSupabase(page, {
    as: 'rc',
    data: {
      events: [event],
      '/functions/v1/sign-event-image': {
        upload_url: 'https://api.cloudinary.com/v1_1/l59gy0g2/image/upload',
        cloud_name: 'l59gy0g2',
        api_key: 'k',
        timestamp: '1',
        signature: 's',
        folder: `sundarbans/events/${EVENT_ID}`,
        allowed_formats: 'jpg,png,webp',
        transformation: 'c_limit,w_1600',
      },
    },
  });
  let uploaded = null;
  await page.route('https://api.cloudinary.com/**', async (route) => {
    uploaded = route.request().postData() ?? '';
    await route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify({
        version: 17,
        public_id: `sundarbans/events/${EVENT_ID}/abc`,
        format: 'jpg',
        width: 1080,
        height: 1350,
      }),
    });
  });
  await page.goto('/#/admin?tab=events');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Upload poster').setInputFiles({
    name: 'poster.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await expect(page.getByAltText('Event poster')).toBeVisible();

  const signed = JSON.parse((await callTo(calls, '/functions/v1/sign-event-image', 'POST')).body);
  expect(signed).toEqual({ event_id: EVENT_ID });
  expect(uploaded).toContain('name="signature"');
  expect(uploaded).toContain(`sundarbans/events/${EVENT_ID}`);
  const saved = JSON.parse((await callTo(calls, '/rest/v1/events', 'PATCH')).body);
  expect(saved).toMatchObject({
    image_url: `https://res.cloudinary.com/l59gy0g2/image/upload/f_auto,q_auto:good,w_1000,c_limit/v17/sundarbans/events/${EVENT_ID}/abc.jpg`,
    image_width: 1080,
    image_height: 1350,
  });
});

test('a poster on a new event saves the draft first, then uploads', async ({ page }) => {
  const calls = await mockSupabase(page, {
    as: 'rc',
    data: {
      events: [{ id: EVENT_ID }],
      '/functions/v1/sign-event-image': {
        upload_url: 'https://api.cloudinary.com/v1_1/l59gy0g2/image/upload',
        cloud_name: 'l59gy0g2',
        api_key: 'k',
        timestamp: '1',
        signature: 's',
        folder: `sundarbans/events/${EVENT_ID}`,
        allowed_formats: 'jpg,png,webp',
        transformation: 'c_limit,w_1600',
      },
    },
  });
  await page.route('https://api.cloudinary.com/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify({ version: 3, public_id: 'p', format: 'png', width: 800, height: 800 }),
    })
  );
  await page.goto('/#/admin?tab=events');
  await page.getByRole('button', { name: 'New event' }).click();
  await expect(page.getByText('Adding one saves this event as a draft.')).toBeVisible();
  await expect(page.getByText('Certificates (optional)')).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill('Fresh event');
  await page.getByLabel('Upload poster').setInputFiles({
    name: 'p.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  });
  await expect(page.getByAltText('Event poster')).toBeVisible();
  const created = JSON.parse((await callTo(calls, '/rest/v1/events', 'POST')).body);
  expect(created.name).toBe('Fresh event');
  const signed = JSON.parse((await callTo(calls, '/functions/v1/sign-event-image', 'POST')).body);
  expect(signed).toEqual({ event_id: EVENT_ID });
});

test('the public Events page shows Public live and upcoming events above the archive', async ({
  page,
}) => {
  await mockSupabase(page, {
    signedIn: false,
    data: {
      list_public_events: [
        {
          id: EVENT_ID,
          name: 'House fest',
          description: 'Food and music',
          registration_link: 'https://forms.gle/example',
          starts_at: soon(5),
          ends_at: soon(6),
          event_type: 'Cultural',
          wing: 'cultural',
          is_public: true,
          stage: 'upcoming',
        },
        {
          id: 'e4000000-0000-4000-8000-000000000003',
          name: 'Night quiz',
          description: 'Live house quiz',
          starts_at: soon(-0.01),
          ends_at: soon(0.04),
          event_type: 'Quiz',
          wing: 'talks',
          is_public: true,
          stage: 'live',
        },
        {
          id: 'e4000000-0000-4000-8000-000000000002',
          name: 'Old open mic',
          starts_at: soon(-40),
          ends_at: soon(-39),
          event_type: 'Open Mic',
          wing: 'cultural',
          stage: 'past',
        },
      ],
    },
  });
  await page.goto('/#/events');
  await expect(page.getByText('live now', { exact: true })).toBeVisible();
  await expect(page.getByText('upcoming', { exact: true })).toBeVisible();

  const liveSection = page.getByRole('region', { name: /Live now/ });
  await expect(liveSection).toBeVisible();
  await expect(liveSection.getByText('Night quiz').first()).toBeVisible();
  await expect(liveSection.getByText('House fest')).toHaveCount(0);

  const soonSection = page.getByRole('region', { name: /Coming up/ });
  await expect(soonSection).toBeVisible();
  await expect(soonSection.getByText('House fest').first()).toBeVisible();
  await expect(soonSection.getByText('Old open mic')).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Event log' }).getByText('Old open mic').first()
  ).toBeVisible();

  await soonSection.getByText('House fest').first().click();
  await expect(page.getByRole('button', { name: /Log in to Launch to join/ })).toBeVisible();
  const register = page.getByRole('link', { name: /Open the sign-up form/ });
  await expect(register).toHaveAttribute('href', 'https://forms.gle/example');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await liveSection.getByText('Night quiz').first().click();
  await expect(page.getByRole('button', { name: /Log in to Launch to join/ })).toBeVisible();
  await expect(page.getByText('Happening now')).toBeVisible();
});

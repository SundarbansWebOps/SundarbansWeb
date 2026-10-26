// Past events, adapted from the data already on the live site.
// Public Events lists Public upcoming/live events at the top, then the archive.
// Joining happens in Launch (the Lounge); this page never shows a Meet link.
import { reactive, watch } from 'vue';
import { router } from '../router/index.js';
import { EVENTS } from '../data/events.data.js';

export const WINGS = {
  cultural: { label: 'Cultural' },
  games: { label: 'Games & Sports' },
  tech: { label: 'Tech' },
  talks: { label: 'Talks' },
};

const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const MONTH = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const monthLong = (m) => MONTH_LONG[m];

// Handles every shape the sheets use: "15 Feb 2026 | 8:00 PM", "5-7 Dec 2025 | Online",
// "October 2025", "10th Aug. 2025", "28 Sep'25", "17-05-2026", "14 Sept 2025".
export function parseDate(raw = '') {
  const s = raw.toLowerCase();
  const time = raw.match(/\d{1,2}:\d{2}\s?[ap]m/i)?.[0] ?? '';
  const num = s.match(/\b(\d{1,2})-(\d{1,2})-(20\d{2})\b/);
  if (num) return { y: +num[3], m: +num[2] - 1, d: +num[1], time, range: '' };
  const m = s.match(
    /(?:(\d{1,2})(?:\s?-\s?(\d{1,2}))?(?:st|nd|rd|th)?\.?\s+)?([a-z]{3,9})\.?\s*'?\s*(20\d{2}|\d{2})\b/
  );
  if (!m) return { y: null, m: null, d: null, time, range: '' };
  const mi = MON.indexOf(m[3].slice(0, 3));
  if (mi === -1) return { y: null, m: null, d: null, time, range: '' };
  let y = +m[4];
  if (y < 100) y += 2000;
  return { y, m: mi, d: m[1] ? +m[1] : null, time, range: m[2] ? `${m[1]}–${m[2]}` : '' };
}

export const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const WING_OF_TYPE = {
  'Guest Talk': 'talks',
  Empowerment: 'talks',
  Sports: 'games',
  'E-Sports': 'games',
  Technical: 'tech',
  Hackathon: 'tech',
  Workshop: 'tech',
  Cultural: 'cultural',
};
export const wingOf = (e) => {
  const raw = e.wing || e.event_type || e.type;
  if (raw === 'esports' || raw === 'games') return 'games';
  if (raw === 'technical' || raw === 'tech') return 'tech';
  if (raw === 'cultural') return 'cultural';
  if (raw === 'talks') return 'talks';
  return WING_OF_TYPE[e.event_type || e.type] ?? (WINGS[e.wing] ? e.wing : 'cultural');
};

// Cloudinary: swap the stored delivery transform for one sized to where it is shown.
const CLD = 'f_auto,q_auto:good,w_1000,c_limit';
export const img = {
  thumb: (u) => u?.replace(CLD, 'f_auto,q_auto,w_72,h_72,c_fill,g_auto'),
  blur: (u) => u?.replace(CLD, 'f_auto,q_30,w_24,e_blur:300'),
  card: (u) => u?.replace(CLD, 'f_auto,q_auto:eco,w_420,c_limit'),
  full: (u) => u?.replace(CLD, 'f_auto,q_auto,w_900,c_limit'),
};

function fromIso(iso) {
  if (!iso) return { y: null, m: null, d: null, time: '', range: '' };
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return { y: null, m: null, d: null, time: '', range: '' };
  const options = { timeZone: 'Asia/Kolkata' };
  const dateParts = new Intl.DateTimeFormat('en', {
    ...options,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(dt);
  const part = (type) => Number(dateParts.find((p) => p.type === type)?.value);
  const time = new Intl.DateTimeFormat('en-IN', {
    ...options,
    hour: 'numeric',
    minute: '2-digit',
  }).format(dt);
  return { y: part('year'), m: part('month') - 1, d: part('day'), time, range: '' };
}

// Public archive cards: RPC rows first, then the local 43-event snapshot if the RPC is empty
// or missing. Same poster fields either way (image, type, wing, date, turnout).
export function fromPublicRow(row) {
  const title = row.name || row.title || '';
  const dateText = row.display_date || row.date || '';
  const when = row.starts_at ? fromIso(row.starts_at) : parseDate(dateText);
  const w = row.image_width ?? row.w;
  const h = row.image_height ?? row.h;
  // Source turnout labels such as "50+" are kept as text, never coerced to an exact count.
  const attendees =
    row.attendee_display ??
    (row.attendee_count == null || row.attendee_count === ''
      ? (row.attendees ?? '')
      : String(row.attendee_count));
  return {
    id: row.source_key || row.id || slug(title),
    dbId: row.id || null,
    title,
    type: row.event_type || row.type || '',
    wing: wingOf(row),
    desc: row.description ?? row.desc ?? '',
    attendees,
    location: row.location ?? '',
    image: row.image_url ?? row.image ?? null,
    ratio: w && h ? w / h : null,
    display_date: dateText || null,
    region_id: row.region_id ?? null,
    community_id: row.community_id ?? null,
    archive: row.archive ?? null,
    // 'past' | 'live' | 'upcoming' (list_public_events); snapshot rows are all past.
    stage: row.stage ?? 'past',
    link: row.registration_link ?? null,
    ...when,
    online: /online/i.test(`${dateText} ${row.location ?? ''}`),
    at:
      row.starts_at && !Number.isNaN(Date.parse(row.starts_at))
        ? new Date(row.starts_at)
        : when.y != null
          ? new Date(when.y, when.m, when.d ?? 15)
          : null,
  };
}

// "Offline Meetup" rows duplicate the regional meetup sheets, which live on the House page.
const notMeetup = (e) => e.type !== 'Offline Meetup';
const snapshot = EVENTS.filter(notMeetup).map(fromPublicRow);
snapshot.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));

export const events = reactive([]);
// Public live and upcoming rows (soonest first). Members-only events stay in Launch.
export const live = reactive([]);
export const upcoming = reactive([]);
export const byId = reactive({});
export const publicCatalog = reactive({
  ready: false,
  error: '',
  regions: [],
});

function replaceEvents(list, happening = []) {
  const onAir = happening.filter((e) => e.stage === 'live');
  const soon = happening.filter((e) => e.stage !== 'live');
  events.splice(0, events.length, ...list);
  live.splice(0, live.length, ...onAir);
  upcoming.splice(0, upcoming.length, ...soon);
  for (const key of Object.keys(byId)) delete byId[key];
  for (const e of [...list, ...onAir, ...soon]) byId[e.id] = e;
}

replaceEvents(snapshot);

function isoFrom(ms) {
  return new Date(ms).toISOString();
}

// Local Vite only. Three throwaway Public events so the live/upcoming bands can be clicked.
function localDemoHappening() {
  if (!import.meta.env.DEV) return [];
  const host = location.hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') return [];
  const now = Date.now();
  const day = 864e5;
  return [
    fromPublicRow({
      id: 'demo-live',
      name: 'Night quiz',
      description: 'Demo live event. Log in to Launch to join.',
      event_type: 'Quiz',
      wing: 'talks',
      location: 'Online',
      starts_at: isoFrom(now - 25 * 60e3),
      ends_at: isoFrom(now + 90 * 60e3),
      stage: 'live',
    }),
    fromPublicRow({
      id: 'demo-soon-fest',
      name: 'House fest',
      description: 'Demo upcoming event with a public sign-up form.',
      event_type: 'Cultural',
      wing: 'cultural',
      location: 'Online',
      registration_link: 'https://forms.gle/example',
      starts_at: isoFrom(now + day),
      ends_at: isoFrom(now + day + 2 * 3600e3),
      stage: 'upcoming',
    }),
    fromPublicRow({
      id: 'demo-soon-bgmi',
      name: 'BGMI warmup',
      description: 'Demo upcoming event. Join from Launch when it starts.',
      event_type: 'E-Sports',
      wing: 'games',
      location: 'Online',
      starts_at: isoFrom(now + 5 * day),
      ends_at: isoFrom(now + 5 * day + 3 * 3600e3),
      stage: 'upcoming',
    }),
  ];
}

function mergeLocalDemo() {
  const extra = localDemoHappening();
  if (!extra.length) return;
  const onAir = [...live, ...extra.filter((e) => e.stage === 'live')];
  const soon = [...upcoming, ...extra.filter((e) => e.stage !== 'live')];
  soon.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  live.splice(0, live.length, ...onAir);
  upcoming.splice(0, upcoming.length, ...soon);
  for (const e of extra) byId[e.id] = e;
}

export async function loadPublicEvents() {
  publicCatalog.error = '';
  try {
    const [{ listPublicEvents }, { supabase }] = await Promise.all([
      import('./lounge.js'),
      import('./supabase.js'),
    ]);
    const [rows, regions] = await Promise.all([
      listPublicEvents(),
      supabase.from('regions').select('id, code, name').order('name'),
    ]);
    const all = (Array.isArray(rows) ? rows : []).map(fromPublicRow).filter(notMeetup);
    const list = all.filter((e) => e.stage === 'past');
    const next = all.filter((e) => e.stage !== 'past');
    list.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
    next.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    if (all.length) replaceEvents(list, next);
    if (!regions.error) publicCatalog.regions = regions.data ?? [];
  } catch (err) {
    publicCatalog.error = err?.message || 'The event archive did not load.';
  } finally {
    mergeLocalDemo();
    publicCatalog.ready = true;
  }
}

export const monthKey = (e) => (e.at ? e.y * 12 + e.m : null);

// Month columns for the swell chart. Runs of empty months collapse into one "quiet" gap,
// so three sparse years don't squeeze the busy season into a sliver.
export function chartColumns(list) {
  const keys = list.map(monthKey).filter((k) => k != null);
  const lo = Math.min(...keys);
  const hi = Math.max(...keys);
  const cols = [];
  let quiet = 0;
  for (let k = lo; k <= hi; k++) {
    const n = list.filter((e) => monthKey(e) === k).length;
    if (!n) {
      quiet++;
      continue;
    }
    if (quiet) cols.push({ gap: true, months: quiet, key: `g${k}` });
    quiet = 0;
    cols.push({ key: k, y: Math.floor(k / 12), m: k % 12 });
  }
  return cols;
}

export function groupByMonth(list) {
  const groups = new Map();
  for (const e of list) {
    const k = monthKey(e) ?? 'undated';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  return [...groups].map(([k, items]) => ({
    key: k,
    y: k === 'undated' ? null : Math.floor(k / 12),
    m: k === 'undated' ? null : k % 12,
    items,
  }));
}

export const dayLabel = (e) =>
  e.at ? `${e.range || e.d || ''} ${MONTH[e.m]}${e.d ? '' : ` ${e.y}`}`.trim() : '';
export const fullDate = (e) =>
  e.at
    ? [e.range || e.d, e.d ? MONTH[e.m] : monthLong(e.m), e.y].filter(Boolean).join(' ')
    : 'Date not recorded';

export function matches(e, q) {
  if (!q) return true;
  const t = q.toLowerCase().trim();
  return (
    e.title.toLowerCase().includes(t) ||
    e.type?.toLowerCase().includes(t) ||
    e.desc.toLowerCase().includes(t)
  );
}

// ---- Event sheet state; ?event= deep link, phone back closes it. -------------------------
// `wing`: a filter to open the Events page with (set by a Teams community card).
export const ev = reactive({ open: null, origin: null, hover: null, wing: null });

export function openEvent(id, e) {
  ev.origin = e?.clientX
    ? { x: e.clientX, y: e.clientY }
    : (() => {
        const r = e?.currentTarget?.getBoundingClientRect?.();
        return r
          ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
          : { x: innerWidth / 2, y: innerHeight / 2 };
      })();
  const route = router.currentRoute.value;
  const to = { query: { ...route.query, event: id }, hash: route.hash, state: { event: true } };
  if (ev.open) router.replace(to);
  else router.push(to);
  ev.open = id;
}

// `then` runs once the panel is gone — after the history entry pops, so a follow-up
// page change doesn't race the back navigation. Template handlers must not pass
// their DOM event through (@click="closeEvent()"): only a real callback is kept.
let afterClose = null;
export function closeEvent(then) {
  afterClose = typeof then === 'function' ? then : null;
  if (history.state?.event) history.back();
  else {
    ev.open = null;
    const route = router.currentRoute.value;
    const query = { ...route.query };
    delete query.event;
    router.replace({ query, hash: route.hash }).then(runAfterClose);
  }
}
function runAfterClose() {
  const f = afterClose;
  afterClose = null;
  if (typeof f === 'function') f();
}

// The URL is the source of truth: Back drops ?event= and the sheet closes; a shared
// ?event= link (or Forward) opens it.
watch(
  () => [router.currentRoute.value.query.event, events.length, live.length, upcoming.length],
  ([id]) => {
    if (id && byId[id]) {
      if (ev.open !== id) {
        ev.open = id;
        ev.origin = { x: innerWidth / 2, y: 80 };
      }
      return;
    }
    ev.open = null;
    runAfterClose();
  },
  { immediate: true }
);

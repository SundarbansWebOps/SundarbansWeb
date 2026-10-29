// Events, this member's registrations/attendance/certificates, and notices for the Lounge.
// Lists come from session.hydrateLounge(); this file keeps the painted helpers.
import { computed, ref } from 'vue';
import CREST from '../../assets/crest.webp';
import { MONTH, parseDate } from '../../lib/events.js';
import { reviewOf } from '../../lib/lounge.js';
import { lounge, dismissNotice, readAllNotices, readNotice } from './session.js';
import { liveOn } from './state.js';

/* ---------- The minute clock ----------
   Countdowns read in minutes ("ends in 1 h 04 min"), so the page re-renders once a minute,
   on the minute, not every second. A hidden tab doesn't tick; it catches up when shown. */

export const clock = ref(Date.now());
let tick = 0;
function schedule() {
  clearTimeout(tick);
  if (document.hidden) return;
  clock.value = Date.now();
  tick = setTimeout(schedule, 60_000 - (Date.now() % 60_000) + 50);
}
export function startClock() {
  document.addEventListener('visibilitychange', schedule);
  schedule();
}
export function stopClock() {
  document.removeEventListener('visibilitychange', schedule);
  clearTimeout(tick);
}

/* ---------- Communities ---------- */

/* `art` is the community's painted figure (the event pop-up's header). House-wide events are
   the house's own, so they carry the crest. */
export const COMMUNITIES = {
  cultural: {
    label: 'Cultural',
    cls: 'w-cultural',
    art: new URL('./art/r3/fig-cultural.webp', import.meta.url).href,
  },
  technical: {
    label: 'Technical',
    cls: 'w-tech',
    art: new URL('./art/r3/fig-technical.webp', import.meta.url).href,
  },
  esports: {
    label: 'Esports',
    cls: 'w-games',
    art: new URL('./art/r3/fig-esports.webp', import.meta.url).href,
  },
  girls: { label: 'Girls', cls: 'w-talks', art: CREST },
  house: { label: 'House-wide', cls: 'w-talks', art: CREST },
};
const COMM_BY_ID = { 1: 'esports', 2: 'technical', 3: 'cultural', 7: 'girls' };
export const commKey = (e) => {
  if (e?.community && COMMUNITIES[e.community]) return e.community;
  if (e?.community_id && COMM_BY_ID[e.community_id]) return COMM_BY_ID[e.community_id];
  const w = e?.wing;
  if (w === 'cultural') return 'cultural';
  if (w === 'esports' || w === 'games') return 'esports';
  if (w === 'tech' || w === 'technical') return 'technical';
  if (w === 'girls') return 'girls';
  return 'house';
};
export const commOf = (e) => COMMUNITIES[commKey(e)] ?? COMMUNITIES.house;

export const ALL = computed(() => lounge.events);
export const eventById = (id) => lounge.events.find((e) => e.id === id);

/* Reads the minute clock, so lists move an event from Upcoming to Live to Past by themselves. */
export function status(e, now = clock.value) {
  if (e?.cancelled_at || e?.cancelled || e?.archive) return 'past';
  const start = Date.parse(e?.starts_at);
  const end = Date.parse(e?.ends_at);
  if (Number.isFinite(start) && Number.isFinite(end)) {
    if (now >= end) return 'past';
    if (now >= start) return 'live';
    return 'upcoming';
  }
  if (Number.isFinite(end) && now >= end) return 'past';
  if (Number.isFinite(start)) return now >= start ? 'live' : 'upcoming';
  if (e?.stage === 'past' || e?.stage === 'live' || e?.stage === 'upcoming') return e.stage;
  if (!e?.ends_at || !e?.starts_at) return e?.ends_at ? 'past' : 'upcoming';
  if (now >= end) return 'past';
  if (now >= start) return 'live';
  return 'upcoming';
}

export const JOIN_EARLY_MS = 15 * 60 * 1000;

export function meetHref(e) {
  return e?.meet_link || e?.gmail_link || '';
}

// Meet opens 15 minutes before start. The event stays upcoming until starts_at.
export function joinOpen(e, now = clock.value) {
  if (!meetHref(e)) return false;
  const s = status(e, now);
  if (s === 'live') return true;
  if (s !== 'upcoming') return false;
  const start = Date.parse(e?.starts_at);
  return Number.isFinite(start) && now >= start - JOIN_EARLY_MS;
}

export function joinEarly(e, now = clock.value) {
  return status(e, now) === 'upcoming' && joinOpen(e, now);
}

export const visible = computed(() =>
  lounge.events.filter((e) => liveOn.value || status(e) !== 'live')
);

export const liveNow = computed(() => visible.value.find((e) => status(e) === 'live') ?? null);
export const nextUp = computed(
  () =>
    visible.value
      .filter((e) => status(e) === 'upcoming' && e.starts_at)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null
);

export const isOpenSession = (e) => (e?.entry_mode || 'register') === 'open';
export const isRegistered = (e) => !!e?.registration;
// The registration row stays after an admin turns the registration down, so the marks read the
// event form's review too: a rejected one never says "Registered".
export const isRejected = (e) =>
  isRegistered(e) && reviewOf(lounge.forms.find((f) => f.event_id === e?.id)) === 'rejected';
const REJECTED = { kind: 'rejected', text: 'Not approved' };
export const ATTEND_MIN = 20;

export function minutesOf(e) {
  const sec = e?.attendance?.duration_seconds;
  if (sec == null) return 0;
  return Math.floor(Number(sec) / 60);
}

export function markOf(e) {
  const s = status(e);
  if (s !== 'past' && isRejected(e)) return REJECTED;
  if (s === 'live') return isRegistered(e) ? { kind: 'live', text: 'Live now' } : null;
  if (s === 'upcoming') return isRegistered(e) ? { kind: 'registered', text: 'Registered' } : null;
  const a = e?.attendance;
  if (!a && !e?.registration) return null;
  const m = minutesOf(e);
  const meetOk = e?.attendance_mode !== 'reviewed' && (a?.duration_seconds ?? 0) >= 1200;
  const reviewedOk = e?.attendance_mode === 'reviewed' && a?.reviewed_eligible;
  if (meetOk || reviewedOk) return { kind: 'attended', text: 'Attended', minutes: m };
  if (m > 0) return { kind: 'early', text: 'Left early', minutes: m };
  if (e?.registration) return isRejected(e) ? REJECTED : { kind: 'missed', text: 'Missed' };
  return null;
}

export const certOf = (e) => e?.certificate ?? null;

export const mine = computed(() => {
  const list = visible.value.filter((e) => isRegistered(e) || minutesOf(e) > 0 || e?.certificate);
  const rank = { live: 0, upcoming: 1, past: 2 };
  return list.sort((a, b) => {
    const sa = status(a);
    const sb = status(b);
    if (sa !== sb) return rank[sa] - rank[sb];
    const aAt = a.starts_at || '';
    const bAt = b.starts_at || '';
    return sa === 'past' ? bAt.localeCompare(aAt) : aAt.localeCompare(bAt);
  });
});

export const certificates = computed(() => {
  const byEvent = Object.fromEntries(lounge.events.map((e) => [e.id, e]));
  return lounge.certificates
    .map((c) => {
      const event = byEvent[c.event_id] || {
        id: c.event_id,
        name: c.event_name,
        starts_at: c.event_date || c.issued_at,
        community: null,
      };
      return {
        ...c,
        event,
        minutes: minutesOf(event) || ATTEND_MIN,
      };
    })
    .sort((a, b) => String(b.issued_at).localeCompare(String(a.issued_at)));
});
export const verifyHref = (id) => `/#/verify-certificate?id=${encodeURIComponent(id)}`;

export const notices = computed(() =>
  [...lounge.notices]
    .map((n) => ({
      ...n,
      posted_at: n.posted_at || n.starts_at,
      by: n.by || '',
    }))
    .sort((a, b) => String(b.posted_at || '').localeCompare(String(a.posted_at || '')))
);
export const isRead = (n) => !!(n.read_at || n.read);
export const unreadCount = computed(() => notices.value.filter((n) => !isRead(n)).length);
export function markRead(n) {
  if (!n?.id || isRead(n)) return;
  readNotice(n.id).catch(() => {});
}
export function markAllRead() {
  readAllNotices().catch(() => {});
}
export const bannerNotice = computed(
  () =>
    notices.value.find((n) => {
      if (n.show_banner === false || n.dismissed_at) return false;
      const posted = n.starts_at || n.posted_at;
      const timestamp = Date.parse(posted);
      if (!Number.isFinite(timestamp) || timestamp > clock.value) return false;
      const end = n.ends_at ? Date.parse(n.ends_at) : null;
      if (Number.isFinite(end) && end <= clock.value) return false;
      return n.show_banner === true || clock.value - timestamp < 72 * 3_600_000;
    }) ?? null
);
export function dismissBanner(n) {
  if (!n?.id) return;
  dismissNotice(n.id).catch(() => {});
}

export function resetDemo() {
  /* Live lists come from the database; there is nothing local to forget. */
}

/* ---------- Words for dates ---------- */

const DATE_ZONE = 'Asia/Kolkata';
const fmtDay = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: DATE_ZONE,
});
const fmtDate = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: DATE_ZONE,
});
const fmtLong = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: DATE_ZONE,
});
const fmtMonth = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
  timeZone: DATE_ZONE,
});
const fmtTime = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: DATE_ZONE,
});

export const timeOf = (iso) => fmtTime.format(new Date(iso)).toLowerCase().replace(' ', ' ');
const yearInIndia = (date) =>
  Number(new Intl.DateTimeFormat('en-IN', { year: 'numeric', timeZone: DATE_ZONE }).format(date));
export const thisYear = (iso) => !!iso && yearInIndia(new Date(iso)) === yearInIndia(new Date());

function archiveParts(e) {
  if (e?.starts_at && Number.isFinite(Date.parse(e.starts_at))) {
    const date = new Date(e.starts_at);
    return {
      year: yearInIndia(date),
      month:
        Number(
          new Intl.DateTimeFormat('en-IN', { month: 'numeric', timeZone: DATE_ZONE }).format(date)
        ) - 1,
      day: Number(
        new Intl.DateTimeFormat('en-IN', { day: 'numeric', timeZone: DATE_ZONE }).format(date)
      ),
    };
  }
  const { y: year, m: month, d: day } = parseDate(e?.display_date || '');
  return { year, month, day };
}
export const eventYear = (event) => archiveParts(event).year;

/* A single descending sort value from the archive date, so events with no starts_at (month-only
   display dates such as "May 2026") sit in their right year instead of after every timestamp. */
export function archiveSortValue(event) {
  const { year, month, day } = archiveParts(event);
  if (year == null) return null;
  return year * 10000 + (month == null ? 0 : (month + 1) * 100) + (day ?? 0);
}

/* "Thu, 8 Oct · 8:30 pm" for this year, "15 Feb 2025" for older, "May 2026" for month-only. */
export function whenOf(e) {
  if (!e.starts_at) return e.display_date || 'Date not recorded';
  if (!e.starts_at) return '';
  if (e.precision === 'month') return fmtMonth.format(new Date(e.starts_at));
  if (status(e) === 'past' && !thisYear(e.starts_at)) return fmtDate.format(new Date(e.starts_at));
  return `${fmtDay.format(new Date(e.starts_at))} · ${timeOf(e.starts_at)}`;
}
export function spanOf(e) {
  if (!e.starts_at) return e.display_date || 'Date not recorded';
  if (e.precision === 'month') return fmtMonth.format(new Date(e.starts_at));
  const d = new Date(e.starts_at);
  const day = thisYear(e.starts_at) ? fmtDay.format(d) : fmtLong.format(d);
  return e.site
    ? `${day}, ${timeOf(e.starts_at)}`
    : `${day}, ${timeOf(e.starts_at)} to ${timeOf(e.ends_at)}`;
}
export const longDate = (e) =>
  !e.starts_at
    ? e.display_date || 'Date not recorded'
    : e.precision === 'month'
      ? fmtMonth.format(new Date(e.starts_at))
      : fmtLong.format(new Date(e.starts_at));
export const tile = (e) => {
  const { year, month, day } = archiveParts(e);
  if (year == null || month == null) return { day: '', mon: 'Archive', yr: '' };
  return {
    day: day == null ? '' : String(day),
    mon: MONTH[month] || 'Archive',
    yr: yearInIndia(new Date()) === year ? '' : String(year).slice(-2),
  };
};

const DAY = 86_400_000;
/* A span in minutes: "45 min", "1 h 04 min", "3 h". Never seconds. */
export function span(ms) {
  const m = Math.max(1, Math.ceil(ms / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')} min` : `${h} h`;
}
/* "ends in 1 h 04 min" for an event on air. */
export const endsIn = (e, now = clock.value) => `ends in ${span(Date.parse(e.ends_at) - now)}`;

/* Calendar days, not 24-hour blocks: 8 pm the day after tomorrow is "in 2 days". */
const midnight = (t) => new Date(t).setHours(0, 0, 0, 0);
export function until(iso, now = clock.value) {
  const t = Date.parse(iso);
  const days = Math.round((midnight(t) - midnight(now)) / DAY);
  if (days >= 2) return `in ${days} days`;
  if (days === 1) return `tomorrow, ${timeOf(iso)}`;
  if (t - now >= 3_600_000) return `today, in ${span(t - now)}`;
  return `in ${span(t - now)}`;
}
/* Rows already show the time: "tomorrow", "in 4 days", "today". */
export const soon = (iso) => until(iso).split(',')[0];
export function ago(iso, now = clock.value) {
  const ms = now - Date.parse(iso);
  const d = Math.floor(ms / DAY);
  if (d >= 1) return d === 1 ? 'yesterday' : `${d} days ago`;
  const m = Math.round(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)} h ago` : `${Math.max(1, m)} min ago`;
}

/* A ref the Events page and Home share: which tab Events opens on. */
export const eventsTab = ref('upcoming');

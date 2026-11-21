// Shared reading of the Home page's next PAN BS session, for the notice prototypes (A/B/C).
import { computed } from 'vue';
import { fullDate, img, live, panbsRegistered, upcoming } from '../../../lib/events.js';

// PAN BS sessions only: one on air first, then the soonest. An upcoming session this browser
// already registered for is skipped; a live one stays, since its notice is the way in to join.
export const next = computed(
  () =>
    [...live, ...upcoming].find(
      (e) => e.panbs && (e.stage === 'live' || !panbsRegistered.includes(e.dbId))
    ) ?? null
);

export const isLive = computed(() => next.value?.stage === 'live');

// An open form takes registrations; a PAN BS session without one is only announced.
export const kicker = computed(() => {
  if (isLive.value) return 'Live now';
  return next.value?.registers ? 'Registrations open' : 'Upcoming session';
});

export const cta = computed(() => {
  if (isLive.value) return 'Join now';
  return next.value?.registers ? 'Register' : 'See details';
});

export const when = computed(() => {
  const e = next.value;
  if (!e?.at) return '';
  return [fullDate(e), e.time].filter(Boolean).join(' · ');
});

// Day and month split for a date block, e.g. { day: '23', month: 'Nov', weekday: 'Mon' }.
export const dateParts = computed(() => {
  const at = next.value?.at;
  if (!at) return null;
  const f = (o) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...o }).format(at);
  return {
    day: f({ day: 'numeric' }),
    month: f({ month: 'short' }),
    weekday: f({ weekday: 'short' }),
  };
});

// Whole IST days until the start: 0 today, 1 tomorrow.
export const daysLeft = computed(() => {
  const at = next.value?.at;
  if (!at || isLive.value) return null;
  const ist = (d) => new Date(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const n = Math.round((ist(at) - ist(new Date())) / 864e5);
  return n >= 0 ? n : null;
});

export const countdown = computed(() => {
  const n = daysLeft.value;
  if (isLive.value) return 'On air now';
  if (n == null) return '';
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return `In ${n} days`;
});

// Series titles read "<series> presents <headline> with <guest>"; split them so the headline
// leads. Titles without that shape fall back to the whole title as the headline.
export const parts = computed(() => {
  const t = next.value?.title ?? '';
  const m = t.match(/^(.*?)\s+presents\s+(.*)$/i);
  const series = m ? m[1] : '';
  const rest = m ? m[2] : t;
  const g = rest.match(/^(.*?)\s+with\s+(.*)$/i);
  return { series, headline: g ? g[1] : rest, guest: g ? g[2] : '' };
});

// The first sentence of the description, for a one-line teaser.
export const teaser = computed(() => {
  const d = (next.value?.desc ?? '').replace(/\s+/g, ' ').trim();
  const s = d.match(/^.*?[.!?](\s|$)/)?.[0] ?? d;
  return s.length > 150 ? s.slice(0, 147).trimEnd() + '…' : s.trim();
});

export const poster = computed(() => img.card(next.value?.image) ?? null);

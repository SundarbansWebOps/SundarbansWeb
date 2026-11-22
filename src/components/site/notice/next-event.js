// Prototype: the same reading of "the next event" as NextEventNotice.vue, shared by the desktop
// corner designs (A/B/C) so all three show the same event, words and action.
import { computed } from 'vue';
import { fullDate, img, live, panbsRegistered, upcoming } from '../../../lib/events.js';

// Anything on air first, then a PAN BS session taking registrations, then the soonest public
// event. A PAN BS session this browser registered for is skipped unless it is live.
export const next = computed(() => {
  const open = [...live, ...upcoming].filter(
    (e) => e.stage === 'live' || !(e.panbs && panbsRegistered.includes(e.dbId))
  );
  return (
    open.find((e) => e.stage === 'live') ??
    open.find((e) => e.panbs && e.registers) ??
    open[0] ??
    null
  );
});

export const isLive = computed(() => next.value?.stage === 'live');

export const kicker = computed(() => {
  const e = next.value;
  if (isLive.value) return 'Live now';
  if (!e?.panbs) return 'House event';
  return e.registers ? 'Registrations open' : 'Upcoming session';
});

export const cta = computed(() => {
  const e = next.value;
  if (isLive.value) return 'Join now';
  if (e?.panbs ? e.registers : e?.link) return 'Register';
  return 'See details';
});

export const when = computed(() => {
  const e = next.value;
  if (!e?.at) return '';
  return [fullDate(e), e.time].filter(Boolean).join(' · ');
});

// Date pieces in IST, e.g. { day: '23', month: 'Nov', weekday: 'Mon' }.
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
const daysLeft = computed(() => {
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

// "<series> presents <headline> with <guest>" splits so the headline leads.
export const parts = computed(() => {
  const t = next.value?.title ?? '';
  const m = t.match(/^(.*?)\s+presents\s+(.*)$/i);
  const rest = m ? m[2] : t;
  const g = rest.match(/^(.*?)\s+with\s+(.*)$/i);
  return { series: m ? m[1] : '', headline: g ? g[1] : rest, guest: g ? g[2] : '' };
});

export const poster = computed(() => img.card(next.value?.image) ?? null);

export const label = computed(() =>
  [`${kicker.value}: ${next.value?.title}`, when.value, cta.value].filter(Boolean).join(', ')
);

<!--
  Events: live and upcoming Public events at the top, then the archive
  (swell chart → month-by-month log). Joining is in Launch. Meetups live on House.
-->
<template>
  <main id="main-content" class="wrap" tabindex="-1">
    <header class="head rise" style="--i: 0">
      <h1>Events</h1>
      <dl class="stats">
        <div v-for="s in STATS" :key="s.label">
          <dt>{{ s.label }}</dt>
          <dd class="mono">{{ shown[s.key] }}</dd>
        </div>
      </dl>
      <p v-if="publicCatalog.error" class="sub" role="alert">{{ publicCatalog.error }}</p>
      <p v-else class="sub">{{ sub }}</p>
    </header>

    <section
      v-if="live.length"
      v-inview
      class="soon live-band rise"
      style="--i: 1"
      aria-labelledby="live-h"
    >
      <h2 id="live-h" class="soon-h live-h">
        <i class="live-dot" aria-hidden="true" />
        Live now
        <span class="soon-n mono">{{ live.length }}</span>
      </h2>
      <div class="cards">
        <EventCard
          v-for="(e, i) in live"
          :key="e.id"
          :e="e"
          :i="i"
          @open="(id, ev2) => openEvent(id, ev2)"
        />
      </div>
    </section>

    <section
      v-if="upcoming.length"
      v-inview
      class="soon rise"
      :style="{ '--i': live.length ? 2 : 1 }"
      aria-labelledby="soon-h"
    >
      <h2 id="soon-h" class="soon-h">
        Coming up
        <span class="soon-n mono">{{ upcoming.length }}</span>
      </h2>
      <div class="cards">
        <EventCard
          v-for="(e, i) in upcoming"
          :key="e.id"
          :e="e"
          :i="i"
          @open="(id, ev2) => openEvent(id, ev2)"
        />
      </div>
    </section>

    <div class="controls rise" style="--i: 1">
      <div ref="chipRow" class="chips" role="radiogroup" aria-label="Filter by wing">
        <i class="pill" :style="pill" />
        <button
          v-for="c in chips"
          :key="c.id"
          :ref="(el) => (chipEls[c.id] = el)"
          type="button"
          role="radio"
          :aria-checked="wing === c.id"
          class="chip"
          :class="[`w-${c.id}`, { on: wing === c.id }]"
          @click="wing = c.id"
        >
          <i v-if="c.id !== 'all'" class="dot" />{{ c.label }}
          <small>{{ c.n }}</small>
        </button>
      </div>
      <div
        v-if="regionChips.length > 1"
        class="chips"
        role="radiogroup"
        aria-label="Filter by region"
      >
        <button
          v-for="r in regionChips"
          :key="r.id"
          type="button"
          role="radio"
          :aria-checked="regionId === r.id"
          class="chip"
          :class="{ on: regionId === r.id }"
          @click="regionId = r.id"
        >
          {{ r.label }}
        </button>
      </div>
      <label class="find" :class="{ has: q }">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5 20 20" />
        </svg>
        <span class="visually-hidden">Search events</span>
        <input
          ref="findEl"
          v-model="q"
          type="search"
          placeholder="Search events"
          autocomplete="off"
          spellcheck="false"
          @keydown.esc="q = ''"
        />
        <kbd v-if="!q">/</kbd>
        <button v-else type="button" class="clear" title="Clear (Esc)" @click="q = ''">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
          <span class="visually-hidden">Clear search</span>
        </button>
      </label>
    </div>

    <section class="chart rise" style="--i: 2" aria-label="Events over time">
      <SwellChart
        ref="chart"
        :list="chartEvents"
        :active="activeIds"
        @open="(id, e) => openEvent(id, e)"
        @jump="jump"
      />
    </section>

    <section class="log" aria-label="Event log">
      <p v-if="!visible.length" class="empty">
        Nothing matches “{{ q }}”.
        <button type="button" @click="clearAll">Show everything</button>
      </p>
      <TransitionGroup name="month">
        <section
          v-for="g in groups"
          :id="`m-${g.key}`"
          :key="g.key"
          v-inview
          class="month"
          :aria-label="g.key === 'undated' ? 'Date not recorded' : `${monthLong(g.m)} ${g.y}`"
        >
          <div class="rail">
            <i class="node" />
            <span class="mon" :class="{ nd: g.key === 'undated' }">{{
              g.key === 'undated' ? 'Date not recorded' : MONTH[g.m]
            }}</span>
            <span v-if="g.y" class="yr mono">{{ g.y }}</span>
            <span class="n"
              >{{ g.items.length }} {{ g.items.length === 1 ? 'event' : 'events' }}</span
            >
          </div>
          <TransitionGroup name="card" tag="div" class="cards">
            <EventCard
              v-for="(e, i) in g.items"
              :key="e.id"
              :e="e"
              :i="i"
              @open="(id, ev2) => openEvent(id, ev2)"
            />
          </TransitionGroup>
        </section>
      </TransitionGroup>
    </section>

    <EventSheet :list="sheetList" />
  </main>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import SwellChart from '../components/site/SwellChart.vue';
import EventCard from '../components/site/EventCard.vue';
import EventSheet from '../components/site/EventSheet.vue';
import {
  MONTH,
  WINGS,
  ev,
  events,
  groupByMonth,
  live,
  loadPublicEvents,
  matches,
  monthKey,
  monthLong,
  openEvent,
  publicCatalog,
  upcoming,
} from '../lib/events.js';

// A wing filter arrives from a Teams community card (ev.wing) or an old /community/* link (?wing=).
const route = useRoute();
const router = useRouter();
const wing = ref(ev.wing ?? (WINGS[route.query.wing] ? route.query.wing : 'all'));
ev.wing = null;
const q = ref(typeof route.query.q === 'string' ? route.query.q : '');
const regionId = ref(typeof route.query.region === 'string' ? route.query.region : 'all');
const findEl = ref(null);
const chart = ref(null);

const dated = computed(() => events.filter((e) => e.at));
const happening = computed(() => [...live, ...upcoming]);
// The sheet pages through the list the open event belongs to.
const sheetList = computed(() =>
  happening.value.some((e) => e.id === ev.open) ? happening.value : visible.value
);
const first = computed(() => dated.value.at(-1));
const sub = computed(() => {
  const since = first.value
    ? `Everything the house has run since ${MONTH[first.value.m]} ${first.value.y}.`
    : 'Past events the house has published.';
  if (happening.value.length) return `${since} Log in to Launch to join what’s live or coming up.`;
  return `${since} More upcoming events are announced to members in Launch.`;
});
// The swell chart shows last calendar year and this year up to today; the log below keeps the full archive.
const chartEvents = computed(() => {
  const now = new Date();
  const since = new Date(now.getFullYear() - 1, 0, 1);
  return dated.value.filter((e) => e.at >= since && e.at <= now);
});

const inWing = (e) => wing.value === 'all' || e.wing === wing.value;
const inRegion = (e) => regionId.value === 'all' || String(e.region_id) === regionId.value;
const visible = computed(() =>
  events.filter((e) => inWing(e) && inRegion(e) && matches(e, q.value))
);
const regionChips = computed(() => {
  const ids = [...new Set(events.map((e) => e.region_id).filter(Boolean))];
  if (!ids.length) return [];
  const named = publicCatalog.regions.filter((r) => ids.includes(r.id));
  return [
    { id: 'all', label: 'All regions' },
    ...named.map((r) => ({ id: String(r.id), label: r.name })),
  ];
});
const activeIds = computed(() =>
  wing.value === 'all' && regionId.value === 'all' && !q.value.trim()
    ? null
    : new Set(visible.value.map((e) => e.id))
);
const groups = computed(() => groupByMonth(visible.value));

const chips = computed(() => [
  { id: 'all', label: 'All', n: events.filter((e) => matches(e, q.value)).length },
  ...Object.entries(WINGS)
    .filter(([id]) => id !== 'meetups')
    .map(([id, w]) => ({
      id,
      label: w.label,
      n: events.filter((e) => e.wing === id && matches(e, q.value)).length,
    })),
]);

// Sliding marigold pill under the active chip.
const chipRow = ref(null);
const chipEls = reactive({});
const pill = ref({});
async function placePill() {
  await nextTick();
  const el = chipEls[wing.value];
  if (el)
    pill.value = { width: `${el.offsetWidth}px`, transform: `translateX(${el.offsetLeft}px)` };
}
watch(wing, placePill);

watch(
  () => [wing.value, regionId.value, q.value],
  ([nextWing, nextRegion, nextQuery]) => {
    const query = { ...route.query };
    if (nextWing === 'all') delete query.wing;
    else query.wing = nextWing;
    if (nextRegion === 'all') delete query.region;
    else query.region = nextRegion;
    if (nextQuery) query.q = nextQuery;
    else delete query.q;
    if (
      query.wing !== route.query.wing ||
      query.region !== route.query.region ||
      query.q !== route.query.q
    )
      router.replace({ query });
  }
);
watch(
  () => [route.query.wing, route.query.region, route.query.q],
  ([nextWing, nextRegion, nextQuery]) => {
    wing.value = WINGS[nextWing] ? nextWing : 'all';
    regionId.value = typeof nextRegion === 'string' ? nextRegion : 'all';
    q.value = typeof nextQuery === 'string' ? nextQuery : '';
  }
);

const STATS = computed(() => {
  const stats = [];
  if (live.length) stats.push({ key: 'live', label: 'live now', to: live.length });
  if (upcoming.length) stats.push({ key: 'upcoming', label: 'upcoming', to: upcoming.length });
  stats.push(
    { key: 'events', label: 'events', to: events.length },
    { key: 'months', label: 'active months', to: new Set(dated.value.map(monthKey)).size }
  );
  return stats;
});
const shown = reactive({ live: 0, upcoming: 0, events: 0, months: 0 });
function countUp() {
  const stats = STATS.value;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const s of stats) shown[s.key] = s.to;
    return;
  }
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / 1200);
    const e = 1 - Math.pow(1 - k, 3);
    for (const s of stats) shown[s.key] = Math.round(s.to * e);
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Cards reveal (and stamp their dates) as each month scrolls in.
const io = new IntersectionObserver(
  (entries) => {
    for (const en of entries)
      if (en.isIntersecting) {
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
  },
  { rootMargin: '0px 0px -12% 0px' }
);
const vInview = { mounted: (el) => io.observe(el), unmounted: (el) => io.unobserve(el) };

function jump(key) {
  document.getElementById(`m-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function clearAll() {
  q.value = '';
  wing.value = 'all';
  regionId.value = 'all';
}

// Hovering a card on a phone-width chart scrolls its bubble into view.
watch(
  () => ev.hover,
  (id) => id && chart.value?.reveal(id)
);

function slash(e) {
  if (e.key !== '/' || e.target.matches?.('input, textarea, [contenteditable]')) return;
  e.preventDefault();
  findEl.value?.focus();
}
onMounted(async () => {
  await loadPublicEvents();
  countUp();
  placePill();
  window.addEventListener('keydown', slash);
  window.addEventListener('resize', placePill);
  document.fonts?.ready.then(placePill);
});
onBeforeUnmount(() => {
  io.disconnect();
  window.removeEventListener('keydown', slash);
  window.removeEventListener('resize', placePill);
});
</script>

<style scoped>
.wrap {
  max-width: 1240px;
  margin: 0 auto;
  padding: 18px 24px 80px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px;
}
.head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: end;
  gap: 4px 28px;
}
h1 {
  margin: 0;
  font-size: clamp(34px, 4.4vw, 48px);
  font-weight: 750;
  letter-spacing: -0.04em;
  line-height: 0.95;
}
.stats {
  display: flex;
  justify-content: flex-end;
  gap: 26px;
  margin: 0;
}
.stats div {
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-end;
}
.stats dt {
  font-size: 12px;
  color: var(--ink-2);
}
.stats dd {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.sub {
  grid-column: 1 / -1;
  margin: 4px 0 0;
  font-size: 15px;
  color: var(--ink-2);
}

.soon {
  padding: 6px 0 10px;
}
.soon-h {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0 0 18px;
  font-size: clamp(24px, 2.6vw, 30px);
  font-weight: 750;
  letter-spacing: -0.035em;
}
.soon-n {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink-3);
  letter-spacing: 0;
}
.live-h {
  align-items: center;
}
.live-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--verm);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--verm) 55%, transparent);
  animation: live-pulse 1.8s var(--ease-out) infinite;
}
@keyframes live-pulse {
  70% {
    box-shadow: 0 0 0 8px color-mix(in srgb, var(--verm) 0%, transparent);
  }
}
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.chips {
  position: relative;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 99px;
  background: var(--sunk);
}
.pill {
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  border-radius: 99px;
  background: var(--ink);
  transition:
    transform 0.5s var(--ease-spring),
    width 0.5s var(--ease-spring);
}
.chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border: 0;
  border-radius: 99px;
  background: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink-2);
  white-space: nowrap;
  transition: color 0.25s;
}
.chip:hover {
  color: var(--ink);
}
.chip.on {
  color: var(--paper);
}
.chip .dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--w);
  box-shadow: 0 0 0 1.5px var(--sunk);
}
.chip.on .dot {
  box-shadow: 0 0 0 1.5px var(--ink);
}
.chip small {
  font-size: 11.5px;
  font-weight: 600;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
.find {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: min(340px, 100%);
  height: 44px;
  padding: 0 12px;
  border: 1.5px solid var(--line-strong);
  border-radius: 12px;
  background: var(--card);
  transition:
    border-color 0.2s,
    box-shadow 0.3s;
}
.find:focus-within {
  border-color: var(--ink);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--mari) 35%, transparent);
}
.find svg {
  flex: none;
  width: 18px;
  height: 18px;
  fill: none;
  stroke: var(--ink-2);
  stroke-width: 2;
  stroke-linecap: round;
}
.find input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: none;
  font: inherit;
  font-size: 15px;
  color: var(--ink);
}
.find input::placeholder {
  color: var(--ink-3);
}
.find input::-webkit-search-cancel-button {
  display: none;
}
.clear {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--sunk);
}
.clear svg {
  width: 14px;
  height: 14px;
  stroke: var(--ink);
}
.find kbd {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-3);
  border: 1px solid var(--line-strong);
  border-bottom-width: 2px;
  border-radius: 6px;
  padding: 1px 7px;
}

.chart {
  padding: 4px 0 0;
  border-bottom: 1px solid var(--line);
}

.log {
  position: relative;
  display: grid;
  gap: 8px;
  padding-top: 12px;
}
.log::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 30px;
  bottom: 0;
  width: 2px;
  background: linear-gradient(var(--line-strong), var(--line-strong) 80%, transparent);
}
.month {
  position: relative;
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 24px;
  padding: 16px 0 26px;
  scroll-margin-top: calc(var(--nav-h) + 16px);
}
.rail {
  position: sticky;
  top: calc(var(--nav-h) + 16px);
  align-self: start;
  display: grid;
  padding-left: 30px;
}
.node {
  position: absolute;
  left: 0;
  top: 12px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--paper);
  border: 2px solid var(--line-strong);
  transition:
    background 0.4s,
    border-color 0.4s,
    transform 0.5s var(--ease-spring);
}
.month.in .node {
  background: var(--mari);
  border-color: var(--ink);
  transform: scale(1.1);
}
.mon {
  font-size: 40px;
  font-weight: 750;
  letter-spacing: -0.045em;
  line-height: 1;
}
.mon.nd {
  font-size: 22px;
  letter-spacing: -0.03em;
  line-height: 1.05;
}
.yr {
  font-size: 13px;
  color: var(--ink-2);
  margin-top: 4px;
}
.n {
  font-size: 12.5px;
  color: var(--ink-3);
  margin-top: 8px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(210px, 100%), 1fr));
  gap: 26px 20px;
  align-items: start;
}
.empty {
  margin: 12px 0;
  padding: 18px;
  border: 1.5px dashed var(--line-strong);
  border-radius: 14px;
  color: var(--ink-2);
}
.empty button {
  margin-left: 8px;
  padding: 6px 12px;
  border: 0;
  border-radius: 99px;
  background: var(--ink);
  color: var(--paper);
  font-weight: 600;
}

.month-enter-active {
  transition: opacity 0.5s var(--ease-out);
}
.month-enter-from {
  opacity: 0;
}
.month-leave-active {
  display: none;
}
.card-enter-active {
  transition:
    opacity 0.4s,
    transform 0.55s var(--ease-spring) !important;
}
.card-enter-from {
  opacity: 0 !important;
  transform: scale(0.9) translateY(12px) !important;
}
.card-leave-active {
  display: none;
}

@media (max-width: 900px) {
  .head {
    grid-template-columns: minmax(0, 1fr);
  }
  .stats {
    justify-content: flex-start;
    order: 3;
  }
  .stats div {
    align-items: flex-start;
  }
}
@media (max-width: 760px) {
  .wrap {
    padding: 14px 16px 110px;
    gap: 14px;
  }
  .stats {
    gap: 18px;
  }
  .stats dd {
    font-size: 20px;
  }
  .chips {
    width: calc(100% + 32px);
    margin: 0 -16px;
    padding: 4px 16px;
    border-radius: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .pill {
    display: none;
  }
  .chip.on {
    background: var(--ink);
  }
  .find {
    width: 100%;
  }
  .find kbd {
    display: none;
  }
  .log::before {
    display: none;
  }
  .month {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    padding: 10px 0 18px;
  }
  .rail {
    position: static;
    padding-left: 0;
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .node {
    display: none;
  }
  .mon {
    font-size: 30px;
  }
  .n {
    margin: 0 0 0 auto;
  }
  .cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px 12px;
  }
}
</style>

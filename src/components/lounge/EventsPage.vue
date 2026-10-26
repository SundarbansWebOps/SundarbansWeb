<!--
  Events: a quarter-screen window onto Home's painted river with the boat on it, then tabs
  (Live, Upcoming, Past, Mine), community chips and one ghat-paper sheet of rows. A row opens
  the event's pop-up (EventDetail). Registering is one-way. Mine carries attendance marks and a
  Certificate button that opens the certificate viewer. Countdowns read in minutes.
-->
<template>
  <div class="evp">
    <section v-loop class="ev-hero" aria-labelledby="ev-h">
      <!-- The band is a window onto Home's scene: `.stage` lays out the same plate Home uses,
           at Home's hero size, shifted up so the window shows the far bank and the river.
           tide.js reads the stage offset to line the two up mid-switch. -->
      <div v-loop class="scene" aria-hidden="true">
        <div class="stage">
          <picture class="ly ev-sky">
            <source type="image/avif" :srcset="PLATE.set(mode, 'avif')" :sizes="PLATE_SIZES" />
            <img
              :src="PLATE.src(mode)"
              :srcset="PLATE.set(mode, 'webp')"
              :sizes="PLATE_SIZES"
              alt=""
            />
          </picture>
        </div>
        <!-- The boat: the one thing that travels between views (it carries
             view-transition-name: boat). The page transition leaves it where it lands and
             it rides the river from there. Its lamp was lit on Home, so it doesn't catch again here. -->
        <div class="ev-boat">
          <RiverBoat :catch-lamp="false" />
        </div>
      </div>
      <div class="ev-title">
        <div class="ev-plate gp">
          <h1 id="ev-h">Events</h1>
          <p class="ev-sum">
            <template v-if="lists.live.length">
              <span class="ev-live"
                ><i aria-hidden="true"></i>{{ lists.live.length }} live now</span
              >
              <span class="sep" aria-hidden="true">·</span>
            </template>
            <span>{{ lists.upcoming.length }} coming up</span>
            <span class="sep" aria-hidden="true">·</span>
            <span>{{ certificates.length }} certificates earned</span>
          </p>
        </div>
      </div>
    </section>

    <section v-loop class="ev-body">
      <div class="ev-in">
        <div
          ref="tabsEl"
          class="ev-tabs gp"
          role="tablist"
          aria-label="Which events"
          @keydown="onTabKey"
        >
          <button
            v-for="t in TABS"
            :id="`tab-${t.id}`"
            :key="t.id"
            type="button"
            role="tab"
            class="ev-tab"
            :class="{ on: tab === t.id, 'is-live': t.id === 'live' && lists.live.length }"
            :aria-selected="tab === t.id ? 'true' : 'false'"
            :aria-controls="`panel-${t.id}`"
            :tabindex="tab === t.id ? 0 : -1"
            @click="tab = t.id"
          >
            <i v-if="t.id === 'live' && lists.live.length" class="dot" aria-hidden="true"></i>
            {{ t.label }}
            <span class="n">{{ counts[t.id] }}</span>
          </button>
          <span
            class="ev-tab-rule"
            :class="{ 'ev-slide': rule.go }"
            :style="rule.style"
            aria-hidden="true"
          ></span>
        </div>

        <div
          ref="chipsEl"
          class="ev-chips"
          :class="{ 'more-l': chipMore.l, 'more-r': chipMore.r }"
          role="group"
          aria-label="Community"
          @scroll.passive="chipEdges"
        >
          <button
            v-for="c in CHIPS"
            :key="c.id"
            type="button"
            class="chip"
            :class="[c.cls, { on: comm === c.id }]"
            :aria-pressed="comm === c.id ? 'true' : 'false'"
            @click="pickChip(c.id, $event)"
          >
            <i v-if="c.cls" aria-hidden="true"></i>{{ c.label }}
          </button>
        </div>
        <div
          :id="`panel-${tab}`"
          :key="`${tab}-${comm}`"
          role="tabpanel"
          class="ev-panel"
          :aria-labelledby="`tab-${tab}`"
        >
          <template v-if="shown.length">
            <template v-for="g in groups" :key="g.label || 'all'">
              <h2 v-if="g.label" class="ev-group gp-kicker">{{ g.label }}</h2>
              <ul class="ev-list gp" :class="{ air: tab === 'live' }">
                <li
                  v-for="e in g.items"
                  :key="e.id"
                  class="er"
                  :class="[
                    commOf(e).cls,
                    `s-${status(e)}`,
                    markOf(e)?.kind ? `m-${markOf(e).kind}` : '',
                  ]"
                >
                  <div v-if="status(e) === 'live'" class="er-date er-onair" aria-hidden="true">
                    <i></i><span>Live</span>
                  </div>
                  <div v-else class="er-date" aria-hidden="true">
                    <b v-if="tile(e).day">{{ tile(e).day }}</b>
                    <span>{{ tile(e).mon }}</span>
                    <small v-if="tile(e).yr">’{{ tile(e).yr }}</small>
                  </div>
                  <div class="er-main">
                    <p v-if="status(e) === 'live'" class="er-kick gp-kicker is-live">
                      Live now · {{ commOf(e).label }}
                    </p>
                    <h3>
                      <button
                        type="button"
                        class="er-hit"
                        aria-haspopup="dialog"
                        @click="openEvent(e)"
                      >
                        {{ e.name }}
                      </button>
                    </h3>
                    <p class="er-meta">
                      <template v-if="status(e) === 'live'">
                        <span>started {{ timeOf(e.starts_at) }}</span>
                        <span class="sep" aria-hidden="true">·</span>
                        <span :key="endsIn(e)" class="soon ev-tick">{{ endsIn(e) }}</span>
                      </template>
                      <template v-else>
                        <span class="er-comm">{{ commOf(e).label }}</span>
                        <span class="sep" aria-hidden="true">·</span>
                        <span>{{ whenOf(e) }}</span>
                        <template v-if="status(e) === 'upcoming'">
                          <span class="sep" aria-hidden="true">·</span
                          ><span :key="soon(e.starts_at)" class="soon ev-tick">{{
                            soon(e.starts_at)
                          }}</span>
                        </template>
                      </template>
                    </p>
                  </div>
                  <div class="er-side">
                    <template v-if="status(e) === 'live'">
                      <a
                        v-if="e.meet_link || e.gmail_link"
                        class="er-join gp-btn"
                        :href="e.meet_link || e.gmail_link"
                        target="_blank"
                        rel="noopener noreferrer"
                        >Join on Meet <span aria-hidden="true">→</span
                        ><span class="visually-hidden"> {{ e.name }}</span></a
                      >
                    </template>
                    <template v-else-if="status(e) === 'upcoming'">
                      <span v-if="isOpenSession(e)" class="mark m-open">Open to all</span>
                      <span v-else-if="markOf(e)?.kind === 'rejected'" class="mark m-rejected">
                        Not approved
                      </span>
                      <span v-else-if="isRegistered(e)" class="mark m-registered">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m5 12.5 4.2 4L19 7" /></svg
                        >Registered
                      </span>
                      <span v-else-if="!registrationOpen(e)" class="mark">
                        Registration closed
                      </span>
                      <button
                        v-else
                        type="button"
                        class="er-reg gp-btn is-ghost"
                        @click="openEvent(e, 'form')"
                      >
                        Register<span class="visually-hidden"> for {{ e.name }}</span>
                      </button>
                    </template>
                    <template v-else>
                      <span v-if="markOf(e)" class="mark" :class="`m-${markOf(e).kind}`">
                        <svg
                          v-if="markOf(e).kind === 'attended'"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d="m5 12.5 4.2 4L19 7" /></svg
                        >{{ markOf(e).text
                        }}<template v-if="markOf(e).minutes">
                          · {{ markOf(e).minutes }} min</template
                        >
                      </span>
                      <span v-else-if="e.attendees" class="came">{{ e.attendees }} came</span>
                      <button
                        v-if="tab === 'mine' && certOf(e)"
                        type="button"
                        class="er-cert gp-btn is-ghost"
                        @click="emit('cert', certOf(e).id)"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="12" cy="9" r="5.5" />
                          <path d="m8.5 13.5-1.8 7 5.3-2.6 5.3 2.6-1.8-7" />
                        </svg>
                        Certificate<span class="visually-hidden"> for {{ e.name }}</span>
                      </button>
                    </template>
                  </div>
                </li>
              </ul>
            </template>
          </template>

          <div v-else class="ev-empty gp">
            <img :src="empty.art" alt="" />
            <h2>{{ empty.title }}</h2>
            <p>{{ empty.body }}</p>
            <button
              v-if="empty.go"
              type="button"
              class="ev-go gp-btn is-ghost"
              @click="tab = empty.go"
            >
              {{ empty.cta }}
            </button>
          </div>
        </div>

        <p v-if="tab === 'mine' && shown.length" class="ev-note">
          Attended means 20 minutes or more in the Meet. That is also what earns a certificate.
        </p>
      </div>
    </section>

    <footer class="foot">
      <img :src="CREST" alt="" width="56" height="56" />
      <p><b>The Lounge</b> · exclusive to Sundarbans House members</p>
    </footer>

    <EventDetail
      v-if="openId"
      :event="openEv"
      :start="openStep"
      :plate="PLATE.src(mode)"
      @close="openId = null"
      @cert="(id) => emit('cert', id)"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import CREST from '../../assets/crest.webp';
import EventDetail from './EventDetail.vue';
import {
  archiveSortValue,
  certificates,
  certOf,
  COMMUNITIES,
  commKey,
  commOf,
  endsIn,
  eventById,
  eventsTab,
  eventYear,
  isOpenSession,
  isRegistered,
  markOf,
  mine,
  soon,
  status,
  tile,
  timeOf,
  until,
  visible,
  whenOf,
} from './events.js';
import { MOORED, PLATE } from './home/art.js';
import { vLoop } from './home/motion.js';
import RiverBoat from './home/RiverBoat.vue';
import { mode } from './state.js';
import { formByEvent } from './session.js';

const emit = defineEmits(['cert']);

/* The band's art is Home's (home/art.js: PLATE, and BOAT inside RiverBoat), so the r6 swap
   happens there once. The plate box is the viewport wide, or 840px on phones. */
const PLATE_SIZES = '(max-width: 760px) 840px, 100vw';

const TABS = [
  { id: 'live', label: 'Live' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'mine', label: 'Mine' },
];
const CHIPS = [
  { id: 'all', label: 'All', cls: '' },
  { id: 'cultural', label: 'Cultural', cls: 'w-cultural' },
  { id: 'technical', label: 'Technical', cls: 'w-tech' },
  { id: 'esports', label: 'Esports', cls: 'w-games' },
  { id: 'house', label: 'House-wide', cls: 'w-talks' },
];

const comm = ref('all');
const tab = eventsTab;
const registrationOpen = (event) => {
  const form = formByEvent(event.id);
  return !!form && (form.accepting_responses ?? form.is_open ?? false);
};

/* On a phone the chips are one row that scrolls sideways; a soft fade at the edge that
   has more chips beyond it says so. Set from the row's own scroll events. */
const chipsEl = ref(null);
const chipMore = ref({ l: false, r: false });
function chipEdges() {
  const el = chipsEl.value;
  if (!el) return;
  const l = el.scrollLeft > 4;
  const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
  if (l !== chipMore.value.l || r !== chipMore.value.r) chipMore.value = { l, r };
}
function pickChip(id, ev) {
  comm.value = id;
  ev.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
/* The chosen tab's rule: one element that slides under it (translateX + scaleX of a 100px
   bar). Placed without a transition first, so it doesn't sweep in on page load. */
const tabsEl = ref(null);
const rule = ref({ go: false, style: {} });
function placeRule() {
  const box = tabsEl.value;
  const on = box?.querySelector('.ev-tab.on');
  if (!on) return;
  const w = on.offsetWidth - 24;
  rule.value = {
    go: rule.value.go,
    style: { '--x': `${on.offsetLeft + 12}px`, '--s': (w / 100).toFixed(3) },
  };
}
watch(tab, () => nextTick(placeRule));

/* Measured again once the web font lands (chips and tabs change width) and on resize. */
let ro = null;
onMounted(() => {
  chipEdges();
  placeRule();
  document.fonts?.ready.then(() => {
    chipEdges();
    placeRule();
    requestAnimationFrame(() => (rule.value = { ...rule.value, go: true }));
  });
  ro = new ResizeObserver(() => {
    chipEdges();
    placeRule();
  });
  ro.observe(chipsEl.value);
  ro.observe(tabsEl.value);
  chipsEl.value.querySelectorAll('.chip').forEach((c) => ro.observe(c));
  tabsEl.value.querySelectorAll('.ev-tab').forEach((t) => ro.observe(t));
});
onBeforeUnmount(() => {
  ro?.disconnect();
});

const lists = computed(() => {
  const by = (s) => visible.value.filter((e) => status(e) === s);
  return {
    live: by('live'),
    upcoming: by('upcoming').sort((a, b) =>
      String(a.starts_at || '').localeCompare(String(b.starts_at || ''))
    ),
    past: by('past').sort((a, b) => {
      /* Archive dates win over raw starts_at: month-only events have no timestamp but still
         belong under their year. Undated rows stay last. */
      const ka = archiveSortValue(a);
      const kb = archiveSortValue(b);
      if (ka == null && kb == null) return String(a.name || '').localeCompare(String(b.name || ''));
      if (ka == null) return 1;
      if (kb == null) return -1;
      return kb - ka;
    }),
    mine: mine.value,
  };
});

/* First visit opens on Live when something is on air. */
let picked = null;
try {
  picked = sessionStorage.getItem('lounge-e-ev-tab');
} catch {
  /* storage blocked */
}
if (picked) tab.value = picked;
else if (lists.value.live.length) tab.value = 'live';
watch(tab, (t) => {
  try {
    sessionStorage.setItem('lounge-e-ev-tab', t);
  } catch {
    /* storage blocked */
  }
});

const pick = (list) =>
  list.filter((e) => {
    if (comm.value !== 'all' && commKey(e) !== comm.value) return false;
    return true;
  });
const counts = computed(() =>
  Object.fromEntries(TABS.map((t) => [t.id, pick(lists.value[t.id]).length]))
);
const shown = computed(() => pick(lists.value[tab.value]));

/* Past is long: group it by year, newest year first and undated rows last. Bucketing (not
   run-length grouping) keeps a year whole when its events interleave in the sorted list. */
const groups = computed(() => {
  if (tab.value !== 'past') return [{ label: '', items: shown.value }];
  const buckets = new Map();
  for (const e of shown.value) {
    const y = eventYear(e) == null ? 'Undated' : String(eventYear(e));
    if (!buckets.has(y)) buckets.set(y, []);
    buckets.get(y).push(e);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => {
      if (a === 'Undated') return 1;
      if (b === 'Undated') return -1;
      return Number(b) - Number(a);
    })
    .map(([label, items]) => ({ label, items }));
});

const commName = computed(() => (comm.value === 'all' ? '' : COMMUNITIES[comm.value].label));
/* Empty states carry one painted object from Home's river: a moored boat (no lamp) when
   nothing is on or planned, the crest for the house's own records. */
const empty = computed(() => {
  const c = commName.value;
  const next = lists.value.upcoming[0];
  switch (tab.value) {
    case 'live':
      return {
        art: MOORED[mode.value],
        title: c ? `No ${c} event is on air` : 'Nothing is on air right now',
        body: next
          ? `Next up is ${next.name}, ${until(next.starts_at)}. When an event starts, it shows here with a Join button.`
          : 'When an event starts, it shows here with a Join button.',
        go: 'upcoming',
        cta: 'See what is coming up',
      };
    case 'upcoming':
      return {
        art: MOORED[mode.value],
        title: c ? `No ${c} events planned yet` : 'Nothing planned yet',
        body: 'New events land here first. Your WhatsApp groups hear about them too.',
        go: 'past',
        cta: 'Look at past events',
      };
    case 'past':
      return {
        art: CREST,
        title: c ? `No past ${c} events here` : 'No past events yet',
        body: 'Once an event ends, it moves here.',
      };
    default:
      return {
        art: CREST,
        title: c ? `You have no ${c} events yet` : 'Nothing here yet',
        body: 'Register for an event and it lands here. After it ends you see your attendance and, if you stayed 20 minutes, your certificate.',
        go: 'upcoming',
        cta: 'Find an event',
      };
  }
});

/* Arrow keys move between tabs (WAI-ARIA tabs pattern). */
function onTabKey(ev) {
  const i = TABS.findIndex((t) => t.id === tab.value);
  let j = null;
  if (ev.key === 'ArrowRight') j = (i + 1) % TABS.length;
  else if (ev.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length;
  else if (ev.key === 'Home') j = 0;
  else if (ev.key === 'End') j = TABS.length - 1;
  if (j === null) return;
  ev.preventDefault();
  tab.value = TABS[j].id;
  nextTick(() => document.getElementById(`tab-${TABS[j].id}`)?.focus());
}

/* ---------- Event pop-up ---------- */

const openId = ref(null);
const openStep = ref('info');
const openEv = computed(() => eventById(openId.value));
function openEvent(e, step = 'info') {
  openStep.value = step;
  openId.value = e.id;
}
</script>

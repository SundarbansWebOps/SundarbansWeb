<!--
  Home — "Pat". Bengal's patuas sing a story while unrolling a painted scroll
  (a pat) panel by panel; this page is the house's pat. On load the roll drops from the top rod and
  unrolls the title panel: the mangrove plate goes down as black keylines and the colour follows
  behind the brush, a line-drawn tiger walks in and is coloured, the name is brushed on and the
  degree is lettered into a cartouche. Scrolling keeps unrolling: the roll rides the bottom edge of
  the screen, turning and thinning, and each feature is the next panel, its figure painting itself
  in as it arrives. The plates are generated patachitra (landing-assets/v2), split into moving parts
  in pat.js / PatFigure.vue; every number is computed from the site's data.
-->
<template>
  <main
    id="main-content"
    tabindex="-1"
    ref="root"
    class="pat"
    :class="{ rolling, ff, settled, rm: RM }"
    :style="{ '--brush': `url(${ASSET.brush})`, '--brush-v': `url(${ASSET.brushV})` }"
  >
    <div ref="scrollEl" class="scroll" @animationend.self="unrolled">
      <div class="rod" aria-hidden="true" />
      <!-- Desktop: the next event hangs from the rod and unrolls with the scroll. -->
      <EventScroll :rolling="rolling" :still="instant || RM" />

      <div class="paper">
        <!-- ============ Title panel ============ -->
        <section ref="heroEl" class="hero" aria-labelledby="pat-title">
          <div class="band" aria-hidden="true" />
          <div ref="sceneEl" class="scene" aria-hidden="true">
            <img
              class="forest ink"
              :src="ASSET.forest"
              :srcset="forestSet"
              sizes="100vw"
              alt=""
              fetchpriority="high"
            />
            <div class="forest color">
              <img
                ref="forestEl"
                :src="ASSET.forest"
                alt=""
                fetchpriority="high"
                @load="forestLoaded"
              />
              <canvas ref="waterEl" class="water" />
            </div>
            <div class="boat">
              <img class="boat-refl" :src="ASSET.boat" alt="" draggable="false" decoding="async" />
              <img class="boat-art" :src="ASSET.boat" alt="" draggable="false" decoding="async" />
            </div>
            <div class="stage">
              <img class="bank" :src="ASSET.bank" alt="" draggable="false" decoding="async" />
              <div class="walk">
                <div class="bob">
                  <PatFigure
                    :fig="FIGS.tiger"
                    name="tiger"
                    sketch
                    :paint="tigerPaint"
                    :instant="instant"
                    :live="heroLive && settled"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="title">
            <!-- Only the lettering drifts with the pointer. The notice stays out of the moving layer:
                 a composited card re-placed at fractional device pixels on every move is resampled
                 soft (seen at 125% display scale). -->
            <div class="drift">
              <span class="seal" aria-hidden="true">
                <svg viewBox="0 0 100 100">
                  <circle class="ring" cx="50" cy="50" r="46" />
                  <circle class="dots" cx="50" cy="50" r="40.5" />
                </svg>
                <img :src="CREST" alt="" width="64" height="64" />
              </span>
              <h1 id="pat-title">
                <span class="w w1">Sundarbans</span>
                <span class="w w2">House</span>
              </h1>
              <p class="cartouche">
                <svg viewBox="0 0 300 46" preserveAspectRatio="none" aria-hidden="true">
                  <path class="fill" d="M24 3 H276 A20 20 0 0 1 276 43 H24 A20 20 0 0 1 24 3 Z" />
                  <path
                    class="rule"
                    pathLength="1"
                    d="M24 3 H276 A20 20 0 0 1 276 43 H24 A20 20 0 0 1 24 3 Z"
                  />
                </svg>
                <span>IIT Madras BS <i aria-hidden="true" /> since 2021</span>
              </p>
              <p class="line">एकत्र उदयामः, सहैव प्रज्वलामः।</p>
            </div>
            <NextEventNotice class="narrow-only" :ready="settled" :still="RM" />
          </div>
          <div class="band" aria-hidden="true" />
        </section>

        <!-- ============ Resources ============ -->
        <section
          id="pat-resources"
          ref="resEl"
          class="panel res"
          :class="{ seen: seen.res }"
          aria-labelledby="pat-h-res"
        >
          <div class="art">
            <PatFigure
              :fig="FIGS.reader"
              name="reader"
              :paint="seen.res"
              :instant="RM"
              :live="live.res"
            />
          </div>
          <div class="copy">
            <h2 id="pat-h-res" class="brushed">Resources</h2>
            <p class="lede">Every past paper and set of notes, sorted by course and exam.</p>
            <dl class="stats">
              <div v-for="s in STATS.res" :key="s.label">
                <dt>{{ s.label }}</dt>
                <dd>{{ shown[s.key] }}</dd>
              </div>
            </dl>
            <PatSearch />
            <RouterLink class="cta" to="/resources">
              Open Resources <LineIcon name="arrow" />
            </RouterLink>
          </div>
        </section>

        <div class="band" aria-hidden="true" />

        <!-- ============ Events ============ -->
        <section
          id="pat-events"
          ref="evEl"
          class="panel ev flip"
          :class="{ seen: seen.ev, live: live.ev }"
          aria-labelledby="pat-h-ev"
        >
          <div class="art">
            <PatFigure
              :fig="FIGS.drummers"
              name="drummers"
              :paint="seen.ev"
              :instant="RM"
              :live="live.ev"
            />
            <svg class="beat" viewBox="0 0 100 100" aria-hidden="true">
              <circle v-for="k in 3" :key="k" cx="50" cy="50" r="30" :style="{ '--k': k }" />
            </svg>
          </div>
          <div class="copy">
            <h2 id="pat-h-ev" class="brushed">Events</h2>
            <p class="lede">
              Every event the house has run, from talks to tournaments, month by month.
            </p>
            <dl class="stats">
              <div v-for="s in STATS.ev" :key="s.label">
                <dt>{{ s.label }}</dt>
                <dd>{{ shown[s.key] }}</dd>
              </div>
            </dl>
            <RouterLink class="cta" to="/events">
              See the archive <LineIcon name="arrow" />
            </RouterLink>
          </div>
          <div class="posters">
            <PatPosters :live="live.ev" />
          </div>
        </section>

        <div class="band" aria-hidden="true" />

        <!-- ============ House ============ -->
        <section
          id="pat-house"
          ref="houseEl"
          class="panel house"
          :class="{ seen: seen.house }"
          :style="{ '--arrive': arrive }"
          aria-labelledby="pat-h-house"
        >
          <div class="art">
            <PatFigure
              :fig="FIGS.gathering"
              name="gathering"
              :paint="seen.house"
              :instant="RM"
              :live="live.house"
            />
          </div>
          <div class="copy">
            <h2 id="pat-h-house" class="brushed">House</h2>
            <p class="lede">
              Who we are, who runs the house, and the cities where we meet in person.
            </p>
            <dl class="stats">
              <div v-for="s in STATS.house" :key="s.label">
                <dt>{{ s.label }}</dt>
                <dd>{{ shown[s.key] }}</dd>
              </div>
            </dl>
            <h3>Where we meet</h3>
            <ul class="places">
              <li v-for="(r, i) in regions" :key="r.id" :style="{ '--i': i }">
                {{ r.name }} <small class="mono">{{ r.items.length }}</small>
              </li>
            </ul>
            <h3>Upper House Council</h3>
            <ul class="council">
              <li v-for="(pp, i) in upper" :key="pp.id" :style="{ '--i': i }">
                <span class="roundel" aria-hidden="true">
                  <img :src="portrait.card(pp.img)" alt="" loading="lazy" decoding="async" />
                  <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" /></svg>
                </span>
                <b>{{ pp.name }}</b>
                <small>{{ pp.role }}</small>
              </li>
            </ul>
            <RouterLink class="cta" to="/house">
              Meet the house <LineIcon name="arrow" />
            </RouterLink>
          </div>
        </section>

        <div class="band" aria-hidden="true" />

        <!-- ============ Teams ============ -->
        <section
          id="pat-teams"
          ref="teamsEl"
          class="panel teams"
          :class="{ seen: seen.teams, live: live.teams }"
          aria-labelledby="pat-h-teams"
        >
          <div class="copy head">
            <h2 id="pat-h-teams" class="brushed">Teams</h2>
            <p class="lede">
              How the house works: the councils, the communities and the teams behind it.
            </p>
            <dl class="stats">
              <div v-for="s in STATS.teams" :key="s.label">
                <dt>{{ s.label }}</dt>
                <dd>{{ shown[s.key] }}</dd>
              </div>
            </dl>
          </div>
          <div class="art">
            <PatFigure
              :fig="FIGS.rowers"
              name="rowers"
              :paint="seen.teams"
              :instant="RM"
              :live="live.teams"
            />
            <span
              v-for="c in PLACES"
              :key="c.n"
              class="marker"
              :style="{ left: `${c.at[0]}%`, top: `${c.at[1]}%` }"
              aria-hidden="true"
              >{{ c.n }}</span
            >
          </div>
          <ol class="places">
            <li v-for="c in PLACES" :key="c.n" :style="{ '--i': c.n }">
              <span class="num" aria-hidden="true">{{ c.n }}</span>
              <small>{{ c.where }}</small>
              <b
                >{{ c.who }} <span class="mono">{{ c.count }}</span></b
              >
              <p>{{ c.what }}</p>
            </li>
          </ol>
          <RouterLink class="cta" to="/teams#how">
            See how it works <LineIcon name="arrow" />
          </RouterLink>
        </section>

        <div class="band" aria-hidden="true" />

        <!-- ============ Close ============ -->
        <section class="panel close" aria-label="Stay in touch">
          <p>Hear about the next event, meetup and set of notes first.</p>
          <a class="cta wa" :href="WHATSAPP" target="_blank" rel="noopener">
            <LineIcon name="wa" /> Join the WhatsApp channel
          </a>
        </section>
      </div>

      <div v-if="rolling" class="roll intro" aria-hidden="true" />
      <div class="roll end" :class="{ away: scrolled }" aria-hidden="true">
        <span class="cue">Scroll to unroll</span>
      </div>
    </div>
    <EventSheet :list="sheetList" />
  </main>
</template>

<script setup>
import CREST from '../assets/crest.webp';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { takeLaunchCut } from '../lib/launch.js';
import EventScroll from '../components/site/EventScroll.vue';
import EventSheet from '../components/site/EventSheet.vue';
import LineIcon from '../components/site/LineIcon.vue';
import NextEventNotice from '../components/site/NextEventNotice.vue';
import PatFigure from '../components/site/PatFigure.vue';
import PatPosters from '../components/site/PatPosters.vue';
import PatSearch from '../components/site/PatSearch.vue';
import { ASSET, FIGS, FOREST } from '../lib/pat.js';
import { nav } from '../lib/store.js';
import { courses, WHATSAPP } from '../lib/courses.js';
import {
  byId,
  events,
  ev,
  live as liveEvents,
  loadPublicEvents,
  publicCatalog,
  upcoming as upcomingEvents,
  WINGS,
} from '../lib/events.js';
import { meetupCount, photoCount, portrait, regions, upper, lower } from '../lib/house.js';
import { COMMUNITIES, TEAMS } from '../data/teams.js';

const forestSet = `${ASSET.forest800} 800w, ${ASSET.forest} 1400w`;

// The event sheet opened from the next-event notice pages through what is on air and coming up.
// A deep link to any other event still opens, alone.
const happening = computed(() => [...liveEvents, ...upcomingEvents]);
const sheetList = computed(() => {
  if (happening.value.some((e) => e.id === ev.open)) return happening.value;
  return byId[ev.open] ? [byId[ev.open]] : [];
});

// ---- Numbers, all from the data ------------------------------------------------------------
const sum = (f) => courses.reduce((n, c) => n + f(c), 0);
const TOTALS = {
  courses: courses.length,
  papers: sum((c) => c.pyqs.length),
  notes: sum((c) => c.notes.length),
  events: events.length,
  wings: Object.keys(WINGS).length,
  seasons: new Set(events.filter((e) => e.y != null).map((e) => e.y)).size,
  regions: regions.length,
  meetups: meetupCount,
  photos: photoCount,
  seats: upper.length + lower.length,
  communities: COMMUNITIES.length,
  teams: TEAMS.length,
};
const STATS = {
  res: [
    { key: 'courses', label: 'courses' },
    { key: 'papers', label: 'past papers' },
    { key: 'notes', label: 'sets of notes' },
  ],
  ev: [
    { key: 'events', label: 'events' },
    { key: 'wings', label: 'wings' },
    { key: 'seasons', label: 'seasons' },
  ],
  house: [
    { key: 'regions', label: 'regions' },
    { key: 'meetups', label: 'meetups' },
    { key: 'photos', label: 'photos' },
  ],
  teams: [
    { key: 'seats', label: 'council seats' },
    { key: 'communities', label: 'communities' },
    { key: 'teams', label: 'teams' },
  ],
};

// The snake-boat as the house: who sits where. `at` is the marker's spot on the plate (%).
const names = (list) => list.map((x) => x.name).join(', ');
const PLACES = [
  {
    n: 1,
    at: [86, 9],
    where: 'At the helm',
    who: 'Upper House Council',
    count: upper.length,
    what: `${upper.map((p) => p.role).join(', ')}: they steer the house.`,
  },
  {
    n: 2,
    at: [38, 91],
    where: 'At the oars',
    who: 'Lower House Council',
    count: lower.length,
    what: 'A coordinator for each region, pulling together.',
  },
  {
    n: 3,
    at: [9.5, 30],
    where: 'On the drum',
    who: 'Communities',
    count: COMMUNITIES.length,
    what: `${names(COMMUNITIES)} set the beat with events.`,
  },
  {
    n: 4,
    at: [63, 74],
    where: 'In the hull',
    who: 'Teams',
    count: TEAMS.length,
    what: `${names(TEAMS)} keep the boat seen and afloat.`,
  },
];

// ---- Intro ----------------------------------------------------------------------------------
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const RM = ref(motionPreference.matches);
// Straight from the launch film, whose last frame is this page composed: no intro.
const composed = RM.value || takeLaunchCut();
const rolling = ref(!composed);
const ff = ref(composed);
const instant = ref(composed);
const settled = ref(composed);
const tigerPaint = ref(composed);
const timers = [];
const later = (ms, f) => timers.push(setTimeout(f, ms));

function unrolled(e) {
  if (e.animationName.includes('unroll')) rolling.value = false;
}
// Any input during the intro jumps straight to the composed title panel.
function fastForward() {
  timers.forEach(clearTimeout);
  ff.value = true;
  rolling.value = false;
  instant.value = true;
  tigerPaint.value = true;
  settled.value = true;
  dropIntroListeners();
}
const INTRO_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchmove'];
function dropIntroListeners() {
  for (const t of INTRO_EVENTS) removeEventListener(t, fastForward, true);
}

// ---- Panels: paint once when they arrive, loop only while on screen ---------------------------
const seen = reactive({ res: RM.value, ev: RM.value, house: RM.value, teams: RM.value });
const live = reactive({ res: false, ev: false, house: false, teams: false });
const shown = reactive(
  Object.fromEntries(Object.keys(TOTALS).map((k) => [k, RM.value ? TOTALS[k] : 0]))
);
const root = ref(null);
const scrollEl = ref(null);
const heroEl = ref(null);
const sceneEl = ref(null);
const resEl = ref(null);
const evEl = ref(null);
const houseEl = ref(null);
const teamsEl = ref(null);
const heroLive = ref(true);
const arrive = ref(RM.value ? 1 : 0);
const scrolled = ref(false);

const countRafs = new Set();
function countUp(id) {
  const t0 = performance.now();
  const keys = STATS[id].map((s) => s.key);
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / 1100);
    const e = 1 - (1 - k) ** 3;
    for (const key of keys) shown[key] = Math.round(TOTALS[key] * e);
    countRafs.delete(raf);
    if (k < 1) {
      raf = requestAnimationFrame(tick);
      countRafs.add(raf);
    }
  };
  let raf = requestAnimationFrame(tick);
  countRafs.add(raf);
}

let io;
let heroIo;
function watchPanels() {
  const els = { res: resEl.value, ev: evEl.value, house: houseEl.value, teams: teamsEl.value };
  const idOf = new Map(Object.entries(els).map(([k, el]) => [el, k]));
  io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const id = idOf.get(en.target);
        live[id] = en.isIntersecting && !document.hidden && !RM.value;
        if (en.isIntersecting && en.intersectionRatio > 0.18 && !seen[id]) {
          seen[id] = true;
          if (!RM.value) countUp(id);
        }
      }
    },
    { threshold: [0, 0.18, 0.4] }
  );
  Object.values(els).forEach((el) => io.observe(el));
  heroIo = new IntersectionObserver(([en]) => {
    heroLive.value = en.isIntersecting;
    kickWater();
  });
  heroIo.observe(heroEl.value);
}

// ---- Scroll: the roll turns and thins; the House boats glide in -----------------------------
let scrollRaf = 0;
function onScroll() {
  if (!scrollRaf) scrollRaf = requestAnimationFrame(applyScroll);
}
function applyScroll() {
  scrollRaf = 0;
  const el = scrollEl.value;
  if (!el) return;
  const y = scrollY;
  const max = Math.max(1, el.offsetHeight - innerHeight);
  scrolled.value = y > 40;
  el.style.setProperty('--spin', `${(y * 0.9).toFixed(1)}px`);
  el.style.setProperty('--thin', (1 - Math.min(1, y / max) * 0.32).toFixed(3));
  if (!RM.value && houseEl.value) {
    const r = houseEl.value.getBoundingClientRect();
    const k = (innerHeight - r.top) / (innerHeight * 0.75);
    arrive.value = Math.max(0, Math.min(1, k)).toFixed(3);
  }
}

// ---- Pointer: the tiger looks toward it; painted things shift a hair -------------------------
let ptrRaf = 0;
let ptr = null;
function onPointer(e) {
  ptr = e;
  if (!ptrRaf) ptrRaf = requestAnimationFrame(applyPointer);
}
function applyPointer() {
  ptrRaf = 0;
  const hero = heroEl.value;
  if (!hero || !heroLive.value || !ptr) return;
  const r = hero.getBoundingClientRect();
  const mx = ((ptr.clientX - r.left) / r.width) * 2 - 1;
  const my = ((ptr.clientY - r.top) / r.height) * 2 - 1;
  hero.style.setProperty('--mx', Math.max(-1, Math.min(1, mx)).toFixed(3));
  hero.style.setProperty('--my', Math.max(-1, Math.min(1, my)).toFixed(3));
  const head = hero.querySelector('.tiger .pt-head');
  if (head) {
    const h = head.getBoundingClientRect();
    const look = (h.top + h.height * 0.55 - ptr.clientY) / 320;
    hero.style.setProperty('--look', Math.max(-1, Math.min(1, look)).toFixed(3));
  }
}

// ---- Water: the plate's river rows ripple sideways; the boat is a sprite that rocks in CSS -----
const RIPPLE_Y = 805; // plate y where the river rows start (below the boat's waterline)
const forestEl = ref(null);
const waterEl = ref(null);
let geo = null;
let waterRaf = 0;
let forestReady = false;
let disposed = false;
let ro;
function forestLoaded() {
  (forestEl.value?.decode?.() ?? Promise.resolve())
    .catch(() => {})
    .finally(() => {
      if (disposed) return;
      forestReady = !!forestEl.value?.naturalWidth;
      measureWater();
      kickWater();
    });
}
function measureWater() {
  const scene = sceneEl.value;
  const cv = waterEl.value;
  if (!scene || !cv) return;
  const W = scene.clientWidth;
  const H = scene.clientHeight;
  if (!W || !H) {
    geo = null;
    return;
  }
  const s = Math.max(W / FOREST.w, H / FOREST.h); // object-fit: cover, anchored bottom
  const ox = (W - FOREST.w * s) / 2;
  const oy = H - FOREST.h * s;
  const top = oy + RIPPLE_Y * s;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  cv.style.top = `${top}px`;
  cv.style.height = `${H - top}px`;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round((H - top) * dpr);
  geo = { s, ox, oy, top, dpr, W, H };
  // The boat sprite is placed in plate coordinates, so it tracks object-fit: cover.
  const b = FOREST.boat;
  scene.style.setProperty('--boat-x', `${ox + b.x * s}px`);
  scene.style.setProperty('--boat-y', `${oy + b.y * s}px`);
  scene.style.setProperty('--boat-w', `${b.w * s}px`);
}
function kickWater() {
  if (RM.value || waterRaf || !forestReady || !heroLive.value || document.hidden) return;
  waterRaf = requestAnimationFrame(drawWater);
}
function drawWater(t) {
  waterRaf = 0;
  const cv = waterEl.value;
  const img = forestEl.value;
  if (disposed || RM.value || !cv || !img || !geo || !heroLive.value || document.hidden) return;
  // Responsive srcset changes can briefly reset naturalWidth while a new source loads.
  // Keep the original plate visible and wait for its load event before painting again.
  if (!img.complete || !img.naturalWidth || !img.naturalHeight || !cv.width || !cv.height) return;
  const ctx = cv.getContext('2d');
  const { s, ox, oy, top, dpr, W } = geo;
  const k = img.naturalWidth / FOREST.w; // source px per plate px
  const sec = t / 1000;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, cv.height / dpr);
  // River rows below the boat's waterline: each 2-plate-px row slides on its own sine.
  const y0 = RIPPLE_Y;
  for (let y = y0; y < FOREST.h; y += 2) {
    const amp = Math.min(1, (y - y0) / 40) * 2.4;
    const dx = Math.sin(sec * 1.25 + y * 0.075) * amp + Math.sin(sec * 0.6 + y * 0.021) * amp * 0.5;
    ctx.globalAlpha = Math.min(1, (y - y0) / 24);
    ctx.drawImage(
      img,
      0,
      y * k,
      img.naturalWidth,
      2 * k,
      ox + dx,
      oy + y * s - top,
      FOREST.w * s,
      2 * s + 0.6
    );
  }
  ctx.globalAlpha = 1;
  waterRaf = requestAnimationFrame(drawWater);
}

function onVisibility() {
  const els = { res: resEl.value, ev: evEl.value, house: houseEl.value, teams: teamsEl.value };
  for (const [id, el] of Object.entries(els)) {
    const r = el.getBoundingClientRect();
    live[id] = !RM.value && !document.hidden && r.bottom > 0 && r.top < innerHeight;
  }
  kickWater();
}
function onMotionChange(e) {
  RM.value = e.matches;
  if (RM.value) {
    fastForward();
    for (const id of Object.keys(seen)) seen[id] = true;
    for (const raf of countRafs) cancelAnimationFrame(raf);
    countRafs.clear();
    Object.assign(shown, TOTALS);
    arrive.value = 1;
    cancelAnimationFrame(waterRaf);
    waterRaf = 0;
  }
  onVisibility();
}

onMounted(() => {
  if (!publicCatalog.ready) loadPublicEvents();
  if (!composed) {
    for (const t of INTRO_EVENTS)
      addEventListener(t, fastForward, { capture: true, passive: true });
    later(1250, () => (tigerPaint.value = true));
    later(2700, () => {
      settled.value = true;
      dropIntroListeners();
    });
    later(1700, () => (rolling.value = false)); // in case animationend never fires
  }
  motionPreference.addEventListener('change', onMotionChange);
  watchPanels();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  ro = new ResizeObserver(() => {
    measureWater();
    kickWater();
  });
  ro.observe(sceneEl.value);
  if (forestEl.value?.complete && forestEl.value.naturalWidth) forestLoaded();
  applyScroll();
});

onBeforeUnmount(() => {
  disposed = true;
  motionPreference.removeEventListener('change', onMotionChange);
  timers.forEach(clearTimeout);
  dropIntroListeners();
  io?.disconnect();
  heroIo?.disconnect();
  ro?.disconnect();
  removeEventListener('scroll', onScroll);
  removeEventListener('resize', onScroll);
  removeEventListener('pointermove', onPointer);
  document.removeEventListener('visibilitychange', onVisibility);
  cancelAnimationFrame(scrollRaf);
  cancelAnimationFrame(ptrRaf);
  cancelAnimationFrame(waterRaf);
  for (const raf of countRafs) cancelAnimationFrame(raf);
  countRafs.clear();
  waterRaf = 0;
});
</script>

<style scoped>
@property --u {
  syntax: '<length>';
  inherits: true;
  initial-value: 0px;
}

/* ---- Scroll palette: pigments on paper. The painting ignores the site theme; only the nav follows it. ---- */
.pat {
  --pp: #efdfc4;
  --pcard: #f7ecd8;
  --pi: #1d1915;
  --pi2: #54483c;
  --pv: #a52d16;
  --pmari: #eaa53c;
  --pmari-soft: #f6dcae;
  --art-filter: none;
  --beat: 0.7s;
  --stroke: 2.4s;
  --edge-w: 14px;
  --tab-h: 0px;
  --rod-h: 22px;
  --roll-h: 46px;
  --band-h: 22px;
  --col: 100%;
  --panel-gut: clamp(36px, 6vw, 120px);
  --hero-h: max(520px, calc(100svh - var(--nav-h) - var(--tab-h) - var(--rod-h)));
  position: relative;
  padding: 0 0 36px;
  overflow-x: clip;
  background: var(--paper);
}
.scroll {
  position: relative;
  width: var(--col);
  margin: 0 auto;
  padding-top: 0;
}

/* ---- Paper: colour, grain and the lotus borders, all under the lamp filter in dark ---- */
.paper {
  position: relative;
  isolation: isolate;
  color: var(--pi);
}
.paper::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    url('../assets/pat/edge.webp') left top / var(--edge-w) auto repeat-y,
    url('../assets/pat/edge.webp') right top / var(--edge-w) auto repeat-y,
    url('../assets/pat/grain.webp') 0 0 / 512px 512px,
    var(--pp);
  background-blend-mode: normal, normal, multiply, normal;
  filter: var(--art-filter);
}
.rolling .paper {
  clip-path: inset(0 -40px calc(100% - var(--u)) -40px);
}
.rolling .scroll {
  animation: unroll 1.45s cubic-bezier(0.55, 0.02, 0.25, 1) both;
}
@keyframes unroll {
  0% {
    --u: 0px;
  }
  82% {
    --u: calc(var(--hero-h) + 10px);
  }
  100% {
    --u: var(--hero-h);
  }
}

.band {
  height: var(--band-h);
  margin: 0 var(--edge-w);
  background: url('../assets/pat/band.webp') center / auto 100% repeat-x;
  filter: var(--art-filter);
}

/* ---- The rod at the top and the roll that carries the rest of the scroll ---- */
.rod,
.roll {
  position: relative;
  z-index: 4;
  margin: 0;
  border-radius: 99px;
  filter: var(--art-filter);
}
.rod {
  height: var(--rod-h);
  background: linear-gradient(
    #3a2412 0,
    #8a4b1c 18%,
    #d99a4a 40%,
    #f3c47b 50%,
    #b8702c 72%,
    #5a3214 100%
  );
  box-shadow: 0 6px 10px -6px rgb(40 20 5 / 0.6);
}
.rod::before,
.rod::after,
.roll::before,
.roll::after {
  content: '';
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 18px;
  border-radius: 7px;
  border: 2px solid #1d1915;
  background:
    linear-gradient(
      90deg,
      transparent 5px,
      #1d1915 5px 7px,
      transparent 7px 11px,
      #1d1915 11px 13px,
      transparent 13px
    ),
    linear-gradient(#7d1e0c, #c9391d 35%, #f06a3f 50%, #b8341b 70%, #6a1a0a);
}
.rod::before,
.roll::before {
  left: -2px;
}
.rod::after,
.roll::after {
  right: -2px;
}
/* The roll: layers of wound paper (the turning lines) with its lotus edges showing at the ends. */
.roll {
  height: var(--roll-h);
  pointer-events: none;
  background:
    linear-gradient(
      rgb(40 22 8 / 0.55),
      rgb(40 22 8 / 0.05) 26%,
      rgb(255 250 235 / 0.4) 40%,
      rgb(40 22 8 / 0) 58%,
      rgb(40 22 8 / 0.5) 100%
    ),
    linear-gradient(
      90deg,
      transparent 14px,
      #c9391d 14px 18px,
      #eaa53c 18px 24px,
      #f5ead0 24px 34px,
      #eaa53c 34px 40px,
      transparent 40px calc(100% - 40px),
      #eaa53c calc(100% - 40px) calc(100% - 34px),
      #f5ead0 calc(100% - 34px) calc(100% - 24px),
      #eaa53c calc(100% - 24px) calc(100% - 18px),
      #c9391d calc(100% - 18px) calc(100% - 14px),
      transparent calc(100% - 14px)
    ),
    repeating-linear-gradient(
        rgb(90 60 30 / 0) 0 5px,
        rgb(90 60 30 / 0.22) 5px 6px,
        rgb(90 60 30 / 0) 6px 11px
      )
      0 var(--spin, 0px) / 100% 11px,
    #ecdcbc;
  box-shadow:
    0 -14px 18px -12px rgb(40 22 8 / 0.35),
    0 12px 16px -8px rgb(20 10 0 / 0.45);
}
.roll.intro {
  position: absolute;
  top: var(--rod-h);
  left: 0;
  right: 0;
  transform: translateY(calc(var(--u) - var(--roll-h)));
}
.roll.intro {
  --spin: calc(var(--u) * 0.9);
}
.roll.end {
  position: sticky;
  bottom: var(--tab-h);
  margin-top: calc(-1 * var(--roll-h));
  transform-origin: 50% 100%;
  transform: scaleY(var(--thin, 1));
}
.rolling .roll.end {
  visibility: hidden;
}
.cue {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #3a2412;
  transform: scaleY(calc(1 / var(--thin, 1)));
  transition: opacity 0.5s;
}
.away .cue {
  opacity: 0;
}

/* ============ Title panel ============ */
.hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: var(--band-h) minmax(0, 1fr) var(--band-h);
  height: var(--hero-h);
  --mx: 0;
  --my: 0;
}
.hero > .band:first-child {
  grid-area: 1 / 1;
}
.hero > .band:last-child {
  grid-area: 3 / 1;
}
.scene {
  position: relative;
  grid-column: 1;
  grid-row: 2;
  min-width: 0;
  min-height: 0;
  margin: 0 var(--edge-w);
  overflow: hidden;
  filter: var(--art-filter);
}
.scene::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse 48% 46% at 50% 5%, var(--pp) 38%, transparent 100%);
}
.forest {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.forest img,
img.forest {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 100%;
}
img.forest.ink {
  position: absolute;
  inset: 0;
  filter: url(#pat-ink);
}
.water {
  position: absolute;
  left: 0;
  width: 100%;
  pointer-events: none;
}
/* The Lounge's boatman, placed by measureWater() in plate coordinates. The wrapper glides in from
   the left; the art rocks on the swell. The hull sinks below the waterline (82% of the sprite) and
   is mirrored there, broken into strokes like the plate's ripples, so the boat sits in the water. */
.boat {
  position: absolute;
  left: var(--boat-x, 30%);
  top: var(--boat-y, 60%);
  width: var(--boat-w, 30%);
  pointer-events: none;
}
.pat:not(.ff) .boat {
  animation: boat-in 1.6s var(--ease-out) 0.6s both;
}
.boat img {
  display: block;
  width: 100%;
  height: auto;
}
.boat-art {
  position: relative;
  transform-origin: 50% 82%;
  -webkit-mask: linear-gradient(var(--ink) 80%, transparent 93%);
  mask: linear-gradient(var(--ink) 80%, transparent 93%);
  animation: boat-rock 4s ease-in-out infinite;
}
.boat-refl {
  position: absolute;
  inset: 0;
  transform: scaleY(-0.7);
  transform-origin: 50% 82%;
  opacity: 0.5;
  mix-blend-mode: multiply;
  -webkit-mask:
    linear-gradient(transparent 30%, var(--ink) 74%, var(--ink) 80%, transparent 83%),
    repeating-linear-gradient(var(--ink) 0 3px, transparent 3px 6px);
  -webkit-mask-composite: source-in;
  mask:
    linear-gradient(transparent 30%, var(--ink) 74%, var(--ink) 80%, transparent 83%),
    repeating-linear-gradient(var(--ink) 0 3px, transparent 3px 6px);
  mask-composite: intersect;
}
@keyframes boat-in {
  from {
    translate: -40% 0;
    opacity: 0;
  }
  to {
    translate: 0 0;
    opacity: 1;
  }
}
@keyframes boat-rock {
  0%,
  100% {
    transform: translateY(0) rotate(0);
  }
  50% {
    transform: translateY(-1.5px) rotate(0.6deg);
  }
}
.pat:not(.ff) .forest.color {
  -webkit-mask: var(--brush-v) no-repeat 0 100% / 100% 250%;
  mask: var(--brush-v) no-repeat 0 100% / 100% 250%;
  animation: wipe-v 1.35s cubic-bezier(0.5, 0.05, 0.3, 1) 0.5s both;
}
@keyframes wipe-v {
  to {
    -webkit-mask-position: 0 0;
    mask-position: 0 0;
  }
}
.pat.settled .forest.color {
  animation: none;
  -webkit-mask: none;
  mask: none;
}
.pat.settled .w {
  animation: none;
  -webkit-mask: none;
  mask: none;
}
.settled img.forest.ink {
  display: none;
}

/* The tiger: walks in as a line drawing, stops on the bank, is coloured in. The stage is sized by
   its width; the figure fills it. The bank is a sibling before .walk, so it stays put while the tiger
   walks onto it; its mud top sits at the paw line. Numbers are fractions of the figure's width. */
.stage {
  position: absolute;
  left: 56%;
  bottom: 17%;
  width: 13%;
  transform: translate(calc(var(--mx) * 9px), calc(var(--my) * 4px));
  transition: transform 0.8s var(--ease-out);
}
.bank {
  position: absolute;
  left: 50%;
  bottom: -16%;
  width: 140%;
  height: auto;
  transform: translateX(-50%);
  /* Toned down from the sprite's brighter ochre to sit with the plate's earth. */
  filter: saturate(0.8) brightness(0.9);
  pointer-events: none;
}
.pat:not(.ff) .bank {
  animation: bank-in 0.9s var(--ease-out) 0.4s both;
}
@keyframes bank-in {
  from {
    opacity: 0;
  }
}
.pat:not(.ff) .walk {
  animation: walk 1.9s cubic-bezier(0.3, 0.1, 0.25, 1) 0.55s both;
}
@keyframes walk {
  from {
    transform: translateX(170%);
  }
}
.pat:not(.ff) .bob {
  animation: stride 0.4s ease-in-out 0.55s 4 alternate both;
}
@keyframes stride {
  from {
    transform: translateY(0) rotate(0);
  }
  to {
    transform: translateY(-2.2%) rotate(-0.7deg);
  }
}

/* Title: crest pressed like a seal, the name brushed on, the degree lettered in a cartouche. */
.title {
  position: relative;
  grid-row: 2;
  grid-column: 1;
  align-self: start;
  justify-self: center;
  display: grid;
  justify-items: center;
  gap: 10px;
  margin-top: clamp(22px, 5vh, 52px);
  padding: 0 20px;
  text-align: center;
  /* Keeps the stacking context the drifting transform used to create for the title. */
  isolation: isolate;
}
/* The card under the motto is for phones and tablets; desktop has EventScroll on the rod. */
.title > .narrow-only {
  display: none;
}
@media (max-width: 1020px) {
  .title > .narrow-only {
    display: grid;
  }
}
.drift {
  display: grid;
  justify-items: center;
  gap: inherit;
  transform: translate(calc(var(--mx) * -3px), calc(var(--my) * -2px));
  transition: transform 0.8s var(--ease-out);
}
.seal {
  position: relative;
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  filter: var(--art-filter);
}
.seal svg {
  position: absolute;
  inset: 0;
  overflow: visible;
}
.seal .ring {
  fill: #eaa53c;
  stroke: #1d1915;
  stroke-width: 3;
}
.seal .dots {
  fill: none;
  stroke: #b8341b;
  stroke-width: 4.5;
  stroke-linecap: round;
  stroke-dasharray: 0 8.48;
}
.seal img {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2.5px solid #1d1915;
  background: #111;
}
.pat:not(.ff) .seal {
  animation: stamp 0.55s cubic-bezier(0.3, 1.6, 0.5, 1) 1.35s both;
}
@keyframes stamp {
  from {
    opacity: 0;
    transform: scale(1.5) rotate(-14deg);
  }
  40% {
    opacity: 1;
  }
}
h1 {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  column-gap: 0.26em;
  font-size: clamp(44px, 5.6vw, 84px);
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: -0.035em;
  color: var(--pi);
}
.w2 {
  color: var(--pv);
}
.w,
.brushed {
  display: inline-block;
  padding: 0.04em 0.06em 0.1em;
}
.pat:not(.ff) .w {
  -webkit-mask: var(--brush) no-repeat 100% 0 / 250% 100%;
  mask: var(--brush) no-repeat 100% 0 / 250% 100%;
  animation: wipe-h 0.75s cubic-bezier(0.5, 0.05, 0.35, 1) 0.95s both;
}
.pat:not(.ff) .w2 {
  animation-delay: 1.35s;
  animation-duration: 0.6s;
}
@keyframes wipe-h {
  to {
    -webkit-mask-position: 0 0;
    mask-position: 0 0;
  }
}
.cartouche {
  position: relative;
  margin: 2px 0 0;
  padding: 11px 34px 12px;
  font-size: clamp(14px, 1.35vw, 17px);
  font-weight: 650;
  letter-spacing: 0.02em;
  color: var(--pi);
}
.cartouche svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.cartouche .fill {
  fill: var(--pmari-soft);
}
.cartouche .rule {
  fill: none;
  stroke: var(--pi);
  stroke-width: 2.2;
  vector-effect: non-scaling-stroke;
  stroke-dasharray: none;
}
.cartouche span {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.cartouche i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pv);
}
.pat:not(.ff) .cartouche .rule {
  /* Dashes must scale with the path during the reveal; restore the fixed-width
     solid stroke afterward so neither the delay nor the finish has a stray arc. */
  animation: draw 0.9s cubic-bezier(0.5, 0, 0.3, 1) 1.55s backwards;
}
@keyframes draw {
  from {
    vector-effect: none;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
  }
  to {
    vector-effect: none;
    stroke-dasharray: 1;
    stroke-dashoffset: 0;
  }
}
.pat:not(.ff) .cartouche .fill,
.pat:not(.ff) .cartouche span {
  animation: fade 0.5s ease-out 2.1s both;
}
@keyframes fade {
  from {
    opacity: 0;
  }
}
.line {
  max-width: 34ch;
  margin: 2px 0 0;
  font-size: clamp(15px, 1.4vw, 18px);
  font-weight: 500;
  line-height: 1.4;
  color: var(--pi2);
}
.pat:not(.ff) .line {
  animation: rise-in 0.6s var(--ease-out) 2.25s both;
}
@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

/* ============ Feature panels ============ */
.panel {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  align-items: center;
  gap: 32px clamp(40px, 7vw, 132px);
  padding: clamp(64px, 7vw, 112px) var(--panel-gut);
}
.panel.flip .art {
  order: 2;
}
.art {
  position: relative;
  width: 96%;
  max-width: 650px;
  justify-self: center;
}
.copy {
  max-width: 600px;
}
.copy {
  display: grid;
  justify-items: start;
  gap: 18px;
}
h2 {
  margin: 0 0 -6px -0.06em;
  font-size: clamp(40px, 4.6vw, 66px);
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: -0.035em;
  color: var(--pi);
}
h2::after {
  content: '';
  display: block;
  width: 1.3em;
  height: 0.14em;
  margin-top: 0.1em;
  border-radius: 99px;
  background:
    radial-gradient(circle, var(--pi) 0.045em, transparent 0.05em) 0 50% / 0.2em 100% repeat-x,
    transparent;
  opacity: 0.8;
}
.panel .brushed {
  -webkit-mask: var(--brush) no-repeat 100% 0 / 250% 100%;
  mask: var(--brush) no-repeat 100% 0 / 250% 100%;
}
.panel.seen .brushed {
  animation: wipe-h 0.8s cubic-bezier(0.5, 0.05, 0.35, 1) 0.25s both;
}
.rm .panel .brushed {
  -webkit-mask: none;
  mask: none;
  animation: none;
}
.lede {
  max-width: 30ch;
  margin: 0;
  font-size: clamp(18px, 1.6vw, 22px);
  font-weight: 550;
  line-height: 1.35;
  color: var(--pi);
}
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 30px;
  margin: 2px 0 4px;
}
.stats div {
  display: flex;
  flex-direction: column-reverse;
}
.stats dd {
  margin: 0;
  font-size: clamp(30px, 3vw, 40px);
  font-weight: 750;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--pv);
}
.stats dt {
  margin-top: 4px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--pi2);
}
.copy > * {
  transition:
    opacity 0.6s var(--ease-out),
    transform 0.6s var(--ease-out);
}
.panel:not(.seen) .copy > :not(h2) {
  opacity: 0;
  transform: translateY(12px);
}
.panel.seen .copy > :nth-child(2) {
  transition-delay: 0.35s;
}
.panel.seen .copy > :nth-child(3) {
  transition-delay: 0.45s;
}
.panel.seen .copy > :nth-child(n + 4) {
  transition-delay: 0.55s;
}
.res .find {
  width: 100%;
  max-width: 520px;
}

/* Painted button: ink outline, marigold paint, a lifted shadow drawn in ink. */
.cta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 50px;
  padding: 0 22px 0 24px;
  border: 2px solid var(--pi);
  border-radius: 99px;
  background: var(--pmari);
  color: #1d1915;
  font-size: 16px;
  font-weight: 700;
  text-decoration: none;
  box-shadow: 3px 4px 0 var(--pi);
  transition:
    transform 0.2s var(--ease-spring),
    box-shadow 0.2s var(--ease-spring);
}
.cta .ic {
  transition: transform 0.25s var(--ease-spring);
}
.cta:hover {
  transform: translate(-1px, -2px);
  box-shadow: 5px 7px 0 var(--pi);
}
.cta:hover .ic {
  transform: translateX(4px);
}
.cta:active {
  transform: translate(2px, 3px);
  box-shadow: 1px 1px 0 var(--pi);
}
.cta:focus-visible {
  outline: 3px solid var(--pv);
  outline-offset: 3px;
}

/* Events: the dhak's rings keep the beat; the poster line hangs across the panel. */
.beat {
  position: absolute;
  left: 27.2%;
  top: 53%;
  width: 34%;
  translate: -50% -50%;
  overflow: visible;
  pointer-events: none;
}
.beat circle {
  fill: none;
  stroke: #b8341b;
  stroke-width: 2.5;
  stroke-dasharray: 5 7;
  opacity: 0;
  transform-origin: 50% 50%;
  filter: var(--art-filter);
}
.ev.live .beat circle {
  animation: ring calc(var(--beat) * 2) cubic-bezier(0.2, 0.6, 0.3, 1) infinite;
  animation-delay: calc(var(--k) * var(--beat) * 0.66 - var(--beat) * 0.66);
}
@keyframes ring {
  0% {
    opacity: 0.85;
    transform: scale(0.35);
  }
  60%,
  100% {
    opacity: 0;
    transform: scale(1.25);
  }
}
.ev {
  padding-bottom: clamp(32px, 3.5vw, 56px);
}
/* Last in order, so the flipped art stays beside the copy instead of wrapping under the line. */
.posters {
  order: 3;
  grid-column: 1 / -1;
  margin: 10px calc(var(--edge-w) - var(--panel-gut)) 0;
}

/* House */
.house {
  --arrive: 1;
}
h3 {
  margin: 8px 0 -6px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pv);
}
.places {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.places li {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 5px 11px 6px;
  border: 1.5px solid var(--pi);
  border-radius: 6px 14px 6px 14px;
  background: var(--pcard);
  font-size: 14.5px;
  font-weight: 600;
}
.places small {
  font-size: 12px;
  color: var(--pv);
}
.council {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.council li {
  display: grid;
  justify-items: center;
  gap: 2px;
  width: 112px;
  text-align: center;
}
.roundel {
  position: relative;
  width: 86px;
  height: 86px;
  margin-bottom: 6px;
  padding: 7px;
  border-radius: 50%;
  border: 2.5px solid var(--pi);
  background:
    radial-gradient(circle, #b8341b 1.6px, transparent 2px) 0 0 / 8px 8px,
    #eaa53c;
}
.roundel img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid var(--pi);
  object-fit: cover;
  object-position: 50% 28%;
  background: var(--pcard);
}
.roundel svg {
  position: absolute;
  inset: -9px;
  width: calc(100% + 18px);
  height: calc(100% + 18px);
  overflow: visible;
}
.roundel circle {
  fill: none;
  stroke: var(--pi);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-dasharray: 0 7.4;
}
.council b {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
}
.council small {
  font-size: 12.5px;
  color: var(--pi2);
}

/* Teams: the whole house in one boat. */
.teams {
  grid-template-columns: minmax(0, 1fr);
  justify-items: center;
  text-align: center;
}
.teams .copy {
  justify-items: center;
}
.teams .lede {
  max-width: 36ch;
}
.teams .art {
  width: min(100%, 1000px);
  margin-top: 6px;
}
.teams h2::after {
  margin-inline: auto;
}
.marker {
  position: absolute;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  margin: -15px 0 0 -15px;
  border: 2px solid var(--pi);
  border-radius: 50%;
  background: #eaa53c;
  color: #1d1915;
  font-size: 14px;
  font-weight: 800;
  box-shadow: 2px 3px 0 var(--pi);
  opacity: 0;
  transform: scale(0.4);
  transition:
    opacity 0.4s,
    transform 0.5s var(--ease-spring);
}
.teams.seen .marker {
  opacity: 1;
  transform: none;
  transition-delay: 1.4s;
}
.places {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px 26px;
  width: 100%;
  margin: 8px 0 6px;
  padding: 0;
  list-style: none;
  text-align: left;
}
.places li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-content: start;
  column-gap: 12px;
  transition:
    opacity 0.6s var(--ease-out),
    transform 0.6s var(--ease-out);
  transition-delay: calc(0.6s + var(--i) * 90ms);
}
.teams:not(.seen) .places li {
  opacity: 0;
  transform: translateY(12px);
}
.places .num {
  grid-row: span 3;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 2px solid var(--pi);
  border-radius: 50%;
  background: var(--pmari);
  color: #1d1915;
  font-size: 14px;
  font-weight: 800;
}
.places small {
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pv);
}
.places b {
  font-size: 17px;
  font-weight: 750;
  line-height: 1.25;
}
.places b .mono {
  font-size: 14px;
  color: var(--pv);
}
.places p {
  margin: 4px 0 0;
  font-size: 14.5px;
  line-height: 1.45;
  color: var(--pi2);
}

/* Close: the last panel before the roll. */
.close {
  grid-template-columns: minmax(0, 1fr);
  justify-items: center;
  gap: 18px;
  padding-block: 56px 96px;
  text-align: center;
}
.close p {
  max-width: 26ch;
  margin: 0;
  font-size: clamp(22px, 2.2vw, 30px);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}
.cta.wa .ic {
  width: 20px;
  height: 20px;
}

/* ============ Phones ============ */
@media (max-width: 1020px) {
  .panel {
    padding-inline: calc(var(--edge-w) + 28px);
    column-gap: 36px;
  }
  .places {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .posters {
    margin-inline: -28px;
  }
}
@media (max-width: 760px) {
  .pat {
    --edge-w: 6px;
    --tab-h: calc(64px + env(safe-area-inset-bottom));
    --rod-h: 16px;
    --roll-h: 34px;
    --band-h: 16px;
    padding-bottom: 100px;
  }
  .rod,
  .roll {
    margin: 0;
  }
  .rod::before,
  .rod::after,
  .roll::before,
  .roll::after {
    width: 12px;
    border-width: 1.5px;
    background:
      linear-gradient(90deg, transparent 3px, #1d1915 3px 5px, transparent 5px),
      linear-gradient(#7d1e0c, #c9391d 35%, #f06a3f 50%, #b8341b 70%, #6a1a0a);
  }
  .roll {
    background-size:
      100% 100%,
      100% 100%,
      100% 11px,
      auto;
  }
  .cue {
    font-size: 10.5px;
  }
  .hero {
    grid-template-rows: var(--band-h) auto minmax(0, 1fr) var(--band-h);
  }
  .hero > .band:last-child {
    grid-row: 4;
  }
  .title {
    grid-row: 2;
    margin-top: 22px;
    gap: 8px;
  }
  .seal {
    width: 68px;
    height: 68px;
  }
  .seal img {
    width: 52px;
    height: 52px;
  }
  h1 {
    font-size: clamp(40px, 12.4vw, 54px);
    flex-direction: column;
    align-items: center;
  }
  .scene::after {
    background: none;
  }
  .scene {
    grid-row: 3;
    margin-top: 12px;
  }
  .stage {
    left: auto;
    right: 8%;
    width: 24%;
    bottom: 14%;
  }
  .panel {
    /* minmax(0, …): a bare 1fr grows to the poster line's scroll width and pushes the art off-screen. */
    grid-template-columns: minmax(0, 1fr);
    gap: 22px;
    padding: 44px calc(var(--edge-w) + 16px) 52px;
  }
  .panel.flip .art {
    order: 0;
  }
  .ev .art {
    order: 0;
  }
  .posters {
    margin-inline: -16px;
  }
  .places {
    grid-template-columns: minmax(0, 1fr);
  }
  .marker {
    width: 24px;
    height: 24px;
    margin: -12px 0 0 -12px;
    font-size: 12px;
  }
  .close {
    padding-block: 40px 72px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .boat,
  .boat-art {
    animation: none;
  }
  .stage,
  .drift {
    transform: none;
    transition: none;
  }
  .copy > *,
  .places li,
  .marker {
    transition: none;
  }
  .ev.live .beat circle,
  .panel.seen .brushed {
    animation: none;
  }
  .panel .brushed {
    -webkit-mask: none;
    mask: none;
  }
}
</style>

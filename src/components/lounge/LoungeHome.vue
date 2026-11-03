<!--
  Lounge Home: one painted screen with two lights by night, your lantern and the boatman's
  lamp (by day, your kite and the sun), the live ticket, then a short scroll down to your
  WhatsApp groups moored at the ghat. Spec: _design/verdict.md (layout, colour, cards, names)
  and _notes/motion.md (every animation, its timing and cost).
  Entry (from App): 'name' = a fresh page load (the load choreography), 'none' = back from
  Events (already arrived; no choreography), { from, boat } = first arrival from the tour
  (the name flies from the ghat's nameplate onto the unlit lantern, which then catches).
-->
<template>
  <div
    ref="homeEl"
    class="home"
    :class="{
      phone,
      intro: phase === 'intro',
      'from-door': fromDoor,
      arrive: phase === 'arrive',
      'boat-handoff': boatHandoff,
    }"
    :style="geoVars"
  >
    <section id="top" ref="heroEl" v-loop class="hero" @pointerdown="ripple">
      <div class="scene" aria-hidden="true">
        <HomeWorld
          :phone="phone"
          :calm="calm"
          :visible="heroOn"
          :class="phase && !fromDoor ? `is-${phase}` : ''"
        />
        <div class="h-mangrove"><Mangrove :phone="phone" :calm="calm" :visible="heroOn" /></div>
        <div ref="boatEl" class="h-boat">
          <div class="h-boat-in">
            <RiverBoat tappable :lamp-delay="lampDelay" :catch-lamp="loadEntry === 'name'" />
          </div>
        </div>
        <div ref="ripHost" class="h-ripples"></div>
        <div class="h-fade"></div>
      </div>

      <DiwaliLayer v-if="DiwaliLayer" :phone="phone" :delay="festiveDelay" :visible="heroOn" />

      <h1 class="visually-hidden">{{ name ? `Lounge of ${name}` : 'Your Lounge' }}</h1>

      <div class="h-mine">
        <div class="h-mine-in">
          <span class="h-refl" aria-hidden="true"><i></i><i></i><i></i></span>
          <NameBeacon ref="beacon" :name="name" :lit="lit" string @name="openNameCard" />
        </div>
      </div>

      <a v-if="groupsSection.show" class="h-cue" href="#groups" @click.prevent="toGroups"
        >{{ groupsSection.rejectedOnly ? 'A group form needs you' : 'Your WhatsApp groups' }}
        <span aria-hidden="true">↓</span></a
      >
    </section>

    <LiveTicket class="h-ticket" />

    <MooredBoats />

    <footer class="h-foot">
      <img :src="CREST" alt="" width="40" height="40" />
      <p><b>The Lounge</b> · for Sundarbans House members</p>
    </footer>
  </div>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import CREST from '../../assets/crest.webp';
import HomeWorld from './home/HomeWorld.vue';
import LiveTicket from './home/LiveTicket.vue';
import Mangrove from './home/Mangrove.vue';
import MooredBoats from './home/MooredBoats.vue';
import NameBeacon from './home/NameBeacon.vue';
import RiverBoat from './home/RiverBoat.vue';
import { PLATE } from './home/art.js';
import { diwaliOn } from './home/festival.js';
import { animate, motionHeld, motionTimeout, onScreen, reduced, vLoop } from './home/motion.js';
import { groupsSection } from './session.js';
import { nameFlight, openNameCard, shownName } from './state.js';

const props = defineProps({ entry: { type: [String, Object], default: 'none' } });
/* App resets entry on mount; retain this mount's handoff across font/decode waits. */
const loadEntry = props.entry;
const firstArrival = loadEntry && typeof loadEntry === 'object';
const boatHandoff = ref(!!loadEntry?.boat);

const homeEl = ref(null);
const heroEl = ref(null);
const boatEl = ref(null);
const ripHost = ref(null);
const beacon = ref(null);

const name = computed(() => shownName.value);

/* Diwali: fetched only inside the festival window, so the rest of the year costs nothing. */
const DiwaliLayer = diwaliOn()
  ? defineAsyncComponent(() => import('./home/DiwaliLayer.vue'))
  : null;
const heroOn = () => onScreen(heroEl.value);

/* ---------- Geometry: the plate box, horizon and sun/moon, as px CSS variables ---------- */

const phone = ref(window.innerWidth <= 760);
const geo = ref(null);
function measure() {
  const el = heroEl.value;
  if (!el) return;
  phone.value = window.innerWidth <= 760;
  const hw = el.clientWidth;
  const hh = el.clientHeight;
  const pw = Math.max(hw, hh * 1.5);
  const ph = pw / 1.5;
  const ox = (hw - pw) / 2;
  const hz = ph * PLATE.horizon;
  /* Desktop: the moon sits on the plate's painted moon. Phone: top right of the screen. */
  const ss = phone.value ? 74 : Math.min(150, PLATE.moon.w * pw);
  const sx = phone.value ? hw - 18 - ss / 2 : ox + PLATE.moon.x * pw;
  const sy = phone.value ? 20 + ss / 2 : PLATE.moon.y * ph;
  geo.value = { hw, hh, pw, ph, ox, hz, sx, sy, ss };
}
const geoVars = computed(() => {
  const g = geo.value;
  if (!g) return {};
  const px = (v) => `${Math.round(v * 10) / 10}px`;
  return {
    '--hw': px(g.hw),
    '--hh': px(g.hh),
    '--pw': px(g.pw),
    '--ph': px(g.ph),
    '--ox': px(g.ox),
    '--hz': px(g.hz),
    '--sx': px(g.sx),
    '--sy': px(g.sy),
    '--ss': px(g.ss),
  };
});
let ro = null;

/* ---------- Choreography ---------- */

/* 'intro' (a fresh load), 'arrive' (from the tour / Replay) or '' (at rest). The phase
   classes carry the one-shot CSS animations; removing them leaves nothing animating but
   the slow loops. */
const phase = ref(reduced() || loadEntry === 'none' || firstArrival ? '' : 'intro');
/* Fresh load behind the sign-in door (motion held at its first frame, see LoungePage): the
   lantern starts mid-screen (lounge.css .from-door) and the painted scene is already in place,
   so the river is not rebuilt once the door lifts. */
const fromDoor = phase.value === 'intro' && motionHeld();
const calm = ref(!phase.value);
const lit = ref(reduced() || !firstArrival);
/* The boat's lamp catches as it finishes gliding in (load), at once otherwise. */
const lampDelay = computed(() =>
  phase.value === 'intro' ? 2600 : phase.value === 'arrive' ? 900 : 0
);
/* The fireworks wait for Home's own arrival to settle: the load build, or the name's flight
   from the tour. */
const festiveDelay = firstArrival ? 3600 : phase.value === 'intro' ? 3000 : 500;
let timers = [];
const later = (fn, ms) => timers.push(motionTimeout(fn, ms));
let dead = false;
const flights = new Set();
function play(el, frames, options) {
  const a = animate(el, frames, options);
  flights.add(a);
  const forget = () => flights.delete(a);
  a.finished.then(forget, forget);
  return a;
}

function settle(ms) {
  later(() => {
    phase.value = '';
    calm.value = true;
  }, ms);
}

const n1 = (v) => Math.round(v * 10) / 10;

/* Fly a copy of the face's text from `from` (a rect) onto the face. The real face text
   shows the frame the copy lands. */
function flyName(from, delay, dur = 900) {
  const face = beacon.value?.faceEl();
  if (!face || !from) return 0;
  const r = face.getBoundingClientRect();
  if (!r.width) return 0;
  const cs = getComputedStyle(face);
  const lines = face.children.length || 1;
  const copy = document.createElement('div');
  copy.className = 'name-flight';
  copy.innerHTML = face.innerHTML;
  Object.assign(copy.style, {
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    fontSize: cs.fontSize,
    fontStretch: cs.fontStretch,
    lineHeight: cs.lineHeight,
  });
  document.body.appendChild(copy);
  const s = Math.max(0.4, Math.min(4, from.height / (r.height / lines)));
  const dx = from.left + from.width / 2 - (r.left + r.width / 2);
  const dy = from.top + from.height / 2 - (r.top + r.height / 2);
  const total = delay + dur;
  play(
    copy,
    [
      { transform: `translate3d(${n1(dx)}px, ${n1(dy)}px, 0) scale(${s.toFixed(3)})`, opacity: 0 },
      { opacity: 1, offset: 0.08 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: dur, delay, easing: 'cubic-bezier(0.55, 0, 0.15, 1)', fill: 'both' }
  ).finished.then(
    () => copy.remove(),
    () => copy.remove()
  );
  play(face, [{ opacity: 0 }, { opacity: 0, offset: 0.999 }, { opacity: 1 }], {
    duration: total,
  });
  return total;
}

/* A fresh load builds the screen from nothing, in order (CSS .intro in lounge.css and
   .is-intro in HomeWorld.vue; the shell's part is html.building). Your lantern or kite rises
   to the middle of the screen and sails to its place, as in B. Calm by 5s. */
const INTRO_MS = 5000;

/* First arrival (once ever, from the tour) and Replay. Timeline: _notes/motion.md. */
async function arrive(from, boatFrom) {
  if (dead || reduced()) return;
  flights.forEach((a) => a.cancel());
  boatHandoff.value = !!boatFrom;
  timers.forEach((cancel) => cancel());
  timers = [];
  calm.value = false;
  lit.value = false;
  phase.value = '';
  await nextTick();
  if (dead) return;
  phase.value = 'arrive';
  await nextTick();
  if (dead) return;
  /* The boat travels from its tour position to its Home spot. The tour overlay (z 60) is
     still fading above Home, so a copy flies on a fixed layer above it and the real boat
     shows the frame the copy lands. */
  if (boatFrom && boatEl.value) {
    const b = boatEl.value.getBoundingClientRect();
    const img = boatEl.value.querySelector('img');
    const s = boatFrom.width / b.width;
    const copy = document.createElement('img');
    copy.className = 'boat-flight';
    copy.alt = '';
    copy.src = img?.currentSrc || img?.src || '';
    Object.assign(copy.style, {
      left: `${b.left}px`,
      top: `${b.top}px`,
      width: `${b.width}px`,
      height: `${b.height}px`,
    });
    document.body.appendChild(copy);
    play(
      copy,
      [
        {
          transform: `translate3d(${n1(boatFrom.left - b.left)}px, ${n1(boatFrom.top - b.top)}px, 0) scale(${s.toFixed(3)})`,
        },
        { transform: 'none' },
      ],
      { duration: 1000, delay: 350, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'both' }
    ).finished.then(
      () => copy.remove(),
      () => copy.remove()
    );
    play(boatEl.value, [{ opacity: 0 }, { opacity: 0, offset: 0.999 }, { opacity: 1 }], {
      duration: 1350,
    });
  }
  flyName(from, 350);
  /* The lantern catches as the name lands; the halo blooms. */
  later(() => (lit.value = true), 1300);
  settle(3300);
}

function replay() {
  window.scrollTo({ top: 0, behavior: 'instant' });
  const w = Math.min(260, window.innerWidth * 0.6);
  arrive({
    left: window.innerWidth / 2 - w / 2,
    top: window.innerHeight - 140,
    width: w,
    height: 30,
  });
}

/* A name saved in the name card flies from the card's input onto the face, then the
   lantern catches (the halo blooms) or the kite tugs. */
watch(nameFlight, async (f) => {
  if (!f?.from || reduced()) return;
  await nextTick();
  await new Promise((r) => requestAnimationFrame(r));
  if (dead) return;
  const t = flyName(f.from, 60, 800);
  later(() => beacon.value?.bloom?.(), t);
});

/* Tap the river: a ring spreads where you touched the water. */
function ripple(ev) {
  if (reduced() || !geo.value || ev.target.closest('a, button, .rb, .nb')) return;
  const host = ripHost.value;
  const r = heroEl.value.getBoundingClientRect();
  const x = ev.clientX - r.left;
  const y = ev.clientY - r.top;
  if (y < geo.value.hz + 12 || host.childElementCount > 3) return;
  const ring = document.createElement('i');
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  host.appendChild(ring);
  play(
    ring,
    [
      { transform: 'scale(0.2)', opacity: 0.7 },
      { transform: 'scale(1.6)', opacity: 0 },
    ],
    { duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  ).finished.then(
    () => ring.remove(),
    () => ring.remove()
  );
}

function toGroups() {
  document.getElementById('groups')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
}

onMounted(async () => {
  measure();
  ro = new ResizeObserver(measure);
  ro.observe(heroEl.value);
  const e = loadEntry;
  if (e && typeof e === 'object' && e.from && !reduced()) {
    /* The face needs the font measured before the name can fly onto it (capped). */
    await Promise.race([beacon.value?.whenReady(), new Promise((r) => setTimeout(r, 1500))]);
    if (!dead) arrive(e.from, e.boat);
  } else if (phase.value === 'intro') {
    settle(INTRO_MS);
  }
});

onBeforeUnmount(() => {
  dead = true;
  ro?.disconnect();
  timers.forEach((cancel) => cancel());
  flights.forEach((a) => a.cancel());
});

defineExpose({ replay });
</script>

<!--
  Home's painted world, behind everything: the plate, the sky (stars, shooting stars, moon;
  by day the sun with its turning rays, clouds, birds), the water's light (the moon's or the
  sun's path, glints on the painted wave line), winter's snow and mist (WinterLayer.vue, in
  season only) and everyone else's lanterns, which lift off the water and become kites by
  day. All positions come from CSS variables set on the hero by LoungeHome (--hw/--hh hero
  size, --pw/--ph/--ox plate box, --hz horizon, --sx/--sy/--ss sun or moon centre and size,
  all px). Spec: _notes/motion.md, "Home".
-->
<template>
  <div class="world" :class="{ phone }">
    <picture class="plate">
      <source type="image/avif" :srcset="PLATE.set(mode, 'avif')" :sizes="sizes" />
      <img
        :src="PLATE.src(mode)"
        :srcset="PLATE.set(mode, 'webp')"
        :sizes="sizes"
        alt=""
        fetchpriority="high"
        decoding="async"
        @load="emit('plate')"
      />
    </picture>

    <!-- Night sky: live stars over the painted ones; a few bright ones scintillate. -->
    <div class="stars" aria-hidden="true">
      <i
        v-for="(s, i) in stars"
        :key="i"
        :class="{ tw: s.tw }"
        :style="{
          left: `${s.x}%`,
          top: `calc(var(--hz) * ${s.y})`,
          width: `${s.z}px`,
          height: `${s.z}px`,
          '--d': `${s.d}s`,
          '--o': `${s.o}s`,
        }"
      ></i>
      <b
        v-for="(s, i) in bright"
        :key="`b${i}`"
        :style="{
          left: `${s.x}%`,
          top: `calc(var(--hz) * ${s.y})`,
          '--d': `${s.d}s`,
          '--o': `${s.o}s`,
        }"
      ></b>
    </div>
    <div ref="shootHost" class="shoots" aria-hidden="true"></div>

    <!-- Clouds and birds (day). -->
    <div class="clouds" aria-hidden="true">
      <img
        v-for="(c, i) in clouds"
        :key="i"
        :src="c.src"
        alt=""
        :style="{
          left: `${c.x}%`,
          top: `calc(var(--hz) * ${c.y})`,
          width: `${c.w}px`,
          '--d': `${c.d}s`,
          '--i': i,
        }"
      />
    </div>
    <div ref="birdHost" class="birds" aria-hidden="true"></div>

    <!-- The water's light: the path under the moon or sun, glints on the painted wave. -->
    <div class="path" aria-hidden="true">
      <i
        v-for="(g, i) in pathGlints"
        :key="i"
        :style="{
          left: `calc(var(--sx) + ${g.dx}px)`,
          top: `calc(var(--hz) + (var(--hh) - var(--hz)) * ${g.y})`,
          '--s': g.s,
          '--d': `${g.d}s`,
          '--o': `${g.o}s`,
        }"
      ></i>
    </div>
    <div class="waves" aria-hidden="true">
      <i
        v-for="(g, i) in waveGlints"
        :key="i"
        :style="{
          left: `${g.x}%`,
          top: `calc(var(--ph) * ${g.y})`,
          '--d': `${g.d}s`,
          '--o': `${g.o}s`,
        }"
      ></i>
    </div>

    <!-- Winter (season.js): mist on the water and falling snow, under everyone's lights. -->
    <WinterLayer v-if="winter" :phone="phone" />

    <!-- Everyone else: lanterns far out on the water by night, kites in the sky by day. -->
    <div class="fleet" :class="{ 'fleet-turn': fleetTurning }" aria-hidden="true">
      <span
        v-for="(f, i) in fleet"
        :key="i"
        class="fb"
        :class="{ 'is-kite': paperKites[i] }"
        :style="{
          '--nx': f.nx,
          '--ny': f.ny,
          '--dx': f.dx,
          '--dy': f.dy,
          '--nw': `${f.nw}px`,
          '--dw': `${f.dw}px`,
          '--k': i,
          '--bd': `${f.bd}s`,
          '--dd': `${f.dd}s`,
        }"
      >
        <span class="fb-bob">
          <span class="fb-spin">
            <img class="fb-l" :src="LANTERN_FAR" alt="" draggable="false" />
            <span class="fb-k">
              <svg class="fb-str" viewBox="0 0 10 100" preserveAspectRatio="none">
                <path :d="`M5 0 C 7 30, ${f.sw} 70, ${f.sw + 2} 100`" pathLength="1" />
              </svg>
              <img :src="KITES[i % 3]" alt="" draggable="false" />
            </span>
          </span>
        </span>
      </span>
    </div>

    <!-- The sun or moon: the theme circle's origin (tide.js). -->
    <div class="sky" data-sky-body aria-hidden="true">
      <span class="flare"></span>
      <span class="rings"><i></i><i></i><i></i></span>
      <span class="glow"></span>
      <span class="rays r1"></span>
      <span class="rays r2"></span>
      <img class="sun" :src="SUN" alt="" draggable="false" />
      <span class="moon-glow"></span>
      <img class="moon" :src="MOON" alt="" draggable="false" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { mode } from '../state.js';
import { fadeReady } from '../tide.js';
import { BIRDS, CLOUDS, KITES, LANTERN_FAR, MOON, PLATE, SUN } from './art.js';
import { animate, motionTimeout, motionActive, lite, rare, reduced } from './motion.js';
import { winter } from './season.js';
import WinterLayer from './WinterLayer.vue';

const props = defineProps({
  phone: { type: Boolean, default: false },
  /* false until the intro is calm: the rare moments wait for it. */
  calm: { type: Boolean, default: true },
  /* Is the hero on screen? (LoungeHome's vLoop) */
  visible: { type: Function, default: () => true },
});
const emit = defineEmits(['plate']);

const sizes = computed(() => (props.phone ? '840px' : '100vw'));

/* A fixed pseudo-random sequence, so the sky is the same on every visit. */
function seq(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* Stars across the whole sky (x % of the hero, y fraction of the horizon height). Most
   twinkle, each at its own pace; lite devices twinkle a third. */
const stars = computed(() => {
  const r = seq(7);
  const n = props.phone ? 20 : 38;
  return Array.from({ length: n }, (_, i) => ({
    x: +(r() * 99 + 0.5).toFixed(2),
    y: +(0.03 + Math.pow(r(), 1.3) * 0.82).toFixed(3),
    z: +(1.4 + r() * 1.3).toFixed(1),
    tw: lite ? i % 3 === 0 : i % 5 !== 4,
    d: +(3.2 + r() * 4.4).toFixed(2),
    o: -(r() * 8).toFixed(2),
  }));
});
const bright = computed(() =>
  (props.phone
    ? [
        [22, 0.16],
        [71, 0.34],
      ]
    : [
        [14, 0.2],
        [47, 0.08],
        [66, 0.42],
      ]
  ).map(([x, y], i) => ({ x, y, d: 7 + i * 2.3, o: -i * 3.1 }))
);

/* Keep each drift envelope clear of the three clouds painted into the plate. On phones,
   the centre-cropped plate needs a separate high lane. */
const clouds = computed(() =>
  [
    {
      src: CLOUDS[0],
      x: props.phone ? 6 : 52,
      y: props.phone ? 0.02 : 0.08,
      w: props.phone ? 70 : 130,
      d: 240,
    },
    { src: CLOUDS[1], x: 62, y: 0.38, w: 96, d: 280 },
  ].slice(0, props.phone ? 1 : 2)
);

/* The light's path on the water: glints in a column under the sun or moon, widening and
   thinning as they come closer. y is a fraction of the water below the horizon. */
const pathGlints = computed(() => {
  const r = seq(11);
  const n = props.phone ? 6 : 9;
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    return {
      y: +(0.03 + t * 0.5).toFixed(3),
      dx: Math.round((r() - 0.5) * (14 + t * 70)),
      s: +(1 - t * 0.45).toFixed(2),
      d: +(2.6 + r() * 2.2).toFixed(2),
      o: -(r() * 4).toFixed(2),
    };
  });
});

/* Glints riding the painted dotted wave line (plate y 0.48 and 0.85). */
const waveGlints = computed(() => {
  const r = seq(23);
  const n = props.phone ? 4 : lite ? 4 : 7;
  return Array.from({ length: n }, (_, i) => ({
    x: +((i + 0.2 + r() * 0.6) * (100 / n)).toFixed(2),
    y: i % 3 === 2 ? 0.851 : 0.481,
    d: +(3.4 + r() * 3).toFixed(2),
    o: -(r() * 6).toFixed(2),
  }));
});

/* Others: night x/y (fractions of the hero; y of the water band under the horizon), day
   x/y (y of the sky above the horizon), widths, bob and drift periods, string sweep. */
const FLEET_D = [
  { nx: 0.06, ny: 0.1, dx: 0.07, dy: 0.24, nw: 34, dw: 52, bd: 7.4, dd: 26, sw: -30 },
  { nx: 0.17, ny: 0.22, dx: 0.2, dy: 0.5, nw: 40, dw: 44, bd: 8.2, dd: 31, sw: -18 },
  { nx: 0.5, ny: 0.05, dx: 0.47, dy: 0.12, nw: 26, dw: 38, bd: 9.1, dd: 23, sw: -10 },
  { nx: 0.6, ny: 0.13, dx: 0.6, dy: 0.62, nw: 30, dw: 34, bd: 7.9, dd: 34, sw: -8 },
  { nx: 0.87, ny: 0.07, dx: 0.9, dy: 0.42, nw: 28, dw: 46, bd: 8.7, dd: 28, sw: 6 },
  { nx: 0.95, ny: 0.24, dx: 0.73, dy: 0.2, nw: 44, dw: 40, bd: 9.5, dd: 37, sw: 12 },
  { nx: 0.38, ny: 0.03, dx: 0.33, dy: 0.08, nw: 22, dw: 30, bd: 8.5, dd: 25, sw: -14 },
];
const FLEET_P = [
  { nx: 0.09, ny: 0.09, dx: 0.12, dy: 0.5, nw: 28, dw: 40, bd: 7.4, dd: 26, sw: -20 },
  { nx: 0.86, ny: 0.05, dx: 0.4, dy: 0.12, nw: 26, dw: 32, bd: 8.2, dd: 31, sw: -8 },
  { nx: 0.3, ny: 0.02, dx: 0.62, dy: 0.66, nw: 20, dw: 30, bd: 9.1, dd: 23, sw: 6 },
  { nx: 0.72, ny: 0.16, dx: 0.88, dy: 0.86, nw: 32, dw: 28, bd: 7.9, dd: 34, sw: 10 },
];
/* Raja: more of B's life on the water, so everyone else's lanterns are larger and glow. */
const fleet = computed(() =>
  (props.phone ? FLEET_P : FLEET_D).map((f) => ({
    ...f,
    nw: Math.round(f.nw * 1.55),
    dw: Math.round(f.dw * 1.2),
  }))
);
const paperKites = ref(Array(FLEET_D.length).fill(mode.value === 'day'));
const fleetTurning = ref(false);
let paperTimers = [];
let fleetGeneration = 0;
watch(mode, async (m) => {
  const generation = ++fleetGeneration;
  paperTimers.forEach((cancel) => cancel());
  paperTimers = [];
  if (reduced()) {
    paperKites.value = paperKites.value.map(() => m === 'day');
    return;
  }
  await fadeReady();
  if (generation !== fleetGeneration) return;
  fleetTurning.value = true;
  /* Each turns edge-on in turn (120ms apart, as in B) and swaps paper at its half. */
  fleet.value.forEach((_, i) => {
    paperTimers.push(
      motionTimeout(
        () => {
          if (generation === fleetGeneration) paperKites.value[i] = m === 'day';
        },
        450 + i * 120
      )
    );
  });
  paperTimers.push(
    motionTimeout(() => (fleetTurning.value = false), 900 + fleet.value.length * 120 + 100)
  );
});

/* ---------- Rare moments: shooting stars at night, birds by day ---------- */

const shootHost = ref(null);
const birdHost = ref(null);
let follow = () => {};
const canPlay = () => !reduced() && motionActive() && props.calm && props.visible();

function shootingStar(lead = true) {
  const host = shootHost.value;
  if (!host || mode.value !== 'night' || !canPlay()) return;
  const hz = host.clientHeight;
  const W = host.clientWidth;
  const el = document.createElement('i');
  const len = 90 + Math.random() * 60;
  const ang = 14 + Math.random() * 16;
  const x = W * (0.08 + Math.random() * 0.6);
  const y = hz * (0.04 + Math.random() * 0.3);
  const travel = 240 + Math.random() * 160;
  el.style.cssText = `left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${len.toFixed(0)}px`;
  host.appendChild(el);
  const rot = `rotate(${ang.toFixed(1)}deg)`;
  const a = animate(
    el,
    [
      { transform: `${rot} translate3d(0,0,0)`, opacity: 0 },
      { opacity: 0.9, offset: 0.18 },
      { transform: `${rot} translate3d(${travel.toFixed(0)}px,0,0)`, opacity: 0 },
    ],
    { duration: 700 + Math.random() * 250, easing: 'cubic-bezier(.4,0,.9,.6)' }
  );
  a.finished.then(
    () => el.remove(),
    () => el.remove()
  );
  /* Now and then a second one follows the first. */
  if (lead && !lite && Math.random() < 0.22) {
    follow = motionTimeout(() => shootingStar(false), 260 + Math.random() * 260);
  }
}

function birdFlock() {
  const host = birdHost.value;
  if (!host || mode.value !== 'day' || !canPlay()) return;
  const W = host.clientWidth;
  const n = 3 + Math.floor(Math.random() * 3);
  const flock = document.createElement('div');
  flock.className = 'flock';
  const top = host.clientHeight * (0.08 + Math.random() * 0.28);
  flock.style.top = `${top.toFixed(0)}px`;
  for (let i = 0; i < n; i++) {
    const b = document.createElement('span');
    const w = 22 + Math.random() * 12;
    b.style.cssText = `left:${(-i * (26 + Math.random() * 14)).toFixed(0)}px;top:${((i % 2 ? 1 : -1) * i * 7 + Math.random() * 6).toFixed(0)}px;width:${w.toFixed(0)}px;--f:${(0.84 + Math.random() * 0.32).toFixed(2)}s;--fo:${(-Math.random()).toFixed(2)}s`;
    b.innerHTML = `<img src="${BIRDS}" alt="">`;
    flock.appendChild(b);
  }
  host.appendChild(flock);
  // Same crossing distance, twice the duration: exactly half the former travel speed.
  const dur = 18000 + Math.random() * 6000;
  const a = animate(
    flock,
    [
      { transform: 'translate3d(-60px, 0, 0)' },
      { transform: `translate3d(${(W * 0.5).toFixed(0)}px, 24px, 0)`, offset: 0.5 },
      { transform: `translate3d(${(W + 220).toFixed(0)}px, -14px, 0)` },
    ],
    { duration: dur, easing: 'linear' }
  );
  a.finished.then(
    () => flock.remove(),
    () => flock.remove()
  );
}

let stops = [];
function schedule() {
  stops.forEach((s) => s());
  stops = [];
  follow();
  for (const host of [shootHost.value, birdHost.value]) {
    host?.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    host?.replaceChildren();
  }
  const when = () => props.calm && props.visible();
  stops.push(
    rare(shootingStar, {
      first: 3500,
      min: 11000,
      max: 26000,
      when: () => when() && mode.value === 'night',
    })
  );
  stops.push(
    rare(birdFlock, {
      first: 2500,
      min: 36000,
      max: 68000,
      when: () => when() && mode.value === 'day',
    })
  );
}
onMounted(schedule);
/* After a switch: a shooting star soon after nightfall, birds soon after daybreak. */
watch(mode, schedule);
onBeforeUnmount(() => {
  fleetGeneration++;
  paperTimers.forEach((cancel) => cancel());
  stops.forEach((s) => s());
  follow();
});
</script>

<style scoped>
.world {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--sky-0);
}
.plate {
  position: absolute;
  left: var(--ox);
  top: 0;
  width: var(--pw);
  height: var(--ph);
}
.plate img {
  display: block;
  width: 100%;
  height: 100%;
}

/* ---------- Stars ---------- */
.stars,
.shoots,
.clouds,
.birds {
  position: absolute;
  inset: 0 0 auto 0;
  height: var(--hz);
  pointer-events: none;
}
.stars i {
  position: absolute;
  border-radius: 50%;
  background: #fff4dc;
  opacity: 0.85;
}
.stars i.tw {
  animation: m-twinkle var(--d) ease-in-out var(--o) infinite alternate;
}
/* A few bright stars: four points that scintillate slowly. */
.stars b {
  position: absolute;
  width: 9px;
  height: 9px;
  margin: -4.5px;
  background: #fff7e2;
  clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
  animation: star-scint var(--d) ease-in-out var(--o) infinite;
}
@keyframes star-scint {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(0.6) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1) rotate(20deg);
  }
}
.shoots :deep(i) {
  position: absolute;
  height: 1.5px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, rgb(255 244 220 / 0.25) 40%, #fff4dc);
  transform-origin: 0 50%;
  opacity: 0;
}
/* Night only: stars fade in after the switch, out quickly at dawn. */
.stars,
.shoots,
.path i,
.waves i {
  transition: opacity 600ms linear 100ms;
}
:root[data-theme='light'] .stars,
:root[data-theme='light'] .shoots {
  opacity: 0;
  transition-duration: 300ms;
  transition-delay: 0s;
}
:root[data-theme='light'] .stars * {
  animation: none;
}

/* ---------- Clouds and birds (day) ---------- */
/* By day they drop in a little, one after another (B). */
.clouds img {
  position: absolute;
  height: auto;
  opacity: 0;
  translate: 0 -30px;
  transition:
    opacity 1000ms linear calc(600ms + var(--i) * 200ms),
    translate 1400ms var(--ease-out) calc(600ms + var(--i) * 200ms);
}
/* At nightfall the clouds go at once (a cream cloud on the night sky reads as a mistake). */
:root[data-theme='dark'] .clouds img {
  transition-duration: 250ms;
  transition-delay: 0s;
}
:root[data-theme='light'] .clouds img {
  opacity: 1;
  translate: 0 0;
  animation: cloud-drift var(--d) ease-in-out infinite alternate;
}
@keyframes cloud-drift {
  to {
    transform: translate3d(18px, 0, 0);
  }
}
.birds :deep(.flock) {
  position: absolute;
  left: 0;
}
.birds :deep(.flock span) {
  position: absolute;
  aspect-ratio: 170 / 150;
  overflow: hidden;
}
/* Two painted frames side by side; the image slides one frame over (transform, not
   background-position, so no repaint). */
.birds :deep(.flock img) {
  display: block;
  width: 200%;
  height: 100%;
  max-width: none;
  animation: flap calc(var(--f) * 4) steps(1) var(--fo) infinite;
}
/* Two slower wingbeats, then an equally long held-wing glide. Each bird has its own phase. */
@keyframes flap {
  0%,
  25%,
  50%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  12.5%,
  37.5% {
    transform: translate3d(-50%, 0, 0);
  }
}

/* ---------- The light on the water ---------- */
.path,
.waves {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
/* Night: short silver dashes under the moon. Day: four-point sparkles under the sun. */
.path i {
  position: absolute;
  width: calc(18px * var(--s));
  height: 2px;
  margin-left: calc(-9px * var(--s));
  border-radius: 2px;
  background: #dfe6ff;
  opacity: 0.55;
  --shimmer-lo: 0.12;
  animation: m-shimmer var(--d) ease-in-out var(--o) infinite alternate;
}
:root[data-theme='light'] .path i {
  width: calc(15px * var(--s));
  height: calc(15px * var(--s));
  margin: calc(-7.5px * var(--s));
  border-radius: 0;
  background: #fffbea;
  clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
  opacity: 1;
  animation-name: m-glint;
  animation-timing-function: ease-in-out;
  animation-direction: normal;
}
.waves i {
  position: absolute;
  width: 9px;
  height: 9px;
  margin: -4.5px;
  background: #e9efff;
  clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
  animation: m-glint var(--d) ease-in-out var(--o) infinite;
}
:root[data-theme='light'] .waves i {
  width: 13px;
  height: 13px;
  margin: -6.5px;
  background: #fffbea;
}
:root.lite .clouds img,
:root.lite .stars b,
:root.lite .path i:nth-child(even),
:root.lite .waves i:nth-child(even) {
  animation: none;
}

/* ---------- Others' lanterns and kites ---------- */
.fleet {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
/* Position: on the water by night, in the sky by day; the move is a transform transition,
   so it plays live inside the theme circle. */
.fb {
  position: absolute;
  left: 0;
  top: 0;
  width: var(--nw);
  aspect-ratio: 480 / 621;
  transform: translate3d(
    calc(var(--hw) * var(--nx) - 50%),
    calc(var(--hz) + (var(--hh) - var(--hz)) * var(--ny) - 50%),
    0
  );
}
/* The water-to-sky move runs only inside a theme switch (tide.js html.theme-move). The
   position vars arrive after first paint; a standing transition slid every lantern in
   from the top-left corner on load. B's swing: long, one after another. */
:root.theme-move .fb {
  transition:
    transform 1900ms var(--ease-swing) calc(300ms + var(--k) * 120ms),
    width 1900ms var(--ease-swing) calc(300ms + var(--k) * 120ms);
}
:root[data-theme='light'] .fb {
  width: var(--dw);
  aspect-ratio: 300 / 373;
  transform: translate3d(calc(var(--hw) * var(--dx) - 50%), calc(var(--hz) * var(--dy) - 50%), 0);
}
.fb-bob,
.fb-spin {
  position: absolute;
  inset: 0;
}
/* Night: half the member's bob, each at its own pace, plus a slow drift on the current. */
.fb-bob {
  animation:
    fb-bob var(--bd) ease-in-out calc(var(--k) * -1.3s) infinite,
    fb-drift var(--dd) ease-in-out calc(var(--k) * -4s) infinite alternate;
}
@keyframes fb-bob {
  50% {
    transform: translate3d(0, -1.5px, 0) rotate(0.5deg);
  }
}
@keyframes fb-drift {
  to {
    translate: 14px 0;
  }
}
:root[data-theme='light'] .fb-bob {
  transform-origin: 50% 100%;
  animation: fb-sway var(--bd) ease-in-out calc(var(--k) * -1.1s) infinite;
}
@keyframes fb-sway {
  0%,
  100% {
    transform: rotate(-3deg);
  }
  50% {
    transform: rotate(3.5deg) translate3d(0, -3px, 0);
  }
}
:root.lite .fb-bob {
  animation: none;
}
.fb-l,
.fb-k,
.fb-k img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.fleet-turn .fb-spin {
  animation: fb-turn 900ms calc(var(--k) * 120ms) cubic-bezier(0.65, 0, 0.35, 1) both;
}
@keyframes fb-turn {
  0%,
  100% {
    transform: none;
  }
  50% {
    transform: scaleX(0.02) scaleY(1.06);
  }
}
/* B's glow: each lantern lights itself and the water under it. */
.fb-l {
  filter: drop-shadow(0 0 14px rgb(244 176 74 / 0.6));
}
.fb::after {
  content: '';
  position: absolute;
  left: -25%;
  right: -25%;
  top: 96%;
  height: 55%;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgb(244 176 74 / 0.34), transparent);
  pointer-events: none;
  transition: opacity 400ms linear;
}
:root[data-theme='light'] .fb::after {
  opacity: 0;
}
.fb-k,
.fb.is-kite .fb-l {
  opacity: 0;
}
.fb.is-kite .fb-k {
  opacity: 1;
}
/* Strings run from each kite's tail down to the ghat (static). */
.fb-str {
  position: absolute;
  left: 50%;
  top: 92%;
  width: 10px;
  height: calc(var(--hz) * (1 - var(--dy)) + 40px);
  margin-left: -5px;
  overflow: visible;
}
.fb-str path {
  fill: none;
  stroke: #3a2414;
  stroke-opacity: 0.4;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
/* At daybreak each string pays out from its kite down to the ghat (B). */
:root.theme-move .fb.is-kite .fb-str path {
  stroke-dasharray: 1;
  animation: str-draw 1400ms var(--ease-out) 250ms backwards;
}
@keyframes str-draw {
  from {
    stroke-dashoffset: 1;
  }
}

/* ---------- Sun and moon ---------- */
.sky {
  position: absolute;
  left: var(--sx);
  top: var(--sy);
  width: var(--ss);
  height: var(--ss);
  margin: calc(var(--ss) / -2) 0 0 calc(var(--ss) / -2);
  pointer-events: none;
}
.sky > * {
  position: absolute;
}
.sun {
  inset: 0;
  width: 100%;
  height: 100%;
}
.moon {
  inset: 14%;
  width: 72%;
  height: 72%;
}
.glow {
  inset: -70%;
  border-radius: 50%;
  background: radial-gradient(
    closest-side,
    rgb(255 236 170 / 0.55),
    rgb(255 200 110 / 0.18) 45%,
    transparent
  );
}
.moon-glow {
  inset: -18%;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgb(244 232 208 / 0.22), transparent 70%);
}
/* Rays: two fans of soft light turning against each other at different speeds, so the
   light seems to shimmer. Each is one layer, rotated by the compositor; painted once. */
.rays {
  inset: -95%;
  border-radius: 50%;
  mask: radial-gradient(closest-side, #000 22%, rgb(0 0 0 / 0.5) 48%, transparent 92%);
}
.r1 {
  background: repeating-conic-gradient(rgb(255 238 186 / 0.34) 0 5deg, transparent 5deg 20deg);
  animation: turn 110s linear infinite;
}
.r2 {
  background: repeating-conic-gradient(
    from 7deg,
    rgb(255 222 150 / 0.22) 0 3deg,
    transparent 3deg 13deg
  );
  animation: turn 170s linear infinite reverse;
}
@keyframes turn {
  to {
    transform: rotate(360deg);
  }
}

/* The switch (B's): the moon spins away as the sun spins in on a spring, with a flash and
   dotted rings (only while html.theme-move is set, so nothing flashes on load); the rays and
   glow open after it. At nightfall the sun spins out fast and the moon swings back in. */
.sun,
.glow,
.rays {
  opacity: 0;
}
.sun {
  transform: rotate(-160deg) scale(0.15);
  transition:
    transform 600ms var(--ease-in),
    opacity 400ms linear 200ms;
}
.glow,
.rays {
  transition: opacity 400ms linear;
}
.moon,
.moon-glow {
  transition:
    transform 900ms var(--ease-swing) 350ms,
    opacity 600ms linear 350ms;
}
:root[data-theme='light'] .sun {
  opacity: 1;
  transform: none;
  transition:
    transform 1500ms var(--ease-spring) 300ms,
    opacity 400ms linear 300ms;
}
:root[data-theme='light'] .glow,
:root[data-theme='light'] .rays {
  opacity: 1;
  transition: opacity 1200ms var(--ease-out) 800ms;
}
:root[data-theme='light'] .moon,
:root[data-theme='light'] .moon-glow {
  opacity: 0;
  transform: rotate(200deg) scale(0.2);
  transition:
    transform 700ms var(--ease-in),
    opacity 350ms linear 300ms;
}
:root[data-theme='dark'] .rays {
  animation-play-state: paused;
}
.flare {
  inset: -40%;
  border-radius: 50%;
  background: radial-gradient(closest-side, #fffbe8, rgb(255 214 120 / 0.7) 40%, transparent);
  opacity: 0;
}
.rings {
  inset: 0;
}
.rings i {
  position: absolute;
  inset: 0;
  border: 3px dotted #fff3d0;
  border-radius: 50%;
  opacity: 0;
}
:root[data-theme='light'] .rings i {
  border-color: #b8341b;
}
:root.theme-move[data-theme='light'] .flare {
  animation: sky-flare 1300ms 200ms var(--ease-out);
}
:root.theme-move[data-theme='dark'] .flare {
  animation: sky-flare-n 1300ms 100ms var(--ease-out);
}
:root.theme-move .rings i {
  animation: sky-ring 1300ms calc(var(--r) * 160ms + 150ms) var(--ease-out);
}
.rings i:nth-child(2) {
  --r: 1;
}
.rings i:nth-child(3) {
  --r: 2;
}
.rings i:nth-child(1) {
  --r: 0;
}
@keyframes sky-flare {
  0% {
    opacity: 0;
    transform: scale(0.2);
  }
  25% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: scale(2.6);
  }
}
@keyframes sky-flare-n {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  30% {
    opacity: 0.55;
  }
  100% {
    opacity: 0;
    transform: scale(2);
  }
}
@keyframes sky-ring {
  from {
    opacity: 1;
    transform: scale(0.4);
  }
  to {
    opacity: 0;
    transform: scale(3.4);
  }
}
:root[data-theme='light'] .path i,
:root[data-theme='light'] .waves i {
  transition-delay: 600ms;
}

/* ---------- Choreography (classes from LoungeHome) ---------- */
/* Fresh load, the build (timeline in lounge.css): the painted river comes up from the
   empty page, then the sun or moon, the stars as your eyes adjust, the clouds, the light on
   the water, and everyone else's lanterns or kites turn in place one by one. First arrival: from 1900ms. */
.is-intro .plate {
  animation: m-fade-in 1300ms linear backwards;
}
.is-intro .sky {
  animation: w-sky-in 1200ms 500ms var(--ease-out) backwards;
}
.is-intro .stars {
  animation: m-fade-in 1400ms 700ms linear backwards;
}
.is-intro .clouds {
  animation: m-fade-in 1200ms 900ms linear backwards;
}
.is-intro .path,
.is-intro .waves {
  animation: m-fade-in 900ms 1100ms linear backwards;
}
.is-intro .fb-spin {
  animation: fb-build 900ms calc(1800ms + var(--k) * 120ms) cubic-bezier(0.65, 0, 0.35, 1) backwards;
}
@keyframes fb-build {
  0% {
    opacity: 0;
    transform: none;
  }
  50% {
    transform: scaleX(0.02) scaleY(1.06);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}
.is-arrive .fb-spin {
  animation: m-fade-in 600ms calc(1900ms + var(--k) * 140ms) linear backwards;
}
@keyframes w-sky-in {
  from {
    opacity: 0;
    transform: translate3d(0, 14px, 0) scale(0.92);
  }
}

@media (prefers-reduced-motion: reduce) {
  .world *,
  .world :deep(*) {
    animation: none !important;
    transition: none !important;
  }
  .path i,
  .waves i {
    opacity: 0.5;
  }
}
</style>

<!--
  Diwali on Lounge Home, laid over the painted scene without changing it: a ghat-paper card
  that wishes the member by name, clay diyas floating on the river, and fireworks over the sky.
  Loaded only inside the festival window (festival.js). Motion budget:
  - Fireworks: one canvas over the sky only (top to the horizon); a salvo once per visit, then
    a single rocket now and then while the hero is on screen; "Light a firework" adds one.
  - Diyas: transform/opacity loops, paused off screen and in hidden tabs (vLoop, motion.css).
  - Reduced motion: no fireworks, still diyas, the card at rest.
  The root does not form a stacking context, so its children stack inside the hero: the sky
  canvas over the scene, diyas under your lantern, the card over everything.
-->
<template>
  <div class="dw" :style="{ '--dw-d': `${delay}ms` }">
    <canvas v-if="motion" ref="sky" class="dw-sky" aria-hidden="true"></canvas>

    <div v-loop class="dw-diyas" aria-hidden="true">
      <span
        v-for="(d, i) in diyas"
        :key="i"
        class="dw-diya"
        :style="{ left: `${d[0]}%`, top: `${d[1]}%`, '--s': d[2], '--i': i }"
      >
        <i class="dw-glow"></i>
        <i class="dw-refl"></i>
        <span class="dw-bob">
          <span class="dw-flame"
            ><svg viewBox="-6 -22 12 22">
              <path class="dw-f-out" d="M0 0C-6-6-4-15 0-22C4-15 6-6 0 0Z" />
              <path class="dw-f-in" d="M0-1C-3-4-2-9 0-13C2-9 3-4 0-1Z" /></svg
          ></span>
          <svg class="dw-bowl" viewBox="0 20 64 28">
            <path
              class="dw-clay"
              d="M4 26C6 40 22 46 34 46S56 40 60 30L63 23C56 27 50 28 34 28S10 27 4 26Z"
            />
            <path
              class="dw-oil"
              d="M5 26C14 28 24 29 34 29S55 27 62 23.5L60 26C52 29 22 30 5 26Z"
            />
            <path class="dw-band" d="M9 33C22 39 44 39 57 31" />
            <circle class="dw-dot" cx="17" cy="38" r="1.7" />
            <circle class="dw-dot" cx="27" cy="41" r="1.7" />
            <circle class="dw-dot" cx="38" cy="41" r="1.7" />
            <circle class="dw-dot" cx="48" cy="38" r="1.7" />
          </svg>
        </span>
      </span>
    </div>

    <aside v-if="open" class="dw-card gp gp-band" aria-labelledby="dw-h" @pointerdown.stop>
      <button type="button" class="dw-x" @click="fold">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        <span class="visually-hidden">Fold the Diwali greeting</span>
      </button>
      <p class="gp-kicker">Shubh Deepavali</p>
      <h2 id="dw-h" class="dw-h">
        Happy Diwali<template v-if="first"
          >, <em>{{ first }}</em></template
        >!
      </h2>
      <p class="gp-body dw-body">
        Wishing you and your family a very happy Diwali from everyone at Sundarbans House. Enjoy the
        sweets, and stay safe around the crackers.
      </p>
      <button v-if="motion" type="button" class="gp-btn is-ghost dw-fire" @click="light">
        Light a firework
      </button>
    </aside>
    <button v-else type="button" class="dw-pill" @pointerdown.stop @click="unfold">
      <svg viewBox="-6 -22 12 22" aria-hidden="true">
        <path class="dw-f-out" d="M0 0C-6-6-4-15 0-22C4-15 6-6 0 0Z" />
        <path class="dw-f-in" d="M0-1C-3-4-2-9 0-13C2-9 3-4 0-1Z" />
      </svg>
      Happy Diwali{{ first ? `, ${first}` : '' }}
    </button>
  </div>
</template>

<script>
/* Once per page load: the opening salvo (Home remounts when you come back from Events), and
   whether the member folded the card. */
let saluted = false;
let foldedByMember = false;
</script>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { createFireworks } from './fireworks.js';
import { motionTimeout, rare, reduced, vLoop } from './motion.js';
import { firstName } from '../state.js';

const props = defineProps({
  phone: { type: Boolean, default: false },
  /* ms before the salvo: after Home's own arrival choreography has settled. */
  delay: { type: Number, default: 600 },
  /* Is the hero on screen? Rare rockets only fly while it is. */
  visible: { type: Function, default: () => true },
});

const motion = !reduced();
const first = computed(() => firstName.value);
const firstVisit = !saluted;
saluted = true;
/* Phones have no free sky for a standing card: the greeting starts as a pill, so the salvo
   stays in view, and opens into the card on a tap. */
const open = ref(!foldedByMember && !props.phone);

/* [left %, top %, scale]: open water clear of the boat, lantern, ticket and mangrove. */
const DESK = [
  [8, 87, 1],
  [31, 85, 0.85],
  [36, 93, 1.05],
  [50, 73, 0.8],
  [62, 80, 0.95],
  [71, 90, 1.1],
  [80, 72, 0.8],
];
const PHONE = [
  [7, 60, 0.8],
  [48, 77, 0.9],
  [62, 84, 0.8],
  [72, 76, 0.75],
];
const diyas = computed(() => (props.phone ? PHONE : DESK));

const sky = ref(null);
let fw = null;
const stops = [];

/* A rocket at `at` (0–1 across the sky), or anywhere the open card does not cover. */
function fire(at) {
  const w = sky.value?.clientWidth;
  if (!fw || !w) return;
  const clear = open.value && !props.phone ? 0.32 : 0.06;
  fw.launch(w * (at ?? clear + Math.random() * (0.94 - clear)));
}

/* On a phone the open card covers the sky: fold it, then light a small volley. */
function light() {
  if (!props.phone) return fire();
  fold();
  [0, 260, 520].forEach((t, i) => stops.push(motionTimeout(() => fire(), t + i * 40)));
}

function fold() {
  open.value = false;
  foldedByMember = true;
}

function unfold() {
  open.value = true;
  foldedByMember = false;
  fire();
}

/* The opening salvo, clear of the card on desktop: rockets alternate across the sky and a
   pair lands together near the end. Phones (no card) spread across the whole sky. */
const SALVO = [
  [0, 0.56, 0.3],
  [420, 0.86, 0.75],
  [950, 0.42, 0.5],
  [1400, 0.7, 0.15],
  [1800, 0.94, 0.88],
  [2500, 0.5, 0.35],
  [2550, 0.78, 0.65],
  [3300, 0.62, 0.5],
];

onMounted(() => {
  if (motion && sky.value) {
    fw = createFireworks(sky.value);
    if (firstVisit) {
      const shots = props.phone ? SALVO.filter((_, i) => i % 4 !== 3) : SALVO;
      for (const [t, desk, phone] of shots) {
        stops.push(motionTimeout(() => fire(props.phone ? phone : desk), props.delay + t));
      }
    }
    stops.push(
      rare(() => fire(), {
        first: firstVisit ? props.delay + 12000 : 4000,
        min: 11000,
        max: 22000,
        when: props.visible,
      })
    );
  }
});

onBeforeUnmount(() => {
  stops.forEach((stop) => stop());
  fw?.destroy();
});
</script>

<style scoped>
.dw {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* ---------- Sky: the canvas ends just below the horizon and fades into the treeline ---------- */
.dw-sky {
  position: absolute;
  z-index: 0;
  left: 0;
  top: 0;
  width: 100%;
  height: calc(var(--hz, 40%) + 24px);
  mask-image: linear-gradient(#000 82%, transparent);
}

/* ---------- Diyas on the river ---------- */
.dw-diyas {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.dw-diya {
  position: absolute;
  --dw-w: 60px;
  width: calc(var(--dw-w) * var(--s, 1));
  margin-left: calc(var(--dw-w) * var(--s, 1) / -2);
  animation: dw-in 900ms var(--ease-settle) both;
  animation-delay: calc(var(--dw-d) * 0.45 + var(--i) * 110ms);
}

.dw-bob {
  position: relative;
  display: block;
  animation: dw-bob 4.6s ease-in-out infinite alternate;
  animation-delay: calc(var(--i) * -0.7s);
}

.dw-bowl {
  display: block;
  width: 100%;
  overflow: visible;
}

.dw-clay {
  fill: var(--verm);
  stroke: var(--pat-ink);
  stroke-width: 1.6;
  stroke-linejoin: round;
}

.dw-oil {
  fill: var(--pat-ink);
  opacity: 0.55;
}

.dw-band {
  fill: none;
  stroke: var(--lamp);
  stroke-width: 1.5;
  stroke-linecap: round;
}

.dw-dot {
  fill: var(--lamp-core);
}

/* The wick sits on the spout, top right of the bowl. */
.dw-flame {
  position: absolute;
  left: 90%;
  bottom: 80%;
  width: 26%;
  margin-left: -13%;
  transform-origin: 50% 100%;
  animation: dw-flick 1.3s ease-in-out infinite alternate;
  animation-delay: calc(var(--i) * -0.37s);
}

.dw-flame svg {
  display: block;
  width: 100%;
  overflow: visible;
}

.dw-f-out {
  fill: var(--lamp);
}

.dw-f-in {
  fill: var(--lamp-core);
}

/* Lamplight: a pre-softened disc (no blur filter) that breathes with the flame. */
.dw-glow {
  position: absolute;
  left: 90%;
  top: -40%;
  width: 150%;
  aspect-ratio: 1;
  translate: -50% -50%;
  border-radius: 50%;
  background: radial-gradient(
    closest-side,
    color-mix(in srgb, var(--lamp) 55%, transparent),
    color-mix(in srgb, var(--lamp) 18%, transparent) 55%,
    transparent
  );
  animation: dw-breathe 2.6s ease-in-out infinite alternate;
  animation-delay: calc(var(--i) * -0.5s);
}

/* Its pool of light on the water, flattened like the river's own reflections. */
.dw-refl {
  position: absolute;
  left: -30%;
  top: 55%;
  width: 160%;
  height: 70%;
  border-radius: 50%;
  background: radial-gradient(
    closest-side,
    color-mix(in srgb, var(--lamp) 45%, transparent),
    transparent
  );
  opacity: 0.4;
  animation: dw-shimmer 3.2s ease-in-out infinite alternate;
  animation-delay: calc(var(--i) * -0.9s);
}

:root[data-theme='light'] .dw-glow {
  opacity: 0.45;
  animation: none;
}

:root[data-theme='light'] .dw-refl {
  opacity: 0.25;
}

@keyframes dw-in {
  from {
    opacity: 0;
    transform: translate3d(0, 14px, 0) scale(0.9);
  }
}

@keyframes dw-bob {
  from {
    transform: translate3d(0, -2px, 0) rotate(-2.5deg);
  }
  to {
    transform: translate3d(0, 2px, 0) rotate(2deg);
  }
}

@keyframes dw-flick {
  0% {
    transform: scale(1, 1) rotate(-2deg);
  }
  40% {
    transform: scale(0.9, 1.1) rotate(2deg);
  }
  70% {
    transform: scale(1.06, 0.94) rotate(-1deg);
  }
  100% {
    transform: scale(0.96, 1.05) rotate(3deg);
  }
}

@keyframes dw-breathe {
  from {
    opacity: 0.7;
  }
  to {
    opacity: 1;
  }
}

@keyframes dw-shimmer {
  from {
    transform: scaleX(0.85);
    opacity: 0.3;
  }
  to {
    transform: scaleX(1.05);
    opacity: 0.55;
  }
}

/* ---------- The greeting ---------- */
.dw-card {
  position: absolute;
  z-index: 3;
  left: 3%;
  top: 28px;
  width: min(340px, 27vw);
  pointer-events: auto;
  animation: dw-card-in 700ms var(--ease-out) both;
  animation-delay: calc(var(--dw-d) * 0.55);
}

.dw-h {
  margin: 6px 0 8px;
  font-size: 30px;
  font-weight: 750;
  line-height: 1.02;
  letter-spacing: -0.03em;
  color: var(--t-1);
  text-wrap: balance;
}

.dw-h em {
  font-style: normal;
  color: var(--accent);
}

.dw-body {
  max-width: 34ch;
}

.dw-x {
  position: absolute;
  top: calc(var(--bh) + 8px);
  right: 8px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--t-2);
  cursor: pointer;
}

.dw-x:hover {
  background: color-mix(in srgb, var(--t-1) 8%, transparent);
}

.dw-x svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.dw-fire {
  min-height: 38px;
  margin-top: 14px;
  padding: 0 16px;
  font-size: 14px;
}

.dw-pill {
  position: absolute;
  z-index: 3;
  left: 16px;
  top: 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 16px 0 12px;
  border: var(--kw) solid var(--keyline);
  border-radius: 999px;
  background: color-mix(in srgb, var(--paper) 92%, transparent);
  box-shadow: 0 2px 0 var(--under);
  color: var(--t-1);
  font: inherit;
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
  pointer-events: auto;
  animation: dw-pop 420ms var(--ease-spring) both;
}

.dw-pill svg {
  width: 10px;
  height: 18px;
}

@keyframes dw-card-in {
  from {
    opacity: 0;
    transform: translate3d(0, 14px, 0) scale(0.98);
  }
}

@keyframes dw-pop {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
}

@media (max-width: 760px) {
  .dw-card {
    left: 16px;
    right: 16px;
    top: 14px;
    width: auto;
    max-width: 360px;
    margin: 0 auto;
  }

  .dw-h {
    font-size: 26px;
  }

  .dw-diya {
    --dw-w: 44px;
  }

  .dw-pill {
    left: 12px;
    top: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dw-diya,
  .dw-bob,
  .dw-flame,
  .dw-glow,
  .dw-refl,
  .dw-card,
  .dw-pill {
    animation: none;
  }
}
</style>

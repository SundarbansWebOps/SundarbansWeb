<!--
  Desktop corner C: "Garland and stub". The event poster hangs from a nail on the rod in a painted
  frame, a marigold garland swagged across its top the way a portrait is honoured, and an entry
  stub hangs beneath on two links: the date, status, headline and Register. It drops and swings
  once from the nail after the title settles. Hidden at 1020px and below, where the slim
  invitation under the motto takes over.
-->
<template>
  <div v-if="next" class="g-wrap" :class="{ show: ready, drop: ready && !still }">
    <span class="nail" aria-hidden="true" />
    <svg class="cords" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <path d="M50 2 L10 32 M50 2 L90 32" />
    </svg>

    <div class="frame">
      <button type="button" class="art" :aria-label="`Poster: ${next.title}`" @click="open">
        <img v-if="poster" :src="poster" alt="" decoding="async" />
        <img v-else class="crest" :src="CREST" alt="" decoding="async" />
      </button>
      <svg class="garland" viewBox="0 0 220 110" aria-hidden="true">
        <path class="thread" :d="SWAG_PATH" />
        <path class="thread" d="M8 8 V102 M212 8 V102" />
        <g v-for="(f, i) in FLOWERS" :key="i" :transform="`translate(${f.x} ${f.y})`">
          <circle :r="f.r" :class="f.c" />
          <circle :r="f.r * 0.38" class="heart" />
        </g>
      </svg>
    </div>

    <span class="links" aria-hidden="true" />

    <article class="stub" :aria-label="label">
      <p v-if="dateParts" class="date">
        <span class="mon mono">{{ dateParts.month }}</span>
        <b>{{ dateParts.day }}</b>
        <span class="wk">{{ dateParts.weekday }}</span>
      </p>
      <div class="info">
        <p class="kicker mono"><i aria-hidden="true" />{{ countdown || kicker }}</p>
        <p class="name">{{ parts.headline }}</p>
        <p class="time mono">{{ next.time }} IST</p>
      </div>
      <button type="button" class="go" @click="open">
        {{ cta }}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
    </article>
  </div>
</template>

<script setup>
import CREST from '../../../assets/crest.webp';
import { openEvent } from '../../../lib/events.js';
import { countdown, cta, dateParts, kicker, label, next, parts, poster } from './next-event.js';

defineProps({
  ready: { type: Boolean, default: false },
  still: { type: Boolean, default: false },
});

// The garland: marigolds strung on a shallow swag across the frame's top (it keeps clear of the
// poster's lettering), with a strand falling down each side. Large marigolds alternate with small
// vermilion blooms.
const P0 = [8, 8];
const P1 = [110, 34];
const P2 = [212, 8];
const SWAG_PATH = `M${P0} Q${P1} ${P2}`;
const bez = (t, k) => (1 - t) ** 2 * P0[k] + 2 * (1 - t) * t * P1[k] + t ** 2 * P2[k];
const swag = Array.from({ length: 13 }, (_, i) => {
  const t = i / 12;
  return { x: bez(t, 0), y: bez(t, 1), big: i % 2 === 0 };
});
const strands = [8, 212].flatMap((x) =>
  [26, 44, 62, 80, 98].map((y, i) => ({ x, y, big: i % 2 === 1 }))
);
const FLOWERS = [...strands, ...swag].map((f) => ({
  x: +f.x.toFixed(1),
  y: +f.y.toFixed(1),
  r: f.big ? 9 : 5.6,
  c: f.big ? 'mari' : 'verm',
}));

const open = (ev) => openEvent(next.value.id, ev);
</script>

<style scoped>
.g-wrap {
  position: absolute;
  z-index: 5;
  top: calc(var(--rod-h) - 6px);
  right: calc(var(--edge-w) + clamp(30px, 4.6vw, 92px));
  width: clamp(186px, 14vw, 228px);
  transform-origin: 50% 0;
  opacity: 0;
  visibility: hidden;
  filter: drop-shadow(0 14px 16px color-mix(in srgb, var(--pi) 34%, transparent));
}
.g-wrap.show {
  opacity: 1;
  visibility: visible;
}
.g-wrap.drop {
  animation: swing 2s var(--ease-out) both;
}
@keyframes swing {
  0% {
    opacity: 0;
    transform: translateY(-18px) rotate(0deg);
  }
  26% {
    opacity: 1;
    transform: translateY(0) rotate(0deg);
  }
  44% {
    transform: rotate(-3.2deg);
  }
  62% {
    transform: rotate(2deg);
  }
  80% {
    transform: rotate(-0.8deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

.nail {
  position: absolute;
  top: 0;
  left: 50%;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  border: 2px solid var(--pi);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, var(--pmari-soft), var(--pi2) 75%);
}
.cords {
  display: block;
  width: 100%;
  height: 34px;
  overflow: visible;
}
.cords path {
  fill: none;
  stroke: var(--pi);
  stroke-width: 2px;
  vector-effect: non-scaling-stroke;
}

/* The frame: an ink line, a vermilion moulding, a marigold mat, then the poster. */
.frame {
  position: relative;
  padding: 9px;
  border: 1.5px solid var(--pi);
  border-radius: 4px;
  background: var(--pmari);
  box-shadow:
    0 0 0 5px var(--pv),
    0 0 0 6.5px var(--pi);
  margin-inline: 6px;
}
.art {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 5;
  padding: 0;
  border: 1.5px solid var(--pi);
  border-radius: 2px;
  overflow: hidden;
  background: var(--pcard);
  cursor: pointer;
}
.art img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 30%;
  transition: transform 0.5s var(--ease-out);
}
.art:hover img,
.art:focus-visible img {
  transform: scale(1.05);
}
.art .crest {
  padding: 18%;
  object-fit: contain;
}

.garland {
  position: absolute;
  top: -16px;
  left: -24px;
  width: calc(100% + 48px);
  height: auto;
  overflow: visible;
  pointer-events: none;
}
.garland .thread {
  fill: none;
  stroke: var(--pi2);
  stroke-width: 1.4;
}
.garland .mari {
  fill: var(--pmari);
  stroke: var(--pi);
  stroke-width: 1.3;
  stroke-dasharray: 2.2 1.4;
}
.garland .verm {
  fill: var(--pv);
  stroke: var(--pi);
  stroke-width: 1.1;
}
.garland .heart {
  fill: var(--pi);
  opacity: 0.55;
}

/* Two short marigold cords, ink-edged so they read against dark bark, tie the stub to the frame. */
.links {
  position: relative;
  display: block;
  height: 30px;
  margin: 4px 26% -3px;
}
.links::before,
.links::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 6px;
  border: 1.5px solid var(--pi);
  border-radius: 99px;
  background: var(--pmari);
}
.links::before {
  left: -3px;
}
.links::after {
  right: -3px;
}

/* The stub: date block, a dashed tear line with a notch cut above it, details, then Register. */
.stub {
  --cut: 58px;
  display: grid;
  grid-template-columns: var(--cut) minmax(0, 1fr);
  margin-inline: 2px;
  border: 1.5px solid var(--pi);
  border-radius: 8px;
  background:
    repeating-linear-gradient(var(--pi2) 0 4px, transparent 4px 7px) var(--cut) 10px / 1.5px
      calc(100% - 20px) no-repeat,
    var(--pcard);
  color: var(--pi);
  mask: radial-gradient(circle 7px at var(--cut) 0, transparent 95%, var(--pi) 100%);
}
.stub p {
  margin: 0;
}
.date {
  display: grid;
  justify-items: center;
  align-content: center;
  padding: 10px 4px;
  line-height: 1;
}
.date .mon {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--pv);
}
.date b {
  font-size: 30px;
  font-weight: 750;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}
.date .wk {
  font-size: 12px;
  font-weight: 600;
  color: var(--pi2);
}
.info {
  display: grid;
  align-content: center;
  gap: 3px;
  min-width: 0;
  padding: 10px 10px 8px 12px;
}
.kicker {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pv);
}
.kicker i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pv);
}
.name {
  font-size: 15px;
  font-weight: 750;
  line-height: 1.12;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
.time {
  font-size: 11px;
  font-weight: 600;
  color: var(--pi2);
  font-variant-numeric: tabular-nums;
}
.go {
  grid-column: 1 / -1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 14px;
  border: 0;
  border-top: 1.5px solid var(--pi);
  border-radius: 0 0 7px 7px;
  background: var(--pmari);
  color: var(--pi);
  font: inherit;
  font-size: 14px;
  font-weight: 750;
  cursor: pointer;
  transition: background-color 0.2s var(--ease-out);
}
.go:hover {
  background: var(--pmari-soft);
}
.go svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.2s var(--ease-out);
}
.go:hover svg {
  transform: translateX(3px);
}

@media (max-width: 1020px) {
  .g-wrap {
    display: none;
  }
}
</style>

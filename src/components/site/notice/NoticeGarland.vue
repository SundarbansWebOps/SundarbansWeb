<!--
  Prototype C — "Garlanded poster". The whole poster hangs from the rod on two strings, framed like a
  pat plate, with a marigold garland (SVG) draped over the frame the way a picture is garlanded for
  a pooja. A torn ticket stub below carries the countdown, date and Register. The frame drops and
  swings once; nothing loops.
-->
<template>
  <div v-if="next" class="hang" :class="{ show: ready, drop: ready && !still }">
    <span class="str l" aria-hidden="true" />
    <span class="str r" aria-hidden="true" />

    <button type="button" class="frame" :aria-label="label" @click="open">
      <span class="ribbon mono"><i aria-hidden="true" />{{ kicker }}</span>
      <img v-if="poster" :src="poster" alt="" decoding="async" />
      <svg class="garland" viewBox="0 0 240 44" preserveAspectRatio="none" aria-hidden="true">
        <path class="cord" d="M4 4 Q120 52 236 4" />
        <g v-for="(f, i) in flowers" :key="i" :transform="`translate(${f.x} ${f.y})`">
          <circle class="bloom" :class="{ alt: i % 3 === 1 }" r="7.5" />
          <circle class="ring" r="4.6" />
          <circle class="eye" r="1.8" />
        </g>
        <g transform="translate(120 30)">
          <path class="leaf" d="M-4 4 C-14 14 -10 26 -2 30 C0 20 0 12 -4 4 Z" />
          <path class="leaf" d="M4 4 C14 14 10 26 2 30 C0 20 0 12 4 4 Z" />
          <circle class="bloom" r="9" />
          <circle class="ring" r="5.6" />
          <circle class="eye" r="2.2" />
        </g>
      </svg>
    </button>

    <div class="stub">
      <div class="cd">
        <span class="n">{{ bigNumber }}</span>
        <span class="u mono">{{ bigUnit }}</span>
      </div>
      <div class="meta">
        <span v-if="dateParts" class="when mono"
          >{{ dateParts.weekday }}, {{ dateParts.day }} {{ dateParts.month }}<br />{{
            next.time
          }}
          IST</span
        >
        <button type="button" class="go" @click="open">
          {{ cta }}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { openEvent } from '../../../lib/events.js';
import { cta, dateParts, daysLeft, isLive, kicker, next, poster, when } from './next-event.js';

defineProps({
  ready: { type: Boolean, default: false },
  still: { type: Boolean, default: false },
});

// Marigolds strung along the garland's curve (a quadratic from 4,4 via 120,52 to 236,4).
const flowers = Array.from({ length: 11 }, (_, i) => {
  const t = (i + 0.5) / 11;
  const x = (1 - t) ** 2 * 4 + 2 * (1 - t) * t * 120 + t ** 2 * 236;
  const y = (1 - t) ** 2 * 4 + 2 * (1 - t) * t * 52 + t ** 2 * 4;
  return { x, y };
}).filter((f) => Math.abs(f.x - 120) > 14);

const bigNumber = computed(() => {
  if (isLive.value) return 'Live';
  const n = daysLeft.value;
  if (n == null) return '—';
  return n === 0 ? 'Today' : String(n);
});
const bigUnit = computed(() => {
  const n = daysLeft.value;
  if (isLive.value) return 'on air now';
  if (n == null || n === 0) return 'don’t miss it';
  return n === 1 ? 'day to go' : 'days to go';
});

const label = computed(() =>
  [`${kicker.value}: ${next.value?.title}`, when.value].filter(Boolean).join(', ')
);
const open = (ev) => openEvent(next.value.id, ev);
</script>

<style scoped>
.hang {
  --str: 26px;
  position: absolute;
  z-index: 5;
  top: var(--rod-h);
  right: calc(var(--edge-w) + clamp(10px, 3vw, 44px));
  width: clamp(210px, 18vw, 250px);
  transform-origin: 50% 0;
  opacity: 0;
  visibility: hidden;
}
.hang.show {
  opacity: 1;
  visibility: visible;
}
.hang.drop {
  animation: swing 2s var(--ease-out) both;
}
@keyframes swing {
  0% {
    opacity: 0;
    transform: translateY(-24px);
  }
  25% {
    opacity: 1;
    transform: translateY(0) rotate(0deg);
  }
  45% {
    transform: rotate(2.6deg);
  }
  65% {
    transform: rotate(-1.6deg);
  }
  84% {
    transform: rotate(0.7deg);
  }
  100% {
    transform: rotate(0deg);
  }
}
.str {
  position: absolute;
  top: 0;
  width: 1.5px;
  height: calc(var(--str) + 10px);
  background: var(--pi2);
}
.str.l {
  left: 22%;
  transform: rotate(-8deg);
  transform-origin: 50% 0;
}
.str.r {
  right: 22%;
  transform: rotate(8deg);
  transform-origin: 50% 0;
}

/* A painted frame: ink rule, marigold mat, ink rule. */
.frame {
  position: relative;
  display: block;
  width: 100%;
  margin-top: var(--str);
  padding: 7px;
  border: 2px solid var(--pi);
  border-radius: 6px;
  background: var(--pmari);
  box-shadow: var(--shadow);
  cursor: pointer;
}
.frame img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  border: 1.5px solid var(--pi);
  border-radius: 3px;
  background: var(--pp);
  transition: filter 0.3s var(--ease-out);
}
.frame:hover img {
  filter: brightness(1.05) saturate(1.08);
}
.ribbon {
  position: absolute;
  z-index: 2;
  left: 50%;
  bottom: -11px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1.5px solid var(--pi);
  border-radius: 99px;
  background: var(--pv);
  color: var(--pp);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
  transform: translateX(-50%);
}
.ribbon i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pmari);
}

.garland {
  position: absolute;
  left: -6%;
  top: -10px;
  width: 112%;
  height: 17%;
  overflow: visible;
  pointer-events: none;
}
.cord {
  fill: none;
  stroke: var(--pi2);
  stroke-width: 1.4;
}
.bloom {
  fill: var(--pmari);
  stroke: var(--pi);
  stroke-width: 1.2;
}
.bloom.alt {
  fill: var(--pv);
}
.ring {
  fill: none;
  stroke: var(--pi);
  stroke-width: 0.8;
  stroke-dasharray: 1.4 1.6;
}
.eye {
  fill: var(--pi);
}
.leaf {
  fill: var(--pi2);
  stroke: var(--pi);
  stroke-width: 1;
}

/* The ticket stub: perforated top edge, countdown left, date and action right. */
.stub {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  margin: 6px 6px 0;
  padding: 18px 12px 12px;
  border: 1.5px solid var(--pi);
  border-top: 0;
  border-radius: 0 0 8px 8px;
  background: var(--pcard);
  color: var(--pi);
  box-shadow: var(--shadow);
}
.stub::before {
  content: '';
  position: absolute;
  left: -1.5px;
  right: -1.5px;
  top: 0;
  height: 6px;
  background: radial-gradient(
      circle at 4px 0,
      transparent 3.5px,
      var(--pi) 3.5px 5px,
      transparent 5px
    )
    0 0 / 8px 6px repeat-x;
}
.cd {
  display: grid;
  justify-items: center;
  padding-right: 12px;
  border-right: 1.5px dashed var(--pi2);
  line-height: 1;
}
.n {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--pv);
  font-variant-numeric: tabular-nums;
}
.u {
  margin-top: 2px;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pi2);
  white-space: nowrap;
}
.meta {
  display: grid;
  gap: 8px;
  justify-items: start;
}
.when {
  font-size: 10.5px;
  line-height: 1.4;
  font-weight: 600;
  color: var(--pi2);
  font-variant-numeric: tabular-nums;
}
.go {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1.5px solid var(--pi);
  border-radius: 99px;
  background: var(--pmari);
  color: var(--pi);
  font: inherit;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
  box-shadow: 0 2px 0 var(--pi);
  transition:
    transform 0.2s var(--ease-out),
    box-shadow 0.2s var(--ease-out);
}
.go:hover {
  transform: translateY(1px);
  box-shadow: 0 1px 0 var(--pi);
}
.go svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Phone: a smaller frame on a mangrove branch below the title. */
@media (max-width: 560px) {
  .hang {
    --str: 14px;
    top: calc(var(--rod-h) + 330px);
    width: min(42vw, 168px);
  }
  .n {
    font-size: 26px;
  }
  .stub {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    text-align: center;
    gap: 8px;
  }
  .cd {
    padding: 0 0 8px;
    border-right: 0;
    border-bottom: 1.5px dashed var(--pi2);
  }
  .meta {
    justify-items: center;
  }
}
</style>

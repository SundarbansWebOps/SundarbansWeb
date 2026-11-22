<!--
  Desktop corner B: "Little pat". A small scroll — the page's own scroll in miniature — hangs from
  a peg on the big rod by a looped cord and unrolls downward once the title settles: lotus band,
  the event poster, headline and guest, the date lettered in a cartouche like the motto's, and
  Register. The bottom roll turns as it drops. Hidden at 1020px and below, where the slim
  invitation under the motto takes over.
-->
<template>
  <div v-if="next" class="pat-wrap" :class="{ show: ready, drop: ready && !still }">
    <svg class="cord" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <path d="M50 3 L7 29 M50 3 L93 29" />
    </svg>
    <span class="peg" aria-hidden="true" />
    <span class="rod" aria-hidden="true" />

    <div class="unroll">
      <article class="sheet" :aria-label="label">
        <span class="band" aria-hidden="true" />
        <p class="kicker mono">
          <i aria-hidden="true" />{{ kicker
          }}<span v-if="countdown" class="cd">{{ countdown }}</span>
        </p>
        <button type="button" class="art" :aria-label="`Poster: ${next.title}`" @click="open">
          <img v-if="poster" :src="poster" alt="" decoding="async" />
          <img v-else class="crest" :src="CREST" alt="" decoding="async" />
        </button>
        <p class="name">
          {{ parts.headline }}<span v-if="parts.guest" class="guest">with {{ parts.guest }}</span>
        </p>
        <p v-if="dateParts" class="cartouche">
          <b>{{ dateParts.weekday }} {{ dateParts.day }} {{ dateParts.month }}</b>
          <i aria-hidden="true" />
          <span class="mono">{{ next.time }}</span>
        </p>
        <button type="button" class="go" @click="open">
          {{ cta }}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
        <span class="band" aria-hidden="true" />
      </article>
    </div>

    <span class="roll" aria-hidden="true" />
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

const open = (ev) => openEvent(next.value.id, ev);
</script>

<style scoped>
.pat-wrap {
  --cord: 30px;
  --nub: 9px;
  position: absolute;
  z-index: 5;
  top: calc(var(--rod-h) - 8px);
  right: calc(var(--edge-w) + clamp(28px, 4.4vw, 88px));
  width: clamp(196px, 15vw, 246px);
  opacity: 0;
  visibility: hidden;
  filter: drop-shadow(0 14px 18px color-mix(in srgb, var(--pi) 32%, transparent));
}
.pat-wrap.show {
  opacity: 1;
  visibility: visible;
}
.pat-wrap.drop {
  animation: arrive 0.45s var(--ease-out) both;
}
@keyframes arrive {
  from {
    opacity: 0;
    transform: translateY(-16px);
  }
}

/* A brass peg on the big rod; the cord loops over it to both ends of the small rod. */
.peg {
  position: absolute;
  top: 0;
  left: 50%;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  border: 2px solid var(--pi);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, var(--pmari-soft), var(--pmari) 60%);
}
.cord {
  display: block;
  width: 100%;
  height: var(--cord);
  overflow: visible;
}
.cord path {
  fill: none;
  stroke: var(--pi);
  stroke-width: 2px;
  vector-effect: non-scaling-stroke;
}

/* Small turned rods with vermilion finials, drawn from the scroll's pigments. */
.rod,
.roll {
  position: relative;
  display: block;
  margin-inline: calc(-1 * var(--nub));
  border-radius: 99px;
  border: 1.5px solid var(--pi);
}
.rod {
  height: 12px;
  background: linear-gradient(
    color-mix(in srgb, var(--pmari) 45%, var(--pi)),
    var(--pmari) 38%,
    var(--pmari-soft) 52%,
    color-mix(in srgb, var(--pmari) 65%, var(--pi)) 78%,
    color-mix(in srgb, var(--pmari) 35%, var(--pi))
  );
}
.rod::before,
.rod::after,
.roll::before,
.roll::after {
  content: '';
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 10px;
  border: 1.5px solid var(--pi);
  border-radius: 4px;
  background: linear-gradient(
    color-mix(in srgb, var(--pv) 60%, var(--pi)),
    var(--pv) 40%,
    color-mix(in srgb, var(--pv) 70%, var(--pmari)) 52%,
    color-mix(in srgb, var(--pv) 60%, var(--pi))
  );
}
.rod::before,
.roll::before {
  left: -6px;
}
.rod::after,
.roll::after {
  right: -6px;
}
/* The bottom roll: wound paper whose turning lines slide while it unrolls. */
.roll {
  height: 20px;
  margin-top: -2px;
  background:
    linear-gradient(
      color-mix(in srgb, var(--pi) 45%, transparent),
      transparent 30%,
      color-mix(in srgb, var(--pcard) 70%, transparent) 45%,
      transparent 62%,
      color-mix(in srgb, var(--pi) 40%, transparent)
    ),
    repeating-linear-gradient(
        transparent 0 4px,
        color-mix(in srgb, var(--pi2) 30%, transparent) 4px 5px,
        transparent 5px 8px
      )
      0 0 / 100% 8px,
    var(--pp);
}
.drop .roll {
  animation: spin 1.15s 0.4s cubic-bezier(0.55, 0.02, 0.25, 1) both;
}
@keyframes spin {
  from {
    background-position:
      0 0,
      0 0,
      0 0;
  }
  to {
    background-position:
      0 0,
      0 64px,
      0 0;
  }
}

/* The sheet opens from zero height to its own: the roll below rides down with it. */
.unroll {
  display: grid;
  grid-template-rows: 1fr;
}
.drop .unroll {
  animation: open 1.15s 0.4s cubic-bezier(0.55, 0.02, 0.25, 1) both;
}
@keyframes open {
  from {
    grid-template-rows: 0fr;
  }
}

.sheet {
  min-height: 0;
  overflow: hidden;
  display: grid;
  justify-items: center;
  gap: 9px;
  padding: 0 18px;
  background:
    url('../../../assets/pat/edge.webp') left top / 8px auto repeat-y,
    url('../../../assets/pat/edge.webp') right top / 8px auto repeat-y,
    url('../../../assets/pat/grain.webp') 0 0 / 512px 512px,
    var(--pp);
  background-blend-mode: normal, normal, multiply, normal;
  color: var(--pi);
  text-align: center;
}
.sheet p {
  margin: 0;
}
.band {
  justify-self: stretch;
  height: 12px;
  margin-inline: -10px;
  background: url('../../../assets/pat/band.webp') center / auto 100% repeat-x;
}
.band:first-child {
  margin-bottom: 4px;
}
.band:last-child {
  margin-top: 6px;
}

.kicker {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2px 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pv);
}
.kicker i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--pv);
  box-shadow: 0 0 0 3px var(--pmari-soft);
}
.cd {
  flex-basis: 100%;
  color: var(--pi2);
}

.art {
  width: 100%;
  aspect-ratio: 4 / 5;
  padding: 4px;
  border: 1.5px solid var(--pi);
  border-radius: 4px;
  background: var(--pmari);
  cursor: pointer;
  box-shadow:
    0 0 0 3px var(--pp),
    0 0 0 4.5px var(--pi);
  transition: transform 0.35s var(--ease-spring);
}
.art:hover,
.art:focus-visible {
  transform: scale(1.03);
}
.art img {
  display: block;
  width: 100%;
  height: 100%;
  border: 1.5px solid var(--pi);
  border-radius: 2px;
  object-fit: cover;
  object-position: 50% 30%;
  background: var(--pcard);
}
.art .crest {
  padding: 18%;
  object-fit: contain;
}

.name {
  display: grid;
  margin-top: 4px;
  font-size: clamp(17px, 1.3vw, 20px);
  font-weight: 750;
  line-height: 1.1;
  letter-spacing: -0.025em;
  text-wrap: balance;
}
.guest {
  font-size: 0.82em;
  color: var(--pv);
}

/* The date lettered in a cartouche, the motto panel's "IIT Madras BS • since 2021". */
.cartouche {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 13px;
  border: 1.5px solid var(--pi);
  border-radius: 99px;
  background: var(--pmari-soft);
  box-shadow:
    0 0 0 2px var(--pp),
    0 0 0 3.5px var(--pi);
  font-size: 13.5px;
  white-space: nowrap;
}
.cartouche b {
  font-weight: 750;
}
.cartouche i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--pv);
}
.cartouche span {
  font-size: 11.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.go {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 3px;
  padding: 9px 14px;
  border: 1.5px solid var(--pi);
  border-radius: 99px;
  background: var(--pv);
  color: var(--pcard);
  font: inherit;
  font-size: 14px;
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
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (max-width: 1020px) {
  .pat-wrap {
    display: none;
  }
}
</style>

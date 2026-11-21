<!--
  Prototype B — "Invitation". A slim painted invitation set into the title panel under the motto,
  where every visitor reads, kept to one row so the boat and tiger below stay clear. The poster
  (tilted, overhanging the card) shows the guest's face; status, countdown, headline and guest sit
  beside it, then the date and Register. Lotus corners are drawn in SVG to match the scroll's
  borders. It unfurls once after the title settles.
-->
<template>
  <div v-if="next" class="invite" :class="{ show: ready, drop: ready && !still, still }">
    <svg
      v-for="c in ['tl', 'tr', 'bl', 'br']"
      :key="c"
      class="corner"
      :class="c"
      viewBox="0 0 28 28"
      aria-hidden="true"
    >
      <path class="petal" d="M3 3 C3 13 8 18 17 18 C12 13 9 8 3 3 Z" />
      <path class="petal" d="M3 3 C13 3 18 8 18 17 C13 12 8 9 3 3 Z" />
      <circle cx="4.5" cy="4.5" r="2.4" />
    </svg>

    <button type="button" class="art" :aria-label="`Poster: ${next.title}`" @click="open">
      <img v-if="poster" :src="poster" alt="" decoding="async" />
    </button>

    <div class="copy">
      <p class="kicker mono">
        <i aria-hidden="true" /><span>{{ kicker }}</span
        ><span v-if="countdown" class="cd">· {{ countdown }}</span>
      </p>
      <p class="name" :title="next.title">
        {{ parts.headline }}<span v-if="parts.guest" class="guest"> with {{ parts.guest }}</span>
      </p>
    </div>

    <p v-if="dateParts" class="date" :aria-label="when">
      <span class="d">{{ dateParts.weekday }} {{ dateParts.day }} {{ dateParts.month }}</span>
      <span class="t mono">{{ next.time }} IST</span>
    </p>

    <button type="button" class="go" @click="open">
      {{ cta }}
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </button>
  </div>
</template>

<script setup>
import { openEvent } from '../../../lib/events.js';
import { countdown, cta, dateParts, kicker, next, parts, poster, when } from './next-event.js';

defineProps({
  ready: { type: Boolean, default: false },
  still: { type: Boolean, default: false },
});

const open = (ev) => openEvent(next.value.id, ev);
</script>

<style scoped>
.invite {
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 16px;
  width: min(620px, 100%);
  margin-top: 16px;
  padding: 10px 14px 10px 16px;
  border: 1.5px solid var(--pi);
  border-radius: 12px;
  background: var(--pcard);
  box-shadow:
    0 0 0 4px var(--pp),
    0 0 0 5.5px var(--pi),
    var(--shadow);
  color: var(--pi);
  text-align: left;
  opacity: 0;
  visibility: hidden;
  /* The title block drifts with the pointer (HomePage .title). The card sits inside it, so it
     moves the exact opposite way on the same timing and stays put; text drifting across
     sub-pixels read as a blur. */
  transform: translate(calc(var(--mx) * 3px), calc(var(--my) * 2px));
  transition: transform 0.8s var(--ease-out);
}
.invite.still {
  transform: none;
  transition: none;
}
.invite.show {
  opacity: 1;
  visibility: visible;
}
.invite.drop {
  animation: unfurl 0.7s var(--ease-out) backwards;
}
@keyframes unfurl {
  from {
    opacity: 0;
    clip-path: inset(0 50% 0 50%);
  }
  to {
    opacity: 1;
    clip-path: inset(-40px -40px -40px -40px);
  }
}

/* Lotus corners, mirrored per corner. */
.corner {
  position: absolute;
  width: 22px;
  height: 22px;
  pointer-events: none;
}
.corner .petal {
  fill: var(--pmari);
  stroke: var(--pi);
  stroke-width: 1.2;
}
.corner circle {
  fill: var(--pv);
}
.tl {
  top: 3px;
  left: 3px;
}
.tr {
  top: 3px;
  right: 3px;
  transform: scaleX(-1);
}
.bl {
  bottom: 3px;
  left: 3px;
  transform: scaleY(-1);
}
.br {
  bottom: 3px;
  right: 3px;
  transform: scale(-1);
}

/* The poster overhangs the slim card, tilted like a pinned print; on hover it straightens and
   lifts. Only the picture moves. */
.art {
  position: relative;
  z-index: 1;
  aspect-ratio: 4 / 5;
  margin-block: -22px;
  padding: 0;
  border: 1.5px solid var(--pi);
  border-radius: 5px;
  overflow: hidden;
  background: var(--pp);
  cursor: pointer;
  transform: rotate(-2.5deg);
  box-shadow: 3px 3px 0 var(--pmari);
  transition:
    transform 0.35s var(--ease-spring),
    box-shadow 0.35s var(--ease-out);
}
.art:hover,
.art:focus-visible {
  transform: rotate(0deg) scale(1.08);
  box-shadow: 4px 4px 0 var(--pv);
}
.art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 30%;
}

.copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.copy p {
  margin: 0;
}
.kicker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 6px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
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
  color: var(--pi2);
}
.name {
  overflow: hidden;
  font-size: clamp(17px, 1.45vw, 20px);
  font-weight: 750;
  line-height: 1.15;
  letter-spacing: -0.02em;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.guest {
  color: var(--pv);
}

.date {
  display: grid;
  justify-items: end;
  gap: 2px;
  margin: 0;
  padding-left: 16px;
  border-left: 1.5px dashed var(--pi2);
  line-height: 1.1;
  white-space: nowrap;
}
.d {
  font-size: 15px;
  font-weight: 750;
  letter-spacing: -0.01em;
}
.t {
  font-size: 11px;
  font-weight: 600;
  color: var(--pi2);
  font-variant-numeric: tabular-nums;
}

.go {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1.5px solid var(--pi);
  border-radius: 99px;
  background: var(--pmari);
  color: var(--pi);
  font: inherit;
  font-size: 13.5px;
  font-weight: 750;
  white-space: nowrap;
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

/* Narrow: poster and copy on top, date and action in a strip below. */
@media (max-width: 640px) {
  .invite {
    grid-template-columns: 64px minmax(0, 1fr) auto;
    row-gap: 10px;
    column-gap: 12px;
    width: 100%;
    padding: 12px;
  }
  /* Spans both rows and sits centred, overhanging top and bottom equally as on desktop. */
  .art {
    grid-row: span 2;
    align-self: center;
    margin-block: -14px;
  }
  .copy {
    grid-column: 2 / -1;
  }
  .name {
    white-space: normal;
  }
  .kicker {
    letter-spacing: 0.08em;
  }
  .date {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 8px;
    min-width: 0;
    padding: 10px 0 0;
    border-left: 0;
    border-top: 1.5px dashed var(--pi2);
  }
  .go {
    align-self: end;
  }
}
</style>

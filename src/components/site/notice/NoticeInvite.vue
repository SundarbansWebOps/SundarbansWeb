<!--
  Prototype B — "Invitation". A painted invitation set into the title panel, under the motto, where
  every visitor reads. Poster on the left, headline, guest and one-line teaser in the middle, a date
  leaf and the Register / Details actions on the right. Lotus corners are drawn in SVG to match the
  scroll's borders. It is brushed in once after the title settles.
-->
<template>
  <div v-if="next" class="invite" :class="{ show: ready, drop: ready && !still }">
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
        <i aria-hidden="true" />{{ kicker
        }}<span v-if="countdown" class="cd">· {{ countdown }}</span>
      </p>
      <p v-if="parts.series" class="series">{{ parts.series }} presents</p>
      <p class="name">
        {{ parts.headline }}<span v-if="parts.guest" class="guest"> with {{ parts.guest }}</span>
      </p>
      <p v-if="teaser" class="teaser">{{ teaser }}</p>
    </div>

    <div class="side">
      <div v-if="dateParts" class="leaf" :aria-label="when">
        <span class="mon mono">{{ dateParts.month }}</span>
        <span class="day">{{ dateParts.day }}</span>
        <span class="time mono">{{ dateParts.weekday }} · {{ next.time }}</span>
      </div>
      <div class="acts">
        <button type="button" class="go" @click="open">
          {{ cta }}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { openEvent } from '../../../lib/events.js';
import {
  countdown,
  cta,
  dateParts,
  kicker,
  next,
  parts,
  poster,
  teaser,
  when,
} from './next-event.js';

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
  grid-template-columns: 92px minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  width: min(660px, 100%);
  margin-top: 14px;
  padding: 14px 16px 14px 14px;
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
}
.invite.show {
  opacity: 1;
  visibility: visible;
}
.invite.drop {
  animation: unfurl 0.7s var(--ease-out) both;
}
@keyframes unfurl {
  from {
    opacity: 0;
    transform: translateY(10px) scaleY(0.9);
    clip-path: inset(0 50% 0 50%);
  }
  to {
    opacity: 1;
    transform: none;
    clip-path: inset(-12px -12px -12px -12px);
  }
}

/* Lotus corners, mirrored per corner. */
.corner {
  position: absolute;
  width: 26px;
  height: 26px;
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

.art {
  position: relative;
  aspect-ratio: 4 / 5;
  padding: 0;
  border: 1.5px solid var(--pi);
  border-radius: 6px;
  overflow: hidden;
  background: var(--pp);
  cursor: pointer;
  transform: rotate(-2.5deg);
  box-shadow: 3px 3px 0 var(--pmari);
  transition: transform 0.35s var(--ease-spring);
}
.art:hover {
  transform: rotate(0deg) scale(1.04);
}
.art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 30%;
}

.copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.copy p:not(.teaser) {
  margin: 0;
}
.kicker {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
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
  color: var(--pi2);
}
.series {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--pi2);
}
.name {
  margin: 0;
  font-size: clamp(19px, 1.7vw, 23px);
  font-weight: 750;
  line-height: 1.08;
  letter-spacing: -0.025em;
}
.guest {
  color: var(--pv);
}
.teaser {
  margin: 3px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--pi2);
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.side {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding-left: 16px;
  border-left: 1.5px dashed var(--pi2);
}
.leaf {
  display: grid;
  justify-items: center;
  line-height: 1;
}
.mon {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--pv);
}
.day {
  font-size: 38px;
  font-weight: 800;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}
.time {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--pi2);
  white-space: nowrap;
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

/* Phone: poster and copy side by side, date and action in a strip below. */
@media (max-width: 560px) {
  .invite {
    grid-template-columns: 76px minmax(0, 1fr);
    gap: 12px;
    width: 100%;
    padding: 12px;
  }
  .teaser {
    display: none;
  }
  .kicker {
    flex-wrap: wrap;
    column-gap: 6px;
    row-gap: 2px;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }
  .name {
    font-size: 18px;
  }
  .side {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0 0;
    border-left: 0;
    border-top: 1.5px dashed var(--pi2);
  }
  .leaf {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .day {
    font-size: 24px;
  }
}
</style>

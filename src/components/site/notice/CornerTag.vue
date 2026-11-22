<!--
  Desktop corner A: "Poster tag". A tag tied to the scroll rod on a single string hangs over the
  right-hand mangrove: the poster (with a countdown stamp), the headline and guest, the date, and a
  Register foot. It drops and sways once after the title settles. Hidden at 1020px and below,
  where the slim invitation under the motto takes over.
-->
<template>
  <div v-if="next" class="tag-wrap" :class="{ show: ready, drop: ready && !still }">
    <span class="knot" aria-hidden="true" />
    <span class="string" aria-hidden="true" />
    <article class="tag" :aria-label="label">
      <span class="hole" aria-hidden="true" />
      <button type="button" class="art" :aria-label="`Poster: ${next.title}`" @click="open">
        <img v-if="poster" :src="poster" alt="" decoding="async" />
        <img v-else class="crest" :src="CREST" alt="" decoding="async" />
        <span v-if="countdown" class="stamp mono">{{ countdown }}</span>
      </button>
      <p class="kicker mono"><i aria-hidden="true" />{{ kicker }}</p>
      <p class="name">
        {{ parts.headline }}<span v-if="parts.guest" class="guest"> with {{ parts.guest }}</span>
      </p>
      <p v-if="dateParts" class="when">
        <b>{{ dateParts.weekday }} {{ dateParts.day }} {{ dateParts.month }}</b>
        <span class="mono">{{ next.time }} IST</span>
      </p>
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

const open = (ev) => openEvent(next.value.id, ev);
</script>

<style scoped>
.tag-wrap {
  --string: 34px;
  position: absolute;
  z-index: 5;
  top: calc(var(--rod-h) - 6px);
  right: calc(var(--edge-w) + clamp(24px, 4.2vw, 84px));
  width: clamp(184px, 14.5vw, 236px);
  transform-origin: 50% 0;
  opacity: 0;
  visibility: hidden;
}
.tag-wrap.show {
  opacity: 1;
  visibility: visible;
}
.tag-wrap.drop {
  animation: hang 1.9s var(--ease-out) both;
}
@keyframes hang {
  0% {
    opacity: 0;
    transform: translateY(-14px) rotate(0deg);
  }
  28% {
    opacity: 1;
    transform: translateY(0) rotate(0deg);
  }
  46% {
    transform: rotate(4deg);
  }
  64% {
    transform: rotate(-2.4deg);
  }
  82% {
    transform: rotate(1deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

/* The string is knotted round the rod and runs to the tag's eyelet. */
.knot {
  position: absolute;
  top: -4px;
  left: 50%;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  border: 2px solid var(--pi);
  border-radius: 50%;
  background: var(--pmari);
}
.string {
  position: absolute;
  top: 8px;
  left: 50%;
  width: 2px;
  height: calc(var(--string) + 6px);
  margin-left: -1px;
  background: var(--pi);
}

.tag {
  position: relative;
  display: grid;
  gap: 7px;
  margin-top: var(--string);
  padding: 26px 12px 12px;
  border: 1.5px solid var(--pi);
  border-radius: 10px 10px 12px 12px;
  background: var(--pcard);
  box-shadow:
    0 0 0 3px var(--pp),
    0 0 0 4.5px var(--pi),
    var(--shadow);
  color: var(--pi);
}
.hole {
  position: absolute;
  top: 8px;
  left: 50%;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  border: 2px solid var(--pi);
  border-radius: 50%;
  background: var(--pp);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--pi) 30%, transparent);
}
.tag p {
  margin: 0;
}

.art {
  position: relative;
  display: block;
  aspect-ratio: 4 / 5;
  padding: 0;
  border: 1.5px solid var(--pi);
  border-radius: 6px;
  overflow: hidden;
  background: var(--pp);
  cursor: pointer;
  box-shadow: 3px 3px 0 var(--pmari);
  transition:
    transform 0.35s var(--ease-spring),
    box-shadow 0.35s var(--ease-out);
}
.art:hover,
.art:focus-visible {
  transform: translate(-1px, -2px);
  box-shadow: 5px 5px 0 var(--pmari);
}
.art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 30%;
}
.art .crest {
  padding: 18%;
  object-fit: contain;
}
.stamp {
  position: absolute;
  right: 8px;
  bottom: 10px;
  padding: 4px 8px;
  border: 1.5px solid var(--pi);
  border-radius: 99px;
  background: var(--pv);
  color: var(--pcard);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transform: rotate(-4deg);
}

.kicker {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 10.5px;
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
.name {
  font-size: clamp(16px, 1.25vw, 19px);
  font-weight: 750;
  line-height: 1.12;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
.guest {
  color: var(--pv);
}
.when {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px 8px;
  padding-top: 7px;
  border-top: 1.5px dashed var(--pi2);
  font-size: 14px;
  line-height: 1.1;
}
.when b {
  font-weight: 750;
}
.when span {
  font-size: 11px;
  font-weight: 600;
  color: var(--pi2);
  font-variant-numeric: tabular-nums;
}

.go {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 2px;
  padding: 9px 14px;
  border: 1.5px solid var(--pi);
  border-radius: 99px;
  background: var(--pmari);
  color: var(--pi);
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
  .tag-wrap {
    display: none;
  }
}
</style>

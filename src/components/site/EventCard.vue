<!--
  One past event in the log. The poster "develops" like a print in a tray:
  a 300-byte blurred preview first, then the real image fades up from sepia. The date is
  stamped onto the corner as the card scrolls in.
-->
<template>
  <button
    type="button"
    class="card"
    :class="[`w-${e.wing}`, { hot: ev.hover === e.id }]"
    :style="{ '--i': i }"
    @click="$emit('open', e.id, $event)"
    @mouseenter="ev.hover = e.id"
    @mouseleave="ev.hover = null"
    @focus="ev.hover = e.id"
    @blur="ev.hover = null"
  >
    <span class="poster" :style="{ aspectRatio: e.ratio ? `${e.ratio}` : '4 / 5' }">
      <template v-if="e.image">
        <img class="lq" :src="img.blur(e.image)" alt="" aria-hidden="true" />
        <img
          class="hi"
          :class="{ on: loaded }"
          :src="img.card(e.image)"
          :alt="`${e.title} poster`"
          loading="lazy"
          decoding="async"
          @load="loaded = true"
        />
      </template>
      <TypePoster v-else :e="e" />
      <span v-if="e.stage === 'live'" class="stamp live-stamp">
        <b>Live</b>
        <small>now</small>
      </span>
      <span v-else-if="e.at && e.image" class="stamp mono">
        <b>{{ e.range || e.d || MONTH[e.m] }}</b>
        <small>{{ e.d ? MONTH[e.m] : e.y }}</small>
      </span>
    </span>
    <span class="meta">
      <i class="dot" />{{ e.type }}
      <template v-if="e.online"> · Online</template>
    </span>
    <strong class="title">{{ e.title }}</strong>
  </button>
</template>

<script setup>
import { ref } from 'vue';
import TypePoster from './TypePoster.vue';
import { MONTH, ev, img } from '../../lib/events.js';

defineProps({
  e: { type: Object, required: true },
  i: { type: Number, default: 0 },
});
defineEmits(['open']);
const loaded = ref(false);
</script>

<style scoped>
.card {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  opacity: 0;
  transform: translateY(18px);
  transition:
    opacity 0.6s var(--ease-out),
    transform 0.7s var(--ease-out);
  transition-delay: calc(var(--i) * 70ms);
}
.in .card {
  opacity: 1;
  transform: none;
}
.poster {
  position: relative;
  display: block;
  border-radius: 12px;
  overflow: hidden;
  background: var(--sunk);
  box-shadow: var(--shadow);
  transition:
    transform 0.45s var(--ease-spring),
    box-shadow 0.3s;
}
.card:hover .poster,
.card.hot .poster {
  transform: translateY(-4px) rotate(-0.6deg);
  box-shadow:
    0 0 0 2px var(--w),
    var(--shadow);
}
/* A painted fallback poster's figure lifts with the card (TypePoster). */
.card:hover .poster :deep(.fig),
.card.hot .poster :deep(.fig) {
  transform: translateY(-3px) rotate(-1deg) scale(1.03);
}
.poster img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.lq {
  filter: blur(10px) saturate(0.8);
  transform: scale(1.12);
}
.hi {
  opacity: 0;
  filter: sepia(0.9) contrast(0.55) brightness(1.25) blur(4px);
  transform: scale(1.04);
  transition:
    opacity 0.5s ease,
    filter 1.3s var(--ease-out),
    transform 1.3s var(--ease-out);
}
.hi.on {
  opacity: 1;
  filter: none;
  transform: none;
}

/* Rubber stamp: thumps down when the month scrolls into view. */
.stamp {
  position: absolute;
  left: 10px;
  top: 10px;
  display: grid;
  justify-items: center;
  min-width: 46px;
  padding: 4px 7px 5px;
  border: 2px solid var(--w);
  border-radius: 7px;
  background: color-mix(in srgb, var(--card) 88%, transparent);
  color: var(--w);
  line-height: 1;
  opacity: 0;
  transform: scale(1.7) rotate(-16deg);
  transition:
    opacity 0.15s,
    transform 0.45s var(--ease-spring);
  transition-delay: calc(var(--i) * 70ms + 380ms);
}
.in .stamp {
  opacity: 1;
  transform: rotate(-7deg);
}
.stamp b {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.04em;
}
.stamp small {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
}
.live-stamp {
  border-color: var(--verm);
  color: var(--verm);
}
.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 550;
  color: var(--ink-2);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--w);
}
.title {
  font-size: 16px;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -0.01em;
  text-wrap: pretty;
}
</style>

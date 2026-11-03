<!--
  For events with no real poster: a small pat, painted for its wing (a Baul singer for
  cultural, a maker for tech, players for games, a speaker for talks, friends over chai for
  meetups), with the event's own title lettered above it inside a dotted pat border. The paper
  stays light in both themes, like the plates on Home and Teams.
-->
<template>
  <div class="tp" :class="{ big }" :style="{ '--w': INK[e.wing] ?? INK.cultural }">
    <small class="mono">{{ WINGS[e.wing].label.toUpperCase() }}</small>
    <strong :style="{ fontSize: size }">{{ e.title }}</strong>
    <img
      v-if="POSTER_ART[e.wing]"
      class="fig"
      :src="POSTER_ART[e.wing]"
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
    />
    <span class="foot mono">{{ e.at ? fullDate(e) : e.type }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { WINGS, fullDate } from '../../lib/events.js';
import { POSTER_ART } from '../../lib/art.js';

const props = defineProps({ e: { type: Object, required: true }, big: Boolean });
const size = computed(() => {
  const n = props.e.title.length;
  const base = n < 14 ? 26 : n < 26 ? 21 : n < 40 ? 18 : 15;
  return `${props.big ? base * 1.5 : base}px`;
});
// Wing inks for the poster's light paper, in both themes (tokens in src/assets/tokens.css).
const INK = {
  cultural: 'var(--poster-cultural)',
  games: 'var(--poster-games)',
  tech: 'var(--poster-tech)',
  talks: 'var(--poster-talks)',
  girls: 'var(--poster-girls)',
  meetups: 'var(--poster-meetups)',
};
</script>

<style scoped>
.tp {
  position: relative;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  width: 100%;
  height: 100%;
  padding: 16px 16px 14px;
  overflow: hidden;
  background:
    radial-gradient(
      90% 60% at 50% 100%,
      color-mix(in srgb, var(--w) 18%, transparent),
      transparent
    ),
    #f6ecd8;
  color: var(--w);
  text-align: left;
}
/* Pat border: a band of the wing colour with a white dot running round it. */
.tp::before,
.tp::after {
  content: '';
  position: absolute;
  pointer-events: none;
}
.tp::before {
  inset: 0;
  border: 7px solid var(--w);
}
.tp::after {
  inset: 3px;
  border: 1.5px dotted #fff6e4;
}
small {
  position: relative;
  font-size: 10px;
  letter-spacing: 0.16em;
  opacity: 0.85;
}
strong {
  position: relative;
  z-index: 1;
  margin-top: 4px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.02;
  color: #1d1915;
  text-wrap: balance;
}
.fig {
  align-self: end;
  justify-self: center;
  width: 108%;
  max-width: none;
  min-height: 0;
  max-height: 100%;
  margin: 2px -4% -4px;
  object-fit: contain;
  object-position: 50% 100%;
  transition: transform 0.6s var(--ease-spring);
}
.foot {
  position: relative;
  font-size: 11px;
  opacity: 0.9;
}
.big {
  padding: 26px 26px 22px;
}
.big::before {
  border-width: 10px;
}
.big::after {
  inset: 4px;
  border-width: 2px;
}
.big small {
  font-size: 12px;
}
.big .foot {
  font-size: 13px;
}
</style>

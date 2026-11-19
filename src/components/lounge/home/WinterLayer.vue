<!--
  Winter on Home (season.js): snow falling over the river and a band of mist lying on the
  water under the far bank. Mounted inside HomeWorld above the plate, under everyone else's
  lanterns and kites. Motion budget:
  - Far and mid snow: three tiled layers, each a few radial-gradient dots repeated across the
    hero, painted once and moved by the compositor (transform falls one tile and loops; the
    translate property sways). Hundreds of flakes for the cost of three layers.
  - Near snow: a handful of DOM flakes, the same two properties each. Opacity is fixed per
    flake; nothing animates paint, blur or shadow.
  - Every loop is CSS, so it pauses with the hero off screen (.m-off), in a hidden tab and
    under the sign-in door (html.m-hidden), and resumes from where it was: no burst.
  - Reduced motion and lite: no falling snow; the mist and a few flakes stay, still.
  Colours follow the theme through tokens only, so a theme switch repaints the layers once
  and never restarts them.
-->
<template>
  <div class="winter" aria-hidden="true">
    <div class="mist"></div>
    <i
      v-for="(t, i) in TILES"
      :key="`t${i}`"
      class="tile"
      :style="{
        '--tile': `${t.size}px`,
        '--d': `${t.d}s`,
        '--sw': `${t.sw}px`,
        '--sd': `${t.sd}s`,
        opacity: t.o,
        backgroundImage: t.image,
        backgroundSize: `${t.size}px ${t.size}px`,
      }"
    ></i>
    <i
      v-for="(f, i) in near"
      :key="i"
      class="flake"
      :style="{
        left: `${f.x}%`,
        width: `${f.z}px`,
        opacity: f.a,
        '--p': f.p,
        '--d': `${f.d}s`,
        '--o': `${f.o}s`,
        '--sw': `${f.sw}px`,
        '--sd': `${f.sd}s`,
        '--so': `${f.so}s`,
      }"
    ></i>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ phone: { type: Boolean, default: false } });

/* The same fixed sequence as HomeWorld's sky: the snow is the same on every visit. */
function seq(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* One tile of flakes: n soft dots, kept clear of the tile's edges so none is cut in half
   where the tile repeats. Tiles of different sizes and speeds hide each other's repeat. */
function tile(seed, size, n, r0, r1) {
  const r = seq(seed);
  return Array.from({ length: n }, () => {
    const rad = r0 + r() * (r1 - r0);
    const at = () => (rad + 1 + r() * (size - 2 * rad - 2)).toFixed(1);
    return `radial-gradient(circle ${rad.toFixed(2)}px at ${at()}px ${at()}px, var(--snow) 62%, var(--snow-rim) 84%, transparent)`;
  }).join(',');
}
/* size: tile px (also the fall per loop), d: seconds per tile, sw/sd: sway px and period. */
const TILES = [
  { size: 150, n: 11, r: [1.05, 1.45], d: 12, sw: 8, sd: 7.3, o: 0.7, seed: 31 },
  { size: 214, n: 9, r: [1.3, 1.8], d: 12.5, sw: 12, sd: 9.1, o: 0.8, seed: 37 },
  { size: 296, n: 7, r: [1.9, 2.5], d: 11.5, sw: 16, sd: 6.2, o: 0.92, seed: 41 },
].map((t) => ({ ...t, image: tile(t.seed, t.size, t.n, ...t.r) }));

/* Near flakes, 2-4 px. Each is a full-height column whose flake sits at its foot, so one
   translateY(-100% -> 0) carries it from above the hero to below it at any hero height.
   --p is where it rests when nothing moves (reduced motion, lite). */
const near = computed(() => {
  const r = seq(53);
  const n = props.phone ? 8 : 16;
  return Array.from({ length: n }, (_, i) => {
    const d = 9 + r() * 6;
    return {
      x: +((i + 0.15 + r() * 0.7) * (100 / n)).toFixed(2),
      z: +(2 + r() * 2).toFixed(1),
      a: +(0.72 + r() * 0.28).toFixed(2),
      p: +(0.08 + r() * 0.84).toFixed(3),
      d: +d.toFixed(2),
      o: -(r() * d).toFixed(2),
      sw: Math.round(6 + r() * 8),
      sd: +(3 + r() * 2.5).toFixed(2),
      so: -(r() * 5).toFixed(2),
    };
  });
});
</script>

<style scoped>
.winter {
  /* Snow is the lightest paper by day and the lightest ink by night; the rim keeps a flake
     visible against the cream day sky. */
  --snow: var(--paper);
  --snow-rim: color-mix(in srgb, var(--t-2) 42%, transparent);
  --mist: color-mix(in srgb, var(--paper) 70%, transparent);
  position: absolute;
  inset: 0;
  pointer-events: none;
}
:root[data-theme='dark'] .winter {
  --snow: var(--t-1);
  --snow-rim: color-mix(in srgb, var(--t-1) 35%, transparent);
  --mist: color-mix(in srgb, var(--t-2) 26%, transparent);
}

/* ---------- Mist: a still band lying on the water under the far bank ---------- */
/* Soft wisps over an even band, so its one slow drift reads as the mist moving. */
.mist {
  position: absolute;
  left: -48px;
  right: -48px;
  top: calc(var(--hz) - 14px);
  height: calc((var(--hh) - var(--hz)) * 0.3);
  background:
    radial-gradient(ellipse 30% 42% at 22% 46%, var(--mist), transparent),
    radial-gradient(ellipse 26% 36% at 61% 54%, var(--mist), transparent),
    radial-gradient(ellipse 22% 34% at 88% 42%, var(--mist), transparent),
    linear-gradient(transparent, var(--mist) 32%, var(--mist) 46%, transparent);
  animation: mist-drift 70s ease-in-out infinite alternate;
}
@keyframes mist-drift {
  from {
    translate: -28px 0;
  }
  to {
    translate: 28px 0;
  }
}

/* ---------- Far and mid snow: tiled layers ---------- */
/* One tile taller than the hero and a sway wider: falling exactly one tile per loop lands
   on the same picture, so the loop has no seam. */
.tile {
  position: absolute;
  left: -24px;
  right: -24px;
  top: 0;
  height: calc(100% + var(--tile));
  background-repeat: repeat;
  animation:
    snow-fall var(--d) linear infinite,
    snow-sway var(--sd) ease-in-out infinite alternate;
}
@keyframes snow-fall {
  from {
    transform: translate3d(0, calc(var(--tile) * -1), 0);
  }
  to {
    transform: translate3d(0, 0, 0);
  }
}
@keyframes snow-sway {
  from {
    translate: calc(var(--sw) * -1) 0;
  }
  to {
    translate: var(--sw) 0;
  }
}

/* ---------- Near snow ---------- */
.flake {
  position: absolute;
  top: 0;
  height: 100%;
  transform: translate3d(0, calc(var(--p) * -100%), 0);
  animation:
    flake-fall var(--d) linear var(--o) infinite,
    snow-sway var(--sd) ease-in-out var(--so) infinite alternate;
}
.flake::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(closest-side, var(--snow) 62%, var(--snow-rim) 86%, transparent);
}
/* From just above the hero to just below it (the flake is at the column's foot). */
@keyframes flake-fall {
  from {
    transform: translate3d(0, -101%, 0);
  }
  to {
    transform: translate3d(0, 1%, 0);
  }
}

/* Fresh load: the snow comes in with the light on the water (HomeWorld .is-intro). */
.is-intro .winter {
  animation: m-fade-in 1200ms 1100ms linear backwards;
}

/* ---------- Still: lite devices and reduced motion ---------- */
:root.lite .tile,
:root.lite .flake:nth-child(odd) {
  display: none;
}
:root.lite .mist,
:root.lite .flake {
  animation: none;
}
@media (prefers-reduced-motion: reduce) {
  .tile,
  .flake:nth-child(odd) {
    display: none;
  }
  .mist,
  .flake,
  .winter {
    animation: none;
  }
}
</style>

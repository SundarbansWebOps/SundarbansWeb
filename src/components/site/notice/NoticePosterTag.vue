<!--
  Prototype A — "Poster tag". The rod tag grows into a hanging card: the event poster (so the
  guest's face is the first thing seen), the headline, the guest, the date and a Register foot.
  Same rod, string, eyelet and single sway as the shipped tag.
-->
<template>
  <div v-if="next" class="tag-wrap" :class="{ show: ready, drop: ready && !still }">
    <span class="string" aria-hidden="true" />
    <button type="button" class="tag" :aria-label="label" @click="openEvent(next.id, $event)">
      <span class="hole" aria-hidden="true" />
      <span v-if="poster" class="art">
        <img :src="poster" alt="" decoding="async" />
        <span class="stamp mono">{{ countdown }}</span>
      </span>
      <span class="body">
        <span class="kicker mono"><i aria-hidden="true" />{{ kicker }}</span>
        <span v-if="parts.series" class="series">{{ parts.series }}</span>
        <span class="name">{{ parts.headline }}</span>
        <span v-if="parts.guest" class="guest">with {{ parts.guest }}</span>
        <span v-if="when" class="when mono">{{ when }}</span>
      </span>
      <span class="foot">
        {{ cta }}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { openEvent } from '../../../lib/events.js';
import { countdown, cta, kicker, next, parts, poster, when } from './next-event.js';

defineProps({
  ready: { type: Boolean, default: false },
  still: { type: Boolean, default: false },
});

const label = computed(() =>
  [`${kicker.value}: ${next.value?.title}`, when.value, cta.value].filter(Boolean).join(', ')
);
</script>

<style scoped>
.tag-wrap {
  --string: 20px;
  --hang: 50%;
  position: absolute;
  z-index: 5;
  top: var(--rod-h);
  right: calc(var(--edge-w) + clamp(10px, 3vw, 44px));
  width: clamp(200px, 18vw, 244px);
  transform-origin: 50% 0;
  opacity: 0;
  visibility: hidden;
}
.tag-wrap.show {
  opacity: 1;
  visibility: visible;
}
.tag-wrap.drop {
  animation: hang 1.8s var(--ease-out) both;
}
@keyframes hang {
  0% {
    opacity: 0;
    transform: translateY(-10px) rotate(0deg);
  }
  30% {
    opacity: 1;
    transform: translateY(0) rotate(0deg);
  }
  48% {
    transform: rotate(4deg);
  }
  66% {
    transform: rotate(-2.6deg);
  }
  82% {
    transform: rotate(1.2deg);
  }
  100% {
    transform: rotate(0deg);
  }
}
.string {
  position: absolute;
  left: var(--hang);
  top: 0;
  height: calc(var(--string) + 12px);
  width: 1.5px;
  margin-left: -0.75px;
  background: var(--pi2);
}

.tag {
  position: relative;
  display: grid;
  width: 100%;
  margin-top: var(--string);
  padding: 20px 10px 0;
  border: 1.5px solid var(--pi);
  border-radius: 8px;
  background: var(--pcard);
  box-shadow: var(--shadow);
  color: var(--pi);
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition:
    transform 0.3s var(--ease-out),
    background-color 0.3s var(--ease-out);
}
.tag:hover {
  transform: translateY(2px);
}
.hole {
  position: absolute;
  top: 7px;
  left: var(--hang);
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border: 1.5px solid var(--pi);
  border-radius: 50%;
  background: var(--pp);
}

/* The poster, cropped to the guest; the countdown is stamped on its corner. */
.art {
  position: relative;
  display: block;
  aspect-ratio: 5 / 4;
  border: 1.5px solid var(--pi);
  border-radius: 4px;
  overflow: hidden;
  background: var(--pp);
}
.art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 22%;
  transition: transform 0.5s var(--ease-out);
}
.tag:hover .art img {
  transform: scale(1.04);
}
.stamp {
  position: absolute;
  left: 6px;
  bottom: 6px;
  padding: 3px 8px;
  border: 1.5px solid var(--pi);
  border-radius: 99px;
  background: var(--pmari);
  color: var(--pi);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.body {
  display: grid;
  gap: 3px;
  padding: 10px 4px 12px;
}
.kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--pv);
}
.kicker i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pv);
}
.series {
  font-size: 12px;
  font-weight: 600;
  color: var(--pi2);
}
.name {
  font-size: 19px;
  font-weight: 750;
  line-height: 1.05;
  letter-spacing: -0.025em;
}
.guest {
  font-size: 14px;
  font-weight: 650;
  color: var(--pv);
}
.when {
  margin-top: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--pi2);
  font-variant-numeric: tabular-nums;
}

/* The painted foot doubles as the call to action. */
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 -10px;
  padding: 9px 14px;
  border-top: 1.5px solid var(--pi);
  background: var(--pmari);
  color: var(--pi);
  font-size: 13.5px;
  font-weight: 750;
}
.foot svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.3s var(--ease-out);
}
.tag:hover .foot svg {
  transform: translateX(3px);
}

/* Phone: hangs from a mangrove branch, poster beside the text so it stays short. */
@media (max-width: 560px) {
  .tag-wrap {
    --string: 14px;
    top: calc(var(--rod-h) + 346px);
    width: min(78vw, 300px);
  }
  .tag {
    grid-template-columns: 92px minmax(0, 1fr);
    column-gap: 10px;
    padding-top: 20px;
  }
  .art {
    aspect-ratio: 4 / 5;
    align-self: start;
  }
  .stamp {
    left: 4px;
    right: 4px;
    bottom: 4px;
    text-align: center;
    font-size: 9.5px;
    padding: 2px 4px;
  }
  .body {
    padding: 0 0 10px;
  }
  .name {
    font-size: 16px;
  }
  .guest {
    font-size: 13px;
  }
  .foot {
    grid-column: 1 / -1;
    font-size: 13px;
  }
}
</style>

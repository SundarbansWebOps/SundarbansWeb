<!--
  The next event, as a paper tag tied to the Home scroll's top rod, like the label on a patua's
  roll. It opens the event sheet in place (HomePage mounts EventSheet). Colours are the scroll's
  painted pigments (--pp, --pi…), inherited from .pat, so the tag matches the plate in both themes.
  It drops in once when the title panel settles and sways once from the rod; nothing loops.
-->
<template>
  <div v-if="next" class="tag-wrap" :class="{ show: ready, drop: ready && !still }">
    <span class="string" aria-hidden="true" />
    <button type="button" class="tag" :aria-label="label" @click="openEvent(next.id, $event)">
      <span class="hole" aria-hidden="true" />
      <span class="kicker mono">{{ kicker }}</span>
      <span class="name">{{ next.title }}</span>
      <span v-if="when" class="when mono">{{ when }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { fullDate, live, openEvent, upcoming } from '../../lib/events.js';

defineProps({
  // The title panel has finished unrolling; the tag drops in once then.
  ready: { type: Boolean, default: false },
  // Reduced motion: the tag appears with no drop or sway.
  still: { type: Boolean, default: false },
});

// A live gathering first, then the next PAN BS registration, then whatever is soonest.
const next = computed(() => live[0] ?? upcoming.find((e) => e.panbs) ?? upcoming[0] ?? null);

const kicker = computed(() => {
  if (next.value?.stage === 'live') return 'Live now · Join';
  return next.value?.panbs ? 'Registrations open' : 'Next';
});

// The event sheet's own date and time format (times are IST, from the event's start).
const when = computed(() => {
  const e = next.value;
  if (!e?.at) return '';
  return [fullDate(e), e.time].filter(Boolean).join(' · ');
});

const label = computed(() =>
  ['Next event: ' + next.value?.title, when.value].filter(Boolean).join(', ')
);
</script>

<style scoped>
/* Hangs from the rod: the wrapper's top edge is the rod's bottom edge, so the sway pivots on the
   rod. Hidden until the title panel settles (visibility keeps it out of the tab order too). */
.tag-wrap {
  --string: 22px;
  --hang: 50%;
  position: absolute;
  z-index: 5;
  top: var(--rod-h);
  right: calc(var(--edge-w) + clamp(10px, 3vw, 44px));
  width: clamp(168px, 17vw, 214px);
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
    transform: rotate(5deg);
  }
  66% {
    transform: rotate(-3.5deg);
  }
  82% {
    transform: rotate(1.6deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

/* The string runs from the rod to the eyelet (12px into the tag). */
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
  gap: 4px;
  width: 100%;
  margin-top: var(--string);
  padding: 22px 14px 12px;
  border: 1.5px solid var(--pi);
  border-radius: 6px;
  background: var(--pcard);
  box-shadow: var(--shadow);
  color: var(--pi);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.3s var(--ease-out);
}
.tag:hover {
  background: var(--pmari-soft);
}
/* A punched eyelet where the string is tied. */
.hole {
  position: absolute;
  top: 8px;
  left: var(--hang);
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border: 1.5px solid var(--pi);
  border-radius: 50%;
  background: var(--pp);
}
/* A painted marigold band along the foot of the tag, like the scroll's border. */
.tag::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 4px;
  border-radius: 0 0 4px 4px;
  background: var(--pmari);
}

.kicker {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--pv);
}
.name {
  display: -webkit-box;
  overflow: hidden;
  font-family: var(--font);
  font-size: 14.5px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.when {
  font-size: 11px;
  color: var(--pi2);
  font-variant-numeric: tabular-nums;
}

/* On a phone the title block fills the top: the tag hangs lower, beside the mangroves, on a long
   string tied near its right corner, clear of the crest, heading and pill. */
@media (max-width: 560px) {
  .tag-wrap {
    --string: 360px;
    --hang: calc(100% - 22px);
    width: clamp(160px, 46vw, 178px);
  }
  .kicker {
    letter-spacing: 0.08em;
  }
  .name {
    font-size: 13.5px;
  }
  .when {
    font-size: 10.5px;
  }
}
</style>

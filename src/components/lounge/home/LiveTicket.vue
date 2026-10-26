<!--
  Home's live ticket (verdict section 6): ghat paper with the stub modifier, the one card that
  is literally an admission. Live: "Live now" kicker, the title, why and "ends in 1 h 04 min"
  (per minute; the number rolls when it changes), Join, and a vermilion stub "Admit one ·
  Live". Nothing live: the next event, a keyline stub "Next". Arrives as paper (opacity +
  8px); the live dot's ring is the only UI loop.
-->
<template>
  <div v-if="live || next" class="tkw">
    <article
      v-loop
      class="tk"
      :class="{ on: !!live }"
      :aria-label="live ? 'Live now' : early ? 'Join early' : 'Next up'"
    >
      <div class="tk-body">
        <p class="tk-kick">
          <i v-if="live" class="tk-dot" aria-hidden="true"></i>
          <template v-if="live">Live now · {{ scope(live) }}</template>
          <template v-else-if="early">Join early · {{ scope(next) }}</template>
          <template v-else>Next up · {{ scope(next) }}</template>
        </p>
        <h2 class="tk-title">{{ (live || next).name }}</h2>
        <p class="tk-meta">
          <template v-if="live">
            <span v-if="live.why">{{ live.why }} · </span>ends in
            <b class="tk-roll"
              ><Transition name="tk-roll"
                ><span :key="endsIn">{{ endsIn }}</span></Transition
              ></b
            >
          </template>
          <template v-else>
            {{ whenOf(next) }} · <b>{{ until(next.starts_at, now) }}</b>
          </template>
        </p>
        <a
          v-if="live || early"
          class="tk-join"
          :href="meetHref(live || next)"
          target="_blank"
          rel="noopener noreferrer"
          >Join on Meet <span aria-hidden="true">→</span></a
        >
        <a v-else class="tk-more" href="#/lounge?view=events"
          >See it in Events <span aria-hidden="true">→</span></a
        >
      </div>
      <span class="tk-perf" aria-hidden="true"></span>
      <div class="tk-stub" aria-hidden="true">
        <span class="tk-admit">Admit one</span>
        <span class="tk-state">{{ live ? 'On air' : 'Next' }}</span>
        <span class="tk-bars"></span>
        <span class="tk-no">No. {{ serial }}</span>
      </div>
    </article>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { vLoop } from './motion.js';
import {
  clock as now,
  commOf,
  joinEarly,
  liveNow as live,
  meetHref,
  nextUp as next,
  span,
  until,
  whenOf,
} from '../events.js';

/* Minutes are enough (events.js's minute clock): seconds ticking in the periphery is the
   most distracting thing on B's Home. */

/* The number only ("1 h 04 min"), so it can roll on its own when it changes. */
const early = computed(() => !live.value && joinEarly(next.value));
const endsIn = computed(() => (live.value ? span(Date.parse(live.value.ends_at) - now.value) : ''));

/* A printed serial from the event's id, so each ticket has its own number. */
const serial = computed(() => {
  const e = live.value || next.value;
  let h = 0;
  for (const c of String(e?.id ?? '')) h = (h * 31 + c.charCodeAt(0)) % 9000;
  return String(1000 + h);
});

function scope(e) {
  return e ? commOf(e)?.label || 'House-wide' : '';
}
</script>

<style scoped>
/* A paper admission ticket. The perforation sits at --cut with a notch bitten out of the top
   and bottom edge (the ring round each notch is a background circle 2px larger than the masked
   hole), two smaller bites in the side edges, a dotted tear line, a printed stub with a
   barcode and serial. The shadow lives on the wrapper because a mask would clip it. */
.tkw {
  filter: drop-shadow(0 3px 0 var(--under)) drop-shadow(0 18px 18px rgb(0 0 0 / 0.38));
  transform: rotate(-0.8deg);
  transform-origin: 20% 100%;
  transition: transform 360ms var(--ease-out);
}
.tkw:hover {
  transform: rotate(0deg) translate3d(0, -3px, 0);
}
.tk {
  --cut: calc(100% - 58px);
  --nr: 12px;
  --sr: 7px;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 58px;
  color: var(--t-1);
  border: var(--kw) solid var(--keyline);
  border-radius: 6px;
  -webkit-mask:
    radial-gradient(
      circle var(--nr) at var(--cut) 0,
      #0000 calc(var(--nr) - 0.5px),
      #000 var(--nr)
    ),
    radial-gradient(
      circle var(--nr) at var(--cut) 100%,
      #0000 calc(var(--nr) - 0.5px),
      #000 var(--nr)
    ),
    radial-gradient(circle var(--sr) at 0 50%, #0000 calc(var(--sr) - 0.5px), #000 var(--sr)),
    radial-gradient(circle var(--sr) at 100% 50%, #0000 calc(var(--sr) - 0.5px), #000 var(--sr));
  -webkit-mask-composite: source-in;
  mask:
    radial-gradient(
      circle var(--nr) at var(--cut) 0,
      #0000 calc(var(--nr) - 0.5px),
      #000 var(--nr)
    ),
    radial-gradient(
      circle var(--nr) at var(--cut) 100%,
      #0000 calc(var(--nr) - 0.5px),
      #000 var(--nr)
    ),
    radial-gradient(circle var(--sr) at 0 50%, #0000 calc(var(--sr) - 0.5px), #000 var(--sr)),
    radial-gradient(circle var(--sr) at 100% 50%, #0000 calc(var(--sr) - 0.5px), #000 var(--sr));
  mask-composite: intersect;
  background:
    radial-gradient(circle calc(var(--nr) + 2px) at var(--cut) 0, var(--keyline) 98%, #0000)
      border-box,
    radial-gradient(circle calc(var(--nr) + 2px) at var(--cut) 100%, var(--keyline) 98%, #0000)
      border-box,
    radial-gradient(circle calc(var(--sr) + 2px) at 0 50%, var(--keyline) 98%, #0000) border-box,
    radial-gradient(circle calc(var(--sr) + 2px) at 100% 50%, var(--keyline) 98%, #0000) border-box,
    radial-gradient(
      120% 80% at 10% 0%,
      color-mix(in srgb, var(--t-1) 7%, transparent),
      transparent 60%
    ),
    var(--paper);
}
/* The printed inner rule, left of the tear line. */
.tk::before {
  content: '';
  position: absolute;
  inset: 6px calc(58px + 6px) 6px 6px;
  border: 1px solid color-mix(in srgb, var(--t-3) 45%, transparent);
  border-radius: 3px;
  pointer-events: none;
}
.tk-perf {
  position: absolute;
  top: calc(var(--nr) + 3px);
  bottom: calc(var(--nr) + 3px);
  left: var(--cut);
  border-left: 3px dotted color-mix(in srgb, var(--t-3) 70%, transparent);
  transform: translateX(-1.5px);
  pointer-events: none;
}
.tk-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 20px 20px 20px 22px;
}
.tk-kick {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  font-stretch: 112%;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}
.on .tk-kick {
  color: var(--live);
}
.tk-dot {
  position: relative;
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--live);
}
/* The one UI loop: a ring that says "now". */
.tk-dot::after {
  content: '';
  position: absolute;
  inset: -5px;
  border: 1.5px solid var(--live);
  border-radius: 50%;
  opacity: 0;
  animation: tk-ping 2.4s ease-out 1.2s infinite;
}
@keyframes tk-ping {
  0% {
    opacity: 0.7;
    transform: scale(0.5);
  }
  70%,
  100% {
    opacity: 0;
    transform: scale(1.4);
  }
}
.tk-title {
  margin: 6px 0 4px;
  font-size: 21px;
  line-height: 1.15;
  font-weight: 700;
  color: var(--t-1);
}
.tk-meta {
  margin: 0 0 14px;
  font-size: 14px;
  line-height: 1.4;
  color: var(--t-2);
}
.tk-meta b {
  color: var(--t-1);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.tk-roll {
  position: relative;
  display: inline-grid;
  vertical-align: bottom;
  overflow: hidden;
}
.tk-roll span {
  grid-area: 1 / 1;
}
.tk-roll-enter-active,
.tk-roll-leave-active {
  transition:
    transform 300ms var(--ease-out),
    opacity 300ms linear;
}
.tk-roll-enter-from {
  opacity: 0;
  transform: translate3d(0, 6px, 0);
}
.tk-roll-leave-to {
  opacity: 0;
  transform: translate3d(0, -6px, 0);
}
.tk-join,
.tk-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 46px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 700;
  text-decoration: none;
  transition:
    transform var(--t-press) ease-out,
    box-shadow var(--t-press) ease-out;
}
.tk-join {
  color: #2a1a0f;
  background: var(--lamp);
  border: 1.5px solid #2a1a0f;
  box-shadow: 0 3px 0 #2a1a0f;
}
.tk-join:active {
  transform: translateY(var(--d-press));
  box-shadow: 0 1px 0 #2a1a0f;
}
.tk-more {
  color: var(--t-1);
  border: 1.5px solid var(--keyline);
}
.tk-join:focus-visible,
.tk-more:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 3px;
}
.tk-stub {
  position: relative;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  justify-items: center;
  align-items: center;
  gap: 6px;
  padding: 14px 0 12px;
  overflow: hidden;
  background:
    repeating-linear-gradient(0deg, transparent 0 7px, rgb(0 0 0 / 0.1) 7px 8px), var(--keyline);
  color: var(--paper);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.on .tk-stub {
  background:
    repeating-linear-gradient(0deg, transparent 0 7px, rgb(0 0 0 / 0.14) 7px 8px), var(--verm);
  color: #fcf3dd;
}
/* A slow sheen across the stub: the foil catching the light. */
.tk-stub::after {
  content: '';
  position: absolute;
  inset: 0 -60%;
  background: linear-gradient(
    100deg,
    transparent 40%,
    rgb(255 255 255 / 0.28) 50%,
    transparent 60%
  );
  transform: translate3d(-100%, 0, 0);
  animation: tk-sheen 7s ease-in-out 2.5s infinite;
  pointer-events: none;
}
@keyframes tk-sheen {
  0%,
  55% {
    transform: translate3d(-100%, 0, 0);
  }
  100% {
    transform: translate3d(100%, 0, 0);
  }
}
.tk-admit,
.tk-state {
  writing-mode: vertical-rl;
}
.tk-state {
  letter-spacing: 0.3em;
}
.tk-bars {
  align-self: end;
  width: 30px;
  height: 22px;
  background: repeating-linear-gradient(
    90deg,
    currentcolor 0 2px,
    transparent 2px 3px,
    currentcolor 3px 4px,
    transparent 4px 7px,
    currentcolor 7px 10px,
    transparent 10px 12px
  );
  opacity: 0.8;
}
.tk-no {
  font-size: 9px;
  letter-spacing: 0.12em;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}
@media (max-width: 760px) {
  .tk-title {
    font-size: 19px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tk-dot::after,
  .tk-stub::after {
    animation: none;
  }
  .tkw {
    transition: none;
  }
  .tk-roll-enter-active,
  .tk-roll-leave-active {
    transition: none;
  }
}
</style>

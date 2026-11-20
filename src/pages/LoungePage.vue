<!-- The approved painted Lounge, isolated from the public site's shell and palette. -->
<template>
  <p v-if="bootError" class="lounge-boot" role="alert">{{ bootError }}</p>
  <p v-else-if="!ready" class="lounge-boot" role="status">Opening the Lounge…</p>
  <LoungeApp v-else />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import LoungeApp from '../components/lounge/App.vue';
import {
  doorHold,
  loungeArrived,
  nameCardOpen,
  theme,
  tourSeen,
} from '../components/lounge/state.js';
import { theme as siteTheme } from '../lib/theme.js';
import { fillMember, hydrateLounge, lounge } from '../components/lounge/session.js';
import { auth, errorText } from '../lib/auth.js';
import { activate, dispose } from '../components/lounge/tide.js';
import {
  activateMotion,
  motionTimeout,
  setMotionHeld,
  stopMotion,
} from '../components/lounge/home/motion.js';
import { startClock, stopClock } from '../components/lounge/events.js';
import '../components/lounge/motion.css';
import '../components/lounge/lounge.css';
import '../components/lounge/events.css';
import '../components/lounge/tour.css';
import '../components/lounge/tokens.css';
import '../components/lounge/scrollbars.css';
import '../components/lounge/cards.css';
import '../components/lounge/panels.css';

const ready = ref(false);
const bootError = ref('');

if (auth.profile) fillMember(auth.profile);

const arrival = !loungeArrived.value;
const root = document.documentElement;
root.classList.add('lounge-active');
root.dataset.theme = theme.value;
activate();
activateMotion();
startClock();

/* The sign-in door covers the page while it opens. If it is already up when the Lounge mounts,
   every motion clock (CSS, Web Animations, timers) holds at its first frame, so the Lounge
   starts from its resting pose, and motion starts the moment the door lifts. Latched here, at
   mount: a hold that begins later is not applied. Reduced motion never holds.
   Safety valve: a door that stays up longer than HOLD_MAX_MS releases the Lounge anyway, so a
   stuck door can never freeze the page. */
const HOLD_MAX_MS = 6000;
const holding = doorHold.value && !matchMedia('(prefers-reduced-motion: reduce)').matches;
let valve = null;
/* html.from-door: the phone tab bar fades in with the build; the class goes 4.2s after release
   (on the motion clock), so a later re-mount of the nav is not delayed. */
let fromDoorTimer = null;
function releaseHold() {
  clearTimeout(valve);
  valve = null;
  setMotionHeld(false);
}
if (holding) {
  setMotionHeld(true);
  root.classList.add('from-door');
  fromDoorTimer = motionTimeout(() => root.classList.remove('from-door'), 4200);
  valve = setTimeout(releaseHold, HOLD_MAX_MS);
}
const stopHoldWatch = watch(doorHold, (on) => {
  if (!on) releaseHold();
});

onMounted(async () => {
  try {
    await hydrateLounge();
  } catch (err) {
    bootError.value = errorText(err) || 'The Lounge could not load. Try again.';
    lounge.ready = true;
  }
  ready.value = true;
  window.dispatchEvent(new Event('lounge-ready'));
  if (arrival && !matchMedia('(prefers-reduced-motion: reduce)').matches && tourSeen.value) {
    root.classList.add('building');
  }
});

onBeforeUnmount(() => {
  stopHoldWatch();
  fromDoorTimer?.();
  releaseHold();
  nameCardOpen.value = false;
  dispose();
  stopMotion();
  stopClock();
  root.classList.remove('lounge-active', 'building', 'has-banner', 'lite', 'm-hidden');
  root.dataset.theme = siteTheme.value;
});
</script>

<style>
.lounge-boot {
  margin: 0;
  padding: 48px 24px;
  color: var(--t-1);
  font: 600 18px/1.4 var(--font);
  text-align: center;
}
</style>

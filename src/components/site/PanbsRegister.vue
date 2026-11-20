<!--
  PANBS on the public event sheet (spec 007): one button that sits under the event facts, so a long
  description never pushes it out of sight. Register opens a pop-up with the form; anyone with an
  IITM student email registers without signing in; the server files every such sign-up as a guest.
  Signed-in members go to the same form in the Members Lounge. From 15 minutes before the start
  until the end, the button is Join now and opens the meeting.
-->
<template>
  <div class="panbs-cta">
    <div v-if="state === 'loading'" class="cta quiet" aria-busy="true">Loading…</div>

    <a
      v-else-if="state === 'join'"
      class="cta"
      :href="joinLink"
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg class="diya" viewBox="0 0 24 24" aria-hidden="true">
        <g class="flame">
          <path d="M12 2.5c2.6 3 3.6 5.2 3.6 7a3.6 3.6 0 0 1-7.2 0c0-1.8 1-4 3.6-7z" />
          <path
            class="inner"
            d="M12 6.6c1.2 1.6 1.6 2.6 1.6 3.4a1.6 1.6 0 0 1-3.2 0c0-.8.4-1.8 1.6-3.4z"
          />
        </g>
        <path class="bowl" d="M3 14h18c-.7 3.9-4.5 6.5-9 6.5S3.7 17.9 3 14z" />
        <circle class="dot" cx="8" cy="16.6" r=".9" />
        <circle class="dot" cx="12" cy="17.4" r=".9" />
        <circle class="dot" cx="16" cy="16.6" r=".9" />
      </svg>
      <span>Join now</span>
    </a>

    <div v-else-if="state === 'closed'" class="cta quiet">Registration closed</div>

    <div v-else-if="state === 'done'" class="cta quiet ok" role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4L19 7" /></svg>
      {{ result?.registered ? 'You’re registered' : 'Already registered' }}
    </div>

    <RouterLink
      v-else-if="signedIn"
      class="cta"
      :to="`/lounge/forms/${form.id}`"
      @click="closeEvent()"
      ><svg class="bloom" viewBox="-12 -12 24 24" aria-hidden="true">
        <ellipse
          v-for="a in 8"
          :key="a"
          rx="2.1"
          ry="4.6"
          cy="-5.6"
          :transform="`rotate(${a * 45})`"
        />
        <circle class="core" r="2.4" /></svg
      ><span>Register</span></RouterLink
    >
    <button v-else type="button" class="cta" @click="open">
      <svg class="bloom" viewBox="-12 -12 24 24" aria-hidden="true">
        <ellipse
          v-for="a in 8"
          :key="a"
          rx="2.1"
          ry="4.6"
          cy="-5.6"
          :transform="`rotate(${a * 45})`"
        />
        <circle class="core" r="2.4" />
      </svg>
      <span>Register</span>
    </button>

    <dialog
      ref="dlg"
      class="pop"
      aria-labelledby="pop-h"
      @keydown.stop
      @close="onClose"
      @click.self="dlg.close()"
    >
      <div v-if="form" class="sheet">
        <figure
          class="banner"
          :class="[`w-${e.wing}`, { 'is-form': form.banner_url }]"
          :aria-hidden="form.banner_url && form.banner_alt ? undefined : 'true'"
        >
          <img v-if="form.banner_url" :src="form.banner_url" :alt="form.banner_alt || ''" />
          <img v-else-if="e.image" :src="img.card(e.image)" alt="" />
          <img v-else-if="POSTER_ART[e.wing]" class="fig" :src="POSTER_ART[e.wing]" alt="" />
          <span class="tag mono">PAN BS</span>
        </figure>
        <button type="button" class="x" title="Close" @click="dlg.close()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          <span class="visually-hidden">Close</span>
        </button>

        <div v-if="sent" class="inner done" role="status">
          <span class="tick" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="m5 12.5 4.2 4L19 7" /></svg>
          </span>
          <h2 id="pop-h">{{ result?.registered ? 'You’re registered' : 'Already registered' }}</h2>
          <p class="sub">Join from this page when it starts.</p>
          <button type="button" class="cta" @click="dlg.close()">Done</button>
        </div>

        <form v-else class="inner" novalidate @submit.prevent="send">
          <h2 id="pop-h">{{ e.title }}</h2>
          <p class="sub">
            {{ fullDate(e) }}<template v-if="e.time"> · {{ e.time }}</template>
          </p>

          <div class="fields">
            <label class="f">
              <span>{{ label('name') }}</span>
              <small v-if="help('name')">{{ help('name') }}</small>
              <input
                v-model.trim="who.name"
                required
                maxlength="200"
                autocomplete="name"
                :disabled="busy"
              />
            </label>
            <label class="f">
              <span>{{ label('email') }}</span>
              <small v-if="help('email')">{{ help('email') }}</small>
              <input
                v-model.trim="who.email"
                type="email"
                required
                maxlength="320"
                autocomplete="email"
                placeholder="you@ds.study.iitm.ac.in"
                :aria-invalid="emailBad ? 'true' : undefined"
                :disabled="busy"
              />
              <small v-if="emailBad" class="bad">Use your IITM email only.</small>
            </label>
            <label class="f">
              <span>{{ label('house') }}</span>
              <small v-if="help('house')">{{ help('house') }}</small>
              <select v-model="who.house" required :disabled="busy">
                <option value="">Choose</option>
                <option v-for="h in form.houses" :key="h" :value="h">{{ h }}</option>
              </select>
            </label>
            <label class="f">
              <span>{{ label('phone') }} <small v-if="!phoneRequired">optional</small></span>
              <small v-if="help('phone')">{{ help('phone') }}</small>
              <input
                v-model.trim="who.phone"
                :required="phoneRequired"
                type="tel"
                inputmode="tel"
                maxlength="20"
                autocomplete="tel"
                placeholder="98765 43210"
                :disabled="busy"
              />
            </label>

            <template v-for="field in blocks" :key="field.key">
              <div v-if="isLayout(field)" class="f">
                <h3 class="guest-section">{{ field.label }}</h3>
                <p v-if="field.description" class="guest-section">{{ field.description }}</p>
              </div>
              <label v-else-if="field.type === 'select'" class="f">
                <span>{{ field.label }} <small v-if="!field.required">optional</small></span>
                <select v-model="answers[field.key]" :required="field.required" :disabled="busy">
                  <option value="">Choose</option>
                  <option v-for="o in field.options || []" :key="o" :value="o">{{ o }}</option>
                </select>
              </label>
              <fieldset v-else-if="field.type === 'multiselect'" class="f">
                <legend>{{ field.label }} <small v-if="!field.required">optional</small></legend>
                <label v-for="o in field.options || []" :key="o" class="chk">
                  <input
                    type="checkbox"
                    :checked="(answers[field.key] || []).includes(o)"
                    :disabled="busy"
                    @change="toggle(field.key, o, $event.target.checked)"
                  />
                  {{ o }}
                </label>
              </fieldset>
              <label v-else-if="field.type === 'checkbox'" class="chk">
                <input v-model="answers[field.key]" type="checkbox" :disabled="busy" />
                {{ field.label }}
              </label>
              <label v-else class="f">
                <span>{{ field.label }} <small v-if="!field.required">optional</small></span>
                <textarea
                  v-if="field.type === 'textarea'"
                  v-model="answers[field.key]"
                  rows="3"
                  maxlength="10000"
                  :required="field.required"
                  :disabled="busy"
                />
                <input
                  v-else
                  v-model="answers[field.key]"
                  :type="
                    field.type === 'email'
                      ? 'email'
                      : field.type === 'phone' || field.type === 'tel'
                        ? 'tel'
                        : 'text'
                  "
                  maxlength="10000"
                  :required="field.required"
                  :disabled="busy"
                />
              </label>
            </template>
          </div>

          <p v-if="error" class="err" role="alert">{{ error }}</p>
          <button type="submit" class="cta" :disabled="busy">
            <svg class="bloom" viewBox="-12 -12 24 24" aria-hidden="true">
              <ellipse
                v-for="a in 8"
                :key="a"
                rx="2.1"
                ry="4.6"
                cy="-5.6"
                :transform="`rotate(${a * 45})`"
              />
              <circle class="core" r="2.4" />
            </svg>
            <span>{{ busy ? 'Saving your seat…' : 'Count me in' }}</span>
          </button>
          <p class="member">
            Sundarbans member? <a href="#" @click.prevent="logIn">Log in instead</a>
          </p>
        </form>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { closeEvent, fullDate, img } from '../../lib/events.js';
import { POSTER_ART } from '../../lib/art.js';
import { signedIn, signInWithGoogle } from '../../lib/auth.js';
import {
  getPanbsForm,
  getPanbsJoinLink,
  isHouseRow,
  submitPanbsRegistration,
} from '../../lib/lounge.js';

const props = defineProps({ e: { type: Object, required: true } });

// Mirrors the server rule in submit_panbs_registration; the server stays the authority.
const STUDENT_EMAIL = /^[a-z0-9._%+-]+@([a-z0-9-]+\.)*study\.iitm\.ac\.in$/i;
// Name, email and phone come from the fixed fields; the server copies them into prefill fields.
const FIXED = new Set(['name', 'email', 'phone']);
// Organizers can reword the fixed fields in the form builder (PANBS_DEFAULTS in admin.js); older
// forms without those rows keep these words.
const FIXED_LABEL = { name: 'Name', email: 'Student email', house: 'Your house', phone: 'Phone' };

// This browser remembers which PANBS events it registered for, so a refresh still says
// "Already registered" (no account to look it up by). The server's one-per-email rule stays the
// authority; storage can be blocked or cleared, so every access is guarded.
const SAVED = 'sundarbans-panbs-registered';
function savedIds() {
  try {
    return JSON.parse(localStorage.getItem(SAVED)) || [];
  } catch {
    return [];
  }
}
function remember(id) {
  try {
    localStorage.setItem(SAVED, JSON.stringify([...new Set([...savedIds(), id])]));
  } catch {
    /* private window or storage off: the server still blocks a second registration */
  }
}

const state = ref('loading'); // loading | join | ready | sending | done | closed
const dlg = ref(null);
const sent = ref(false); // the pop-up shows the result until it closes
const joinLink = ref('');
const form = ref(null);
const result = ref(null);
const error = ref('');
const tried = ref(false);
const who = reactive({ name: '', email: '', house: '', phone: '' });
const answers = reactive({});

const busy = computed(() => state.value === 'sending');
const isLayout = (f) => f.type === 'section' || f.type === 'page_break';
const fixedRow = (k) =>
  (form.value?.fields || []).find((f) => (k === 'house' ? isHouseRow(f) : f.prefill === k));
const label = (k) => fixedRow(k)?.label || FIXED_LABEL[k];
const help = (k) => fixedRow(k)?.description || '';
const guestQuestions = computed(() =>
  (form.value?.fields || []).filter((f) => !isLayout(f) && f.type !== 'file' && !isHouseRow(f))
);
const blocks = computed(() =>
  (form.value?.fields || []).filter(
    (f) => isLayout(f) || (f.type !== 'file' && !isHouseRow(f) && !FIXED.has(f.prefill))
  )
);
const asked = computed(() => blocks.value.filter((f) => !isLayout(f)));
const emailBad = computed(() => tried.value && !STUDENT_EMAIL.test(who.email));
// A required question that takes the phone is answered by the fixed Phone field, so that field
// becomes required too (otherwise the server names a question the visitor never saw).
const phoneRequired = computed(() =>
  guestQuestions.value.some((f) => f.prefill === 'phone' && f.required)
);

// The join window opens 15 minutes before the start. A page left open checks for the link when it
// opens, then every 30 s until the event ends (the link may be set late, or this clock may run
// ahead of the server's). A check only swaps in Join now; it never touches the form or the pop-up.
const JOIN_LEAD = 15 * 60 * 1000;
let timer = 0;
let run = 0; // only the latest load may write state
onBeforeUnmount(() => clearTimeout(timer));

function schedule(mine) {
  clearTimeout(timer);
  const now = Date.now();
  if (!props.e.at || (props.e.end && now >= props.e.end.getTime())) return;
  const wait = props.e.at.getTime() - JOIN_LEAD - now;
  if (wait > 864e5) return;
  timer = setTimeout(() => poll(mine), wait > 0 ? wait + 1000 : 30_000);
}

async function poll(mine) {
  const link = await getPanbsJoinLink(props.e.dbId).catch(() => null);
  if (mine !== run) return;
  if (link && state.value !== 'sending') {
    joinLink.value = link;
    state.value = 'join';
    return;
  }
  schedule(mine);
}

watch(
  () => [props.e.dbId, props.e.stage],
  async ([id]) => {
    const mine = ++run;
    clearTimeout(timer);
    dlg.value?.close();
    state.value = 'loading';
    error.value = '';
    tried.value = false;
    sent.value = false;
    try {
      // The server releases the link only inside the join window, so it decides Join vs Register.
      const link = await getPanbsJoinLink(id).catch(() => null);
      if (mine !== run) return;
      if (link) {
        joinLink.value = link;
        state.value = 'join';
        return;
      }
      // No link yet: registration stays open (also for a live event with no meeting link set).
      if (props.e.stage !== 'past') schedule(mine);
      if (savedIds().includes(id)) {
        result.value = null;
        state.value = 'done';
        return;
      }
      const f = props.e.registers ? await getPanbsForm(id) : null;
      if (mine !== run) return;
      form.value = f;
      for (const k of Object.keys(answers)) delete answers[k];
      for (const field of asked.value) {
        answers[field.key] =
          field.type === 'multiselect' ? [] : field.type === 'checkbox' ? false : '';
      }
      state.value = f ? 'ready' : 'closed';
    } catch {
      if (mine === run) state.value = 'closed';
    }
  },
  { immediate: true }
);

async function open() {
  dlg.value?.showModal();
  await nextTick();
  dlg.value?.querySelector('input')?.focus();
}

function onClose() {
  error.value = '';
  sent.value = false;
}

function toggle(key, opt, on) {
  const cur = answers[key] || [];
  answers[key] = on ? [...cur, opt] : cur.filter((x) => x !== opt);
}

// A ten-digit Indian mobile gets +91; anything else goes as typed for the server to check.
function phoneOut(raw) {
  const digits = raw.replace(/[\s-]/g, '');
  return /^\d{10}$/.test(digits) ? `+91${digits}` : digits;
}

function missing() {
  if (!who.name) return 'Enter your name.';
  if (!STUDENT_EMAIL.test(who.email)) return 'Use your IITM email only.';
  if (!who.house) return 'Choose your house.';
  if (phoneRequired.value && !who.phone) return 'Phone is required.';
  for (const f of asked.value) {
    if (!f.required) continue;
    const v = answers[f.key];
    if (Array.isArray(v) ? !v.length : !String(v ?? '').trim() || v === false) {
      return `${f.label} is required.`;
    }
  }
  return '';
}

async function send() {
  tried.value = true;
  error.value = missing();
  if (error.value) return;
  state.value = 'sending';
  try {
    result.value = await submitPanbsRegistration({
      formId: form.value.id,
      email: who.email,
      name: who.name,
      house: who.house,
      phone: who.phone ? phoneOut(who.phone) : null,
      answers: Object.fromEntries(asked.value.map(({ key }) => [key, answers[key]])),
    });
    remember(props.e.dbId);
    sent.value = true;
    state.value = 'done';
  } catch (err) {
    if (err?.code === 'PT409') {
      remember(props.e.dbId);
      result.value = null;
      sent.value = true;
      state.value = 'done';
      return;
    }
    // Database rules raise readable messages (closed, bad email or phone).
    const known = ['22023', '42501'].includes(err?.code);
    error.value = known && err.message ? err.message : 'Could not register. Try again.';
    state.value = 'ready';
  }
}

async function logIn() {
  const next = `/lounge/forms/${form.value.id}`;
  try {
    await signInWithGoogle(next);
  } catch {
    location.hash = `#/login?next=${encodeURIComponent(next)}`;
  }
}
</script>

<style scoped>
/* One solid ink button, the size of the sheet's "Took part?" row. Not a pill: soft corners. */
.cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  padding: 0 20px;
  border: 1.5px solid var(--ink);
  border-radius: 12px;
  background: var(--ink);
  color: var(--paper);
  font: inherit;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color 0.3s ease,
    transform 0.35s var(--ease-out);
}
/* Hover is quiet: the ink softens a touch and the marigold bloom turns a quarter. A press sinks
   the button quickly and lets it ease back. Nothing lifts, no shadows. */
.cta:hover:not(:disabled, .quiet) {
  background: color-mix(in srgb, var(--ink) 88%, var(--paper));
}
.cta:active:not(:disabled, .quiet) {
  transform: scale(0.97);
  transition-duration: 0.08s;
}
/* Bloom: an eight-petal pat flower, the house's marigold, in the button. */
.cta .bloom {
  flex: none;
  stroke: none;
  width: 20px;
  height: 20px;
  fill: var(--mari);
  transition: transform 0.7s var(--ease-out);
}
.bloom .core {
  fill: currentColor;
}
.cta:hover:not(:disabled, .quiet) .bloom {
  transform: rotate(90deg);
}
.cta:active:not(:disabled, .quiet) .bloom {
  transform: rotate(90deg) scale(0.8);
  transition-duration: 0.12s;
}
.cta:disabled .bloom {
  animation: bloom-spin 1.4s linear infinite;
}
@keyframes bloom-spin {
  to {
    transform: rotate(360deg);
  }
}
.cta:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 4px;
}
.cta:disabled {
  opacity: 0.6;
  cursor: progress;
}
.cta.quiet {
  border: 1.5px dashed var(--line-strong);
  background: transparent;
  color: var(--ink-2);
  font-weight: 600;
  cursor: default;
}
.cta.ok {
  border-style: solid;
  color: var(--ink);
}
.cta svg,
.tick svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
/* Live: a lit diya, the bloom's sibling. The flame flickers while the event runs; on hover it
   draws up taller, on press it ducks. */
.cta .diya {
  flex: none;
  width: 22px;
  height: 22px;
  stroke: none;
  overflow: visible;
}
.diya .bowl {
  fill: var(--mari);
}
.diya .dot {
  fill: var(--verm);
}
.diya .flame {
  fill: var(--verm);
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: flicker 2.4s ease-in-out infinite;
}
.diya .inner {
  fill: var(--mari);
}
.cta:hover .diya .flame {
  scale: 1.18;
}
.cta:active .diya .flame {
  scale: 0.85;
}
.diya .flame {
  transition: scale 0.6s var(--ease-out);
}
@keyframes flicker {
  0%,
  100% {
    transform: rotate(0) scaleY(1);
  }
  30% {
    transform: rotate(-4deg) scaleY(1.06);
  }
  55% {
    transform: rotate(3deg) scaleY(0.95);
  }
  80% {
    transform: rotate(-2deg) scaleY(1.03);
  }
}

/* The pop-up: a paper card on the site, with the event's poster as its banner. */
.pop {
  width: min(500px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--paper);
  color: var(--ink);
  box-shadow: 0 30px 80px -30px color-mix(in srgb, var(--ink) 60%, transparent);
  overflow: auto;
  overscroll-behavior: contain;
}
.pop[open] {
  animation: pop-in 0.38s var(--ease-out);
}
.pop::backdrop {
  background: color-mix(in srgb, var(--ink) 45%, transparent);
  backdrop-filter: blur(3px);
}
@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }
}
.sheet {
  position: relative;
}
.banner {
  position: relative;
  margin: 0;
  height: 132px;
  overflow: hidden;
  background:
    radial-gradient(
      90% 90% at 50% 100%,
      color-mix(in srgb, var(--w) 22%, transparent),
      transparent
    ),
    var(--sunk);
  border-bottom: 1px solid var(--line);
}
/* An organizer's form banner is 3:1, so the band takes its shape instead of cropping it. */
.banner.is-form {
  height: auto;
  aspect-ratio: 3 / 1;
}
.banner img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.banner .fig {
  object-fit: contain;
  padding-top: 14px;
}
.banner .tag {
  position: absolute;
  left: 22px;
  bottom: 14px;
  padding: 3px 7px 2px 8px;
  border: 1px dotted color-mix(in srgb, var(--on-mari) 50%, transparent);
  border-radius: 2px;
  box-shadow: 0 0 0 2px var(--mari);
  background: var(--mari);
  color: var(--on-mari);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
}
.x {
  position: absolute;
  top: 12px;
  right: 12px;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--card);
  color: var(--ink);
}
.x svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}
.inner {
  display: grid;
  gap: 14px;
  padding: 20px 24px 22px;
}
h2 {
  margin: 0;
  font-size: 26px;
  font-weight: 750;
  letter-spacing: -0.03em;
  line-height: 1.1;
  text-wrap: balance;
}
.sub {
  margin: -6px 0 2px;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--ink-2);
}
.fields {
  display: grid;
  gap: 12px;
}
.f {
  display: grid;
  gap: 5px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  font-size: 13.5px;
  font-weight: 650;
}
.f small {
  font-weight: 500;
  color: var(--ink-3);
}
.f small.bad {
  color: var(--verm);
  font-weight: 600;
}
.f input,
.f select,
.f textarea {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1.5px solid var(--line-strong);
  border-radius: 10px;
  background: var(--card);
  color: var(--ink);
  font: inherit;
  font-weight: 500;
}
.f input:focus-visible,
.f select:focus-visible,
.f textarea:focus-visible {
  outline: none;
  border-color: var(--ink);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mari) 45%, transparent);
}
.f input[aria-invalid='true'] {
  border-color: var(--verm);
}
.f legend {
  margin-bottom: 4px;
}
.chk {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14.5px;
  font-weight: 500;
}
.err {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--verm);
}
.member {
  margin: -2px 0 0;
  text-align: center;
  font-size: 13.5px;
  color: var(--ink-3);
}
.member a {
  color: var(--ink);
  font-weight: 650;
}
.done {
  justify-items: center;
  text-align: center;
  padding-top: 26px;
}
.done .sub {
  margin: -6px 0 6px;
}
.tick {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--paper);
}
@media (prefers-reduced-motion: reduce) {
  .diya .flame,
  .pop[open] {
    animation: none;
  }
  .cta,
  .cta .bloom {
    transition: none;
    animation: none;
  }
}
@media (max-width: 560px) {
  .pop {
    width: 100%;
    max-width: none;
    max-height: 92dvh;
    margin: auto 0 0;
    border-radius: 18px 18px 0 0;
  }
  .inner {
    padding: 18px 18px 22px;
  }
}
.guest-section {
  margin: 0;
  white-space: pre-line;
}
</style>

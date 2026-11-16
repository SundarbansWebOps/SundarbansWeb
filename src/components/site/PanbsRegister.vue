<!--
  PANBS registration on the public event sheet (spec 007). Anyone with an IITM student email
  registers here without signing in; the server files them as a member or a guest by email.
  Signed-in members get a link to the same form in the Members Lounge instead. From 15 minutes
  before the start until the end, everyone gets a Join button instead of the form.
-->
<template>
  <section class="reg" aria-labelledby="reg-h">
    <p v-if="state === 'loading'" class="note">Loading…</p>

    <template v-else-if="state === 'join'">
      <h3 id="reg-h">{{ live ? 'Happening now' : 'Starting soon' }}</h3>
      <a class="go join" :href="joinLink" target="_blank" rel="noopener noreferrer">
        <span><i class="beat" aria-hidden="true" />Join now</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </a>
      <p class="note">Open to every IITM BS student. No registration needed to join.</p>
    </template>

    <p v-else-if="state === 'wait'" class="note">
      <strong>Happening now.</strong> The joining link isn’t up yet. Check back in a minute.
    </p>
    <p v-else-if="state === 'closed'" class="note">Registration for this event is closed.</p>

    <template v-else-if="state === 'done'">
      <div class="done" role="status">
        <strong id="reg-h">You’re registered</strong>
        <span v-if="result?.kind === 'member'">
          It’s filed with your Sundarbans account. You’ll see it in the Members Lounge when you log
          in.
        </span>
        <span v-else-if="result?.kind">We’ve got your registration for {{ form.title }}.</span>
        <span v-else>This email is already registered for {{ form.title }}.</span>
        <span
          >Come back to this page when it starts: the Join button appears here 15 minutes
          before.</span
        >
      </div>
    </template>

    <template v-else-if="state === 'ready' || state === 'sending'">
      <template v-if="signedIn">
        <h3 id="reg-h">Register</h3>
        <RouterLink class="go" :to="`/lounge/forms/${form.id}`" @click="closeEvent()">
          Open the form in the Members Lounge
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </RouterLink>
      </template>

      <form v-else novalidate @submit.prevent="send">
        <h3 id="reg-h">{{ form.title || 'Register' }}</h3>
        <p v-if="form.description" class="lede">{{ form.description }}</p>
        <p class="lede">
          Sundarbans member?
          <a href="#" @click.prevent="logIn">Log in to register from the Members Lounge</a>.
        </p>

        <div class="grid">
          <label class="f">
            <span>Name</span>
            <input
              v-model.trim="who.name"
              required
              maxlength="200"
              autocomplete="name"
              :disabled="busy"
            />
          </label>
          <label class="f">
            <span>Student email</span>
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
            <small v-if="emailBad" class="bad"
              >Use your IITM student email (…study.iitm.ac.in).</small
            >
          </label>
          <label class="f">
            <span>Your house</span>
            <select v-model="who.house" required :disabled="busy">
              <option value="">Choose</option>
              <option v-for="h in form.houses" :key="h" :value="h">{{ h }}</option>
            </select>
          </label>
          <label class="f">
            <span>Phone <small>optional</small></span>
            <input
              v-model.trim="who.phone"
              type="tel"
              inputmode="tel"
              maxlength="20"
              autocomplete="tel"
              placeholder="+91 98765 43210"
              :disabled="busy"
            />
          </label>

          <template v-for="field in asked" :key="field.key">
            <label v-if="field.type === 'select'" class="f">
              <span>{{ field.label }} <small v-if="!field.required">optional</small></span>
              <select v-model="answers[field.key]" :required="field.required" :disabled="busy">
                <option value="">Choose</option>
                <option v-for="o in field.options || []" :key="o" :value="o">{{ o }}</option>
              </select>
            </label>
            <fieldset v-else-if="field.type === 'multiselect'" class="f wide">
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
            <label v-else-if="field.type === 'checkbox'" class="chk wide">
              <input v-model="answers[field.key]" type="checkbox" :disabled="busy" />
              {{ field.label }}
            </label>
            <label v-else class="f" :class="{ wide: field.type === 'textarea' }">
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
        <button type="submit" class="send" :disabled="busy">
          {{ busy ? 'Registering…' : 'Register' }}
        </button>
      </form>
    </template>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { closeEvent } from '../../lib/events.js';
import { signedIn, signInWithGoogle } from '../../lib/auth.js';
import { getPanbsForm, getPanbsJoinLink, submitPanbsRegistration } from '../../lib/lounge.js';

const props = defineProps({
  eventId: { type: String, required: true },
  live: { type: Boolean, default: false },
  registers: { type: Boolean, default: true },
});

// Mirrors the server rule in submit_panbs_registration; the server stays the authority.
const STUDENT_EMAIL = /^[a-z0-9._%+-]+@([a-z0-9-]+\.)*study\.iitm\.ac\.in$/i;
// Name, email and phone come from the fixed fields; the server copies them into prefill fields.
const FIXED = new Set(['name', 'email', 'phone']);

const state = ref('loading'); // loading | join | wait | ready | sending | done | closed
const joinLink = ref('');
const form = ref(null);
const result = ref(null);
const error = ref('');
const tried = ref(false);
const who = reactive({ name: '', email: '', house: '', phone: '' });
const answers = reactive({});

const busy = computed(() => state.value === 'sending');
const asked = computed(() => (form.value?.fields || []).filter((f) => !FIXED.has(f.prefill)));
const emailBad = computed(() => tried.value && !STUDENT_EMAIL.test(who.email));

watch(
  () => [props.eventId, props.live],
  async ([id]) => {
    state.value = 'loading';
    error.value = '';
    tried.value = false;
    try {
      // The server releases the link only inside the join window, so it decides Join vs form.
      const link = await getPanbsJoinLink(id).catch(() => null);
      if (id !== props.eventId) return;
      if (link) {
        joinLink.value = link;
        state.value = 'join';
        return;
      }
      if (props.live) {
        state.value = 'wait';
        return;
      }
      const f = props.registers ? await getPanbsForm(id) : null;
      if (id !== props.eventId) return;
      form.value = f;
      for (const k of Object.keys(answers)) delete answers[k];
      for (const field of f?.fields || []) {
        answers[field.key] =
          field.type === 'multiselect' ? [] : field.type === 'checkbox' ? false : '';
      }
      state.value = f ? 'ready' : 'closed';
    } catch {
      if (id === props.eventId) state.value = 'closed';
    }
  },
  { immediate: true }
);

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
  if (!STUDENT_EMAIL.test(who.email)) return 'Use your IITM student email (…study.iitm.ac.in).';
  if (!who.house) return 'Choose your house.';
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
      answers: { ...answers },
    });
    state.value = 'done';
  } catch (e) {
    if (e?.code === 'PT409') {
      result.value = null;
      state.value = 'done';
      return;
    }
    // Database rules raise readable messages (closed, already registered, bad email/phone).
    const known = ['22023', '42501'].includes(e?.code);
    error.value = known && e.message ? e.message : 'Could not register. Try again in a moment.';
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
.reg {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1.5px solid var(--mari);
  border-radius: 14px;
  background: var(--mari-soft);
}
h3 {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
form {
  display: grid;
  gap: 12px;
}
.lede,
.note {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.5;
  color: var(--ink-2);
}
.lede a {
  color: var(--mari-ink);
  font-weight: 650;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 14px;
}
.f {
  display: grid;
  gap: 5px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  font-size: 13.5px;
  font-weight: 600;
}
.wide {
  grid-column: 1 / -1;
}
.f small {
  font-weight: 500;
  color: var(--ink-3);
}
.f small.bad {
  color: var(--verm);
}
.f input,
.f select,
.f textarea {
  width: 100%;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background: var(--card);
  color: var(--ink);
  font: inherit;
  font-weight: 500;
}
.f input:focus-visible,
.f select:focus-visible,
.f textarea:focus-visible {
  outline: 2px solid var(--mari);
  outline-offset: 1px;
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
  font-size: 14px;
  font-weight: 500;
}
.err {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--verm);
}
.send {
  justify-self: start;
  padding: 11px 22px;
  border: 0;
  border-radius: 99px;
  background: var(--mari);
  color: var(--on-mari);
  font: inherit;
  font-weight: 700;
  transition: transform 0.2s var(--ease-spring);
}
.send:hover:not(:disabled) {
  transform: translateY(-1px);
}
.send:disabled {
  opacity: 0.6;
}
.go {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--mari);
  color: var(--on-mari);
  font-weight: 700;
  text-decoration: none;
}
.go svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.3s var(--ease-out);
}
.go:hover svg {
  transform: translateX(4px);
}
.done {
  display: grid;
  gap: 4px;
  font-size: 14.5px;
  color: var(--ink-2);
}
.join {
  padding: 14px 18px;
  font-size: 17px;
}
.join span {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.beat {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--verm);
  animation: beat 1.6s ease-in-out infinite;
}
@keyframes beat {
  50% {
    opacity: 0.3;
    transform: scale(0.7);
  }
}
@media (prefers-reduced-motion: reduce) {
  .beat {
    animation: none;
  }
}
.note strong {
  color: var(--ink);
}
.done strong {
  font-size: 19px;
  color: var(--ink);
}
@media (max-width: 560px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

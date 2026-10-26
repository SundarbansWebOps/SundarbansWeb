<!--
  One event's pop-up: its community's painted figures standing on Home's river, what and when,
  then one action. Live: Join (opens the Meet). Upcoming: Register: lounge-a's questions
  (Raja liked them) in B's register sheet (the event in one line, plain fields, pill choices),
  then "You're in" with the member's own lantern (night) or kite (day) rising. Registering is
  one-way: there is no unregister. Past: the member's attendance and, if earned, their
  certificate.
-->
<template>
  <LoungeDialog ref="dlg" labelledby="ed-h" @close="emit('close')">
    <div class="evd" :class="[commOf(event).cls, `s-${st}`, step]">
      <div class="evd-art" :style="{ '--plate': `url('${plate}')` }" aria-hidden="true">
        <img :src="commOf(event).art" alt="" />
      </div>

      <!-- Info -->
      <template v-if="step === 'info'">
        <p class="evd-kick gp-kicker" :class="{ 'is-live': st === 'live' }">
          <template v-if="st === 'live'">Live now · </template>
          <span :class="{ 'evd-comm': st !== 'live' }">{{ commOf(event).label }}</span>
          <template v-if="event.type"> · {{ event.type }}</template>
        </p>
        <h2 id="ed-h" class="evd-h">{{ event.name }}</h2>
        <img
          v-if="event.image_url"
          class="evd-poster"
          :src="img.full(event.image_url)"
          :alt="`${event.name} poster`"
          :width="event.image_width || undefined"
          :height="event.image_height || undefined"
          loading="lazy"
        />
        <p class="evd-when">
          <span>{{ spanOf(event) }}</span>
          <span class="sep" aria-hidden="true">·</span>
          <span>{{ event.platform || event.location || 'Google Meet' }}</span>
        </p>
        <p class="evd-desc">{{ event.description }}</p>

        <p v-if="event.cancelled_at || event.cancelled" class="evd-plain">
          This event was cancelled.
        </p>
        <div v-else-if="st === 'live'" class="evd-air gp-inset">
          <p class="gp-title">On air now</p>
          <p class="gp-meta">
            Started {{ ago(event.starts_at) }} · <b>{{ endsIn(event) }}</b>
          </p>
          <a
            v-if="event.meet_link || event.gmail_link"
            class="gp-btn is-big"
            :href="event.meet_link || event.gmail_link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Join on Meet <span aria-hidden="true">→</span>
          </a>
          <p class="evd-small">Stay 20 minutes and it counts as attended.</p>
        </div>

        <div v-else-if="st === 'upcoming'" class="evd-act">
          <p v-if="isOpenSession(event)" class="evd-plain">
            <b>Open to all members.</b> No registration. Join on Meet when it starts,
            {{ until(event.starts_at) }}.
          </p>
          <template v-else-if="rejected">
            <p class="evd-plain" role="status">
              <b>Not approved.</b>
              {{ regForm.review_reason || 'The admins could not approve this registration.' }}
            </p>
            <button v-if="regOpen" type="button" class="gp-btn is-big" @click="step = 'form'">
              Register again
            </button>
          </template>
          <p v-else-if="isRegistered(event)" class="evd-done">
            <span class="evd-tick" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="m5 12.5 4.2 4L19 7" /></svg>
            </span>
            <span
              ><b>You're registered.</b> The Join button shows up in your Lounge when it starts,
              {{ until(event.starts_at) }}.</span
            >
          </p>
          <template v-else-if="regOpen">
            <button type="button" class="gp-btn is-big" @click="step = 'form'">Register</button>
            <p class="evd-small">Starts {{ until(event.starts_at) }}.</p>
          </template>
          <p v-else class="evd-plain">Registration is not open for this event.</p>
        </div>

        <div v-else class="evd-act">
          <template v-if="mark?.kind === 'attended'">
            <p class="evd-done">
              <span class="evd-tick" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="m5 12.5 4.2 4L19 7" /></svg>
              </span>
              <span><b>You attended.</b> You were in the call for {{ mark.minutes }} minutes.</span>
            </p>
            <button v-if="cert" type="button" class="gp-btn is-big" @click="toCert">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="9" r="5.5" />
                <path d="m8.5 13.5-1.8 7 5.3-2.6 5.3 2.6-1.8-7" />
              </svg>
              View certificate
            </button>
          </template>
          <p v-else-if="mark?.kind === 'early'" class="evd-plain">
            You were in the call for {{ mark.minutes }} minutes. A certificate needs 20, so this one
            has none.
          </p>
          <p v-else-if="mark?.kind === 'missed'" class="evd-plain">
            You registered but didn't join this one.
          </p>
          <p v-else-if="event.attendees" class="evd-plain">
            {{ event.attendees }} members came to this one.
          </p>
          <p v-else class="evd-plain">This event has ended.</p>
        </div>
      </template>

      <!-- Register: B's sheet -->
      <template v-else-if="step === 'form'">
        <p class="evd-kick gp-kicker">Register</p>
        <h2 id="ed-h" class="evd-h">{{ event.name }}</h2>
        <p class="evd-sub">
          <b>{{ spanOf(event) }}</b> · {{ until(event.starts_at) }}
        </p>
        <form class="evd-form" @submit.prevent="submit">
          <FormFields
            v-if="regForm"
            ref="fieldsEl"
            v-model:save-phone="savePhone"
            :fields="regForm.fields || []"
          />
          <p v-if="error" class="ff-err" role="alert">{{ error }}</p>
          <p class="evd-final">
            Registering is final. It can't be undone, so check the date first.
          </p>
          <div class="evd-acts">
            <button type="submit" class="gp-btn is-big" :disabled="busy">
              {{ busy ? 'Sending…' : 'Register' }}
            </button>
            <button type="button" class="gp-btn is-ghost" @click="step = 'info'">Back</button>
          </div>
        </form>
      </template>

      <!-- Registered -->
      <div v-else class="evd-sent" role="status">
        <span class="evd-lamp" :class="{ 'is-kite': mode === 'day' }" aria-hidden="true">
          <span v-if="mode === 'night'" class="evd-halo"></span>
          <img :src="mode === 'night' ? LANTERN.src : KITE_MINE.src" alt="" />
        </span>
        <h2 id="ed-h" class="evd-h">{{ youreIn }}</h2>
        <p>
          <b>{{ event.name }}</b> starts {{ until(event.starts_at) }}. The Join button shows up in
          your Lounge then. Stay 20 minutes and you get a certificate.
        </p>
        <p v-if="invite" class="ff-invite">
          WhatsApp invite:
          <a :href="invite" target="_blank" rel="noopener noreferrer">Open the group</a>. Request
          entry there. An admin checks house membership before they add you. Registration is not
          admission.
        </p>
        <button ref="doneEl" type="button" class="gp-btn is-ghost" @click="dlg?.close()">
          Back to the river
        </button>
      </div>
    </div>
  </LoungeDialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { errorText } from '../../lib/auth.js';
import { reviewOf } from '../../lib/lounge.js';
import { img } from '../../lib/events.js';
import { KITE_MINE, LANTERN } from './home/art.js';
import FormFields from './FormFields.vue';
import LoungeDialog from './LoungeDialog.vue';
import {
  ago,
  certOf,
  commOf,
  endsIn,
  isOpenSession,
  isRegistered,
  markOf,
  spanOf,
  status,
  until,
} from './events.js';
import { firstName, mode } from './state.js';
import { fetchInvite, formByEvent, submitLoungeForm } from './session.js';

/* The member's own lantern and kite: Home's art (home/art.js). */

const props = defineProps({
  event: { type: Object, required: true },
  start: { type: String, default: 'info' },
  /* Home's plate for the current theme: the figures stand on the same river. */
  plate: { type: String, default: '' },
});
const emit = defineEmits(['close', 'cert']);

const dlg = ref(null);
const fieldsEl = ref(null);
const doneEl = ref(null);
const savePhone = ref(false);
const busy = ref(false);
const error = ref('');
const invite = ref('');
const st = computed(() => status(props.event));
const mark = computed(() => markOf(props.event));
const cert = computed(() => certOf(props.event));
const regForm = computed(() => formByEvent(props.event.id));
const regOpen = computed(
  () =>
    !isOpenSession(props.event) &&
    !!regForm.value &&
    (regForm.value.accepting_responses ?? regForm.value.is_open ?? false)
);
/* An admin turned this registration down: it shows the reason and can be sent again. The
   registration itself stays listed wherever it already appears. */
const rejected = computed(
  () => !isOpenSession(props.event) && reviewOf(regForm.value) === 'rejected'
);

/* Already registered: never show the form again. */
const step = ref(
  props.start === 'form' &&
    !isOpenSession(props.event) &&
    (!isRegistered(props.event) || reviewOf(formByEvent(props.event.id)) === 'rejected') &&
    st.value === 'upcoming' &&
    formByEvent(props.event.id)
    ? 'form'
    : 'info'
);
const youreIn = computed(() => {
  const f = firstName.value;
  return f ? `You're in, ${f}.` : "You're in.";
});

watch(step, async (s) => {
  await nextTick();
  if (s === 'done') doneEl.value?.focus();
});

async function submit() {
  if (st.value !== 'upcoming' || isOpenSession(props.event)) {
    step.value = 'info';
    return;
  }
  if (!regForm.value || busy.value) return;
  if (!(await fieldsEl.value?.validate())) return;
  busy.value = true;
  error.value = '';
  try {
    const result = await submitLoungeForm(
      regForm.value.id,
      fieldsEl.value?.answers() ?? {},
      savePhone.value
    );
    invite.value = result?.invite_url || '';
    if (!invite.value && result?.response_id) {
      invite.value = (await fetchInvite(regForm.value.id).catch(() => '')) || '';
    }
    step.value = 'done';
  } catch (err) {
    error.value = errorText(err);
  } finally {
    busy.value = false;
  }
}

function toCert() {
  emit('cert', cert.value.id);
  dlg.value?.swap();
}
</script>

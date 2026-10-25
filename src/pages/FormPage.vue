<!-- Member form on its own route. Same field renderer as the Lounge dialog. -->
<template>
  <div class="lounge-form-shell">
    <header class="lounge-form-nav">
      <RouterLink class="lounge-brand" to="/lounge"
        >Sundarbans House <span>· The Lounge</span></RouterLink
      >
      <div class="lounge-form-nav-actions">
        <RouterLink class="lounge-back" to="/lounge">Back to the Lounge</RouterLink>
        <button class="lounge-theme" type="button" @click="toggleTheme">
          {{ theme === 'dark' ? 'Switch to day' : 'Switch to night' }}
        </button>
      </div>
    </header>
    <main id="main-content" class="wrap">
      <header class="head">
        <p class="kicker">House form</p>
        <h1>{{ form?.group_label || form?.title || 'Form' }}</h1>
        <p class="sub">
          {{
            form?.group_purpose ||
            form?.description ||
            'Signed-in members only. Answers are saved on your account.'
          }}
        </p>
      </header>

      <p v-if="loadError" class="msg err" role="alert">{{ loadError }}</p>
      <p v-else-if="!ready" class="msg" role="status">Opening the form…</p>
      <p v-else-if="!form" class="msg err" role="alert">
        {{ unavailableMessage }}
      </p>

      <form v-else class="slip" @submit.prevent="send">
        <p v-if="rejected" class="msg" role="status">
          <strong>Not approved.</strong>
          {{ form.review_reason || 'The admins could not approve this one.' }}
          <template v-if="canSubmit">Fill it in again below and send it for another look.</template>
        </p>
        <p
          v-else-if="form.review_status === 'pending' && form.form_kind === 'group'"
          class="msg"
          role="status"
        >
          Under review.
        </p>
        <p v-if="locked && !isSuperAdmin && !invite" class="msg" role="status">
          Your application is saved. Sending this form is not WhatsApp admission.
        </p>
        <FormFields
          v-else-if="canViewFields"
          ref="fieldsEl"
          v-model:save-phone="savePhone"
          :fields="form.fields || []"
          :disabled="previewOnly || locked || (rejected && !canSubmit)"
        />
        <p v-if="previewOnly" class="msg" role="status">Preview only. {{ unavailableMessage }}</p>
        <p v-else-if="!canSubmit && !locked" class="msg" role="status">
          {{ unavailableMessage }}
        </p>
        <p v-if="error" class="msg err" role="alert">{{ error }}</p>
        <p v-if="invite" class="next" role="status">
          <strong>Saved. One step left.</strong>
          Open the invite and request to join. An admin adds you after checking.
        </p>
        <p v-else-if="locked && inviteError" class="msg err" role="alert">
          {{ inviteError }}
          <button class="text-action" type="button" @click="loadInvite">Try again</button>
        </p>
        <p v-else-if="locked && form.form_kind === 'group'" class="msg" role="status">
          No invite link is available for this group yet. Your application remains saved; an
          application does not confirm admission.
        </p>
        <p v-else-if="done" class="msg" role="status">
          Saved. If this form has a WhatsApp group, the invite appears after the database confirms
          your response.
        </p>
        <div class="acts">
          <button v-if="!locked && !done && canSubmit" class="go" type="submit" :disabled="busy">
            {{ busy ? 'Sending…' : rejected ? 'Send again' : 'Send' }}
          </button>
          <a v-if="invite" class="go join" :href="invite" target="_blank" rel="noopener noreferrer"
            >Open WhatsApp invite <span aria-hidden="true">→</span></a
          >
          <RouterLink class="ghost" to="/lounge">Back to the Lounge</RouterLink>
        </div>
      </form>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import { theme } from '../components/lounge/state.js';
import { setTheme, theme as siteTheme } from '../lib/theme.js';
import '../components/lounge/lounge.css';
import '../components/lounge/panels.css';
import '../components/lounge/tokens.css';
import FormFields from '../components/lounge/FormFields.vue';
import {
  fetchInvite,
  formById,
  hydrateLounge,
  lounge,
  submitLoungeForm,
} from '../components/lounge/session.js';
import { auth, errorText, isSuperAdmin } from '../lib/auth.js';
import { formUnavailableMessage, isLocked, reviewOf } from '../lib/lounge.js';
import { member } from '../components/lounge/fixtures.js';

const route = useRoute();
const root = document.documentElement;
root.classList.add('lounge-active');
root.dataset.theme = theme.value;
const ready = ref(false);
const loadError = ref('');
const fieldsEl = ref(null);
const savePhone = ref(false);
const busy = ref(false);
const error = ref('');
const done = ref(false);
const invite = ref('');
const inviteError = ref('');

const form = computed(() => formById(route.params.id));
/* Submitted and not rejected: final. A rejected response can be filled in again. */
const locked = computed(() => isLocked(form.value));
const rejected = computed(() => !done.value && reviewOf(form.value) === 'rejected');
const canSubmit = computed(
  () => !!form.value && (form.value.accepting_responses ?? form.value.is_open ?? false)
);
const previewOnly = computed(() => isSuperAdmin.value && !canSubmit.value);
const canViewFields = computed(() => canSubmit.value || isSuperAdmin.value);
const unavailableMessage = computed(() =>
  formUnavailableMessage(form.value, member.region_id, member.cohort)
);

function toggleTheme() {
  setTheme(theme.value === 'dark' ? 'light' : 'dark');
}

onBeforeRouteLeave((to) => {
  if (to.name === 'Lounge' || to.name === 'LoungeForm') return;
  root.classList.remove('lounge-active');
  root.dataset.theme = siteTheme.value;
});

onBeforeUnmount(() => {
  if (route.name === 'Lounge' || route.name === 'LoungeForm') return;
  root.classList.remove('lounge-active');
  root.dataset.theme = siteTheme.value;
});

onMounted(async () => {
  if (!auth.session || !auth.profile) return;
  try {
    if (!lounge.ready) await hydrateLounge();
    if (locked.value) await loadInvite();
  } catch (err) {
    loadError.value = errorText(err);
  } finally {
    ready.value = true;
  }
});

async function loadInvite() {
  if (!locked.value) return;
  inviteError.value = '';
  try {
    invite.value = (await fetchInvite(form.value.id)) || '';
  } catch (err) {
    inviteError.value = errorText(err) || 'The invite could not be loaded.';
  }
}

async function send() {
  if (busy.value || !form.value || locked.value || !canSubmit.value) return;
  if (!(await fieldsEl.value?.validate())) return;
  busy.value = true;
  error.value = '';
  try {
    const result = await submitLoungeForm(
      form.value.id,
      fieldsEl.value?.answers() ?? {},
      savePhone.value
    );
    done.value = true;
    invite.value = result?.invite_url || '';
    if (!invite.value && result?.response_id) {
      await loadInvite();
    }
  } catch (err) {
    error.value = errorText(err);
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.lounge-form-shell {
  min-height: 100vh;
  background: var(--bg);
  color: var(--t-1);
  font-family: var(--font);
  --r: var(--r-sheet);
}
.lounge-form-nav {
  position: relative;
  z-index: 2;
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px clamp(16px, 4vw, 48px);
  background: var(--bg);
  border-bottom: var(--kw) solid var(--keyline);
}
.lounge-brand,
.lounge-back {
  color: var(--t-1);
  font-weight: 700;
  text-decoration: none;
}
.lounge-brand span {
  color: var(--t-2);
  font-weight: 500;
}
.lounge-form-nav-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}
.lounge-theme {
  min-height: 44px;
  padding: 0 14px;
  border: var(--kw) solid var(--keyline);
  border-radius: 999px;
  background: var(--paper);
  color: var(--t-1);
  font: inherit;
  font-weight: 650;
  cursor: pointer;
}
.lounge-form-shell a:focus-visible,
.lounge-form-shell button:focus-visible,
.lounge-form-shell input:focus-visible,
.lounge-form-shell select:focus-visible,
.lounge-form-shell textarea:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}
.wrap {
  max-width: 760px;
  margin: 0 auto;
  padding: 40px 24px 72px;
  display: grid;
  gap: 22px;
}
.kicker {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--mari-ink);
}
h1 {
  margin: 0;
  font-size: clamp(34px, 4.4vw, 48px);
  font-weight: 750;
  letter-spacing: -0.04em;
  line-height: 0.95;
}
.sub {
  margin: 12px 0 0;
  max-width: 62ch;
  color: var(--ink-2);
  font-size: 17px;
  line-height: 1.45;
  white-space: pre-line;
}
.slip {
  display: grid;
  gap: 14px;
  padding: 22px 24px 18px;
  border-radius: var(--r);
  background: var(--card);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
}
.msg {
  margin: 0;
  color: var(--ink-2);
  font-size: 15px;
  line-height: 1.45;
  white-space: pre-line;
}
.msg.err {
  color: var(--verm);
}
.text-action {
  margin-left: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 650;
  text-decoration: underline;
  cursor: pointer;
}
.acts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.go,
.ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 99px;
  font-size: 15px;
  font-weight: 650;
  text-decoration: none;
}
.go {
  border: 0;
  background: var(--mari);
  color: var(--on-mari);
}
.join {
  gap: 10px;
  border: 1.5px solid var(--pat-ink);
  box-shadow: 0 3px 0 var(--pat-ink);
  transition:
    transform 120ms var(--ease-out),
    box-shadow 120ms var(--ease-out);
}
.join:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 var(--pat-ink);
}
.next {
  margin: 0;
  color: var(--ink-2);
  font-size: 16px;
  line-height: 1.45;
}
.next strong {
  display: block;
  color: var(--ink);
  font-size: 19px;
}
.go:disabled {
  opacity: 0.55;
}
.ghost {
  border: 1.5px solid var(--line-strong);
  background: transparent;
  color: var(--ink);
}
:deep(.ff) {
  display: grid;
  gap: 14px;
}
:deep(.ff-field),
:deep(.ff-multi legend) {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-2);
}
:deep(.ff-field input),
:deep(.ff-field select),
:deep(.ff-field textarea),
:deep(.ff-other input[type='text']) {
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  border: 1.5px solid var(--line-strong);
  border-radius: 12px;
  background: var(--paper);
  color: var(--ink);
  font: inherit;
  text-transform: none;
  letter-spacing: 0;
}
:deep(.ff-multi) {
  margin: 0;
  padding: 0;
  border: 0;
  display: grid;
  gap: 8px;
}
:deep(.ff-check),
:deep(.ff-other) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  text-transform: none;
  letter-spacing: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--ink);
}
@media (max-width: 760px) {
  .lounge-form-nav {
    align-items: flex-start;
    flex-direction: column;
  }
  .lounge-form-nav-actions {
    width: 100%;
    justify-content: space-between;
  }
  .wrap {
    padding: 24px 16px 40px;
  }
}
</style>

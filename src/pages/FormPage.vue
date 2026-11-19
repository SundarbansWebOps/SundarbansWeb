<!-- Member form on its own route. Same field renderer as the Lounge dialog, split into pages
     at page_break questions. Each question renders on its own so file questions can use the
     upload field; pages stay mounted so Back keeps answers. -->
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
      <figure v-if="form?.banner_url" class="banner">
        <img :src="form.banner_url" :alt="form.banner_alt || ''" decoding="async" />
      </figure>
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
        <template v-else-if="canViewFields">
          <div v-for="(pg, pi) in pageBlocks" v-show="pi === page" :key="pi" class="pg">
            <h2
              v-if="pageBlocks.length > 1"
              :ref="(el) => setPageHead(pi, el)"
              class="pg-title"
              tabindex="-1"
            >
              Page {{ pi + 1 }} of {{ pageBlocks.length }}
            </h2>
            <template v-for="block in pg" :key="block.key">
              <div v-if="block.kind === 'section'" class="sec">
                <h2 class="sec-title">{{ block.field.label }}</h2>
                <p v-if="block.field.description" class="sec-desc">
                  {{ block.field.description }}
                </p>
              </div>
              <FormFileField
                v-else-if="block.kind === 'file'"
                :ref="(el) => setFieldRef(block.key, el)"
                :field="block.field"
                :form-id="form.id"
                :disabled="fieldsDisabled"
                @update:model-value="(list) => setFileIds(block.key, list)"
                @update:busy="(value) => setBusy(block.key, value)"
              />
              <div v-else class="fblock">
                <p v-if="block.field.description" class="fdesc">{{ block.field.description }}</p>
                <FormFields
                  :ref="(el) => setFieldRef(block.key, el)"
                  v-model:save-phone="savePhone"
                  :fields="block.fields"
                  :disabled="fieldsDisabled"
                />
              </div>
            </template>
          </div>
        </template>
        <p v-if="previewOnly" class="msg" role="status">Preview only. {{ unavailableMessage }}</p>
        <p v-else-if="!canSubmit && !locked" class="msg" role="status">
          {{ unavailableMessage }}
        </p>
        <p v-if="uploadsBusy" class="msg" role="status">Finish the uploads to continue.</p>
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
          <button v-if="canViewFields && page > 0" class="ghost" type="button" @click="goBack">
            Back
          </button>
          <button
            v-if="canViewFields && !isLast"
            class="go"
            type="button"
            :disabled="uploadsBusy"
            @click="goNext"
          >
            Next
          </button>
          <button
            v-if="!locked && !done && canSubmit && isLast"
            class="go"
            type="submit"
            :disabled="submitting || uploadsBusy"
          >
            {{ submitting ? 'Sending…' : rejected ? 'Send again' : 'Send' }}
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
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import { theme } from '../components/lounge/state.js';
import { setTheme, theme as siteTheme } from '../lib/theme.js';
import '../components/lounge/lounge.css';
import '../components/lounge/panels.css';
import '../components/lounge/tokens.css';
import FormFields from '../components/lounge/FormFields.vue';
import FormFileField from '../components/lounge/FormFileField.vue';
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
const savePhone = ref(false);
const submitting = ref(false);
const error = ref('');
const done = ref(false);
const invite = ref('');
const inviteError = ref('');
const page = ref(0);

// Input components by field key (FormFields for answers, FormFileField for files).
const fieldRefs = new Map();
const pageHeads = [];
// Ready file ids per file question, and the questions still uploading or preparing.
const fileIds = reactive({});
const busyFields = reactive(new Set());
const uploadsBusy = computed(() => busyFields.size > 0);

const form = computed(() => formById(route.params.id));
/* Submitted and not rejected: final. A rejected response can be filled in again. */
const locked = computed(() => isLocked(form.value));
const rejected = computed(() => !done.value && reviewOf(form.value) === 'rejected');
const canSubmit = computed(
  () => !!form.value && (form.value.accepting_responses ?? form.value.is_open ?? false)
);
const previewOnly = computed(() => isSuperAdmin.value && !canSubmit.value);
const canViewFields = computed(() => canSubmit.value || isSuperAdmin.value);
const fieldsDisabled = computed(
  () => previewOnly.value || locked.value || (rejected.value && !canSubmit.value)
);
const unavailableMessage = computed(() =>
  formUnavailableMessage(form.value, member.region_id, member.cohort)
);

// Pages are split at page_break questions. Section headers and questions become blocks;
// page_break itself is never rendered or answered.
const pageBlocks = computed(() => {
  const pages = [[]];
  (form.value?.fields || []).forEach((field, index) => {
    if (field.type === 'page_break') {
      pages.push([]);
      return;
    }
    const kind = field.type === 'section' ? 'section' : field.type === 'file' ? 'file' : 'input';
    pages[pages.length - 1].push({
      key: field.key || `block-${index}`,
      kind,
      field,
      fields: [field],
    });
  });
  return pages;
});
const isLast = computed(() => page.value >= pageBlocks.value.length - 1);

function toggleTheme() {
  setTheme(theme.value === 'dark' ? 'light' : 'dark');
}

function setFieldRef(key, el) {
  if (el) fieldRefs.set(key, el);
  else fieldRefs.delete(key);
}

function setPageHead(index, el) {
  pageHeads[index] = el;
}

function setFileIds(key, list) {
  fileIds[key] = list.map((file) => file.file_id);
}

function setBusy(key, value) {
  if (value) busyFields.add(key);
  else busyFields.delete(key);
}

// Validates every question on one page. Runs in reverse so the focus call from the
// earliest invalid question lands last and wins.
async function validatePage(index) {
  let ok = true;
  const blocks = pageBlocks.value[index].filter((block) => block.kind !== 'section').reverse();
  for (const block of blocks) {
    const input = fieldRefs.get(block.key);
    if (input && !(await input.validate())) ok = false;
  }
  return ok;
}

async function goTo(index) {
  page.value = index;
  await nextTick();
  pageHeads[index]?.focus();
}

async function goNext() {
  if (uploadsBusy.value || isLast.value) return;
  if (!(await validatePage(page.value))) return;
  await goTo(page.value + 1);
}

function goBack() {
  if (page.value > 0) goTo(page.value - 1);
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

function collectAnswers() {
  const out = {};
  for (const blocks of pageBlocks.value) {
    for (const block of blocks) {
      if (block.kind === 'section') continue;
      if (block.kind === 'file') out[block.field.key] = fileIds[block.key] ?? [];
      else Object.assign(out, fieldRefs.get(block.key)?.answers() ?? {});
    }
  }
  return out;
}

async function send() {
  if (!isLast.value) return goNext();
  if (submitting.value || uploadsBusy.value || !form.value || locked.value || !canSubmit.value) {
    return;
  }
  // Check every page; if one fails, show it and land on it.
  for (let i = 0; i < pageBlocks.value.length; i++) {
    if (await validatePage(i)) continue;
    if (i !== page.value) {
      page.value = i;
      await nextTick();
      await validatePage(i);
    }
    return;
  }
  submitting.value = true;
  error.value = '';
  try {
    const result = await submitLoungeForm(form.value.id, collectAnswers(), savePhone.value);
    done.value = true;
    invite.value = result?.invite_url || '';
    if (!invite.value && result?.response_id) {
      await loadInvite();
    }
  } catch (err) {
    error.value = errorText(err);
  } finally {
    submitting.value = false;
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
.banner {
  margin: 0;
  overflow: hidden;
  aspect-ratio: 3 / 1;
  border: 1px solid var(--line);
  border-radius: var(--r);
  background: var(--paper);
}
.banner img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
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
.pg {
  display: grid;
  gap: 14px;
}
.pg-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--ink);
}
.sec {
  display: grid;
  gap: 4px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}
.sec-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
}
.sec-desc,
.fdesc {
  margin: 0;
  font-size: 15px;
  line-height: 1.45;
  color: var(--ink-2);
  white-space: pre-line;
}
.fblock {
  display: grid;
  gap: 8px;
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
  font: inherit;
  font-size: 15px;
  font-weight: 650;
  text-decoration: none;
  cursor: pointer;
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
  cursor: default;
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
@media (max-width: 560px) {
  .banner {
    aspect-ratio: 16 / 9;
  }
}
</style>

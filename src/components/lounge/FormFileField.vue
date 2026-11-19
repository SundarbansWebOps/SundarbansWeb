<!-- One file question on a member form. Files upload as they are picked (compressed first for
     photos); the answer is the list of ready files. Removing a ready file deletes it on the server. -->
<template>
  <div ref="root" class="ffile" role="group" :aria-labelledby="labelId" :aria-describedby="descId">
    <div class="ffile-head">
      <span :id="labelId" class="ffile-label"
        >{{ field.label }} <small>{{ field.required ? 'required' : 'optional' }}</small></span
      >
      <span v-if="!disabled" class="ffile-count" aria-hidden="true"
        >{{ readyCount }} of {{ max }}</span
      >
    </div>
    <p v-if="field.description" :id="descId" class="ffile-desc">{{ field.description }}</p>

    <div
      v-if="!disabled && canAdd"
      class="ffile-drop"
      :class="{ on: dragging }"
      @dragenter.prevent="dragging = true"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <p :id="hintId" class="ffile-hint">{{ hint }}</p>
      <button type="button" class="ffile-choose" :aria-describedby="hintId" @click="pick">
        Choose files
      </button>
      <input
        ref="input"
        class="ffile-input"
        type="file"
        tabindex="-1"
        aria-hidden="true"
        :accept="accept"
        :multiple="max > 1"
        @change="onPick"
      />
    </div>
    <p v-else-if="!disabled" :id="hintId" class="ffile-hint">
      Limit reached. Remove a file to add another.
    </p>

    <ul
      v-if="items.length && !disabled"
      class="ffile-list"
      :aria-label="`Files for ${field.label}`"
    >
      <li v-for="item in items" :key="item.uid" class="ffile-item" :data-status="item.status">
        <div class="ffile-row">
          <span class="ffile-name">{{ item.name }}</span>
          <span class="ffile-state">{{ stateText(item) }}</span>
          <button
            v-if="!disabled"
            type="button"
            class="ffile-remove"
            :aria-label="`Remove ${item.name}`"
            @click="remove(item)"
          >
            Remove
          </button>
        </div>
        <progress
          v-if="item.status === 'uploading'"
          class="ffile-bar"
          :value="item.progress"
          max="1"
          :aria-label="`Uploading ${item.name}`"
        />
        <progress
          v-else-if="item.status === 'preparing'"
          class="ffile-bar"
          :aria-label="`Preparing ${item.name}`"
        />
        <p v-if="item.status === 'error'" class="ffile-err">{{ item.error }}</p>
      </li>
    </ul>

    <ul
      v-if="disabled && savedFiles.length"
      class="ffile-list"
      :aria-label="`Files for ${field.label}`"
    >
      <li v-for="file in savedFiles" :key="file.file_id" class="ffile-item">
        <div class="ffile-row">
          <span class="ffile-name">{{ file.name }}</span>
        </div>
      </li>
    </ul>

    <p v-if="notice" class="ffile-notice" role="status">{{ notice }}</p>
    <p v-if="error" :id="errorId" class="ffile-err" role="alert">{{ error }}</p>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, useId, watch } from 'vue';
import {
  FILE_LIMITS,
  acceptFor,
  prepareFile,
  removeFormFile,
  uploadFormFile,
} from '../../lib/form-files.js';

const props = defineProps({
  field: { type: Object, required: true },
  formId: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  // Files already attached to a submitted response (name only), shown read-only.
  savedFiles: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue', 'update:busy']);

const uid = useId();
const labelId = `${uid}-label`;
const descId = `${uid}-desc`;
const hintId = `${uid}-hint`;
const errorId = `${uid}-error`;

const root = ref(null);
const input = ref(null);
const dragging = ref(false);
const items = ref([]);
const error = ref('');
const notice = ref('');
let nextUid = 0;

const max = computed(() => Math.min(Math.max(Number(props.field.max_files) || 1, 1), 10));
const kind = computed(() => props.field.accept || 'any');
const accept = computed(() => acceptFor(kind.value));
const liveItems = computed(() => items.value.filter((item) => item.status !== 'error'));
const readyCount = computed(() => items.value.filter((item) => item.status === 'ready').length);
const canAdd = computed(() => liveItems.value.length < max.value);
const busy = computed(() =>
  items.value.some((item) => item.status === 'preparing' || item.status === 'uploading')
);
const hint = computed(() => {
  const photoMb = FILE_LIMITS.imageSourceBytes / (1024 * 1024);
  const pdfMb = FILE_LIMITS.pdfBytes / (1024 * 1024);
  if (kind.value === 'image')
    return `Photos up to ${photoMb} MB. We shrink them before they upload.`;
  if (kind.value === 'pdf') return `PDF files up to ${pdfMb} MB.`;
  return `Photos up to ${photoMb} MB or PDF files up to ${pdfMb} MB.`;
});

function stateText(item) {
  if (item.status === 'preparing') return 'Preparing…';
  if (item.status === 'uploading') return `Uploading ${Math.round(item.progress * 100)}%`;
  if (item.status === 'ready') return 'Attached';
  return 'Not added';
}

// Only finished files reach the parent; it sends their ids with the answers.
watch(
  items,
  () => {
    emit(
      'update:modelValue',
      items.value
        .filter((item) => item.status === 'ready')
        .map(({ file_id, name, mime, size }) => ({ file_id, name, mime, size }))
    );
    emit('update:busy', busy.value);
  },
  { deep: true }
);

function pick() {
  input.value?.click();
}

function onPick(event) {
  addFiles(Array.from(event.target.files ?? []));
  // Clear the input so picking the same file again still fires a change.
  event.target.value = '';
}

function onDrop(event) {
  dragging.value = false;
  if (props.disabled) return;
  addFiles(Array.from(event.dataTransfer?.files ?? []));
}

function addFiles(files) {
  if (!files.length) return;
  error.value = '';
  notice.value = '';
  const free = max.value - liveItems.value.length;
  const taken = files.slice(0, Math.max(free, 0));
  if (taken.length < files.length) {
    notice.value = `You can attach up to ${max.value} ${max.value === 1 ? 'file' : 'files'} here. ${files.length - taken.length} not added.`;
  }
  for (const file of taken) {
    const item = reactive({
      uid: ++nextUid,
      name: file.name,
      status: 'preparing',
      progress: 0,
      file_id: null,
      error: '',
      controller: new AbortController(),
    });
    items.value.push(item);
    upload(item, file);
  }
}

async function upload(item, file) {
  const { signal } = item.controller;
  try {
    const prepared = await prepareFile(file, kind.value);
    if (signal.aborted) return;
    item.name = prepared.name;
    item.status = 'uploading';
    const result = await uploadFormFile({
      formId: props.formId,
      fieldKey: props.field.key,
      prepared,
      signal,
      onProgress: (fraction) => {
        item.progress = Math.min(Math.max(Number(fraction) || 0, 0), 1);
      },
    });
    if (signal.aborted) {
      // Removed mid-upload: the server copy is no longer wanted.
      await removeFormFile(result.file_id).catch(() => {});
      return;
    }
    Object.assign(item, {
      status: 'ready',
      file_id: result.file_id,
      name: result.name ?? item.name,
      progress: 1,
    });
  } catch (err) {
    if (signal.aborted) return;
    item.status = 'error';
    item.error = err?.message || "This file couldn't be uploaded. Try again.";
  }
}

async function remove(item) {
  error.value = '';
  notice.value = '';
  item.controller.abort();
  const index = items.value.indexOf(item);
  if (index !== -1) items.value.splice(index, 1);
  if (item.status !== 'ready' || !item.file_id) return;
  try {
    await removeFormFile(item.file_id);
  } catch (err) {
    // Keep it listed so the member can try again; the file is still attached on the server.
    items.value.splice(index, 0, item);
    error.value = err?.message || `${item.name} couldn't be removed. Try again.`;
    await nextTick();
  }
}

// Used by the page before moving on or submitting. Returns false and shows the reason.
function validate() {
  error.value = '';
  if (busy.value) {
    error.value = 'Wait for the upload to finish.';
  } else if (props.field.required && readyCount.value === 0) {
    error.value = `${props.field.label} needs at least one file.`;
  }
  if (!error.value) return true;
  nextTick(() => root.value?.querySelector('.ffile-choose, .ffile-remove')?.focus());
  return false;
}

onBeforeUnmount(() => {
  for (const item of items.value) item.controller.abort();
});

defineExpose({
  validate,
  busy: () => busy.value,
  focus: () => nextTick(() => root.value?.querySelector('.ffile-choose, .ffile-remove')?.focus()),
});
</script>

<style scoped>
.ffile {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.ffile-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.ffile-label {
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.ffile-label small {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: var(--ink-3);
}
.ffile-count {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}
.ffile-desc,
.ffile-hint,
.ffile-notice {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--ink-2);
}
.ffile-drop {
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 16px;
  border: 1.5px dashed var(--line-strong);
  border-radius: 12px;
  background: var(--paper);
  transition: border-color 0.2s var(--ease-out);
}
.ffile-drop.on {
  border-color: var(--mari);
  background: var(--mari-soft);
}
.ffile-choose,
.ffile-remove {
  min-height: 44px;
  padding: 0 16px;
  border-radius: 99px;
  font: inherit;
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
}
.ffile-choose {
  border: 0;
  background: var(--mari);
  color: var(--on-mari);
}
.ffile-choose:disabled {
  opacity: 0.55;
  cursor: default;
}
.ffile-remove {
  min-height: 36px;
  padding: 0 12px;
  border: 1.5px solid var(--line-strong);
  background: transparent;
  color: var(--ink);
}
.ffile-input {
  display: none;
}
.ffile-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}
.ffile-item {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--card);
}
.ffile-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
}
.ffile-name {
  flex: 1 1 160px;
  min-width: 0;
  font-size: 15px;
  font-weight: 550;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.ffile-state {
  font-size: 13px;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}
.ffile-bar {
  width: 100%;
  height: 8px;
  accent-color: var(--mari);
}
.ffile-err {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--verm);
}
@media (max-width: 560px) {
  .ffile-drop {
    padding: 14px;
  }
}
</style>

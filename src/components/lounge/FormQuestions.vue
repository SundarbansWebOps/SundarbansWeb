<template>
  <div>
    <p v-if="pendingError" class="ff-err" role="alert">
      {{ pendingError }}
      <button type="button" class="retry" @click="loadPending">Try again</button>
    </p>
    <div v-for="(blocks, index) in pages" v-show="index === page" :key="index" class="pg">
      <h2
        v-if="pages.length > 1"
        :ref="(el) => (headings[index] = el)"
        class="pg-title"
        tabindex="-1"
      >
        Page {{ index + 1 }} of {{ pages.length }}
      </h2>
      <template v-for="block in blocks" :key="block.field.key">
        <section
          v-if="block.field.type === 'section'"
          class="sec"
          :aria-labelledby="`${uid}-${block.field.key}`"
        >
          <h2 :id="`${uid}-${block.field.key}`" class="sec-title">{{ block.field.label }}</h2>
          <p v-if="block.field.description" class="sec-desc">{{ block.field.description }}</p>
        </section>
        <FormFileField
          v-else-if="block.field.type === 'file'"
          :ref="(el) => setInput(block.field.key, el)"
          :field="block.field"
          :form-id="form.id"
          :disabled="disabled"
          :restoring="restoring"
          :pending-files="pendingFiles[block.field.key]"
          @update:model-value="
            (list) => (fileIds[block.field.key] = list.map(({ file_id }) => file_id))
          "
          @update:busy="(busy) => setBusy(block.field.key, busy)"
        />
        <div v-else class="fblock">
          <p v-if="block.field.description" class="fdesc">{{ block.field.description }}</p>
          <FormFields
            :ref="(el) => setInput(block.field.key, el)"
            v-model:save-phone="savePhone"
            :fields="block.fields"
            :disabled="disabled"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, useId, watch } from 'vue';
import { listPendingFormFiles } from '../../lib/form-files.js';
import FormFields from './FormFields.vue';
import FormFileField from './FormFileField.vue';

const props = defineProps({
  form: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
});
const savePhone = defineModel('savePhone', { type: Boolean, default: false });

const uid = useId();
const page = ref(0);
const headings = [];
const inputs = new Map();
const fileIds = reactive(Object.create(null));
const busyFields = reactive(new Set());
const restoring = ref(false);
const pendingFiles = ref(Object.create(null));
const pendingError = ref('');
const uploadsBusy = computed(() => restoring.value || busyFields.size > 0);

const pages = computed(() => {
  const result = [[]];
  for (const field of props.form.fields ?? []) {
    if (field.type === 'page_break') result.push([]);
    else result.at(-1).push({ field, fields: [field] });
  }
  return result;
});
const hasPrevious = computed(() => page.value > 0);
const isLast = computed(() => page.value >= pages.value.length - 1);
const hasFileQuestions = computed(() => props.form.fields?.some((field) => field.type === 'file'));

function setInput(key, el) {
  if (el) inputs.set(key, el);
  else inputs.delete(key);
}

function setBusy(key, busy) {
  if (busy) busyFields.add(key);
  else busyFields.delete(key);
}

let pendingRun = 0;
async function loadPending() {
  const run = ++pendingRun;
  pendingError.value = '';
  if (props.disabled || !hasFileQuestions.value) {
    restoring.value = false;
    return;
  }

  restoring.value = true;
  try {
    const files = await listPendingFormFiles(props.form.id);
    if (run !== pendingRun) return;
    // Null prototype: a question keyed "constructor" must not hit Object.prototype.
    const grouped = Object.create(null);
    for (const file of files ?? []) (grouped[file.field_key] ??= []).push(file);
    pendingFiles.value = grouped;
  } catch (err) {
    if (run === pendingRun) pendingError.value = err.message || 'Could not load pending uploads.';
  } finally {
    if (run === pendingRun) restoring.value = false;
  }
}

watch([() => props.form.id, () => props.disabled, hasFileQuestions], loadPending, {
  immediate: true,
});

onBeforeUnmount(() => pendingRun++);

async function goTo(index) {
  page.value = index;
  await nextTick();
  headings[index]?.focus();
}

async function validatePage(index, focus = true) {
  for (const { field } of pages.value[index] ?? []) {
    const input = inputs.get(field.key);
    if (input && !(await input.validate(focus))) return false;
  }
  return true;
}

async function next() {
  if (uploadsBusy.value || isLast.value) return;
  if (props.disabled || (await validatePage(page.value))) await goTo(page.value + 1);
}

async function validate() {
  for (let index = 0; index < pages.value.length; index++) {
    if (await validatePage(index, index === page.value)) continue;
    if (index !== page.value) {
      await goTo(index);
      await validatePage(index);
    }
    return false;
  }
  return true;
}

function answers() {
  const result = {};
  for (const blocks of pages.value) {
    for (const { field } of blocks) {
      if (field.type === 'file') result[field.key] = fileIds[field.key] ?? [];
      else Object.assign(result, inputs.get(field.key)?.answers() ?? {});
    }
  }
  return result;
}

defineExpose({
  answers,
  validate,
  uploadsBusy,
  hasPrevious,
  isLast,
  next,
  back: () => hasPrevious.value && goTo(page.value - 1),
});
</script>

<style scoped>
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
.retry {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
</style>

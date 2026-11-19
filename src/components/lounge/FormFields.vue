<!-- Ordered schema renderer: text, email, phone/tel, textarea, select, checkbox, multiselect. -->
<template>
  <div class="ff">
    <template v-for="field in fields" :key="field.key">
      <label v-if="isText(field)" class="ff-field" :class="{ wide: field.type === 'textarea' }">
        <span
          >{{ field.label }}
          <small v-if="!field.required">optional</small>
          <small v-else>required</small></span
        >
        <textarea
          v-if="field.type === 'textarea'"
          :id="idFor(field)"
          :aria-invalid="errors[field.key] ? 'true' : undefined"
          :aria-describedby="errors[field.key] ? errorId(field) : undefined"
          v-model="draft[field.key]"
          rows="3"
          :required="field.required"
          :maxlength="10000"
          :disabled="disabled"
        />
        <input
          v-else
          :id="idFor(field)"
          :aria-invalid="errors[field.key] ? 'true' : undefined"
          :aria-describedby="errors[field.key] ? errorId(field) : undefined"
          v-model="draft[field.key]"
          :type="inputType(field)"
          :required="field.required"
          :autocomplete="autoOf(field)"
          :inputmode="field.type === 'phone' || field.type === 'tel' ? 'tel' : undefined"
          :maxlength="field.type === 'phone' || field.type === 'tel' ? 20 : 10000"
          :disabled="disabled"
        />
      </label>

      <label v-else-if="field.type === 'select'" class="ff-field">
        <span
          >{{ field.label }} <small v-if="!field.required">optional</small
          ><small v-else>required</small></span
        >
        <select
          :id="idFor(field)"
          :aria-invalid="errors[field.key] ? 'true' : undefined"
          :aria-describedby="errors[field.key] ? errorId(field) : undefined"
          v-model="draft[field.key]"
          :required="field.required"
          :disabled="disabled"
        >
          <option value="">Choose</option>
          <option v-for="opt in field.options || []" :key="opt" :value="opt">{{ opt }}</option>
          <option v-if="field.allow_other" :value="OTHER">Other</option>
        </select>
        <input
          v-if="field.allow_other && draft[field.key] === OTHER"
          v-model="otherText[field.key]"
          type="text"
          maxlength="300"
          placeholder="Please specify"
          :required="field.required"
          :aria-label="`Other answer for ${field.label}`"
          :disabled="disabled"
        />
      </label>

      <fieldset v-else-if="field.type === 'multiselect'" class="ff-multi">
        <legend>
          {{ field.label }} <small v-if="!field.required">optional</small
          ><small v-else>required</small>
        </legend>
        <label v-for="opt in field.options || []" :key="opt" class="ff-check">
          <input
            :id="idFor(field)"
            :checked="selected(field.key).includes(opt)"
            type="checkbox"
            :name="field.key"
            :aria-invalid="errors[field.key] ? 'true' : undefined"
            :aria-describedby="errors[field.key] ? errorId(field) : undefined"
            :disabled="disabled"
            @change="toggle(field.key, opt, $event.target.checked)"
          />
          {{ opt }}
        </label>
        <label v-if="field.allow_other" class="ff-other">
          <input
            :checked="otherOn[field.key]"
            type="checkbox"
            :aria-invalid="errors[field.key] ? 'true' : undefined"
            :aria-describedby="errors[field.key] ? errorId(field) : undefined"
            :disabled="disabled"
            @change="toggleOther(field.key, $event.target.checked)"
          />
          Other
          <input
            v-if="otherOn[field.key]"
            v-model="otherText[field.key]"
            type="text"
            maxlength="300"
            placeholder="Please specify"
            :aria-label="`Other answer for ${field.label}`"
            :disabled="disabled"
          />
        </label>
        <p v-if="errors[field.key]" :id="errorId(field)" class="ff-error" role="alert">
          {{ errors[field.key] }}
        </p>
      </fieldset>

      <label v-else-if="field.type === 'checkbox'" class="ff-check">
        <input
          :id="idFor(field)"
          :aria-invalid="errors[field.key] ? 'true' : undefined"
          :aria-describedby="errors[field.key] ? errorId(field) : undefined"
          v-model="draft[field.key]"
          type="checkbox"
          :required="field.required"
          :disabled="disabled"
        />
        {{ field.label }}
      </label>
      <p
        v-if="field.type !== 'multiselect' && errors[field.key]"
        :id="errorId(field)"
        class="ff-error"
        role="alert"
      >
        {{ errors[field.key] }}
      </p>
    </template>

    <label v-if="phoneField" class="ff-check">
      <input v-model="savePhone" type="checkbox" :disabled="disabled" />
      Save your phone number for later
    </label>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, watch } from 'vue';
import { member } from './fixtures.js';
import { preferredName } from './state.js';

const props = defineProps({
  fields: { type: Array, default: () => [] },
  profile: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
});

const draft = reactive({});
const otherOn = reactive({});
const otherText = reactive({});
const errors = reactive({});
const savePhone = defineModel('savePhone', { type: Boolean, default: false });

const profile = computed(() => props.profile || member);
const phoneField = computed(() => props.fields.find((f) => f.type === 'phone' || f.type === 'tel'));

function isText(field) {
  return ['text', 'textarea', 'email', 'phone', 'tel'].includes(field.type);
}
function inputType(field) {
  if (field.type === 'email') return 'email';
  if (field.type === 'phone' || field.type === 'tel') return 'tel';
  return 'text';
}
// Sentinel for a single-select "Other"; it never reaches the server as an answer.
const OTHER = '\u0000other';

function autoOf(field) {
  if (field.prefill === 'name') return 'name';
  if (field.prefill === 'email' || field.type === 'email') return 'email';
  if (field.prefill === 'phone' || field.type === 'phone' || field.type === 'tel') return 'tel';
  return 'off';
}
function idFor(field) {
  return `ff-${field.key}`;
}
function errorId(field) {
  return `ff-error-${field.key}`;
}
function selected(key) {
  return Array.isArray(draft[key]) ? draft[key] : [];
}
function toggle(key, opt, on) {
  const cur = selected(key);
  draft[key] = on ? [...cur, opt] : cur.filter((x) => x !== opt);
}
function toggleOther(key, on) {
  otherOn[key] = on;
  if (!on) otherText[key] = '';
}

function prefillValue(field) {
  const who = profile.value;
  if (field.prefill === 'name') return preferredName.value || '';
  if (field.prefill === 'phone') return who.phone || '';
  if (field.prefill === 'email') return who.email || '';
  if (field.type === 'checkbox') return false;
  if (field.type === 'multiselect') return [];
  return '';
}

watch(
  () => props.fields,
  (fields) => {
    for (const field of fields) {
      if (draft[field.key] === undefined) draft[field.key] = prefillValue(field);
      if (field.allow_other && otherText[field.key] === undefined) otherText[field.key] = '';
      if (field.type === 'multiselect' && field.allow_other && otherOn[field.key] === undefined) {
        otherOn[field.key] = false;
        otherText[field.key] = '';
      }
    }
  },
  { immediate: true, deep: true }
);

defineExpose({
  async validate(focus = true) {
    for (const field of props.fields) {
      delete errors[field.key];
      const value = String(draft[field.key] ?? '');
      let valid = true;
      if (field.type === 'multiselect') {
        valid =
          selected(field.key).length > 0 || (otherOn[field.key] && !!otherText[field.key]?.trim());
      } else if (field.type === 'select' && draft[field.key] === OTHER) {
        valid = !!otherText[field.key]?.trim();
      } else if (field.type === 'checkbox') {
        valid = !!draft[field.key];
      } else {
        valid = !!String(draft[field.key] ?? '').trim();
      }
      if (field.required && !valid) {
        errors[field.key] = `${field.label} is required.`;
      } else if (field.type === 'email' && value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
        errors[field.key] = 'Enter a valid email address.';
      } else if (
        ['phone', 'tel'].includes(field.type) &&
        value.trim() &&
        !/^(?:\+|00)[1-9][0-9]{7,14}$/.test(value.replace(/[\s().-]/g, ''))
      ) {
        errors[field.key] = 'Enter your phone number with its country code, e.g. +919876543210.';
      }
    }
    const invalid = props.fields.find((field) => errors[field.key]);
    if (invalid && focus) {
      await nextTick();
      document.getElementById(idFor(invalid))?.focus();
    }
    return !invalid;
  },
  answers() {
    const out = {};
    for (const field of props.fields) {
      if (field.type === 'checkbox') {
        out[field.key] = !!draft[field.key];
      } else if (field.type === 'multiselect') {
        const chosen = [...selected(field.key)];
        if (field.allow_other && otherOn[field.key] && otherText[field.key]?.trim()) {
          chosen.push(`Other:${otherText[field.key].trim().slice(0, 300)}`);
        }
        out[field.key] = chosen;
      } else if (field.type === 'select' && draft[field.key] === OTHER) {
        const text = otherText[field.key]?.trim().slice(0, 300);
        out[field.key] = text ? `Other:${text}` : '';
      } else {
        const v = draft[field.key];
        out[field.key] = v == null ? '' : String(v);
      }
    }
    return out;
  },
  savePhone: () => !!savePhone.value,
});
</script>

<style scoped>
.ff-error {
  margin: 0;
  color: var(--verm);
  font-size: 13px;
  line-height: 1.4;
}
</style>

<template>
  <p v-if="error" class="ff-err" role="alert">{{ error }}</p>
  <FormFileField
    v-for="{ field, files } in submitted"
    :key="field.key"
    :field="field"
    :form-id="formId"
    :saved-files="files"
    disabled
  />
</template>

<script setup>
import { ref, watch } from 'vue';
import { auth, errorText } from '../../lib/auth.js';
import { decodeFileAnswer } from '../../lib/form-files.js';
import { getOwnFormResponse } from '../../lib/lounge.js';
import FormFileField from './FormFileField.vue';

const props = defineProps({ formId: { type: String, required: true } });
const submitted = ref([]);
const error = ref('');

watch(
  [() => props.formId, () => auth.session?.user?.id],
  async ([formId, memberId], _, onCleanup) => {
    let stale = false;
    onCleanup(() => (stale = true));
    submitted.value = [];
    error.value = '';
    if (!memberId) return;
    try {
      const response = await getOwnFormResponse(formId, memberId);
      if (stale) return;
      submitted.value = (response?.field_schema ?? [])
        .filter(({ type }) => type === 'file')
        .map((field) => ({
          field,
          files: decodeFileAnswer(response.answers?.[field.key]).filter(({ name }) => name),
        }))
        .filter(({ files }) => files.length);
    } catch (err) {
      if (!stale) error.value = errorText(err);
    }
  },
  { immediate: true }
);
</script>

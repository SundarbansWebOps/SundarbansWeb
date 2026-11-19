<!-- One uploaded form file for managers. Opened from a response's file link in the admin
     lounge. The file is fetched with the manager's session, so it cannot be a plain link. -->
<template>
  <main id="main-content" class="file-page">
    <p class="back-row">
      <RouterLink class="adm-btn ghost small" to="/admin">Back to the admin lounge</RouterLink>
    </p>
    <h1 ref="heading" tabindex="-1" class="title">Form file</h1>

    <p v-if="state === 'loading'" class="adm-note" role="status">Loading the file…</p>
    <p v-else-if="state === 'error'" class="adm-msg err" role="alert">
      Couldn't load file. Check your connection and try again.
    </p>
    <figure v-else-if="kind === 'image'" class="frame">
      <img :src="src" alt="Uploaded form file" />
    </figure>
    <p v-else-if="kind === 'pdf'" class="back-row">
      <a class="adm-btn ghost small" :href="src" target="_blank" rel="noopener noreferrer">
        Open PDF in a new tab
      </a>
    </p>
  </main>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { fetchFormFileBlob } from '../lib/form-files.js';
import '../components/admin/admin.css';

const route = useRoute();
const heading = ref(null);
const state = ref('loading');
const kind = ref('');
const src = ref('');
let objectUrl = '';
// Each load gets a number so a slow earlier fetch cannot overwrite a newer one.
let generation = 0;

function release() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = '';
  src.value = '';
}

async function load() {
  const current = ++generation;
  release();
  state.value = 'loading';
  kind.value = '';
  try {
    const blob = await fetchFormFileBlob(route.params.fileId);
    if (current !== generation) return;
    const type = blob.type || '';
    if (!type.startsWith('image/') && type !== 'application/pdf') throw new Error('unsupported');
    objectUrl = URL.createObjectURL(blob);
    src.value = objectUrl;
    kind.value = type === 'application/pdf' ? 'pdf' : 'image';
    state.value = 'ready';
  } catch {
    if (current !== generation) return;
    state.value = 'error';
  }
}

onMounted(() => {
  load();
  heading.value?.focus();
});

watch(() => route.params.fileId, load);

onBeforeUnmount(() => {
  generation++;
  release();
});
</script>

<style scoped>
.file-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px clamp(16px, 4vw, 40px) 64px;
  display: grid;
  gap: 16px;
  color: var(--ink);
  font-family: var(--font);
}
.back-row {
  margin: 0;
}
.title {
  margin: 0;
  font-size: clamp(26px, 3.6vw, 36px);
  font-weight: 750;
  letter-spacing: -0.03em;
}
.title:focus {
  outline: none;
}
.frame {
  margin: 0;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--paper);
  overflow: hidden;
}
.frame img {
  display: block;
  max-width: 100%;
  height: auto;
}
</style>

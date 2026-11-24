<!-- Copies a Lounge link that opens this form for whoever follows it (after sign-in). Only admins
     and Super Admins see it: they hand the link to members. -->
<template>
  <span v-if="canShare" class="share">
    <button type="button" class="gp-btn is-ghost share-btn" @click="copy">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          v-if="state !== 'copied'"
          d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"
        />
        <path v-else d="m5 12 4.5 4.5L19 7" />
      </svg>
      {{ state === 'copied' ? 'Link copied' : 'Copy link' }}
    </button>
    <span class="visually-hidden" role="status">{{ state === 'copied' ? 'Link copied' : '' }}</span>
    <!-- Clipboard blocked (an insecure origin or a denied permission): show it to copy by hand. -->
    <input
      v-if="state === 'failed'"
      class="share-url"
      :value="url"
      readonly
      aria-label="Form link"
      @focus="$event.target.select()"
    />
  </span>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import { auth } from '../../lib/auth.js';

const props = defineProps({
  /* Route location inside the app, e.g. { path: '/lounge', query: { form: id } }. */
  to: { type: Object, required: true },
});

const router = useRouter();
const canShare = computed(() => ['admin', 'super_admin'].includes(auth.dashboard?.role));
const url = computed(() => new URL(router.resolve(props.to).href, location.href).href);
const state = ref('');
let timer = 0;

async function copy() {
  clearTimeout(timer);
  try {
    await navigator.clipboard.writeText(url.value);
    state.value = 'copied';
    timer = setTimeout(() => (state.value = ''), 1800);
  } catch {
    state.value = 'failed';
  }
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<style scoped>
.share {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.share-btn {
  min-height: 36px;
  padding: 0 14px;
  gap: 8px;
  font-size: 14px;
}
.share-btn svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.share-url {
  min-width: 0;
  width: min(100%, 360px);
  min-height: 36px;
  padding: 6px 10px;
  border: var(--kw) solid var(--keyline);
  border-radius: 4px;
  background: var(--paper-2);
  color: var(--t-1);
  font: inherit;
  font-size: 13px;
}
</style>

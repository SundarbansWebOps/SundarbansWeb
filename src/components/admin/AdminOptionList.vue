<!--
  Choice options, one input each, like a WhatsApp poll: an empty row always waits at the end and
  typing in it adds the next one. Enter moves down, Backspace in an empty row removes it.
  The model holds only filled options; blanks never reach the form.
-->
<template>
  <fieldset class="opts">
    <legend>Options</legend>
    <ol>
      <li v-for="(opt, i) in rows" :key="i" class="opt">
        <span class="n mono" aria-hidden="true">{{ i + 1 }}</span>
        <input
          :ref="(el) => (inputs[i] = el)"
          class="adm-input"
          :value="opt"
          maxlength="300"
          :placeholder="i === rows.length - 1 ? (i ? 'Add option' : 'Option 1') : ''"
          :aria-label="`Option ${i + 1}`"
          :aria-invalid="dupes.has(i) ? 'true' : undefined"
          @input="set(i, $event.target.value)"
          @keydown.enter.prevent="focus(i + 1)"
          @keydown.backspace="onBackspace(i, $event)"
        />
        <button
          v-if="i < rows.length - 1"
          type="button"
          class="adm-btn ghost small x"
          :aria-label="`Remove option ${i + 1}`"
          title="Remove"
          @click="remove(i)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </li>
    </ol>
    <small v-if="dupes.size" class="bad" aria-live="polite">Each option must be different.</small>
    <small v-else-if="model.length === 0">Add at least one option.</small>
  </fieldset>
</template>

<script setup>
import { computed, nextTick } from 'vue';

const model = defineModel({ type: Array, default: () => [] });
const inputs = [];

// The filled options plus the one empty row that grows the list.
const rows = computed(() => [...model.value, '']);
const dupes = computed(() => {
  const seen = new Map();
  const out = new Set();
  model.value.forEach((o, i) => {
    const k = o.trim().toLowerCase();
    if (!k) return;
    if (seen.has(k)) out.add(i).add(seen.get(k));
    else seen.set(k, i);
  });
  return out;
});

function set(i, value) {
  const next = [...model.value];
  if (i === next.length) {
    if (!value) return;
    next.push(value);
  } else next[i] = value;
  model.value = next;
}
function remove(i) {
  model.value = model.value.filter((_, j) => j !== i);
}
async function focus(i) {
  await nextTick();
  inputs[Math.min(i, rows.value.length - 1)]?.focus();
}
function onBackspace(i, e) {
  if (e.target.value || i === 0 || i === rows.value.length - 1) return;
  e.preventDefault();
  remove(i);
  focus(i - 1);
}
</script>

<style scoped>
.opts {
  grid-column: 1 / -1;
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
legend {
  padding: 0;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--ink-2);
}
ol {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.opt {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 36px;
  align-items: center;
  gap: 8px;
}
.n {
  font-size: 12px;
  color: var(--ink-3);
  text-align: right;
}
.x {
  inline-size: 36px;
  padding: 0;
  display: grid;
  place-items: center;
}
.x svg {
  inline-size: 16px;
  block-size: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}
small {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--ink-3);
}
small.bad {
  color: var(--verm);
}
</style>

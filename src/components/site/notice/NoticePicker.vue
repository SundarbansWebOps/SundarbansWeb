<!-- Prototype-only switcher: flips the desktop Home notice between the shipped card and corner designs A/B/C via ?v=. -->
<template>
  <nav class="picker" aria-label="Notice prototype">
    <span class="mono">Notice</span>
    <a
      v-for="o in OPTIONS"
      :key="o.v"
      :href="`?v=${o.v}#/`"
      :aria-current="o.v === modelValue ? 'true' : undefined"
      >{{ o.label }}</a
    >
  </nav>
</template>

<script setup>
defineProps({ modelValue: { type: String, required: true } });
const OPTIONS = [
  { v: 'now', label: 'Current' },
  { v: 'a', label: 'A · Poster tag' },
  { v: 'b', label: 'B · Little pat' },
  { v: 'c', label: 'C · Garland' },
];
</script>

<style scoped>
.picker {
  position: fixed;
  z-index: 60;
  left: 50%;
  bottom: calc(16px + var(--tab-h, 0px));
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px;
  border: 1px solid var(--line-strong);
  border-radius: 99px;
  background: var(--card);
  box-shadow: var(--shadow);
  transform: translateX(-50%);
  font-size: 12.5px;
  white-space: nowrap;
}
.picker > span {
  padding: 0 8px;
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-3);
}
a {
  padding: 6px 11px;
  border-radius: 99px;
  color: var(--ink-2);
  font-weight: 600;
  text-decoration: none;
}
a:hover {
  background: var(--sunk);
}
a[aria-current] {
  background: var(--mari);
  color: var(--on-mari);
}
/* Phones and tablets keep the shipped card under the motto, so there is nothing to switch. */
@media (max-width: 1020px) {
  .picker {
    display: none;
  }
}
</style>

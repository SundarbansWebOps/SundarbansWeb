<!--
  One past event: the full poster, what happened, and the way to a participation certificate. Opens with the same
  tide reveal as a course; ← / → step through the log without closing.
-->
<template>
  <Teleport to="body">
    <Transition :css="false" @enter="enter" @leave="leave">
      <div v-if="e" class="root">
        <div class="backdrop" @click="closeEvent()" />
        <aside
          ref="panel"
          class="panel"
          :class="`w-${e.wing}`"
          role="dialog"
          aria-modal="true"
          :aria-label="e.title"
          tabindex="-1"
        >
          <header class="top">
            <span class="wing"><i />{{ WINGS[e.wing].label }}</span>
            <span class="pos mono">{{ idx + 1 }} / {{ list.length }}</span>
            <span class="grow" />
            <button
              type="button"
              class="icon"
              title="Previous (←)"
              :disabled="idx <= 0"
              @click="step(-1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
              <span class="visually-hidden">Previous event</span>
            </button>
            <button
              type="button"
              class="icon"
              title="Next (→)"
              :disabled="idx >= list.length - 1"
              @click="step(1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
              <span class="visually-hidden">Next event</span>
            </button>
            <button
              type="button"
              class="icon"
              :title="copied ? 'Copied' : 'Copy link'"
              @click="copy"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  v-if="!copied"
                  d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"
                />
                <path v-else d="m5 12 4.5 4.5L19 7" />
              </svg>
              <span class="visually-hidden">Copy link</span>
            </button>
            <button type="button" class="icon" title="Close (Esc)" @click="closeEvent()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              <span class="visually-hidden">Close</span>
            </button>
          </header>

          <div ref="body" class="body">
            <Transition :name="dir > 0 ? 'next' : 'prev'" mode="out-in">
              <article :key="e.id" class="art">
                <figure class="poster" :class="{ tall: e.ratio && e.ratio < 0.9 }">
                  <template v-if="e.image">
                    <img class="bg" :src="img.blur(e.image)" alt="" aria-hidden="true" />
                    <img
                      class="hi"
                      :class="{ on: loaded }"
                      :src="img.full(e.image)"
                      :alt="`${e.title} poster`"
                      :style="{ aspectRatio: `${e.ratio}` }"
                      @load="loaded = true"
                    />
                  </template>
                  <div v-else class="tp-wrap"><TypePoster :e="e" big /></div>
                </figure>

                <h2>{{ e.title }}</h2>
                <dl class="facts">
                  <div>
                    <dt>When</dt>
                    <dd>
                      {{ fullDate(e) }}<template v-if="e.time"> · {{ e.time }}</template>
                    </dd>
                  </div>
                  <div>
                    <dt>Format</dt>
                    <dd>{{ e.type }}<template v-if="e.online"> · Online</template></dd>
                  </div>
                  <div v-if="e.attendees">
                    <dt>Turnout</dt>
                    <dd>{{ e.attendees }}</dd>
                  </div>
                  <div v-if="e.location">
                    <dt>Where</dt>
                    <dd>{{ e.location }}</dd>
                  </div>
                </dl>

                <p v-if="e.desc" class="desc">{{ e.desc }}</p>

                <a
                  v-if="e.stage && e.stage !== 'past' && e.link"
                  class="verify"
                  :href="e.link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>
                    <strong>{{ e.stage === 'live' ? 'Happening now' : 'Coming up' }}</strong>
                    Register for this event
                  </span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>
                <button
                  v-else-if="!e.stage || e.stage === 'past'"
                  type="button"
                  class="verify"
                  @click="toLounge"
                >
                  <span>
                    <strong>Took part?</strong>
                    Get your participation certificate in the members’ lounge
                  </span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </article>
            </Transition>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import TypePoster from './TypePoster.vue';
import { WINGS, byId, closeEvent, ev, fullDate, img, openEvent } from '../../lib/events.js';
import { nav } from '../../lib/store.js';

const props = defineProps({ list: { type: Array, required: true } });

// Certificates live in the members’ lounge; land on its certificate demo.
function toLounge() {
  closeEvent(() => {
    nav.go('lounge', 'certificates');
  });
}

const e = computed(() => (ev.open ? byId[ev.open] : null));
const idx = computed(() => props.list.findIndex((x) => x.id === ev.open));
const panel = ref(null);
const body = ref(null);
const loaded = ref(false);
const copied = ref(false);
const dir = ref(1);

watch(
  () => ev.open,
  (id, old) => {
    loaded.value = false;
    copied.value = false;
    if (id && !old) nextTick(() => panel.value?.focus({ preventScroll: true }));
    body.value?.scrollTo({ top: 0 });
  }
);

function step(d) {
  const n = props.list[idx.value + d];
  if (!n) return;
  dir.value = d;
  openEvent(n.id);
}

// Esc / ← / → live on the window (like PhotoViewer): stepping to the first or
// last event disables the focused button, which drops focus to <body> —
// handlers on the panel would stop hearing keys right when they matter most.
function onKey(e) {
  if (!ev.open) return;
  if (e.key === 'Escape') closeEvent();
  else if (!e.target?.matches?.('input, textarea, [contenteditable]')) {
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  }
}
onMounted(() => addEventListener('keydown', onKey));
onBeforeUnmount(() => removeEventListener('keydown', onKey));

async function copy() {
  try {
    await navigator.clipboard.writeText(location.href);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {
    /* clipboard blocked */
  }
}

// Tide reveal from the tapped poster or bubble.
function enter(el, done) {
  const p = el.querySelector('.panel');
  const b = el.querySelector('.backdrop');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
  const r = p.getBoundingClientRect();
  const o = ev.origin ?? { x: r.left, y: r.top };
  const ox = o.x - r.left;
  const oy = o.y - r.top;
  const R =
    Math.hypot(Math.max(Math.abs(ox), Math.abs(r.width - ox)), Math.max(oy, r.height - oy)) + 40;
  b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' });
  p.animate(
    [
      { clipPath: `circle(0px at ${ox}px ${oy}px)` },
      { clipPath: `circle(${R}px at ${ox}px ${oy}px)` },
    ],
    { duration: 700, easing: 'cubic-bezier(.22,1,.36,1)' }
  ).finished.then(done);
}
function leave(el, done) {
  const p = el.querySelector('.panel');
  const b = el.querySelector('.backdrop');
  b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
  p.animate(
    [
      { transform: 'none', opacity: 1 },
      { transform: 'translateX(24px)', opacity: 0 },
    ],
    { duration: 240, easing: 'ease-in', fill: 'forwards' }
  ).finished.then(done);
}
</script>

<style scoped>
.root {
  position: fixed;
  inset: 0;
  z-index: 100;
}
.backdrop {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--ink) 38%, transparent);
  backdrop-filter: blur(2px);
}
.panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(640px, 100%);
  display: flex;
  flex-direction: column;
  background: var(--paper);
  box-shadow: -30px 0 80px -40px rgb(0 0 0 / 0.5);
  outline: none;
}
.top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
}
.grow {
  flex: 1;
}
.wing {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 10px 4px 8px;
  border-radius: 99px;
  border: 1.5px solid var(--w);
  color: var(--w);
  font-size: 13px;
  font-weight: 650;
}
.wing i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--w);
}
.pos {
  font-size: 12px;
  color: var(--ink-3);
}
.icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--card);
  transition:
    transform 0.2s var(--ease-spring),
    border-color 0.2s;
}
.icon:hover:not(:disabled) {
  border-color: var(--ink-3);
  transform: scale(1.06);
}
.icon:disabled {
  opacity: 0.35;
  cursor: default;
}
.icon svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.art {
  padding: 20px 28px 40px;
  display: grid;
  gap: 16px;
}
.poster {
  position: relative;
  margin: 0;
  display: grid;
  place-items: center;
  border-radius: 14px;
  overflow: hidden;
  background: var(--sunk);
  max-height: 52vh;
}
.poster .bg {
  position: absolute;
  inset: -20px;
  width: calc(100% + 40px);
  height: calc(100% + 40px);
  object-fit: cover;
  filter: blur(18px) saturate(1.1);
  opacity: 0.7;
}
.poster .hi {
  position: relative;
  display: block;
  max-width: 100%;
  max-height: 52vh;
  object-fit: contain;
  opacity: 0;
  filter: sepia(0.9) contrast(0.55) brightness(1.25) blur(4px);
  transform: scale(1.03);
  transition:
    opacity 0.5s ease,
    filter 1.2s var(--ease-out),
    transform 1.2s var(--ease-out);
}
.poster .hi.on {
  opacity: 1;
  filter: none;
  transform: none;
}
.tp-wrap {
  width: 100%;
  aspect-ratio: 16 / 10;
}
h2 {
  margin: 4px 0 0;
  font-size: clamp(26px, 4.5vw, 36px);
  font-weight: 750;
  letter-spacing: -0.03em;
  line-height: 1.05;
  text-wrap: balance;
  animation: rise 0.6s var(--ease-out) both 0.1s;
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 26px;
  margin: 0;
  animation: rise 0.6s var(--ease-out) both 0.16s;
}
.facts div {
  display: grid;
  gap: 2px;
}
.facts dt {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.facts dd {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.desc {
  margin: 0;
  font-size: 15.5px;
  line-height: 1.6;
  color: var(--ink-2);
  white-space: pre-line;
  max-width: 62ch;
  animation: rise 0.6s var(--ease-out) both 0.22s;
}
a.verify {
  color: inherit;
  text-decoration: none;
}
.verify {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1.5px dashed var(--line-strong);
  border-radius: 14px;
  background: transparent;
  text-align: left;
  font-size: 14.5px;
  color: var(--ink-2);
  transition: border-color 0.2s;
}
.verify strong {
  display: block;
  color: var(--ink);
  font-weight: 650;
}
.verify svg {
  flex: none;
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.3s var(--ease-out);
}
.verify:hover {
  border-color: var(--ink);
}
.verify:hover svg {
  transform: translateX(4px);
}

.next-enter-active,
.prev-enter-active,
.next-leave-active,
.prev-leave-active {
  transition:
    opacity 0.22s,
    transform 0.3s var(--ease-out);
}
.next-enter-from,
.prev-leave-to {
  opacity: 0;
  transform: translateX(28px);
}
.next-leave-to,
.prev-enter-from {
  opacity: 0;
  transform: translateX(-28px);
}

@media (max-width: 640px) {
  .top {
    padding: 10px 12px;
    gap: 6px;
  }
  .pos {
    display: none;
  }
  .art {
    padding: 16px 18px 40px;
  }
}
</style>

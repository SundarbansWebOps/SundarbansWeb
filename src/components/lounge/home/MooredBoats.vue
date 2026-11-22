<!--
  The member's WhatsApp groups as boats moored at the ghat, below the hero (verdict section 4,
  with the owner's override: below the hero, a short scroll down). Each boat plus its hung tag
  is one link. Reveal, once, when the row is 30% visible: the current sets the boats down
  left to right (ripple ring, settle, the tag swings once on its rope). Idle: a slow bob,
  each boat at its own period, paused off screen. Tap: the boat dips and the water
  splashes; the link opens at once (the splash never delays navigation).
-->
<template>
  <section
    v-if="groupsSection.show"
    id="groups"
    v-loop
    class="moor"
    :class="{ in: shown }"
    aria-labelledby="moor-h"
  >
    <div class="moor-in">
      <header class="moor-head">
        <template v-if="groupsSection.rejectedOnly">
          <p class="moor-kick">Needs another look</p>
          <h2 id="moor-h">A group form wasn't approved</h2>
          <p class="moor-sub">Fill it in again and the admins will take another look.</p>
        </template>
        <template v-else>
          <p class="moor-kick">Moored at the ghat</p>
          <h2 id="moor-h">Your WhatsApp groups</h2>
          <p class="moor-sub">Tap a boat to board. Each one opens in WhatsApp.</p>
        </template>
      </header>
      <p v-if="!boats.length" class="moor-sub">
        Your community and regional groups will appear here when available.
      </p>
      <ul v-else ref="list" class="moor-row" :class="{ 'moor-row--all': isSuperAdmin }">
        <li
          v-for="(g, i) in boats"
          v-loop
          :key="g.id"
          :style="{ '--i': i, '--p': `${PERIODS[i % 5]}s` }"
        >
          <a
            v-if="g.href"
            class="mb"
            :href="g.href"
            target="_blank"
            rel="noopener noreferrer"
            @pointerdown="splash"
            @keydown.enter="splash"
          >
            <span class="mb-hullw" aria-hidden="true">
              <span class="mb-ring"></span>
              <span class="mb-bob">
                <span class="mb-hull">
                  <picture>
                    <source type="image/avif" :srcset="MOORED.avif[mode]" />
                    <img :src="MOORED[mode]" data-art alt="" draggable="false" loading="lazy" />
                  </picture>
                </span>
              </span>
              <span class="mb-water"></span>
              <span class="mb-splash"></span>
            </span>
            <span class="mb-rope" aria-hidden="true"></span>
            <span class="mb-tag">
              <span class="mb-eye" aria-hidden="true"></span>
              <span v-if="g.banner" class="mb-wa">
                <img
                  class="mb-thumbnail"
                  :src="g.banner"
                  :alt="g.bannerAlt"
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <span v-else class="mb-wa" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path
                    fill="#fff"
                    d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Zm4.4 12.4c-.2.5-1.1 1-1.6 1-.4.1-.9.1-3-.7-2.5-1-4-3.5-4.1-3.7-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.8c.1.2.1.4 0 .5l-.4.6c-.1.2-.2.3 0 .6.4.7 1 1.3 1.6 1.8.7.5 1.1.6 1.3.7.2.1.4 0 .5-.1l.6-.8c.2-.2.3-.2.5-.1l1.7.8c.2.1.4.2.4.3.1.2.1.7-.1 1.1Z"
                  />
                </svg>
              </span>
              <span class="mb-txt">
                <em v-if="kick(g)">{{ kick(g) }}</em>
                <b>{{ g.label }}</b>
                <small>{{ g.why }}</small>
              </span>
              <span class="mb-go">Open invite <span aria-hidden="true">↗</span></span>
            </span>
          </a>
          <RouterLink v-else class="mb" :to="g.to" @pointerdown="splash" @keydown.enter="splash">
            <span class="mb-hullw" aria-hidden="true">
              <span class="mb-ring"></span>
              <span class="mb-bob">
                <span class="mb-hull">
                  <picture>
                    <source type="image/avif" :srcset="MOORED.avif[mode]" />
                    <img :src="MOORED[mode]" data-art alt="" draggable="false" loading="lazy" />
                  </picture>
                </span>
              </span>
              <span class="mb-water"></span>
              <span class="mb-splash"></span>
            </span>
            <span class="mb-rope" aria-hidden="true"></span>
            <span class="mb-tag">
              <span class="mb-eye" aria-hidden="true"></span>
              <span v-if="g.banner" class="mb-wa">
                <img
                  class="mb-thumbnail"
                  :src="g.banner"
                  :alt="g.bannerAlt"
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <span v-else class="mb-wa" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path
                    fill="#fff"
                    d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Zm4.4 12.4c-.2.5-1.1 1-1.6 1-.4.1-.9.1-3-.7-2.5-1-4-3.5-4.1-3.7-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.8c.1.2.1.4 0 .5l-.4.6c-.1.2-.2.3 0 .6.4.7 1 1.3 1.6 1.8.7.5 1.1.6 1.3.7.2.1.4 0 .5-.1l.6-.8c.2-.2.3-.2.5-.1l1.7.8c.2.1.4.2.4.3.1.2.1.7-.1 1.1Z"
                  />
                </svg>
              </span>
              <span class="mb-txt">
                <em v-if="kick(g)">{{ kick(g) }}</em>
                <b>{{ g.label }}</b>
                <small>{{ g.why }}</small>
              </span>
              <span class="mb-go">{{
                g.previewOnly
                  ? 'Preview'
                  : g.review === 'rejected'
                    ? g.closed
                      ? 'Form closed'
                      : 'Fill again'
                    : g.applied
                      ? 'Applied'
                      : 'Apply'
              }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { isSuperAdmin } from '../../../lib/auth.js';
import { formUnavailableMessage } from '../../../lib/lounge.js';
import { member } from '../fixtures.js';
import { bannerThumbnail } from '../../../lib/form-files.js';
import { formById, groupsSection, lounge, openGroupForms } from '../session.js';
import { mode } from '../state.js';
import { MOORED } from './art.js';
import { animate, reduced, vLoop } from './motion.js';

const PERIODS = [7.5, 8.1, 8.7, 9.3, 9.9];
const list = ref(null);
const shown = ref(false);

const boats = computed(() => {
  const rejected = (g) => g.review_status === 'rejected';
  const joined = lounge.groups
    // Groups the student is already in stay away unless "Show groups I'm in" is on.
    .filter((g) => member.joined_groups_shown || !g.joined)
    // Hidden ("I've joined all my groups") keeps only what the student can still fix.
    .filter((g) => !member.group_forms_hidden || isSuperAdmin.value || (rejected(g) && g.fixable))
    .map((g) => ({
      id: g.id,
      label: g.name || g.label,
      banner: bannerThumbnail(formById(g.id)?.banner_url),
      bannerAlt: formById(g.id)?.banner_alt || '',
      why: rejected(g)
        ? g.review_reason
          ? `Note from the admins: ${g.review_reason}`
          : g.fixable
            ? 'The admins could not approve this one. You can send it again.'
            : 'The admins could not approve this one.'
        : [
            g.purpose,
            g.joined
              ? "You're in this group."
              : g.add_state === 'waiting'
                ? 'Waiting for an admin to add you.'
                : g.review_status === 'pending'
                  ? 'Under review.'
                  : '',
            g.invite_error
              ? 'Invite link could not be loaded. Open to retry.'
              : !g.invite_url && g.applied
                ? 'No invite link is available yet. Your application is saved.'
                : '',
          ]
            .filter(Boolean)
            .join(' '),
      href: g.invite_url || g.href,
      to: `/lounge/forms/${g.id}`,
      applied: true,
      review: g.review_status,
      joined: g.joined,
      closed: rejected(g) && !g.fixable,
      kind: g.community_id ? 'community' : g.region_id ? 'region' : 'house',
    }));
  // A joined boat already carries its invite; list each form once.
  const joinedIds = new Set(joined.map((g) => g.id));
  const apply = openGroupForms.value
    .filter((f) => isSuperAdmin.value || !joinedIds.has(f.id))
    .map((f) => ({
      id: f.id,
      label: f.group_label || f.title,
      banner: bannerThumbnail(f.banner_url),
      bannerAlt: f.banner_alt || '',
      why: [
        f.group_purpose || '',
        isSuperAdmin.value && !(f.accepting_responses ?? f.is_open)
          ? `Super Admin preview. ${formUnavailableMessage(f, member.region_id, member.cohort)}`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      href: '',
      to: `/lounge/forms/${f.id}`,
      applied: !!f.submitted,
      previewOnly: isSuperAdmin.value && !(f.accepting_responses ?? f.is_open),
      kind: f.community_id
        ? 'community'
        : f.region_id
          ? f.region_id === member.region_id
            ? 'region'
            : 'other-region'
          : 'house',
    }));
  if (member.group_forms_hidden && !isSuperAdmin.value) return joined;
  return isSuperAdmin.value ? apply : [...apply, ...joined];
});

const kick = (g) =>
  g.previewOnly
    ? 'Preview only'
    : g.review === 'rejected'
      ? 'Not approved'
      : g.joined
        ? "You're in"
        : g.kind === 'house'
          ? 'Start here'
          : g.kind === 'region'
            ? 'Your region'
            : g.kind === 'other-region'
              ? 'Regional group'
              : g.applied
                ? 'You applied'
                : 'Apply';

let io = null;
onMounted(() => {
  if (reduced()) {
    shown.value = true;
    return;
  }
  io = new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting) {
        shown.value = true;
        io.disconnect();
      }
    },
    { threshold: 0.3 }
  );
  /* The phone list can be taller than the viewport: observe its first boat, so a
     30% whole-list threshold can never leave every group invisible. */
  if (list.value?.firstElementChild) io.observe(list.value.firstElementChild);
});
onBeforeUnmount(() => io?.disconnect());

/* The splash: the hull dips, a ring spreads and a crown of drops jumps and falls back.
   Built on the fly, removed when done; the link's own navigation is untouched. */
function splash(ev) {
  if (reduced()) return;
  const a = ev.currentTarget;
  const host = a.querySelector('.mb-splash');
  const hull = a.querySelector('.mb-hull');
  if (!host || host.childElementCount) return;
  animate(
    hull,
    [
      { transform: 'none' },
      { transform: 'translate3d(0, 3px, 0) rotate(-1deg)', offset: 0.25 },
      { transform: 'translate3d(0, -1px, 0) rotate(0.5deg)', offset: 0.6 },
      { transform: 'none' },
    ],
    { duration: 700, easing: 'ease-out' }
  );
  const parts = [];
  for (let r = 0; r < 2; r++) {
    const ring = document.createElement('i');
    ring.className = 'ring';
    host.appendChild(ring);
    parts.push(
      animate(
        ring,
        [
          { transform: 'scale(0.3)', opacity: 0.8 },
          { transform: 'scale(1.5)', opacity: 0 },
        ],
        { duration: 650, delay: r * 140, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }
      )
    );
  }
  const n = 9;
  for (let k = 0; k < n; k++) {
    const d = document.createElement('b');
    const side = (k / (n - 1)) * 2 - 1; // -1 .. 1
    const dx = side * (30 + Math.random() * 34);
    const up = 26 + (1 - Math.abs(side)) * 26 + Math.random() * 16;
    const s = 0.7 + Math.random() * 0.7;
    d.style.cssText = `--s:${s.toFixed(2)}`;
    host.appendChild(d);
    parts.push(
      animate(
        d,
        [
          {
            transform: `translate3d(0, 0, 0) scale(${s})`,
            opacity: 1,
            easing: 'cubic-bezier(.2,.6,.4,1)',
          },
          {
            transform: `translate3d(${(dx * 0.6).toFixed(1)}px, ${(-up).toFixed(1)}px, 0) scale(${s})`,
            opacity: 1,
            offset: 0.45,
            easing: 'cubic-bezier(.55,.085,.68,.53)',
          },
          {
            transform: `translate3d(${dx.toFixed(1)}px, 6px, 0) scale(${(s * 0.6).toFixed(2)})`,
            opacity: 0,
          },
        ],
        { duration: 560 + Math.random() * 160 }
      )
    );
  }
  Promise.all(parts.map((p) => p.finished.catch(() => {}))).then(() => host.replaceChildren());
}
</script>

<style scoped>
/* The river carries on under the hero; the boats sit on it. */
.moor {
  position: relative;
  padding: 28px 20px 64px;
  background: linear-gradient(var(--water-0), var(--water-1) 70%, var(--bg));
  color: var(--t-1);
}
.moor-in {
  max-width: 1180px;
  margin: 0 auto;
}
.moor-head {
  margin: 0 0 10px;
  max-width: 44ch;
}
.moor-kick {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  font-stretch: 112%;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--h-accent-on-water);
}
.moor h2 {
  margin: 4px 0 2px;
  font-size: 26px;
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--h-on-water);
}
.moor-sub {
  margin: 0;
  font-size: 15px;
  color: var(--h-on-water-2);
}
.moor-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 18px;
  margin: 0;
  padding: 18px 0 0;
  list-style: none;
}
.moor-row li {
  display: flex;
  flex: 1 1 180px;
  min-width: 0;
  max-width: 214px;
}
/* Super admins see every open form: a grid of boats, four to a row (three on tablets). */
.moor-row--all {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 22px 18px;
}
.moor-row--all li {
  max-width: none;
}
@media (max-width: 1024px) {
  .moor-row--all {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.mb {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: inherit;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}
.mb-hullw {
  position: relative;
  display: block;
  width: 92%;
  aspect-ratio: 400 / 145;
}
.mb-bob,
.mb-hull {
  position: absolute;
  inset: 0;
}
.mb-hull {
  transform-origin: 50% 80%;
  transition: transform var(--t-hover) var(--ease-out);
}
.mb-hull img {
  width: 100%;
  height: 100%;
}
.mb-rope {
  width: 2px;
  height: 14px;
  margin-top: -4px;
  background: repeating-linear-gradient(#c9a66a 0 4px, #6e4f27 4px 6px);
}
.mb-tag {
  position: relative;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  grid-template-rows: auto auto;
  gap: 4px 9px;
  flex: 1;
  align-content: start;
  width: 100%;
  min-height: 48px;
  padding: 16px 12px 11px;
  color: var(--t-1);
  background: var(--paper);
  border: var(--kw) solid var(--keyline);
  border-radius: 6px;
  box-shadow:
    0 3px 0 var(--under),
    var(--drop);
  clip-path: polygon(
    9px 0,
    calc(100% - 9px) 0,
    100% 9px,
    100% calc(100% + 20px),
    0 calc(100% + 20px),
    0 9px
  );
  transform-origin: 50% -14px;
  transition: transform var(--t-hover) var(--ease-out);
}
.mb-eye {
  position: absolute;
  left: 50%;
  top: 4px;
  width: 7px;
  height: 7px;
  margin-left: -3.5px;
  border: 1.5px solid var(--keyline);
  border-radius: 50%;
  background: var(--bg);
}
.mb-wa {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #25d366;
}
.mb-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 12px;
}
.mb-wa svg {
  width: 16px;
  height: 16px;
}
.mb-txt {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.mb-txt em {
  font-style: normal;
  font-size: 10.5px;
  font-weight: 700;
  font-stretch: 112%;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
}
.mb-txt b {
  font-size: 15px;
  line-height: 1.15;
  font-weight: 700;
}
.mb-txt small {
  font-size: 12.5px;
  line-height: 1.3;
  color: var(--t-3);
}
.mb-go {
  grid-column: 2;
  justify-self: start;
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
}

/* Hover / focus: the boat leans toward you, the tag lifts. */
.mb:hover .mb-hull,
.mb:focus-visible .mb-hull {
  transform: rotate(-2deg);
}
.mb:hover .mb-tag,
.mb:focus-visible .mb-tag {
  transform: translate3d(0, -2px, 0);
}
.mb:focus-visible {
  outline: none;
}
.mb:focus-visible .mb-tag {
  outline: 2px solid var(--focus);
  outline-offset: 3px;
}

/* Splash parts (built in JS). */
/* A row of painted dots where the hull meets the river (static). */
.mb-water {
  position: absolute;
  left: -6%;
  right: -6%;
  bottom: -2px;
  height: 4px;
  background: radial-gradient(circle, var(--h-spray) 1.1px, transparent 1.7px) 0 50% / 9px 4px
    repeat-x;
  opacity: 0.45;
  pointer-events: none;
}
.mb-splash {
  position: absolute;
  left: 50%;
  bottom: 2px;
  width: 0;
  height: 0;
  pointer-events: none;
}
.mb-splash :deep(.ring) {
  position: absolute;
  left: -46px;
  top: -9px;
  width: 92px;
  height: 18px;
  border: 1.5px solid var(--h-spray);
  border-radius: 50%;
}
.mb-splash :deep(b) {
  position: absolute;
  left: -3px;
  top: -3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--h-spray);
}

/* ---------- Reveal: the current sets them down (once) ---------- */
.mb-ring {
  position: absolute;
  left: 15%;
  right: 15%;
  bottom: 4%;
  aspect-ratio: 5;
  border: 1.5px solid color-mix(in srgb, var(--t-2) 70%, transparent);
  border-radius: 50%;
  opacity: 0;
}
.moor.in .mb-ring {
  animation: m-ripple 800ms calc(var(--i) * 90ms) ease-out backwards;
}
.moor.in .mb-bob {
  animation:
    m-settle 950ms calc(var(--i) * 90ms) var(--ease-settle) backwards,
    m-bob-moored var(--p) calc(1000ms + var(--i) * 90ms) ease-in-out infinite;
}
.moor.in .mb-tag {
  animation: m-swing 1s calc(250ms + var(--i) * 90ms) ease-out backwards;
}

/* ---------- Phones: a list, each boat on its own strip of water ---------- */
@media (max-width: 760px) {
  .moor {
    padding: 24px 16px 48px;
  }
  .moor h2 {
    font-size: 22px;
  }
  .moor-row {
    flex-direction: column;
    gap: 0;
    padding-top: 8px;
  }
  .moor-row--all {
    grid-template-columns: minmax(0, 1fr);
  }
  .moor-row li {
    max-width: none;
    border-bottom: 1px dashed color-mix(in srgb, var(--h-on-water-2) 45%, transparent);
  }
  .mb {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    padding: 10px 0;
  }
  .mb-hullw {
    width: 112px;
  }
  .mb-rope,
  .mb-eye {
    display: none;
  }
  .mb-tag {
    padding: 0;
    background: none;
    border: 0;
    box-shadow: none;
    clip-path: none;
    color: var(--h-on-water);
  }
  .mb-txt small {
    color: var(--h-on-water-2);
  }
  .mb-txt em,
  .mb-go {
    color: var(--h-accent-on-water);
  }
  .moor.in .mb-tag {
    animation-name: m-fade-in;
    animation-duration: 400ms;
  }
}

@media (prefers-reduced-motion: reduce) {
  .moor.in .mb-ring,
  .moor.in .mb-bob,
  .moor.in .mb-tag {
    animation: none;
  }
  .mb-hull,
  .mb-tag {
    transition: none;
  }
}
</style>

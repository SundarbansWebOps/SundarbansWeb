<!--
  The Lounge header, shared by Home and Events: the crest and wordmark (left), Home / Events
  and the way back out to the public site (centred; Sign out lives in the site's navbar), and the notices bell (badge = unread), theme toggle and profile avatar
  (right). No progress bar. Under it, the newest urgent notice as a slim paper strip with a
  vermilion rule, dismissible (verdict §9.5).
-->
<template>
  <header class="lnav">
    <div class="lnav-in">
      <a class="lnav-brand" href="#/lounge" aria-label="Sundarbans House, the Lounge: Home">
        <img :src="CREST" alt="" width="34" height="34" />
        <span class="lnav-word" aria-hidden="true">
          <b>Sundarbans</b>
          <small>The Lounge</small>
        </span>
      </a>
      <nav class="lnav-links" aria-label="Main">
        <a href="#/lounge" :aria-current="view === 'home' ? 'page' : undefined">Home</a>
        <a href="#/lounge?view=events" :aria-current="view === 'events' ? 'page' : undefined"
          >Events</a
        >
        <a class="lnav-site" href="#/" aria-label="Back to the website">
          <span>Website</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
        </a>
      </nav>
      <div class="lnav-acts">
        <button
          type="button"
          class="lnav-btn"
          :aria-label="unread ? `Notices, ${unread} unread` : 'Notices'"
          aria-haspopup="dialog"
          @click="emit('notices')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
            <path d="M10 18.5a2 2 0 0 0 4 0" />
          </svg>
          <span v-if="unread" class="gp-badge lnav-badge" aria-hidden="true">{{ unread }}</span>
        </button>
        <button
          type="button"
          class="lnav-btn lnav-theme"
          :class="{ dark: theme === 'dark' }"
          :aria-label="theme === 'dark' ? 'Switch to day' : 'Switch to night'"
          @pointerenter="tide.warmOther?.()"
          @focus="tide.warmOther?.()"
          @click="(e) => tide.toggleTheme?.(e)"
        >
          <svg class="lnav-sun" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4.4" />
            <path
              d="M12 2.2v2.4M12 19.4v2.4M2.2 12h2.4M19.4 12h2.4M5.1 5.1l1.7 1.7M17.2 17.2l1.7 1.7M5.1 18.9l1.7-1.7M17.2 6.8l1.7-1.7"
            />
          </svg>
          <svg class="lnav-moon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z" />
          </svg>
        </button>
        <button
          type="button"
          class="lnav-me"
          :aria-label="callName ? `Your profile, ${callName}` : 'Your profile'"
          aria-haspopup="dialog"
          :aria-expanded="profileOpen ? 'true' : 'false'"
          @click="emit('profile')"
        >
          <img
            v-if="avatarUrl"
            :src="avatarUrl"
            alt=""
            referrerpolicy="no-referrer"
            @error="avatarFailed"
          />
          <span v-else-if="initials" aria-hidden="true">{{ initials }}</span>
          <img v-else :src="CREST" alt="" />
        </button>
      </div>
    </div>
  </header>

  <!-- Phones: the same two places as a bottom tab bar, as on the public site (TopNav.vue). -->
  <nav class="lnav-tabs" aria-label="Main">
    <a href="#/lounge" :aria-current="view === 'home' ? 'page' : undefined">
      <LineIcon name="house" />
      <span>Home</span>
    </a>
    <a href="#/lounge?view=events" :aria-current="view === 'events' ? 'page' : undefined">
      <LineIcon name="cal" />
      <span>Events</span>
    </a>
    <a href="#/">
      <LineIcon name="door" />
      <span>Website</span>
    </a>
  </nav>

  <div v-if="strip" class="lnav-strip" role="region" aria-label="New notice">
    <button type="button" class="lnav-strip-open" @click="emit('notices', strip.id)">
      <span class="lnav-strip-k">Notice</span>
      <span class="lnav-strip-text"
        ><b>{{ strip.title }}.</b> <span class="lnav-strip-body">{{ strip.body }}</span></span
      >
    </button>
    <button
      type="button"
      class="lnav-strip-x"
      aria-label="Dismiss this notice"
      @click="ev.dismissBanner?.(strip)"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  </div>
  <!-- Until the member's full name and gender are set (notices take the strip first). -->
  <div v-else-if="details" class="lnav-strip" role="region" aria-label="Your details">
    <button type="button" class="lnav-strip-open" @click="emit('edit')">
      <span class="lnav-strip-k">Profile</span>
      <span class="lnav-strip-text"
        ><b>{{ details }}</b> <span class="lnav-strip-body">As on your IITM records.</span></span
      >
    </button>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, watchEffect } from 'vue';
import CREST from '../../assets/crest.webp';
import LineIcon from '../site/LineIcon.vue';
import * as ev from './events.js';
import { missingDetails } from './session.js';
import { callName, initialsOf, theme } from './state.js';
import { avatarFailed, avatarUrl } from '../../lib/auth.js';
import * as tide from './tide.js';

defineProps({ view: { type: String, default: 'home' }, profileOpen: Boolean });
const emit = defineEmits(['notices', 'profile', 'edit']);

/* events.js and tide.js belong to other workers; read them defensively. */
const unread = computed(() => ev.unreadCount?.value ?? 0);
const strip = computed(() => ev.bannerNotice?.value ?? null);
const initials = computed(() => initialsOf(callName.value));
const details = computed(() => {
  const { name, gender } = missingDetails.value;
  if (name && gender) return 'Add your full name and gender.';
  if (name) return 'Add your full name.';
  return gender ? 'Add your gender.' : '';
});

/* Views pad their top by --banner-h while the strip shows. */
watchEffect(() =>
  document.documentElement.classList.toggle('has-banner', !!(strip.value || details.value))
);
onBeforeUnmount(() => document.documentElement.classList.remove('has-banner'));
</script>

<style>
:where(html.lounge-active) .lnav {
  position: fixed;
  inset: 0 0 auto;
  z-index: 20;
  height: var(--nav-h);
  background: var(--bg);
  color: var(--t-1);
  border-bottom: 1px solid color-mix(in srgb, var(--keyline) 55%, transparent);
}

:where(html.lounge-active) .lnav-in {
  width: 100%;
  max-width: none;
  height: 100%;
  margin: 0;
  padding: 0 clamp(16px, 2.2vw, 40px);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

:where(html.lounge-active) .lnav-brand {
  justify-self: start;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: inherit;
  text-decoration: none;
  border-radius: 999px;
}

:where(html.lounge-active) .lnav-brand img {
  flex: none;
  width: 34px;
  height: 34px;
}

/* The site's top bar (TopNav.vue): wordmark over a small quiet line, links in ink-2 with a
   marigold rule under the current page, round outlined buttons. */
:where(html.lounge-active) .lnav-word {
  display: grid;
  line-height: 1.05;
  white-space: nowrap;
}

:where(html.lounge-active) .lnav-word b {
  font-size: 17px;
  font-weight: 750;
  letter-spacing: -0.02em;
}

:where(html.lounge-active) .lnav-word small {
  font-size: 10.5px;
  letter-spacing: 0.02em;
  color: var(--t-2);
}

:where(html.lounge-active) .lnav-links {
  display: flex;
  gap: 4px;
}

:where(html.lounge-active) .lnav-links a {
  position: relative;
  display: grid;
  place-items: center;
  padding: 8px 14px;
  border-radius: 99px;
  font-size: 14.5px;
  font-weight: 550;
  color: var(--t-2);
  text-decoration: none;
  transition:
    color 0.2s,
    background 0.2s;
}

:where(html.lounge-active) .lnav-links a:hover {
  color: var(--t-1);
  background: var(--sunk);
}

:where(html.lounge-active) .lnav-links a[aria-current='page'] {
  color: var(--t-1);
}

/* The way out to the public site: set apart from the two Lounge views by a hairline. */
:where(html.lounge-active) .lnav-links a.lnav-site {
  display: inline-flex;
  gap: 5px;
  margin-left: 8px;
}

:where(html.lounge-active) .lnav-links a.lnav-site::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 10px;
  bottom: 10px;
  width: 1px;
  background: var(--line-strong);
}

:where(html.lounge-active) .lnav-site svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* The current page: a short marigold rule under the word. */
:where(html.lounge-active) .lnav-links a[aria-current='page']::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 2px;
  height: 2.5px;
  border-radius: 2px;
  background: var(--lamp);
}

:where(html.lounge-active) .lnav-acts {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 8px;
}

:where(html.lounge-active) .lnav-btn,
:where(html.lounge-active) .lnav-me {
  position: relative;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 1.5px solid var(--line-strong);
  border-radius: 50%;
  background: transparent;
  color: var(--t-1);
  cursor: pointer;
  transition:
    transform 0.25s var(--ease-spring),
    background 0.2s;
}

:where(html.lounge-active) .lnav-btn:hover,
:where(html.lounge-active) .lnav-me:hover {
  background: var(--sunk);
  transform: translateY(-1px);
}

:where(html.lounge-active) .lnav-btn:focus-visible,
:where(html.lounge-active) .lnav-me:focus-visible {
  outline: 2px solid var(--mari);
  outline-offset: 2px;
}

:where(html.lounge-active) .lnav-btn svg {
  grid-area: 1 / 1;
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

:where(html.lounge-active) .lnav-badge {
  position: absolute;
  top: -4px;
  right: -5px;
  box-shadow: 0 0 0 2px var(--bg);
}

:where(html.lounge-active) .lnav-sun circle,
:where(html.lounge-active) .lnav-moon path {
  fill: currentColor;
  stroke: none;
}

:where(html.lounge-active) .lnav-theme svg {
  transition:
    transform 0.4s var(--ease-out),
    opacity 0.25s linear;
}

:where(html.lounge-active) .lnav-moon,
:where(html.lounge-active) .lnav-theme.dark .lnav-sun {
  opacity: 0;
  transform: rotate(-60deg) scale(0.6);
}

:where(html.lounge-active) .lnav-theme.dark .lnav-moon {
  opacity: 1;
  transform: none;
}

:where(html.lounge-active) .lnav-me {
  overflow: hidden;
  background: var(--paper);
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

:where(html.lounge-active) .lnav-me img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

:where(html.lounge-active) .lnav-me[aria-expanded='true'] {
  outline: 2px solid var(--lamp);
  outline-offset: 2px;
}

/* ---------- Slim notice strip ---------- */
:where(html.lounge-active) .lnav-strip {
  position: fixed;
  top: var(--nav-h);
  left: 0;
  right: 0;
  z-index: 19;
  display: flex;
  align-items: center;
  height: var(--banner-h);
  padding: 0 6px 0 0;
  background: var(--paper);
  color: var(--t-1);
  border-bottom: 1px solid color-mix(in srgb, var(--keyline) 55%, transparent);
  box-shadow: inset 3px 0 0 var(--verm);
}

:where(html.lounge-active) .lnav-strip-open {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 8px 0 18px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

:where(html.lounge-active) .lnav-strip-k {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  font-stretch: 112.5%;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--live);
}

:where(html.lounge-active) .lnav-strip-text {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
  color: var(--t-2);
}

:where(html.lounge-active) .lnav-strip-text b {
  font-weight: 700;
  color: var(--t-1);
}

:where(html.lounge-active) .lnav-strip-open:hover .lnav-strip-text b {
  text-decoration: underline;
  text-underline-offset: 3px;
}

:where(html.lounge-active) .lnav-strip-x {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--t-2);
  cursor: pointer;
}

:where(html.lounge-active) .lnav-strip-x:hover {
  color: var(--t-1);
  background: color-mix(in srgb, var(--t-1) 7%, transparent);
}

:where(html.lounge-active) .lnav-strip-x svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
}

:where(html.lounge-active) .lnav-strip :focus-visible {
  outline-offset: -2px;
}

/* The bottom tab bar is hidden on desktop; the header's links are hidden on phones. */
:where(html.lounge-active) .lnav-tabs {
  display: none;
}

/* Page switch (tide.js adds html.vt-page): the header, bar and strip hold still. */
html:where(.lounge-active).vt-page .lnav {
  view-transition-name: lounge-nav;
}

html:where(.lounge-active).vt-page .lnav-tabs {
  view-transition-name: lounge-tabs;
}

html:where(.lounge-active).vt-page .lnav-strip {
  view-transition-name: lounge-notice;
}

@media (max-width: 760px) {
  :where(html.lounge-active) {
    --tab-h: 64px;
  }

  :where(html.lounge-active) main#main {
    padding-bottom: calc(var(--tab-h) + env(safe-area-inset-bottom));
  }

  :where(html.lounge-active) .lnav-in {
    /* With the links in the bottom bar, the actions belong in the last column. */
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
    padding: 0 16px;
  }

  :where(html.lounge-active) .lnav-links {
    display: none;
  }

  /* Same look as the site's tab bar (TopNav.vue .tabbar): fixed to the bottom, icon over label,
     the current page on a soft marigold tile. */
  :where(html.lounge-active) .lnav-tabs {
    position: fixed;
    inset: auto 0 0;
    z-index: 20;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(10px);
    border-top: 1px solid color-mix(in srgb, var(--keyline) 55%, transparent);
  }

  :where(html.lounge-active) .lnav-tabs a {
    display: grid;
    justify-items: center;
    gap: 3px;
    padding: 6px 0;
    border-radius: 12px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--t-2);
    text-decoration: none;
  }

  :where(html.lounge-active) .lnav-tabs a[aria-current='page'] {
    color: var(--t-1);
    background: var(--mari-soft);
  }

  :where(html.lounge-active) .lnav-tabs svg {
    width: 22px;
    height: 22px;
  }

  :where(html.lounge-active) .lnav-acts {
    gap: 6px;
  }

  :where(html.lounge-active) .lnav-btn,
  :where(html.lounge-active) .lnav-me {
    width: 36px;
    height: 36px;
  }

  :where(html.lounge-active) .lnav-strip-body {
    display: none;
  }

  :where(html.lounge-active) .lnav-strip-open {
    padding-left: 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  :where(html.lounge-active) .lnav-theme svg {
    transition: none;
  }
}
</style>

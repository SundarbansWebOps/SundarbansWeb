<!-- Approved Lounge E shell: Home/Events, profile, notices, certificates and the welcome tour.
     Enter or Not now marks the tour seen; Skip only advances to the ghat. -->
<template>
  <p v-if="tourError" class="tour-error" role="alert">
    {{ tourError }}
    <button type="button" @click="retakeTour">Try again</button>
  </p>
  <LoungeNav
    v-if="showHome"
    :view="view"
    :profile-open="profileOpen"
    @notices="openNotices"
    @profile="profileOpen = true"
    @edit="editOpen = true"
  />
  <main v-if="showHome" id="main">
    <LoungeHome
      v-if="view === 'home'"
      :key="homeKey"
      :entry="entry"
      @vue:mounted="entry = 'none'"
    />
    <EventsPage v-else @cert="openCert" />
  </main>

  <WelcomeTour v-if="showTour" :leaving="leaving" @done="onDone" @gone="onGone" />

  <ProfileMenu
    v-if="profileOpen"
    @close="profileOpen = false"
    @edit="editOpen = true"
    @certs="openCert('')"
    @tour="retakeTour"
    @theme="tide.toggleTheme?.()"
  />
  <ProfileEdit v-if="editOpen" @close="editOpen = false" />
  <ProfileEdit v-if="nameCardOpen" variant="ghat" @close="nameCardOpen = false" />
  <RegionSelect v-if="needRegion" @close="needRegion = false" />
  <FormDialog v-if="formOpen" :form="formOpen" @close="formOpen = null" />
  <CertificatesPopup v-if="certsOpen" :start="certStart" @close="certsOpen = false" />
  <NoticesPanel v-if="noticesOpen" :focus="noticeFocus" @close="noticesOpen = false" />
</template>

<script setup>
import { defineAsyncComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import CertificatesPopup from './CertificatesPopup.vue';
import EventsPage from './EventsPage.vue';
import FormDialog from './FormDialog.vue';
import LoungeHome from './LoungeHome.vue';
import LoungeNav from './LoungeNav.vue';
import NoticesPanel from './NoticesPanel.vue';
import ProfileEdit from './ProfileEdit.vue';
import ProfileMenu from './ProfileMenu.vue';
import RegionSelect from './RegionSelect.vue';
import { member } from './fixtures.js';
import { errorText } from '../../lib/auth.js';
import { formById } from './session.js';
import { eventsTab } from './events.js';
import { loungeArrived, markTourSeen, nameCardOpen, resetTour, tourSeen } from './state.js';
/* tide.js (theme and page switches) belongs to the motion designer; every call is optional. */
import * as tide from './tide.js';
import { motionTimeout } from './home/motion.js';
import { useRoute, useRouter } from 'vue-router';
const route = useRoute();
const router = useRouter();

/* The tour is seen once ever, so returning members never download it. */
const WelcomeTour = defineAsyncComponent(() => import('./WelcomeTour.vue'));

/* ---------- Views: Home and #events ---------- */

const viewOf = () => (route.query.view === 'events' ? 'events' : 'home');
const view = ref(viewOf());
/* Nav links, "Next up", Back and Forward all land here. tide.js runs the shared-scene
   switch (or a plain swap without View Transitions or with reduced motion). */
function onHash() {
  const stale = () => viewOf() !== view.value;
  const apply = () => (view.value = viewOf());
  if (tide.switchPage) tide.switchPage(stale, apply);
  else if (stale()) apply();
}
watch(() => route.query.view, onHash);
/* The build (lounge.css) is over by 4.2s; dropping the class leaves the shell at rest. */
const built = motionTimeout(() => document.documentElement.classList.remove('building'), 4200);
onBeforeUnmount(() => {
  built();
});

/* ---------- Tour gating ---------- */

const showTour = ref(!tourSeen.value);
const showHome = ref(tourSeen.value);
const leaving = ref(false);
const homeKey = ref(0);
/* How Home starts: 'name' plays the load choreography, 'none' shows it finished, or
   { from, boat } flies the name (and the boat) in from the tour's ghat. Reset to 'none'
   once Home has mounted, so coming back from Events doesn't replay it. */
const entry = ref(loungeArrived.value ? 'none' : 'name');
loungeArrived.value = true;

const profileOpen = ref(false);
const editOpen = ref(false);
const certsOpen = ref(false);
const certStart = ref('');
const noticesOpen = ref(false);
const noticeFocus = ref('');
const needRegion = ref(false);
const tourError = ref('');
const formOpen = ref(null);

watch(
  () => [showHome.value, member.region_id],
  ([home, regionId]) => {
    needRegion.value = !!home && !regionId;
  },
  { immediate: true }
);

watch(
  () => route.query.form,
  (id) => {
    formOpen.value = typeof id === 'string' ? formById(id) : null;
  },
  { immediate: true }
);

watch(
  () => [route.query.room, showHome.value],
  async ([room, home]) => {
    if (!home || typeof room !== 'string' || !['live', 'groups', 'certificates'].includes(room))
      return;
    const query = { ...route.query };
    delete query.room;
    if (room === 'live') {
      eventsTab.value = 'live';
      query.view = 'events';
      view.value = 'events';
    } else if (room === 'groups') {
      delete query.view;
      view.value = 'home';
    }
    await router.replace({ path: '/lounge', query });
    if (room === 'groups') {
      await nextTick();
      document.getElementById('groups')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (room === 'certificates') {
      openCert('');
    }
  },
  { immediate: true }
);

async function retakeTour() {
  tourError.value = '';
  try {
    await resetTour();
  } catch (err) {
    tourError.value = errorText(err) || 'The tour could not be reopened. Try again.';
    return;
  }
  profileOpen.value = editOpen.value = certsOpen.value = noticesOpen.value = false;
  nameCardOpen.value = false;
  leaving.value = false;
  showHome.value = false;
  showTour.value = true;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* Enter the Lounge ({ from, boat }: where the name and the boat are now) or "Not now" (null). */
async function onDone(handoff) {
  try {
    await markTourSeen();
  } catch {
    /* Tour still closes; the member can retake from profile if the save did not land. */
  }
  entry.value = handoff?.from ? handoff : 'name';
  if (view.value !== 'home') {
    router.replace({ path: '/lounge' });
    view.value = 'home';
  }
  homeKey.value++;
  leaving.value = true;
  window.scrollTo({ top: 0, behavior: 'instant' });
  showHome.value = true;
}

function onGone() {
  showTour.value = false;
  leaving.value = false;
}

/* ---------- Pop-ups ---------- */

function openCert(id) {
  certStart.value = id || '';
  certsOpen.value = true;
}

function openNotices(id) {
  noticeFocus.value = typeof id === 'string' ? id : '';
  noticesOpen.value = true;
}
</script>

<style scoped>
.tour-error {
  position: fixed;
  z-index: 5000;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  max-width: min(90vw, 620px);
  margin: 0;
  padding: 12px 16px;
  border: 1px solid var(--verm);
  border-radius: 12px;
  background: var(--card);
  color: var(--verm);
  box-shadow: var(--shadow);
}
.tour-error button {
  margin-left: 8px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}
</style>

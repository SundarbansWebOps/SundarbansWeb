<template>
  <div class="admin-page">
    <AdminNav
      :members-visible="membersVisible"
      :theme="theme"
      :avatar-url="avatarUrl"
      :avatar-failed="avatarFailed"
      :profile-open="profileOpen"
      @add-students="create('students')"
      @create="createOpen = true"
      @profile="profileOpen = true"
      @toggle-theme="toggleTheme"
    />
    <div class="command-desk">
      <aside class="sidebar" aria-label="Admin navigation">
        <nav class="desk-nav" aria-label="Admin sections">
          <template v-for="item in tabs" :key="item.id">
            <p v-if="item.id === 'directory'" class="nav-label">Administration</p>
            <button :aria-current="tab === item.id ? 'page' : undefined" @click="navigate(item.id)">
              <LineIcon :name="item.icon" />{{ item.label
              }}<span
                v-if="item.id === 'requests' && overview?.queue?.for_you"
                class="queue-count"
                >{{ overview.queue.for_you }}</span
              >
            </button>
          </template>
        </nav>
      </aside>
      <div class="desk-main">
        <main id="main-content" class="content" tabindex="-1">
          <header v-if="tab !== 'overview'" class="page-head">
            <h1>{{ current.label }}</h1>
            <p>{{ current.description }}</p>
          </header>
          <p v-if="loadError" class="adm-msg err" role="alert">
            {{ loadError }} <button class="retry" @click="refresh">Try again</button>
          </p>
          <AdminOverview v-if="tab === 'overview'" :data="overview" @navigate="navigate" />
          <component
            v-else-if="lookups"
            :is="current.component"
            :key="tab"
            ref="panel"
            :lookups="lookups"
            :initial-id="selectedId"
            @changed="refresh"
            @navigate="navigate"
            @edit-form="openEventForm"
          />
          <p v-else-if="!loadError" class="adm-note" role="status">Loading admin data...</p>
        </main>
      </div>
      <nav class="bottom-nav" aria-label="Admin phone navigation">
        <button
          v-for="item in phoneTabs"
          :key="item.id"
          :aria-current="tab === item.id ? 'page' : undefined"
          @click="navigate(item.id)"
        >
          <span class="ico"
            ><LineIcon :name="item.icon" /><b
              v-if="item.id === 'requests' && overview?.queue?.for_you"
              >{{ overview.queue.for_you }}</b
            ></span
          >{{ item.label }}</button
        ><button
          :aria-current="!phoneTabs.some((t) => t.id === tab) ? 'page' : undefined"
          @click="moreOpen = true"
        >
          <span class="ico"><LineIcon name="portal" /></span>More
        </button>
      </nav>
      <AdminCommands
        v-if="paletteOpen"
        :tabs="tabs"
        :members-visible="membersVisible"
        @close="paletteOpen = false"
        @navigate="navigate"
        @student="openStudent"
        @create="create"
      />
      <AdminConfirmHost />
      <AdminDialog v-if="moreOpen" title="Admin sections" @close="moreOpen = false"
        ><div class="menu-list">
          <button v-for="item in tabs" :key="item.id" @click="navigate(item.id)">
            <LineIcon :name="item.icon" />{{ item.label }}</button
          ><button
            @click="
              profileOpen = true;
              moreOpen = false;
            "
          >
            Your account
          </button>
        </div></AdminDialog
      >
      <AdminDialog v-if="createOpen" title="Create" @close="createOpen = false"
        ><div class="menu-list">
          <button @click="create('events')"><LineIcon name="cal" />New event</button
          ><button @click="create('forms')"><LineIcon name="book" />New form</button
          ><button v-if="noticesVisible" @click="create('notices')">
            <LineIcon name="chat" />New notice
          </button>
        </div></AdminDialog
      >
      <AdminDialog v-if="profileOpen" title="Your account" drop @close="profileOpen = false">
        <section class="adm-profile" aria-labelledby="admin-profile-heading">
          <div class="adm-profile-identity">
            <span class="adm-profile-avatar" aria-hidden="true">
              <img
                v-if="avatarUrl"
                :src="avatarUrl"
                alt=""
                referrerpolicy="no-referrer"
                @error="avatarFailed"
              />
              <img v-else :src="CREST" alt="" />
            </span>
            <div class="adm-profile-person">
              <p class="adm-kicker">Admin profile</p>
              <h3 id="admin-profile-heading">{{ profileName }}</h3>
              <p class="adm-profile-email">{{ auth.profile?.email || 'Signed-in admin' }}</p>
            </div>
          </div>
          <div class="adm-profile-scope" aria-label="Administrator scope">
            <span><LineIcon name="seal" />{{ roleLabel }}</span>
            <span><LineIcon name="pin" />{{ scope }}</span>
          </div>
          <nav class="adm-profile-actions" aria-label="Account actions">
            <button
              type="button"
              class="adm-profile-action"
              @click="
                helpOpen = true;
                profileOpen = false;
              "
            >
              <span class="adm-profile-action-icon">
                <LineIcon name="keyboard" />
              </span>
              <span>Keyboard shortcuts</span>
              <kbd>?</kbd>
            </button>
            <button type="button" class="adm-profile-action" @click="leave">
              <span class="adm-profile-action-icon">
                <LineIcon name="logout" />
              </span>
              <span>Sign out</span>
              <LineIcon name="next" />
            </button>
          </nav>
        </section>
      </AdminDialog>
      <AdminDialog v-if="helpOpen" title="Keyboard shortcuts" @close="helpOpen = false"
        ><dl class="shortcuts">
          <dt>Search and commands</dt>
          <dd><kbd>Ctrl K</kbd> or <kbd>/</kbd></dd>
          <dt>Overview / requests / students / events</dt>
          <dd><kbd>G</kbd> then <kbd>O / R / S / E</kbd></dd>
          <dt>Next / previous request</dt>
          <dd><kbd>J / K</kbd></dd>
          <dt>Review decision</dt>
          <dd><kbd>A</kbd> approve, <kbd>R</kbd> focus rejection note</dd>
          <dt>Close drawer or menu</dt>
          <dd><kbd>Esc</kbd></dd>
          <dt>Keyboard shortcuts</dt>
          <dd><kbd>?</kbd></dd>
        </dl></AdminDialog
      >
    </div>
  </div>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminNav from '../components/admin/AdminNav.vue';
import LineIcon from '../components/site/LineIcon.vue';
import AdminDialog from '../components/admin/AdminDialog.vue';
import AdminConfirmHost from '../components/admin/AdminConfirmHost.vue';
import AdminCommands from '../components/admin/AdminCommands.vue';
import AdminOverview from '../components/admin/AdminOverview.vue';
import AdminStudents from '../components/admin/AdminStudents.vue';
import AdminEvents from '../components/admin/AdminEvents.vue';
import AdminForms from '../components/admin/AdminForms.vue';
import AdminNotices from '../components/admin/AdminNotices.vue';
import AdminRequests from '../components/admin/AdminRequests.vue';
import AdminPositions from '../components/admin/AdminPositions.vue';
import AdminAudit from '../components/admin/AdminAudit.vue';
import AdminLookup from '../components/admin/AdminLookup.vue';
import AdminDirectory from '../components/admin/AdminDirectory.vue';
import '../components/admin/admin.css';
import CREST from '../assets/crest.webp';
import {
  auth,
  avatarFailed,
  avatarUrl,
  errorText,
  isHead,
  isRc,
  isSuperAdmin,
  signOut,
} from '../lib/auth.js';
import { loadAdminOverview, loadLookups } from '../lib/admin.js';
import { theme, toggleTheme } from '../lib/theme.js';
const route = useRoute();
const router = useRouter();
// Super Admins and RCs manage student records; a Head or Co-Head also sees Students (their
// community's tagged students) and Requests (to ask for a tag removal).
const membersVisible = computed(() => isSuperAdmin.value || isRc.value);
const studentsVisible = computed(() => membersVisible.value || isHead.value);
const profileName = computed(() => {
  const metadata = auth.session?.user?.user_metadata ?? {};
  return (
    metadata.full_name?.trim() ||
    metadata.name?.trim() ||
    auth.profile?.full_name?.trim() ||
    auth.profile?.preferred_name?.trim() ||
    'Admin'
  );
});
const allTabs = [
  { id: 'overview', label: 'Overview', icon: 'home' },
  {
    id: 'requests',
    label: 'Requests',
    icon: 'door',
    component: AdminRequests,
    students: true,
    description:
      'Review student corrections and admin changes. Your own changes need a different Super Admin.',
  },
  {
    id: 'students',
    label: 'Students',
    icon: 'people',
    component: AdminStudents,
    students: true,
    description:
      'Everyone in the house, signed in or not yet, with their communities. Open a student to see or change their record.',
  },
  {
    id: 'events',
    label: 'Events',
    icon: 'cal',
    component: AdminEvents,
    description: 'Manage events, posters, attendance and certificates in your scope.',
  },
  {
    id: 'forms',
    label: 'Forms',
    icon: 'book',
    component: AdminForms,
    description: 'Build forms, manage registration and export responses.',
  },
  {
    id: 'notices',
    label: 'Notices',
    icon: 'chat',
    component: AdminNotices,
    notices: true,
    description: 'Publish notices for your audience.',
  },
  {
    id: 'lookup',
    label: 'Find email',
    icon: 'search',
    component: AdminLookup,
    description:
      'Check one exact email against the whole house. Every lookup is recorded in the activity log.',
  },
  {
    id: 'directory',
    label: 'Directory',
    icon: 'lock',
    component: AdminDirectory,
    sa: true,
    description:
      'Search every student in the house upload by name, email or phone. Every search is recorded in the activity log.',
  },
  {
    id: 'positions',
    label: 'Positions',
    icon: 'seal',
    component: AdminPositions,
    sa: true,
    description: 'Coordinator and community positions. Changes need another Super Admin.',
  },
  {
    id: 'audit',
    label: 'Activity',
    icon: 'chart',
    component: AdminAudit,
    sa: true,
    description: 'Every admin action: who did it, to whom, and what changed.',
  },
];
const ownCommunity = computed(() =>
  lookups.value?.communities.find((c) => c.id === auth.dashboard?.community_id)
);
const membersOnlyHead = computed(() => isHead.value && !!ownCommunity.value?.members_only);
// Other community heads publish only events and forms; a members-only community's notices reach
// just its own list, so its Head/Co-Head may publish them too.
const noticesVisible = computed(() => membersVisible.value || membersOnlyHead.value);
const tabs = computed(() =>
  allTabs
    .filter(
      (t) =>
        (!t.students || studentsVisible.value) &&
        (!t.notices || noticesVisible.value) &&
        (!t.sa || isSuperAdmin.value)
    )
    .map((t) =>
      t.id === 'students' && !membersVisible.value
        ? {
            ...t,
            description: `Students in ${ownCommunity.value?.name ?? 'your'} Community. Approving a response on its join form adds a student; a Super Admin removes one.`,
          }
        : t
    )
);
const tab = computed(() =>
  tabs.value.some((t) => t.id === route.query.tab) ? route.query.tab : 'overview'
);
const current = computed(() => tabs.value.find((t) => t.id === tab.value));
const phoneTabs = computed(() =>
  tabs.value.filter((t) =>
    [
      'overview',
      ...(membersVisible.value ? ['requests', 'students'] : ['students', 'events', 'forms']),
    ].includes(t.id)
  )
);
const lookups = ref(null);
const overview = ref({});
const loadError = ref('');
const panel = ref(null);
const selectedId = ref(null);
const paletteOpen = ref(false);
const moreOpen = ref(false);
const createOpen = ref(false);
const profileOpen = ref(false);
const helpOpen = ref(false);
const scope = computed(() =>
  isSuperAdmin.value
    ? 'All regions'
    : isRc.value
      ? lookups.value?.regions.find((r) => r.id === auth.dashboard?.region_id)?.name ||
        'Your region'
      : lookups.value?.communities.find((c) => c.id === auth.dashboard?.community_id)?.name ||
        'Your community'
);
const roleLabel = computed(() =>
  isSuperAdmin.value
    ? 'Super Admin'
    : isRc.value
      ? 'Regional Coordinator'
      : auth.dashboard?.position === 'co_head'
        ? 'Co-Head'
        : 'Head'
);
async function navigate(id, recordId = null) {
  if (!tabs.value.some((t) => t.id === id)) return;
  const same = tab.value === id;
  selectedId.value = recordId;
  paletteOpen.value = moreOpen.value = createOpen.value = false;
  await router.replace({ query: { tab: id } });
  await nextTick();
  if (same && recordId) panel.value?.openRecord?.(recordId);
  window.scrollTo({ top: 0 });
}
async function openStudent(id) {
  await navigate('students');
  panel.value?.openRecord?.(id);
}
async function create(id) {
  await navigate(id);
  panel.value?.create?.();
}
async function openEventForm({ event, formId }) {
  await navigate('forms');
  await nextTick();
  await panel.value?.openForEvent?.(event, formId);
}
async function refresh() {
  loadError.value = '';
  try {
    if (!lookups.value) lookups.value = await loadLookups();
    overview.value = await loadAdminOverview();
  } catch (error) {
    loadError.value = errorText(error);
  }
}
let gAt = 0;
function shortcuts(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    paletteOpen.value = !paletteOpen.value;
    return;
  }
  if (
    document.querySelector('dialog[open]') ||
    /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) ||
    event.target.isContentEditable ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return;
  const key = event.key.toLowerCase();
  if (key === '?' || key === '/') {
    event.preventDefault();
    if (key === '?') helpOpen.value = true;
    else paletteOpen.value = true;
    return;
  }
  if (Date.now() - gAt < 900) {
    gAt = 0;
    const id = { o: 'overview', r: 'requests', s: 'students', e: 'events', a: 'audit' }[key];
    if (id) {
      event.preventDefault();
      navigate(id);
      return;
    }
  }
  if (key === 'g') gAt = Date.now();
  if (tab.value === 'requests') panel.value?.shortcut?.(key, event);
}
onMounted(async () => {
  window.addEventListener('keydown', shortcuts);
  await refresh();
});
onBeforeUnmount(() => window.removeEventListener('keydown', shortcuts));
async function leave() {
  await signOut();
  router.push('/login');
}
</script>
<style scoped src="../components/admin/desk.css"></style>

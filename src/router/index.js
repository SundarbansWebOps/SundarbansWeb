import { nextTick } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import { auth, authReady, canAdmin } from '../lib/auth.js';

// Every route is lazy so a visitor to "/" downloads only the homepage chunk.
// Paths must stay literal strings — Vite needs them statically analysable to
// emit one chunk per page.
const routes = [
  { path: '/', component: () => import('../pages/HomePage.vue') },
  { path: '/resources', component: () => import('../pages/ResourcesPage.vue') },
  { path: '/events', component: () => import('../pages/EventsPage.vue') },
  { path: '/house', component: () => import('../pages/HousePage.vue') },
  { path: '/teams', component: () => import('../pages/TeamsPage.vue') },
  { path: '/contributors', redirect: { path: '/teams', hash: '#contributors' } },
  {
    path: '/teams/legacy',
    name: 'Legacy',
    component: () => import('../pages/LegacyPage.vue'),
  },
  {
    path: '/teams/legacy/2021-22',
    name: 'Council2021',
    component: () => import('../pages/CouncilStoryPage.vue'),
    props: { story: '2021-22' },
  },
  {
    path: '/teams/legacy/2022-23',
    name: 'Council2022',
    component: () => import('../pages/CouncilStoryPage.vue'),
    props: { story: '2022-23' },
  },
  {
    path: '/teams/legacy/2023-24',
    name: 'Tenure2023',
    component: () => import('../pages/TenureReadPage.vue'),
  },
  {
    path: '/lounge',
    name: 'Lounge',
    component: () => import('../pages/LoungePage.vue'),
    meta: { member: true },
  },
  {
    path: '/lounge/forms/:id',
    name: 'LoungeForm',
    component: () => import('../pages/FormPage.vue'),
    meta: { member: true },
  },
  {
    path: '/lounge/certificates/:id',
    name: 'LoungeCertificate',
    component: () => import('../pages/CertificatePage.vue'),
    meta: { member: true },
  },
  // The admin lounge: Regional Coordinators, Heads/Co-Heads and Super Admins.
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../pages/AdminPage.vue'),
    meta: { member: true, admin: true },
  },
  // One uploaded form file, opened from a response's file link (manager only).
  {
    path: '/admin/files/:fileId',
    name: 'AdminFile',
    component: () => import('../pages/AdminFilePage.vue'),
    meta: { member: true, admin: true },
  },
  { path: '/login', name: 'Login', component: () => import('../pages/LoginPage.vue') },
  { path: '/help', component: () => import('../pages/HelpPage.vue') },
  { path: '/verify-certificate', component: () => import('../pages/VerifyPage.vue') },
  // Hands the reader to the contribution form; the raw Google Form link lives only there.
  {
    path: '/contribute-resources',
    component: () => import('../pages/ContributeResourcesPage.vue'),
  },

  // Links from the previous site (shared on WhatsApp, bookmarked) land on the page that
  // now holds that content.
  { path: '/study', redirect: '/resources' },
  { path: '/about', redirect: { path: '/house', hash: '#story' } },
  { path: '/meetups', redirect: { path: '/house', hash: '#regions' } },
  {
    path: '/meetups/:region',
    redirect: (to) => ({ path: '/house', hash: '#regions', query: { region: to.params.region } }),
  },
  { path: '/community', redirect: { path: '/teams', hash: '#communities' } },
  { path: '/community/technical', redirect: { path: '/events', query: { wing: 'tech' } } },
  { path: '/community/cultural', redirect: { path: '/events', query: { wing: 'cultural' } } },
  { path: '/community/esports', redirect: { path: '/events', query: { wing: 'games' } } },
  { path: '/contact', redirect: '/help' },
  { path: '/dashboard', redirect: '/lounge' },
  {
    path: '/grade',
    name: 'GradeCalculator',
    component: () => import('../pages/GradeCalculatorView.vue'),
  },

  // 404 catch-all
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../pages/NotFoundPage.vue'),
  },
];

// With lazy routes the view mounts after the navigation resolves, so an anchor
// target usually does not exist yet when scrollBehavior runs. Wait for it
// instead of silently landing at the top of the page.
const ANCHOR_TIMEOUT_MS = 1500;

// Mirrors vue-router's own lookup: ids are resolved with getElementById so a
// hash that is not a valid CSS selector (e.g. "#2024-recap") still matches.
function findAnchor(hash) {
  if (hash.startsWith('#')) {
    const byId = document.getElementById(hash.slice(1));
    if (byId) return byId;
  }
  try {
    return document.querySelector(hash);
  } catch {
    return null;
  }
}

// Bumped on every navigation so a wait left over from a superseded navigation
// resolves to null instead of scrolling whatever page the user is on now.
let scrollToken = 0;

function waitForAnchor(hash, token) {
  const existing = findAnchor(hash);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let timer;
    const finish = (el) => {
      clearTimeout(timer);
      observer.disconnect();
      resolve(token === scrollToken ? el : null);
    };
    const observer = new MutationObserver(() => {
      const el = findAnchor(hash);
      if (el) finish(el);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    timer = setTimeout(() => finish(findAnchor(hash)), ANCHOR_TIMEOUT_MS);
  });
}

// Room for the sticky nav and a page's section rail above an anchored section.
const ANCHOR_OFFSET = 120;
// Pages measure themselves after mounting (canvases, fitted names): land once, then settle.
const ANCHOR_SETTLE_MS = 450;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function scrollToAnchor(el, behavior) {
  window.scrollTo({
    top: el.getBoundingClientRect().top + window.scrollY - ANCHOR_OFFSET,
    behavior: reducedMotion() ? 'auto' : behavior,
  });
}

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    const token = ++scrollToken;
    // Same page and section, new query (a course or event sheet, the photo viewer): stay
    // where the reader is.
    if (to.path === from.path && to.hash === from.hash) return false;
    if (to.hash) {
      // Scrolls itself (offset + settle) and resolves falsy so vue-router leaves it alone.
      return waitForAnchor(to.hash, token).then((el) => {
        if (!el || token !== scrollToken) return false;
        const samePage = to.path === from.path;
        scrollToAnchor(el, samePage ? 'smooth' : 'auto');
        if (!samePage)
          setTimeout(() => token === scrollToken && scrollToAnchor(el, 'smooth'), ANCHOR_SETTLE_MS);
        return false;
      });
    }
    return savedPosition ?? { top: 0 };
  },
});

// Members-only pages need a session (and the admin lounge an RC or Super Admin role). The
// database enforces the same rules on every query; this only decides which page to show.
router.beforeEach(async (to) => {
  if (!to.meta.member) return;
  await authReady();
  if (!auth.session || !auth.profile) return { path: '/login', query: { next: to.fullPath } };
  if (to.meta.admin && !canAdmin.value) return { path: '/lounge' };
});

// Page changes cross-fade where the browser supports view transitions. The old page is
// captured first; the transition completes once the new page has rendered.
router.beforeResolve((to, from) => {
  if (!from.matched.length || to.path === from.path) return;
  // The Lounge owns its shared-scene transitions and arrival choreography.
  if (to.name === 'Lounge' || from.name === 'Lounge') return;
  if (!document.startViewTransition || reducedMotion()) return;
  return new Promise((captured) => {
    const transition = document.startViewTransition(
      () =>
        new Promise((rendered) => {
          captured();
          const off = router.afterEach(() => {
            off();
            nextTick(rendered);
          });
        })
    );
    // A transition skipped by a quick second navigation or a hidden tab is not an error;
    // the page still swaps, just without the fade.
    transition.ready.catch(() => {});
    // A page that restyles this transition (LegacyBoard's door) clears its styling on this
    // event. Clearing it any earlier, even on its own animationend, restarts the default fade.
    transition.finished.finally(() => document.dispatchEvent(new Event('pagetransitionend')));
  });
});

// A tab left open across a deploy asks for chunk files the new build no longer
// has. Reload once onto the target URL to pick up the fresh manifest; the
// sessionStorage marker stops a genuinely broken chunk from looping forever.
const CHUNK_RELOAD_KEY = 'sundarbans_chunk_reload';

function isChunkLoadError(error) {
  const message = String(error?.message ?? error ?? '');
  // Chrome and Firefox both say "dynamically imported module"; Safari says
  // "Importing a module script failed". Matching bare "Failed to fetch" would
  // add no coverage but would hard-reload the tab on any future async guard
  // whose fetch blips.
  return (
    /dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

function readReloadMarker() {
  try {
    return sessionStorage.getItem(CHUNK_RELOAD_KEY);
  } catch {
    return null;
  }
}

function writeReloadMarker(value) {
  try {
    if (value === null) sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    else sessionStorage.setItem(CHUNK_RELOAD_KEY, value);
    return true;
  } catch {
    return false;
  }
}

router.onError((error, to) => {
  if (!isChunkLoadError(error)) return;
  if (readReloadMarker() === to.fullPath) return;
  // Storage disabled (private mode / embedded webview) means the loop guard
  // cannot be armed. One broken page beats an unbreakable reload loop.
  if (!writeReloadMarker(to.fullPath)) return;
  window.location.hash = to.fullPath;
  window.location.reload();
});

router.afterEach(() => {
  if (readReloadMarker() !== null) writeReloadMarker(null);
});

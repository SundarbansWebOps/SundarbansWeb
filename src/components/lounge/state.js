// Shared Lounge state: theme, the member's name, tour flag. Names and the tour live on the
// member row (updateProfile / markTourSeen). Theme is the only browser preference stored here.
import { computed, ref } from 'vue';
import { member } from './fixtures.js';

import { boot } from './boot.js';
export { boot };

// Document lifetime only: route returns stay settled; a browser refresh replays arrival.
export const loungeArrived = ref(false);
// True while the sign-in door still covers the Lounge. The Lounge (or its tour) is mounted and
// rests in its first pose underneath; it starts moving when this turns false.
export const doorHold = ref(false);
export { theme } from '../../lib/theme.js';
import { theme } from '../../lib/theme.js';
export const rosterName = computed(() => member.full_name ?? '');
export const preferredName = ref(null);
export const certName = ref('');
export const cleanName = (v) => (v ?? '').trim().replace(/\s+/g, ' ');

export function applyProfile(profile) {
  if (!profile) return;
  preferredName.value = profile.preferred_name ?? null;
  certName.value = profile.certificate_name ?? '';
  tourSeen.value = !!profile.tour_seen_at;
}

// One name: the member's full name, as on their IITM records. While the record has none, the
// first name they save fills it too (set once, audited; an admin corrects it after that).
// Gender rides along from Edit profile. Details go first so a refusal saves nothing.
export async function savePreferredName(v, phone, gender = null) {
  const { saveMemberProfile, saveMyDetails } = await import('./session.js');
  const name = cleanName(v);
  const fullName = member.id && !member.full_name && name.length >= 2 ? name : null;
  if (fullName || gender) await saveMyDetails({ full_name: fullName, gender });
  const row = await saveMemberProfile({
    preferred_name: name,
    phone: phone === undefined ? member.phone : phone,
  });
  preferredName.value = row?.preferred_name ?? name;
  return row;
}

export const nameOn = ref(true);
export const liveOn = ref(true);
export const customName = preferredName;
export const shownName = computed(() => (nameOn.value ? preferredName.value || '' : ''));
export const hasName = computed(() => !!shownName.value);
export const firstName = computed(() => shownName.value.split(' ')[0] || '');
export const callName = computed(() => shownName.value);
export const initialsOf = (name) =>
  cleanName(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export const nameCardOpen = ref(false);
export function openNameCard() {
  nameCardOpen.value = true;
}
export const nameFlight = ref(null);

export function store(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
}

export function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const tourSeen = ref(false);
export async function markTourSeen() {
  const { completeTour } = await import('./session.js');
  await completeTour();
}
export async function resetTour() {
  const { retakeTourOnServer } = await import('./session.js');
  await retakeTourOnServer();
}

export const mode = computed(() => (theme.value === 'dark' ? 'night' : 'day'));

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Live Lounge payload: one hydrate from loadLounge(), then member UI reads these arrays.
// Visual art stays in events.js / home; this file holds no sample notices, groups or certificates.
import { computed, reactive, watch } from 'vue';
import { auth, errorText, isSuperAdmin } from '../../lib/auth.js';
import { lower } from '../../lib/house.js';
import {
  completeProfile,
  confirmCertificateName as persistCertName,
  getFormInvite,
  groupFormsForMember,
  isFixable,
  listGroups,
  loadLounge,
  listNotices,
  markTourSeen as persistTour,
  requestCertificateNameChange,
  requestRegionChange,
  reviewOf,
  selectInitialRegion,
  setGroupFormsHidden as persistGroupFormsHidden,
  setNoticeState,
  submitForm,
  updateProfile,
} from '../../lib/lounge.js';
import { member } from './fixtures.js';
import { applyProfile, certName, preferredName, tourSeen } from './state.js';

export const lounge = reactive({
  ready: false,
  error: '',
  events: [],
  forms: [],
  notices: [],
  noticeError: '',
  certificates: [],
  regionRequests: [],
  groups: [],
  regions: [],
  inviteByForm: {},
});

const asList = (value) => (Array.isArray(value) ? value : []);
let activeUid = auth.session?.user?.id ?? auth.profile?.id ?? null;
let hydrateGeneration = 0;

function coordinatorFor(regionName) {
  if (!regionName || /international/i.test(regionName)) {
    return { name: 'Upper House Council', role: 'Upper House Council' };
  }
  const rc = lower.find(
    (p) => p.region === regionName || (regionName === 'Delhi NCR' && p.region === 'Delhi')
  );
  return { name: rc?.name ?? 'Your Regional Coordinator', role: 'Regional Coordinator' };
}

function clearMemberData() {
  lounge.ready = false;
  lounge.error = '';
  lounge.noticeError = '';
  lounge.events = [];
  lounge.forms = [];
  lounge.notices = [];
  lounge.certificates = [];
  lounge.regionRequests = [];
  lounge.groups = [];
  lounge.regions = [];
  lounge.inviteByForm = {};
  Object.assign(member, {
    id: '',
    full_name: '',
    preferred_name: '',
    email: '',
    phone: '',
    roll: '',
    cohort: '',
    region_id: null,
    region: { code: '', name: '' },
    coordinator: coordinatorFor(''),
    certificate_name: '',
    tour_seen_at: null,
    group_forms_hidden: false,
  });
  preferredName.value = null;
  certName.value = '';
  tourSeen.value = false;
}

watch(
  () => auth.session?.user?.id ?? null,
  (uid) => {
    if (uid === activeUid) return;
    activeUid = uid;
    hydrateGeneration++;
    clearMemberData();
  },
  { flush: 'sync' }
);

export function fillMember(profile) {
  if (!profile) return;
  const regionName = profile.region?.name ?? '';
  Object.assign(member, {
    id: profile.id,
    full_name: profile.full_name ?? '',
    preferred_name: profile.preferred_name ?? '',
    gender: profile.gender ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    roll: (profile.member_code || '').toUpperCase(),
    cohort: profile.cohort ?? '',
    region_id: profile.region_id ?? null,
    region: { code: profile.region?.code ?? '', name: regionName },
    coordinator: coordinatorFor(regionName),
    certificate_name: profile.certificate_name ?? '',
    tour_seen_at: profile.tour_seen_at ?? null,
    // A payload without the field (an RPC that returns a trimmed profile) keeps what we know.
    group_forms_hidden: profile.group_forms_hidden ?? member.group_forms_hidden,
  });
  applyProfile(profile);
}

async function loadRegions() {
  const { supabase } = await import('../../lib/supabase.js');
  const { data, error } = await supabase.from('regions').select('id, code, name').order('name');
  if (error) throw error;
  return data ?? [];
}

// Bumped when "I've joined all my groups" is saved. A refresh that was already in flight read
// the old value, so it re-applies the saved one instead of putting the old one back.
let hiddenSaves = 0;
let savedHidden = false;

export async function hydrateLounge() {
  const generation = ++hydrateGeneration;
  const savesAtStart = hiddenSaves;
  const requestedUid = auth.session?.user?.id ?? auth.profile?.id ?? null;
  lounge.error = '';
  const data = await loadLounge();
  const currentUid = auth.session?.user?.id ?? auth.profile?.id ?? null;
  if (
    generation !== hydrateGeneration ||
    requestedUid !== currentUid ||
    (requestedUid && data.profile?.id !== requestedUid)
  )
    return data;
  if (data.profile) {
    auth.profile = { ...auth.profile, ...data.profile };
    fillMember(data.profile);
    if (hiddenSaves !== savesAtStart) {
      member.group_forms_hidden = savedHidden;
      auth.profile.group_forms_hidden = savedHidden;
    }
  }
  lounge.events = asList(data.events);
  lounge.forms = asList(data.forms);
  lounge.notices = asList(data.notices);
  lounge.certificates = asList(data.certificates);
  lounge.regionRequests = asList(data.regionRequests);
  const [groups, regions] = await Promise.all([
    listGroups(lounge.forms, member.region_id),
    loadRegions().catch(() => []),
  ]);
  if (
    generation !== hydrateGeneration ||
    requestedUid !== (auth.session?.user?.id ?? auth.profile?.id ?? null)
  )
    return data;
  lounge.groups = asList(groups);
  lounge.regions = asList(regions);
  lounge.ready = true;
  return data;
}

export async function refreshLounge() {
  try {
    await hydrateLounge();
  } catch (err) {
    lounge.error = errorText(err);
    lounge.ready = true;
  }
}

export async function saveMemberProfile({ preferred_name, phone }) {
  const row = await updateProfile({
    preferred_name: preferred_name ?? preferredName.value ?? '',
    phone: phone === undefined ? (member.phone ?? null) : phone,
  });
  auth.profile = { ...auth.profile, ...row };
  fillMember({ ...auth.profile, ...row });
  return row;
}

// Students who signed in after the roster clean-up have no full name; the nav strip and the
// profile card ask for it (and gender) until both are set.
export const missingDetails = computed(() =>
  member.id ? { name: !member.full_name, gender: !member.gender } : { name: false, gender: false }
);

export async function saveMyDetails({ full_name, gender }) {
  const row = await completeProfile({ full_name, gender });
  auth.profile = { ...auth.profile, ...row };
  fillMember({ ...auth.profile, ...row });
  return row;
}

export async function completeTour() {
  const seen = await persistTour(true);
  tourSeen.value = true;
  if (auth.profile) auth.profile.tour_seen_at = seen;
  member.tour_seen_at = seen;
  return seen;
}

// "I've joined all my groups": persisted on the member row, reversible.
export async function saveGroupFormsHidden(hidden) {
  const saved = !!(await persistGroupFormsHidden(hidden));
  hiddenSaves++;
  savedHidden = saved;
  member.group_forms_hidden = saved;
  if (auth.profile) auth.profile.group_forms_hidden = saved;
  return saved;
}

export async function retakeTourOnServer() {
  await persistTour(false);
  tourSeen.value = false;
  if (auth.profile) auth.profile.tour_seen_at = null;
  member.tour_seen_at = null;
}

export async function chooseInitialRegion(regionId) {
  const row = await selectInitialRegion(regionId);
  const region = lounge.regions.find((item) => Number(item.id) === Number(regionId));
  const profile = { ...auth.profile, ...row, region: region ?? row.region ?? auth.profile?.region };
  auth.profile = profile;
  fillMember(profile);
  await refreshLounge();
  return row;
}

export async function submitRegionRequest(regionId, reason) {
  const id = await requestRegionChange(regionId, reason);
  await refreshLounge();
  return id;
}

export async function submitLoungeForm(formId, answers, savePhone = false) {
  const result = await submitForm(formId, answers, savePhone);
  if (result?.invite_url) lounge.inviteByForm[formId] = result.invite_url;
  await refreshLounge();
  return result;
}

export async function fetchInvite(formId) {
  const url = await getFormInvite(formId);
  if (url) lounge.inviteByForm[formId] = url;
  return url;
}

export async function readNotice(id) {
  await updateNotice(id, { read: true, dismiss: false });
}

export async function dismissNotice(id) {
  await updateNotice(id, { read: true, dismiss: true });
}

export async function readAllNotices() {
  lounge.noticeError = '';
  const pending = lounge.notices.filter((n) => !n.read_at && !n.read);
  const results = await Promise.allSettled(
    pending.map((n) => setNoticeState(n.id, { read: true }))
  );
  if (results.some((result) => result.status === 'rejected')) {
    lounge.noticeError = 'Some notices could not be marked read. Your list has been refreshed.';
    await reconcileNotices();
    throw new Error(lounge.noticeError);
  }
  for (const n of pending) n.read_at = n.read_at || new Date().toISOString();
}

async function reconcileNotices() {
  try {
    lounge.notices = asList(await listNotices());
  } catch {
    /* Keep the last known rows and surface the mutation error. */
  }
}

async function updateNotice(id, state) {
  lounge.noticeError = '';
  try {
    await setNoticeState(id, state);
    const n = lounge.notices.find((row) => row.id === id);
    if (n) {
      const now = new Date().toISOString();
      if (state.read) n.read_at = n.read_at || now;
      if (state.dismiss) {
        n.dismissed_at = n.dismissed_at || now;
        n.show_banner = false;
      }
    }
  } catch (error) {
    lounge.noticeError = errorText(error) || 'This notice could not be updated.';
    await reconcileNotices();
    throw error;
  }
}

export async function confirmPrintedName(name) {
  const saved = await persistCertName(name);
  certName.value = saved || name;
  if (auth.profile) {
    auth.profile.certificate_name = certName.value;
    auth.profile.certificate_name_confirmed_at =
      auth.profile.certificate_name_confirmed_at || new Date().toISOString();
  }
  await refreshLounge();
  return saved;
}

export async function askCertNameChange(name, reason) {
  return requestCertificateNameChange(name, reason);
}

export const pendingRegionRequest = computed(() =>
  lounge.regionRequests.find((r) => r.status === 'pending' && r.member_id === member.id)
);

// Members see open forms for their region. Super Admins can see every group form;
// audience-restricted and closed forms are available as read-only previews.
export const openGroupForms = computed(() => {
  if (isSuperAdmin.value) {
    return lounge.forms.filter((f) => f.form_kind === 'group' && !f.event_id);
  }
  return groupFormsForMember(lounge.forms, member.region_id).filter(
    (f) => (f.accepting_responses ?? f.is_open) && !f.submitted
  );
});

// What the WhatsApp groups section shows. Approved forms are gone and "I've joined all my
// groups" hides the rest; a rejected response always stays as a notice so the student can
// fix it. With nothing left to show the section is removed, not left as an empty frame, but a
// student whose groups have not been published yet keeps today's "will appear here" note.
export const groupsSection = computed(() => {
  if (isSuperAdmin.value) return { show: true, rejectedOnly: false };
  const mine = groupFormsForMember(lounge.forms, member.region_id);
  // Only a rejection the student can still fix pulls the section back while it is hidden.
  const fixable = mine.some(isFixable);
  if (member.group_forms_hidden) return { show: fixable, rejectedOnly: true };
  const anyBoat =
    openGroupForms.value.length > 0 || mine.some((f) => f.submitted && reviewOf(f) !== 'approved');
  const emptiedByApproval = !anyBoat && mine.some((f) => reviewOf(f) === 'approved');
  return { show: !emptiedByApproval, rejectedOnly: false };
});

export const formByEvent = (eventId) => lounge.forms.find((f) => f.event_id === eventId) ?? null;
export const formById = (id) => lounge.forms.find((f) => f.id === id) ?? null;

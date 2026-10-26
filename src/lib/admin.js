// Admin lounge data: every call goes through Supabase as the signed-in organizer, and
// the database decides what they may see or change (row-level security plus the RPC checks).
// Changes to a student's record are requests; a different Super Admin approves them.
// Student region corrections are reviewed by the current-region RC or a Super Admin (Q15).
import { supabase } from './supabase.js';
import { auth, isHead, isRc, isSuperAdmin } from './auth.js';
import {
  exportEventRecords as loungeExportEventRecords,
  exportFormResponses as loungeExportFormResponses,
  getAvailableCohorts as loungeGetAvailableCohorts,
  importAttendance as loungeImportAttendance,
  listAttendance as loungeListAttendance,
  listCertificateNameRequests as loungeListCertificateNameRequests,
  listForms as loungeListForms,
  listRegionRequests as loungeListRegionRequests,
  releaseCertificates as loungeReleaseCertificates,
  reviewCertificateNameRequest as loungeReviewCertificateNameRequest,
  reviewRegionRequest as loungeReviewRegionRequest,
  saveForm as loungeSaveForm,
  saveNotice as loungeSaveNotice,
  deleteNotice as loungeDeleteNotice,
  setNoticePublished as loungeSetNoticePublished,
  uploadCertificateTemplate as loungeUploadCertificateTemplate,
} from './lounge.js';

const unwrap = ({ data, error, count }) => {
  if (error) throw error;
  return count === undefined || count === null ? data : { data, count };
};

const asList = (data) => (Array.isArray(data) ? data : []);

export const PAGE = 50;
export const FORM_FIELD_TYPES = [
  'text',
  'textarea',
  'email',
  'phone',
  'select',
  'checkbox',
  'multiselect',
];
export const PREFILL_KEYS = ['name', 'phone', 'email'];
export const MEET_ELIGIBLE_SECONDS = 1200;
export const TEMPLATE_MAX_BYTES = 10485760;
export const TEMPLATE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const REQUEST_LABEL = {
  event_publish: 'Publish house-wide event',
  form_publish: 'Publish form',
  member_deletion: 'Delete member',
  member_blacklist: 'Blacklist member',
  member_hard_delete: 'Erase permanently',
  member_profile_update: 'Edit details',
  member_contact_change: 'Change login email',
  member_status_change: 'Change status',
  position_change: 'Change position',
  community_record_update: 'Edit community record',
  community_record_deletion: 'Delete community record',
  community_tag_removal: 'Remove from community',
};

export const POSITION_LABEL = { rc: 'Regional Coordinator', head: 'Head', co_head: 'Co-Head' };
export const STATUS_ACTION_LABEL = {
  suspend: 'Suspend',
  reinstate: 'Reinstate',
  restore: 'Restore',
  lift_blacklist: 'Lift blacklist',
};

export function isInternationalRegion(region) {
  return region?.code === 'international' || /^international$/i.test(region?.name ?? '');
}

export function fieldKeyFromLabel(label, used = []) {
  let key = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  if (!/^[a-z]/.test(key)) key = `f_${key}`.slice(0, 64);
  if (!key) key = 'field';
  let out = key;
  let n = 2;
  while (used.includes(out)) {
    out = `${key.slice(0, 60)}_${n}`;
    n += 1;
  }
  return out;
}

// Lookups

export async function loadLookups() {
  const [regions, communities] = await Promise.all([
    supabase.from('regions').select('id, code, name').order('code'),
    supabase.from('communities').select('id, code, name, members_only').order('id'),
  ]);
  return { regions: unwrap(regions), communities: unwrap(communities) };
}

// The audience line for an item a members-only community owns, or null for an ordinary
// community (whose items reach every matching house member). The database enforces it.
export function membersOnlyAudience(lookups, communityId) {
  const community = lookups?.communities?.find((c) => c.id === communityId);
  return community?.members_only ? `Only ${community.name} Community members` : null;
}

// Overview counts (each one already scoped by the database).

// RC: pending counts their own requests; Super Admin: the whole queue (RLS decides).
export async function loadCounts() {
  const head = { count: 'exact', head: true };
  const now = new Date().toISOString();
  const [members, roster, events, pending] = await Promise.all([
    supabase.from('members').select('id', head).neq('account_status', 'deleted'),
    supabase.from('member_roster').select('email', head),
    supabase.from('events').select('id', head).is('deleted_at', null).gte('ends_at', now),
    supabase.from('approval_requests').select('id', head).eq('status', 'pending'),
  ]);
  for (const result of [members, roster, events, pending]) if (result.error) throw result.error;
  return {
    members: members.count ?? 0,
    roster: roster.count ?? 0,
    events: events.count ?? 0,
    pending: pending.count ?? 0,
  };
}

// Students

// The one Students list: signed-in students and roster students who have not signed in yet,
// scoped by the database (Super Admin: all; RC: own region; Head/Co-Head: own community's tags).
// Each row has kind 'member' or 'roster' and the community ids the caller may see.
export async function listStudents({
  query = '',
  status = 'current',
  regionId = null,
  communityId = null,
  page = 0,
} = {}) {
  return unwrap(
    await supabase.rpc('list_students', {
      p_query: query || null,
      p_status: status,
      p_region: regionId,
      p_community: communityId,
      p_offset: page * PAGE,
    })
  );
}

const MEMBER_COLS =
  'id, member_code, full_name, preferred_name, email, phone, gender, region_id, account_status, deleted_at, created_at, last_login_at';

export async function searchMembers(query, includeDeleted = false) {
  return unwrap(
    await supabase.rpc('search_members', { p_query: query, p_include_deleted: includeDeleted })
  );
}

// House-wide exact-email check for any admin. The database audits every lookup.
export async function lookupEmail(email) {
  return unwrap(await supabase.rpc('admin_lookup_email', { p_email: email }));
}

// Super Admin search of the student directory (name, email or phone). Audited by the database.
export async function searchDirectory(query) {
  return unwrap(await supabase.rpc('search_student_directory', { p_query: query }));
}

export async function getMember(id) {
  const [m, pos, reg] = await Promise.all([
    supabase.from('members').select(MEMBER_COLS).eq('id', id).maybeSingle(),
    supabase
      .from('admin_assignments')
      .select('id, position, region_id, community_id, started_at')
      .eq('member_id', id)
      .is('ended_at', null)
      .maybeSingle(),
    supabase
      .from('regional_registrations')
      .select('answers, updated_at')
      .eq('member_id', id)
      .maybeSingle(),
  ]);
  const member = unwrap(m);
  return { member, position: pos.error ? null : pos.data, regional: reg.error ? null : reg.data };
}

// Requests about a student

export const requestUpdate = (memberId, changes, reason) =>
  supabase
    .rpc('request_member_update', { p_member_id: memberId, p_changes: changes, p_reason: reason })
    .then(unwrap);
export const requestDeletion = (memberId, reason) =>
  supabase.rpc('request_member_deletion', { p_member_id: memberId, p_reason: reason }).then(unwrap);
export const requestBlacklist = (memberId, reason) =>
  supabase.rpc('request_blacklist', { p_member_id: memberId, p_reason: reason }).then(unwrap);
export const requestStatus = (memberId, action, reason) =>
  supabase
    .rpc('request_status_change', { p_member_id: memberId, p_action: action, p_reason: reason })
    .then(unwrap);
export const requestPosition = (memberId, action, position, communityId, reason) =>
  supabase
    .rpc('request_position_change', {
      p_member_id: memberId,
      p_action: action,
      p_position: position ?? null,
      p_community_id: communityId ?? null,
      p_reason: reason,
    })
    .then(unwrap);
// Login email: one Super Admin files, another approves through change-member-contact.
export const requestContactChange = (memberId, email, reason) =>
  supabase
    .rpc('request_contact_change', { p_member_id: memberId, p_email: email, p_reason: reason })
    .then(unwrap);
export const requestHardDelete = (memberId, reason) =>
  supabase.rpc('request_hard_delete', { p_member_id: memberId, p_reason: reason }).then(unwrap);

// Roster (students who have not signed in yet)

export const rosterAdd = (row) =>
  supabase
    .rpc('roster_add', {
      p_email: row.email,
      p_full_name: row.full_name || null,
      p_phone: row.phone || null,
      p_region_id: row.region_id || null,
      p_gender: row.gender || null,
    })
    .then(unwrap);
export const rosterAddMany = (rows) =>
  supabase.rpc('roster_add_many', { p_rows: rows }).then(unwrap);
export const rosterRemove = (email) =>
  supabase.rpc('roster_remove', { p_email: email }).then(unwrap);

// Community tags, by email. A Super Admin adds and removes them; approving a response on a join
// form also adds one. A Head or Co-Head asks a Super Admin to remove one through Requests.

export const COMMUNITY_ADD_MAX = 2000;

export const addCommunityMembers = (communityId, emails) =>
  supabase
    .rpc('add_community_members', { p_community_id: communityId, p_emails: emails })
    .then(unwrap);
export const removeCommunityMember = (communityId, email) =>
  supabase
    .rpc('remove_community_member', { p_community_id: communityId, p_email: email })
    .then(unwrap);
export const requestTagRemoval = (communityId, email, reason) =>
  supabase
    .rpc('request_community_tag_removal', {
      p_community_id: communityId,
      p_email: email,
      p_reason: reason,
    })
    .then(unwrap);

// Every distinct address in pasted text: one per line, or separated by commas, tabs or spaces.
// Words without an @ (a header, a name copied beside the email) are left out; the server
// reports anything else it cannot accept.
export function emailsFromText(text) {
  const seen = new Set();
  for (const token of String(text ?? '').split(/[\s,;]+/)) {
    const email = normalizeEmail(token.replace(/^[<"']+|[>"']+$/g, ''));
    if (email.includes('@')) seen.add(email);
  }
  return [...seen];
}

// A CSV with an "Email Address" column (a Google Form export) or an "Email" column.
export function emailsFromCsv(rows) {
  const headers = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const i = ['email address', ...HEADER_ALIASES.email]
    .map((name) => headers.indexOf(name))
    .find((index) => index >= 0);
  if (i === undefined) return { emails: [], error: 'The CSV needs an Email Address column.' };
  return {
    emails: emailsFromText(
      rows
        .slice(1)
        .map((r) => r[i] ?? '')
        .join('\n')
    ),
    error: '',
  };
}

function regionIdFrom(value, regions) {
  if (!value) return null;
  const key = String(value).trim().toLowerCase();
  if (!key) return null;
  const byCode = new Map(regions.map((r) => [r.code.toLowerCase(), r.id]));
  const byName = new Map(regions.map((r) => [r.name.toLowerCase(), r.id]));
  return byCode.get(key) ?? byName.get(key) ?? null;
}

// Gender is stored as Female or Male (members_gender_choice). Spreadsheets say it many ways.
export const GENDER_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
];
const GENDER_WORDS = {
  f: 'Female',
  female: 'Female',
  girl: 'Female',
  m: 'Male',
  male: 'Male',
  boy: 'Male',
};
// '' and unknown words both give null; gender_error names the unknown one.
const genderFields = (raw) => {
  const gender = raw ? (GENDER_WORDS[raw.toLowerCase()] ?? null) : null;
  return { gender, gender_error: raw && !gender ? `Unknown gender: ${raw}` : null };
};

// One student per line, tab- or comma-separated: email[, full name][, phone][, region][, gender].
// Name, phone, region and gender may be left empty. Spreadsheet copies paste as tabs.
export function parseRosterPaste(text, regions) {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(line.includes('\t') ? '\t' : ',').map((c) => c.trim()))
    .filter((c) => c.length >= 1 && c[0] && !/^e-?mail$/i.test(c[0]))
    .map(([email, full_name, phone, region, gender]) => ({
      email,
      full_name: full_name || null,
      phone: phone || null,
      region_id: regionIdFrom(region, regions),
      region_error:
        isSuperAdmin.value && region && !regionIdFrom(region, regions)
          ? `Unknown region: ${region}`
          : null,
      ...genderFields(gender),
    }));
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  const pushCell = () => {
    row.push(cell);
    cell = '';
  };
  const pushRow = () => {
    if (row.some((c) => c.trim())) rows.push(row.map((c) => c.trim()));
    row = [];
  };
  const src = String(text ?? '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') pushCell();
    else if (ch === '\n') {
      pushCell();
      pushRow();
    } else if (ch !== '\r') cell += ch;
  }
  pushCell();
  pushRow();
  return rows;
}

const HEADER_ALIASES = {
  email: ['email', 'e-mail', 'student_email', 'student email', 'mail'],
  full_name: ['full name', 'name', 'full_name', 'student name', 'student_name'],
  phone: ['phone', 'mobile', 'whatsapp', 'phone number'],
  region: ['region', 'allocated_region', 'allocated region', 'house region'],
  gender: ['gender'],
};

function headerIndex(headers, aliases) {
  const lower = headers.map((h) => h.toLowerCase());
  for (const a of aliases) {
    const i = lower.indexOf(a);
    if (i >= 0) return i;
  }
  return -1;
}

export function suggestRosterMapping(headers) {
  return {
    email: headerIndex(headers, HEADER_ALIASES.email),
    full_name: headerIndex(headers, HEADER_ALIASES.full_name),
    phone: headerIndex(headers, HEADER_ALIASES.phone),
    region: headerIndex(headers, HEADER_ALIASES.region),
    gender: headerIndex(headers, HEADER_ALIASES.gender),
  };
}

export function rowsFromRosterCsv(rows, mapping, regions) {
  if (!rows.length) return [];
  const [headers, ...body] = rows;
  const col = (name, line) => {
    const i = mapping[name];
    return i >= 0 ? (line[i] ?? '').trim() : '';
  };
  const seen = new Map();
  const out = [];
  for (const line of body) {
    const email = col('email', line).toLowerCase();
    if (!email) continue;
    const rawRegion = col('region', line);
    const row = {
      email,
      full_name: col('full_name', line) || null,
      phone: col('phone', line) || null,
      region_id: regionIdFrom(rawRegion, regions),
      region_error:
        isSuperAdmin.value && rawRegion && !regionIdFrom(rawRegion, regions)
          ? `Unknown region: ${rawRegion}`
          : null,
      ...genderFields(col('gender', line)),
      _headers: headers,
      _raw: line,
    };
    if (seen.has(email)) {
      row.duplicate = true;
    } else {
      seen.set(email, row);
    }
    out.push(row);
  }
  return out;
}

export function toCsv(rows, columns) {
  const esc = (v) => {
    let s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    // Member-typed text must never run as a spreadsheet formula.
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cols = columns ?? [
    ...new Set(rows.flatMap((r) => (r && typeof r === 'object' ? Object.keys(r) : []))),
  ];
  const columnKey = (column) => (typeof column === 'object' ? column.key : column);
  const columnLabel = (column) => (typeof column === 'object' ? column.label : column);
  return [
    cols.map((column) => esc(columnLabel(column))).join(','),
    ...rows.map((r) => cols.map((column) => esc(r?.[columnKey(column)])).join(',')),
  ].join('\n');
}

export function downloadCsv(filename, rows, columns) {
  const blob = new Blob([toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function flattenExportRows(value) {
  if (Array.isArray(value)) {
    return value.map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return { value: row };
      const out = {};
      for (const [k, v] of Object.entries(row)) {
        out[k] = v && typeof v === 'object' ? JSON.stringify(v) : v;
      }
      return out;
    });
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([section, rows]) =>
      flattenExportRows(rows).map((row) => ({ section, ...row }))
    );
  }
  return [];
}

// Events

const EVENT_COLS =
  'id, name, description, registration_link, gmail_link, starts_at, ends_at, community_id, region_id, published_at, audience_cohorts, attendance_mode, certificate_template_url, certificates_released_at, archive, source_key, display_date, image_url, event_type, wing, location, image_width, image_height, attendee_count, attendee_display, cancelled_at, deleted_at, created_at, updated_at, is_public, created_by';

export async function listEvents({ view = 'upcoming' } = {}) {
  const now = new Date().toISOString();
  let q = supabase.from('events').select(EVENT_COLS).is('deleted_at', null);
  if (view === 'drafts') {
    q = q.is('published_at', null).order('updated_at', { ascending: false }).order('id');
  } else if (view === 'past') {
    q = q.not('published_at', 'is', null).order('starts_at', { ascending: false }).order('id');
  } else {
    q = q
      .not('published_at', 'is', null)
      .eq('archive', false)
      .gte('ends_at', now)
      .order('starts_at')
      .order('id');
  }
  const rows = [];
  for (let from = 0; ; from += 200) {
    const page = unwrap(await q.range(from, from + 199));
    rows.push(...page);
    if (page.length < 200) break;
  }
  const visible =
    view === 'past' ? rows.filter((e) => e.archive || (e.ends_at && e.ends_at < now)) : rows;
  // House-wide drafts an RC asked to publish (RLS: the RC sees their own, Super Admins all).
  const pending = unwrap(
    await supabase
      .from('approval_requests')
      .select('id, target_event_id')
      .eq('type', 'event_publish')
      .eq('status', 'pending')
  );
  const pendingByEvent = new Map(pending.map((r) => [r.target_event_id, r.id]));
  return visible.map((event) => ({
    ...event,
    can_manage: canManageEvent(event),
    pending_request_id: pendingByEvent.get(event.id) ?? null,
  }));
}

// An RC's own unpublished house-wide draft; once a Super Admin publishes it, only they manage it.
export const isMyHouseDraft = (event) =>
  isRc.value &&
  event.region_id == null &&
  event.community_id == null &&
  !event.published_at &&
  event.created_by === auth.profile?.id;

// RLS can expose events to members who may read public history. Keep organizer actions
// aligned with the dashboard scope while the RPC remains the authoritative write check.
export function canManageEvent(event) {
  if (!event || !auth.dashboard) return false;
  if (isSuperAdmin.value) return true;
  if (isRc.value)
    return (
      (event.region_id === auth.dashboard.region_id && event.community_id == null) ||
      isMyHouseDraft(event)
    );
  if (isHead.value)
    return event.community_id === auth.dashboard.community_id && event.region_id == null;
  return false;
}

export async function saveEvent(event, { publish = false, unpublish = false } = {}) {
  const row = {
    name: event.name,
    description: event.description || null,
    registration_link: event.registration_link || null,
    gmail_link: event.gmail_link || null,
    starts_at: event.starts_at || null,
    ends_at: event.ends_at || null,
    community_id: event.community_id || null,
    region_id: event.region_id || null,
    audience_cohorts: event.audience_cohorts ?? [],
    attendance_mode: event.attendance_mode || 'meet',
    certificate_template_url: event.certificate_template_url || null,
    archive: !!event.archive,
    source_key: event.source_key || null,
    display_date: event.display_date || null,
    image_url: event.image_url || null,
    event_type: event.event_type || null,
    wing: event.wing || null,
    location: event.location || null,
    image_width: event.image_width || null,
    image_height: event.image_height || null,
    attendee_count: event.attendee_count ?? null,
    attendee_display: event.attendee_display || null,
    is_public: !!event.is_public,
  };
  if (publish) row.published_at = new Date().toISOString();
  else if (unpublish) row.published_at = null;
  else if (event.published_at) row.published_at = event.published_at;
  const q = event.id
    ? supabase.from('events').update(row).eq('id', event.id).select('id')
    : supabase.from('events').insert(row).select('id');
  const data = unwrap(await q);
  if (!data?.length) throw new Error('This event could not be saved. Reload and try again.');
  return data[0].id;
}

export async function setEventCancelled(id, cancelled) {
  return unwrap(
    await supabase
      .from('events')
      .update({ cancelled_at: cancelled ? new Date().toISOString() : null })
      .eq('id', id)
      .select('id')
  );
}

export async function deleteEvent(id) {
  return unwrap(await supabase.rpc('soft_delete_event', { p_event_id: id, p_deleted: true }));
}

// RC house-wide drafts go live only when a Super Admin approves this request.
export const requestEventPublish = (eventId, reason) =>
  supabase
    .rpc('request_event_publish', { p_event_id: eventId, p_reason: reason || null })
    .then(unwrap);

// Event posters: sign-event-image checks the caller may manage the event and signs an upload
// into its own Cloudinary folder; the file then goes straight to Cloudinary. The saved URL uses
// the site's standard delivery transform, so img.card/thumb/full in events.js size it as usual.
export const POSTER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const POSTER_MAX_BYTES = 10 * 1024 * 1024;
const POSTER_DELIVERY = 'f_auto,q_auto:good,w_1000,c_limit';

export async function uploadEventPoster(eventId, file) {
  if (!eventId) throw new Error('Save the event as a draft before adding a poster.');
  if (!POSTER_TYPES.includes(file?.type)) throw new Error('Use a JPG, PNG or WebP image.');
  if (file.size > POSTER_MAX_BYTES) throw new Error('The image is larger than 10 MB.');
  const sig = await invoke('sign-event-image', { event_id: eventId });
  const body = new FormData();
  body.append('file', file);
  for (const k of [
    'api_key',
    'timestamp',
    'signature',
    'folder',
    'allowed_formats',
    'transformation',
  ])
    body.append(k, sig[k]);
  const res = await fetch(sig.upload_url, { method: 'POST', body });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out?.error?.message || 'Cloudinary refused the image.');
  return {
    image_url: `https://res.cloudinary.com/${sig.cloud_name}/image/upload/${POSTER_DELIVERY}/v${out.version}/${out.public_id}.${out.format}`,
    image_width: out.width,
    image_height: out.height,
  };
}

export async function uploadCertificateTemplate(eventId, file) {
  if (!eventId) throw new Error('Save the event before attaching a signed template.');
  return loungeUploadCertificateTemplate(eventId, file);
}

// Cohorts (India calendar; Q20–Q24). RPC is the live source; the local calendar matches the SQL.

function indiaYmd(at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
    .formatToParts(at)
    .reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

export function currentCohort(at = new Date()) {
  const { year, month } = indiaYmd(at);
  const term = month < 5 ? '1' : month < 9 ? '2' : '3';
  return `${String(year).slice(-2)}F${term}`;
}

export function nextCohort(at = new Date()) {
  const { year, month } = indiaYmd(at);
  const nextYear = month < 9 ? year : year + 1;
  const nextMonth = month < 5 ? 5 : month < 9 ? 9 : 1;
  return currentCohort(new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T06:00:00Z`));
}

export function cohortCalendar(at = new Date()) {
  const current = currentCohort(at);
  const next = nextCohort(at);
  const options = [];
  for (let year = 2017; year <= 2100; year += 1) {
    for (const term of [1, 2, 3]) {
      const code = `${String(year).slice(-2)}F${term}`;
      options.push(code);
      if (code === next) return { current, next, options };
    }
  }
  return { current, next, options };
}

export async function getAvailableCohorts() {
  try {
    const data = await loungeGetAvailableCohorts();
    if (data?.options?.length) return data;
  } catch {
    /* calendar below matches the SQL rollover */
  }
  return cohortCalendar();
}

export function termsForYear(year, cohorts) {
  const yy = String(year).slice(-2);
  return ['1', '2', '3'].filter((t) => cohorts.options.includes(`${yy}F${t}`)).map((t) => `F${t}`);
}

export function yearFromCohort(code) {
  const yy = Number(String(code).slice(0, 2));
  if (Number.isNaN(yy)) return null;
  return 2000 + yy;
}

// Forms use lounge.js adapters, with list and export results normalized to arrays.

export async function listForms() {
  const [forms, pending] = await Promise.all([
    loungeListForms().then(asList),
    // Head/Co-Head forms waiting for a Super Admin (RLS: the requester sees their own, Super Admins all).
    supabase
      .from('approval_requests')
      .select('id, target_form_id')
      .eq('type', 'form_publish')
      .eq('status', 'pending')
      .then(unwrap),
  ]);
  const pendingByForm = new Map(pending.map((r) => [r.target_form_id, r.id]));
  return forms.map((f) => ({ ...f, pending_request_id: pendingByForm.get(f.id) ?? null }));
}

export const saveForm = (form) => loungeSaveForm(form);

// Head/Co-Head forms go live only when a Super Admin approves this request.
export const requestFormPublish = (formId, reason) =>
  supabase
    .rpc('request_form_publish', { p_form_id: formId, p_reason: reason || null })
    .then(unwrap);

export async function exportFormResponses(formId) {
  return asList(await loungeExportFormResponses(formId));
}

// Reasons a reviewer can pick when rejecting a response; the text stays editable.
export const REJECT_REASONS = [
  "Name doesn't match your IITM ID — use your full official name",
  'Not a Sundarbans House member',
  'Wrong region for this group',
  'Answers incomplete or incorrect',
];
export const REVIEW_REASON_MAX = 500;
export const REVIEW_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };

// Approve, reject (reason required) or undo (back to pending) one response. The database checks
// that the caller manages the form. expectedAt is the version the reviewer saw, passed back
// exactly as loaded (resubmitted_at ?? submitted_at); if the member has since resent their
// answers the database refuses with code PT409.
export const reviewFormResponse = (responseId, status, expectedAt, reason = null) =>
  supabase
    .rpc('review_form_response', {
      p_response_id: responseId,
      p_status: status,
      p_expected_at: expectedAt,
      p_reason: reason,
    })
    .then(unwrap);

// Serial numbers are the arrival order the database assigned; the sort/filter views never renumber.
export function sortResponses(rows, order = 'newest') {
  const dir = order === 'oldest' ? 1 : -1;
  return [...rows].sort(
    (a, b) =>
      dir * (new Date(a.submitted_at) - new Date(b.submitted_at)) ||
      dir * ((a.serial ?? 0) - (b.serial ?? 0))
  );
}

export function formResponsesToCsv(payload) {
  const rows = asList(payload);
  const fields = [];
  const byIdentity = new Map();
  for (const row of rows) {
    for (const field of row.field_schema || []) {
      if (!field?.key) continue;
      const identity = JSON.stringify([field.key, field.label || field.key, field.type || '']);
      if (byIdentity.has(identity)) continue;
      const column = `answer:${identity}`;
      const entry = { key: field.key, identity, column, label: field.label || field.key };
      byIdentity.set(identity, entry);
      fields.push(entry);
    }
  }
  const usedLabels = new Set([
    'serial',
    'email',
    'full_name',
    'preferred_name',
    'submitted_at',
    'review_status',
    'review_reason',
    'reviewed_by',
    'reviewed_at',
  ]);
  const labelCounts = new Map();
  for (const field of fields) {
    const base = String(field.label || field.key);
    labelCounts.set(base, (labelCounts.get(base) ?? 0) + 1);
  }
  for (const field of fields) {
    const base = String(field.label || field.key);
    let label = labelCounts.get(base) > 1 || usedLabels.has(base) ? `${base} [${field.key}]` : base;
    let suffix = 2;
    while (usedLabels.has(label)) label = `${base} [${field.key}-${suffix++}]`;
    field.label = label;
    usedLabels.add(label);
  }
  const columns = [
    { key: 'serial', label: 'serial' },
    { key: 'email', label: 'email' },
    { key: 'full_name', label: 'full_name' },
    { key: 'preferred_name', label: 'preferred_name' },
    { key: 'submitted_at', label: 'submitted_at' },
    { key: 'review_status', label: 'review_status' },
    { key: 'review_reason', label: 'review_reason' },
    { key: 'reviewed_by', label: 'reviewed_by' },
    { key: 'reviewed_at', label: 'reviewed_at' },
    ...fields.map((field) => ({ key: field.column, label: field.label })),
  ];
  const csvRows = rows.map((row) => {
    const out = {
      serial: row.serial,
      email: row.email,
      full_name: row.member_full_name,
      preferred_name: row.member_preferred_name,
      submitted_at: row.submitted_at,
      review_status: row.review_status,
      review_reason: row.review_reason,
      reviewed_by: row.reviewer_name ?? row.reviewer_email,
      reviewed_at: row.reviewed_at,
    };
    for (const captured of row.field_schema || []) {
      const identity = JSON.stringify([
        captured.key,
        captured.label || captured.key,
        captured.type || '',
      ]);
      const field = byIdentity.get(identity);
      if (!field) continue;
      const value = row.answers?.[captured.key];
      out[field.column] = Array.isArray(value) ? value.join('; ') : (value ?? '');
    }
    return out;
  });
  return { columns, rows: csvRows, fields };
}

export async function listEventRegistrations(eventId) {
  return unwrap(
    await supabase
      .from('event_registrations')
      .select('event_id, member_id, registered_email, registered_at')
      .eq('event_id', eventId)
  );
}

export async function listAttendance(eventId) {
  return asList(await loungeListAttendance(eventId));
}

export const importAttendance = (
  eventId,
  rows,
  options = { mode: 'merge', sourceId: 'admin-upload' }
) => loungeImportAttendance(eventId, rows, options);

export const releaseCertificates = (eventId) => loungeReleaseCertificates(eventId);

export async function exportEventRecords(eventId) {
  return loungeExportEventRecords(eventId);
}

export function normalizeEmail(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function isMaskedEmail(value) {
  const email = normalizeEmail(value);
  return !email || /[*…]/.test(email) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export function parseDurationSeconds(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  const hms = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (hms) {
    const h = Number(hms[1]);
    const m = Number(hms[2]);
    const sec = Number(hms[3] || 0);
    if (hms[3] == null && h <= 24 && m < 60) return h * 3600 + m * 60;
    return h * 3600 + m * 60 + sec;
  }
  let total = 0;
  let matched = false;
  const hour = s.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?/);
  const min = s.match(/(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?/);
  const sec = s.match(/(\d+(?:\.\d+)?)\s*s(?:ec(?:onds?)?)?/);
  if (hour) {
    total += Number(hour[1]) * 3600;
    matched = true;
  }
  if (min) {
    total += Number(min[1]) * 60;
    matched = true;
  }
  if (sec) {
    total += Number(sec[1]);
    matched = true;
  }
  return matched ? Math.round(total) : null;
}

const MEET_HEADERS = {
  email: ['email', 'e-mail', 'email address'],
  duration: ['duration', 'duration of meeting', 'time in call'],
  first: ['first name', 'first'],
  last: ['last name', 'last'],
  joined: ['time joined', 'join time'],
  exited: ['time exited', 'leave time'],
};

export function suggestMeetMapping(headers) {
  return {
    email: headerIndex(headers, MEET_HEADERS.email),
    duration: headerIndex(headers, MEET_HEADERS.duration),
    first: headerIndex(headers, MEET_HEADERS.first),
    last: headerIndex(headers, MEET_HEADERS.last),
    joined: headerIndex(headers, MEET_HEADERS.joined),
    exited: headerIndex(headers, MEET_HEADERS.exited),
  };
}

export function previewAttendance({
  rows,
  mapping,
  registrations = [],
  mode = 'meet',
  eligibleSeconds = MEET_ELIGIBLE_SECONDS,
}) {
  if (!rows.length) {
    return { registered: [], unregistered: [], absent: [], unresolved: [], importRows: [] };
  }
  const [, ...body] = rows;
  const col = (name, line) => {
    const i = mapping[name];
    return i >= 0 ? (line[i] ?? '').trim() : '';
  };
  const registeredEmails = new Set(
    registrations.map((r) => normalizeEmail(r.registered_email || r.email)).filter(Boolean)
  );
  const seenAttend = new Set();
  const registered = [];
  const unregistered = [];
  const unresolved = [];
  const importMap = new Map();
  const unresolvedImportRows = [];

  for (const [index, line] of body.entries()) {
    const email = normalizeEmail(col('email', line));
    const duration_seconds = parseDurationSeconds(col('duration', line));
    const item = {
      email,
      duration_seconds,
      first: col('first', line),
      last: col('last', line),
      joined: col('joined', line),
      exited: col('exited', line),
    };
    if (isMaskedEmail(email)) {
      const itemRow = { ...item, eligible: false, source_row_id: String(index + 1) };
      unresolved.push(item);
      unresolvedImportRows.push(itemRow);
      continue;
    }
    const eligible =
      mode === 'reviewed' ? !!item._eligible : (duration_seconds ?? 0) >= eligibleSeconds;
    const importRow = {
      email,
      duration_seconds: duration_seconds ?? 0,
      eligible: mode === 'reviewed' ? eligible : (duration_seconds ?? 0) >= eligibleSeconds,
    };
    if (importMap.has(email)) {
      const prev = importMap.get(email);
      prev.duration_seconds += importRow.duration_seconds;
      prev.eligible = prev.eligible || importRow.eligible;
    } else importMap.set(email, importRow);
    item.eligible =
      mode === 'reviewed'
        ? eligible
        : (importMap.get(email).duration_seconds ?? 0) >= eligibleSeconds;
    seenAttend.add(email);
    if (registeredEmails.has(email)) registered.push(item);
    else unregistered.push(item);
  }

  const absent = [...registeredEmails]
    .filter((email) => !seenAttend.has(email))
    .map((email) => ({ email, duration_seconds: 0, eligible: false }));

  return {
    registered,
    unregistered,
    absent,
    unresolved,
    importRows: [...importMap.values(), ...unresolvedImportRows],
  };
}

export function applyReviewedEligibility(preview, email, eligible) {
  const row = preview.importRows.find((r) => r.email === email);
  if (row) row.eligible = eligible;
  for (const list of [preview.registered, preview.unregistered]) {
    for (const item of list) if (item.email === email) item.eligible = eligible;
  }
}

// Notices (organizer)

export async function listNoticesAdmin({ page = 0 } = {}) {
  let query = supabase
    .from('announcements')
    .select(
      'id, title, body, link, region_id, community_id, audience_cohorts, starts_at, ends_at, published_at, created_at'
    );
  if (isRc.value) query = query.eq('region_id', auth.dashboard.region_id).is('community_id', null);
  if (isHead.value)
    query = query.eq('community_id', auth.dashboard.community_id).is('region_id', null);
  return unwrap(
    await query
      .order('starts_at', { ascending: false })
      .order('id')
      .range(page * PAGE, page * PAGE + PAGE - 1)
  );
}

export const saveNotice = (notice) => loungeSaveNotice(notice);
export const deleteNotice = (id) => loungeDeleteNotice(id);
export const setNoticePublished = (id, published) => loungeSetNoticePublished(id, published);

// Student region requests (Q15) and certificate-name requests (SA)

export async function listRegionRequests() {
  return asList(await loungeListRegionRequests());
}

export const reviewRegionRequest = (id, approve, note = '') =>
  loungeReviewRegionRequest(id, approve, note);

export async function listCertificateNameRequests() {
  return asList(await loungeListCertificateNameRequests());
}

export const reviewCertificateNameRequest = (id, approve, note = '') =>
  loungeReviewCertificateNameRequest(id, approve, note);

// Approval requests

const REQUEST_COLS = `id, type, status, reason, requested_change, target_snapshot, review_note, requested_at,
  reviewed_at, requested_by, reviewed_by, target_member_id,
  target:members!approval_requests_target_member_id_fkey(full_name, preferred_name, email, member_code, region_id),
  requester:members!approval_requests_requested_by_fkey(full_name)`;

export async function listRequests({ status = 'pending' } = {}) {
  let q = supabase
    .from('approval_requests')
    .select(REQUEST_COLS)
    .order('requested_at', { ascending: false })
    .limit(100);
  q = status === 'pending' ? q.eq('status', 'pending') : q.neq('status', 'pending');
  return unwrap(await q);
}

export const approveRequest = (id, note) =>
  supabase.rpc('approve_request', { p_request_id: id, p_note: note || null }).then(unwrap);
export const rejectRequest = (id, note) =>
  supabase.rpc('reject_request', { p_request_id: id, p_note: note || null }).then(unwrap);
export const cancelRequest = (id) =>
  supabase.rpc('cancel_request', { p_request_id: id }).then(unwrap);

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error?.name === 'FunctionsFetchError')
    throw new Error('Could not reach the server. Check your connection and try again.');
  if (error) {
    let message = error.message;
    try {
      const body = await error.context?.json();
      message = body?.message ?? body?.error ?? message;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }
  return data;
}

// Sign-in access follows the member's status (an inactive member is banned in Auth).
export const syncSignInAccess = (memberId) =>
  invoke('apply-account-status', { member_id: memberId });
// A second Super Admin approves a login email change (Auth and members move together).
export const executeContactChange = (requestId, note) =>
  invoke('change-member-contact', { request_id: requestId, note: note || null });
// Permanent erasure is executed by a second Super Admin through its Edge Function.
export const executeHardDelete = (requestId) =>
  invoke('hard-delete-member', { request_id: requestId });

// Positions and audit (Super Admin)

export async function listPositions() {
  return unwrap(
    await supabase
      .from('admin_assignments')
      .select(
        'id, member_id, position, region_id, community_id, started_at, member:members!admin_assignments_member_id_fkey(id, full_name, preferred_name, email, member_code)'
      )
      .is('ended_at', null)
  );
}

// The Overview's "Recent changes" when admin_dashboard_summary is missing (older databases).
async function listRecentAudit() {
  const rows = unwrap(
    await supabase
      .from('audit_log')
      .select('id, created_at, action, target_table, target_id, result, actor_id, request_id')
      .order('created_at', { ascending: false })
      .limit(6)
  );
  const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))];
  const names = ids.length
    ? unwrap(await supabase.from('members').select('id, full_name').in('id', ids))
    : [];
  const byId = new Map(names.map((n) => [n.id, n.full_name]));
  return rows.map((r) => ({ ...r, actor: byId.get(r.actor_id) ?? null }));
}

// Super Admin activity feed, newest first. `args` come from feedArgs() in audit-actions.js;
// `cursor` is the previous page's `next` ({ at, id }) for keyset paging.
export async function listAuditFeed(args, cursor = null) {
  const data = unwrap(
    await supabase.rpc('admin_audit_feed', {
      ...args,
      p_before_at: cursor?.at ?? null,
      p_before_id: cursor?.id ?? null,
      p_limit: PAGE,
    })
  );
  return { rows: asList(data?.rows), next: data?.next ?? null };
}

function missingRpc(error) {
  return error?.code === 'PGRST202' || error?.code === '42883';
}

function decorateRequest(row, category = 'admin') {
  const own = (row.requested_by || row.member_id) === auth.profile?.id;
  const canReview =
    category === 'admin'
      ? isSuperAdmin.value
      : category === 'region'
        ? isSuperAdmin.value || isRc.value
        : isSuperAdmin.value;
  const normalized = { ...row, category, type: category === 'admin' ? row.type : category };
  if (category !== 'admin') {
    normalized.target = row.member;
    normalized.target_member_id = row.member_id;
    normalized.requested_by = row.member_id;
    normalized.requester = row.member;
    normalized.target_snapshot =
      category === 'region'
        ? { region_id: row.from_region_id }
        : { certificate_name: row.old_name };
    normalized.requested_change =
      category === 'region' ? { region_id: row.to_region_id } : { certificate_name: row.new_name };
  }
  return {
    ...normalized,
    can_decide: row.can_decide ?? (row.status === 'pending' && canReview && !own),
    waiting_on:
      row.waiting_on ?? (own && isSuperAdmin.value ? 'Another Super Admin' : 'A Super Admin'),
    age_seconds: row.age_seconds ?? Math.max(0, (Date.now() - new Date(row.requested_at)) / 1000),
  };
}

export async function loadRequestDesk({ status = 'pending', page = 0 } = {}) {
  const result = await supabase.rpc('admin_dashboard_requests', {
    p_status: status,
    p_offset: page * 100,
  });
  if (!result.error)
    return { ...result.data, rows: result.data.rows.map((r) => decorateRequest(r, r.category)) };
  if (!missingRpc(result.error)) throw result.error;
  const [admin, region, certificate] = await Promise.all([
    listRequests({ status }),
    listRegionRequests(),
    isSuperAdmin.value ? listCertificateNameRequests() : [],
  ]);
  const rows = [
    ...admin.map((r) => decorateRequest(r)),
    ...region
      .filter((r) => (status === 'pending' ? r.status === 'pending' : r.status !== 'pending'))
      .map((r) => decorateRequest(r, 'region')),
    ...certificate
      .filter((r) => (status === 'pending' ? r.status === 'pending' : r.status !== 'pending'))
      .map((r) => decorateRequest(r, 'certificate')),
  ].sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));
  return { rows: page === 0 ? rows : [], total: rows.length, legacy: true };
}

export async function loadAdminOverview() {
  const result = await supabase.rpc('admin_dashboard_summary');
  if (!result.error) return result.data;
  if (!missingRpc(result.error)) throw result.error;
  const membersVisible = isSuperAdmin.value || isRc.value;
  const now = Date.now();
  const [counts, events, forms, notices, requests, audit] = await Promise.all([
    membersVisible ? loadCounts() : null,
    listEvents(),
    listForms(),
    membersVisible ? listNoticesAdmin() : [],
    membersVisible ? loadRequestDesk() : { rows: [] },
    isSuperAdmin.value ? listRecentAudit() : [],
  ]);
  return {
    legacy: true,
    counts,
    queue: {
      for_you: requests.rows.filter((r) => r.can_decide).length,
      waiting: requests.rows.filter((r) => !r.can_decide).length,
    },
    requests: requests.rows,
    events: events
      .filter(
        (event) =>
          canManageEvent(event) &&
          event.published_at &&
          new Date(event.published_at).getTime() <= now &&
          new Date(event.ends_at).getTime() > now &&
          !event.cancelled_at &&
          !event.archive
      )
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
      .slice(0, 5),
    forms: forms
      .filter(
        (f) =>
          f.can_manage &&
          !f.archived_at &&
          f.is_open &&
          f.published_at &&
          new Date(f.published_at).getTime() <= now &&
          (!f.opens_at || new Date(f.opens_at).getTime() <= now) &&
          (!f.closes_at || new Date(f.closes_at).getTime() > now)
      )
      .sort((a, b) => (a.closes_at || '\uffff').localeCompare(b.closes_at || '\uffff'))
      .slice(0, 4),
    notices: notices
      .filter(
        (n) =>
          new Date(n.starts_at) <= new Date() && (!n.ends_at || new Date(n.ends_at) > new Date())
      )
      .slice(0, 4),
    audit: audit.slice(0, 6),
    regions: [],
    joins: [],
  };
}

<!-- Events in the organizer's scope. RCs own their region and may draft house-wide events, which a
     Super Admin publishes (event_publish request); Heads/Co-Heads own their community; Super Admins
     manage house, any region, and any community. Save keeps a draft; Publish sets published_at.
     "Public" lists an upcoming event on the public Events page. Posters upload to Cloudinary. -->
<template>
  <div>
    <div class="adm-toolbar between">
      <div class="adm-chips" role="group" aria-label="Which events">
        <button
          type="button"
          class="adm-chip"
          :class="{ on: view === 'upcoming' }"
          @click="show('upcoming')"
        >
          Upcoming
        </button>
        <button
          type="button"
          class="adm-chip"
          :class="{ on: view === 'drafts' }"
          @click="show('drafts')"
        >
          Drafts
        </button>
        <button
          type="button"
          class="adm-chip"
          :class="{ on: view === 'past' }"
          @click="show('past')"
        >
          Past
        </button>
      </div>
      <button type="button" class="adm-btn mari" @click="edit()">New event</button>
    </div>

    <p v-if="error" class="adm-msg err" role="alert">{{ error }}</p>
    <p v-if="notice" class="adm-msg ok" role="status">{{ notice }}</p>

    <ul v-if="events.length" class="adm-list">
      <li v-for="e in events" :key="e.id" class="adm-row">
        <div>
          <b>{{ e.name }}</b>
          <div class="adm-meta">
            <span class="mono">{{ when(e) }}</span>
            <span>{{ scopeOf(e) }}</span>
            <span v-if="e.pending_request_id" class="adm-badge mari">waiting for approval</span>
            <span v-else-if="!e.published_at" class="adm-badge">draft</span>
            <span v-else-if="e.archive" class="adm-badge">archive</span>
            <span v-else-if="e.cancelled_at" class="adm-badge verm">cancelled</span>
            <span v-else-if="isLive(e)" class="adm-badge mari">live now</span>
            <span v-if="e.certificates_released_at" class="adm-badge mari">certificates</span>
            <span v-if="e.is_public && !e.archive" class="adm-badge">public</span>
            <span v-if="e.entry_mode === 'open'" class="adm-badge">open to all</span>
          </div>
        </div>
        <div class="adm-chips">
          <button
            v-if="e.pending_request_id && !isSuperAdmin"
            type="button"
            class="adm-btn danger small"
            :disabled="busy"
            @click="cancelPublish(e)"
          >
            Cancel request
          </button>
          <template v-else-if="canManageEvent(e)">
            <button type="button" class="adm-btn ghost small" @click="edit(e)">Edit</button>
            <button type="button" class="adm-btn ghost small" @click="openOps(e)">
              Attendance
            </button>
            <button
              type="button"
              :class="['adm-btn', 'small', e.cancelled_at ? 'ghost' : 'danger']"
              :disabled="busy"
              @click="toggleCancel(e)"
            >
              {{ e.cancelled_at ? 'Restore' : 'Cancel' }}
            </button>
            <button type="button" class="adm-btn danger small" :disabled="busy" @click="remove(e)">
              Remove
            </button>
          </template>
        </div>
      </li>
    </ul>
    <p v-else-if="!loading" class="adm-empty">
      {{
        view === 'drafts'
          ? 'No drafts.'
          : view === 'past'
            ? 'No past events yet.'
            : 'Nothing planned. Add the next event.'
      }}
    </p>

    <AdminDialog
      v-if="form"
      ref="dlg"
      wide
      :title="form.id ? 'Edit event' : 'New event'"
      @close="form = null"
    >
      <form class="adm-form" @submit.prevent="save(false)">
        <label class="adm-field wide">
          <span>Name</span>
          <input
            ref="nameInput"
            v-model.trim="form.name"
            class="adm-input"
            required
            maxlength="200"
          />
        </label>
        <label v-if="isSuperAdmin" class="adm-field">
          <span>Scope</span>
          <AdminSelect v-model="form.scope" :options="SA_SCOPES" @change="onScope" />
        </label>
        <label v-if="isSuperAdmin && form.scope === 'region'" class="adm-field">
          <span>Region</span>
          <AdminSelect
            v-model="form.region_id"
            :options="lookups.regions"
            value-key="id"
            label-key="name"
          />
        </label>
        <label v-if="isSuperAdmin && form.scope === 'community'" class="adm-field">
          <span>Community</span>
          <AdminSelect
            v-model="form.community_id"
            :options="lookups.communities"
            value-key="id"
            label-key="name"
          />
          <small v-if="membersOnlyAudience(lookups, form.community_id)"
            >{{ membersOnlyAudience(lookups, form.community_id) }} see it.</small
          >
        </label>
        <label v-else-if="isRc && !form.published_at" class="adm-field">
          <span>Scope</span>
          <AdminSelect v-model="form.scope" :options="rcScopes" />
          <small v-if="form.scope === 'house'">A Super Admin approves house-wide events.</small>
        </label>
        <p v-else-if="!isSuperAdmin" class="adm-note wide">{{ lockedScope }}</p>
        <label class="adm-field">
          <span>Starts</span>
          <input
            v-model="form.starts"
            class="adm-input"
            type="datetime-local"
            :required="!form.archive"
          />
        </label>
        <label class="adm-field">
          <span>Ends</span>
          <input
            v-model="form.ends"
            class="adm-input"
            type="datetime-local"
            :required="!form.archive"
          />
        </label>
        <label v-if="isSuperAdmin" class="adm-check wide" :class="{ danger: form.archive }">
          <input v-model="form.archive" type="checkbox" />
          <span>Archive (dateless historical record)</span>
        </label>
        <div class="wide">
          <p class="adm-kicker">Audience</p>
          <AdminCohortSelect v-if="cohorts" v-model="form.audience_cohorts" :cohorts="cohorts" />
        </div>
        <div v-if="!form.archive && !membersOnlyEvent" class="adm-field wide">
          <label class="adm-check">
            <input v-model="form.is_public" type="checkbox" />
            <span>Public: also list it on the public Events page</span>
          </label>
          <small>Otherwise only its audience sees it in the Lounge until it ends.</small>
        </div>
        <label class="adm-field wide">
          <span>How members attend</span>
          <AdminSelect v-model="form.entry_mode" :options="ENTRY_MODES" />
          <small v-if="form.entry_mode === 'open'">
            Members join when it starts. No registration form. The Meet link stays in the Lounge.
          </small>
          <small v-else>Link a form under Forms. Certificates need that registration.</small>
        </label>
        <div class="adm-field wide">
          <span>Poster</span>
          <div class="poster">
            <img
              v-if="form.image_url"
              :src="posterPreview(form.image_url)"
              alt="Event poster"
              width="96"
              height="96"
            />
            <div class="poster-acts">
              <label
                class="adm-drop"
                :class="{ over: dragging, busy: posterBusy }"
                @dragenter.prevent="dragging = true"
                @dragover.prevent
                @dragleave="dragging = false"
                @drop.prevent="onPosterDrop"
              >
                <input
                  class="adm-pick-input"
                  type="file"
                  :accept="POSTER_TYPES.join(',')"
                  aria-label="Upload poster"
                  :disabled="busy"
                  @click="needName"
                  @change="onPoster"
                />
                <LineIcon name="upload" class="adm-drop-icon" />
                <span class="adm-drop-title">{{
                  form.image_url ? 'Replace poster' : 'Choose a poster image'
                }}</span>
                <span class="adm-drop-sub">{{ posterStatus }}</span>
              </label>
              <small>
                JPG, PNG or WebP, up to 10 MB. You can also drop the file onto the box.<template
                  v-if="!form.id"
                >
                  Adding one saves this event as a draft.</template
                >
              </small>
              <p v-if="posterBusy" class="adm-note" role="status">Uploading the poster…</p>
              <button
                v-if="form.image_url"
                type="button"
                class="adm-btn danger small"
                @click="clearPoster"
              >
                Remove poster
              </button>
            </div>
          </div>
        </div>
        <label class="adm-field wide">
          <span>Description</span>
          <textarea v-model.trim="form.description" class="adm-input" maxlength="4000" />
        </label>
        <p v-if="form.entry_mode === 'open'" class="adm-note wide">
          Open sessions have no registration form, so they don't issue certificates.
        </p>
        <p v-else class="adm-kicker wide certs-h">Certificates (optional)</p>
        <label v-if="form.entry_mode !== 'open'" class="adm-field">
          <span>Attendance</span>
          <AdminSelect
            v-model="form.attendance_mode"
            :options="ATTENDANCE_MODES"
            :disabled="!!form.certificates_released_at"
          />
        </label>
        <label v-if="form.entry_mode !== 'open'" class="adm-field wide">
          <span>Certificate template URL</span>
          <input
            v-model.trim="form.certificate_template_url"
            class="adm-input"
            type="url"
            placeholder="https://…"
            :disabled="!!form.certificates_released_at"
          />
          <small>
            The blank, signed certificate design used for participation certificates. Not the event
            poster.
          </small>
        </label>
        <div
          v-if="form.entry_mode !== 'open' && form.id && !form.certificates_released_at"
          class="adm-field wide"
        >
          <span>Or upload a certificate template (not the poster)</span>
          <label
            class="adm-drop"
            :class="{ over: templateDragging, busy: templateBusy }"
            @dragenter.prevent="templateDragging = true"
            @dragover.prevent
            @dragleave="templateDragging = false"
            @drop.prevent="onTemplateDrop"
          >
            <input
              class="adm-pick-input"
              type="file"
              :accept="TEMPLATE_TYPES.join(',')"
              aria-label="Upload certificate template"
              :disabled="busy"
              @change="onTemplate"
            />
            <LineIcon name="upload" class="adm-drop-icon" />
            <span class="adm-drop-title">{{
              form.certificate_template_url ? 'Replace template' : 'Choose a template image'
            }}</span>
            <span class="adm-drop-sub">{{ templateStatus }}</span>
          </label>
          <small>PNG, JPG or WebP, up to 10 MB. You can also drop the file onto the box.</small>
        </div>
        <label class="adm-field wide">
          <span>{{
            form.entry_mode === 'open'
              ? "Members' meeting link"
              : "Members' meeting link (optional)"
          }}</span>
          <input
            v-model.trim="form.gmail_link"
            class="adm-input"
            type="url"
            placeholder="https://meet.google.com/…"
          />
          <small v-if="form.entry_mode === 'open'">
            Members see this in the Lounge when the session goes live. Public visitors do not.
          </small>
        </label>
        <template v-if="isSuperAdmin && form.archive">
          <label class="adm-field">
            <span>Display date</span>
            <input v-model.trim="form.display_date" class="adm-input" maxlength="200" />
          </label>
          <label class="adm-field">
            <span>Location</span>
            <input v-model.trim="form.location" class="adm-input" maxlength="500" />
          </label>
        </template>
        <p v-if="formError" class="adm-msg err wide" role="alert">{{ formError }}</p>
        <p v-if="form.published_at" class="adm-note wide">
          Saving changes updates this published record immediately.
        </p>
        <div class="wide adm-actions">
          <button type="submit" class="adm-btn ghost" :disabled="busy">
            {{ form.published_at ? 'Save changes' : 'Save draft' }}
          </button>
          <button
            v-if="form.published_at"
            type="button"
            class="adm-btn danger"
            :disabled="busy"
            @click="save('unpublish')"
          >
            Unpublish
          </button>
          <button type="button" class="adm-btn mari" :disabled="busy" @click="save('publish')">
            {{ needsApproval ? 'Ask a Super Admin to publish' : 'Publish' }}
          </button>
        </div>
      </form>
    </AdminDialog>

    <AdminDialog
      v-if="ops"
      ref="opsDlg"
      wide
      title="Attendance and certificates"
      @close="ops = null"
    >
      <div class="adm-stack">
        <p class="adm-note">
          {{ ops.name }} · {{ ops.attendance_mode === 'meet' ? 'Google Meet' : 'Reviewed' }}
        </p>
        <div class="adm-field">
          <span>Attendance CSV</span>
          <label
            class="adm-drop"
            :class="{ over: attendDragging }"
            @dragenter.prevent="attendDragging = true"
            @dragover.prevent
            @dragleave="attendDragging = false"
            @drop.prevent="onAttendDrop"
          >
            <input
              class="adm-pick-input"
              type="file"
              accept=".csv,text/csv"
              aria-label="Upload attendance CSV"
              @change="onAttendFile"
            />
            <LineIcon name="upload" class="adm-drop-icon" />
            <span class="adm-drop-title">{{
              attendFile ? 'Replace CSV' : 'Choose a CSV file'
            }}</span>
            <span class="adm-drop-sub">{{ attendFile || 'No file chosen' }}</span>
          </label>
          <small>
            Google Meet headers: First name, Last name, Email, Duration. Masked emails stay
            unresolved. Save only after you have reviewed the lists.
          </small>
        </div>
        <label class="adm-field">
          <span>Import behavior</span>
          <AdminSelect v-model="attendanceMode" :options="IMPORT_MODES" />
        </label>
        <label class="adm-field">
          <span>Source name</span>
          <input v-model.trim="attendanceSource" class="adm-input" maxlength="120" />
          <small>Replace affects only rows previously imported under this exact name.</small>
        </label>
        <template v-if="attend.headers.length">
          <label class="adm-field">
            <span>Email column</span>
            <AdminSelect v-model="attend.mapping.email" :options="columnOptions" />
          </label>
          <label v-if="ops.attendance_mode === 'meet'" class="adm-field">
            <span>Duration column</span>
            <AdminSelect v-model="attend.mapping.duration" :options="columnOptions" />
          </label>
        </template>
        <p v-if="preview" class="adm-note">
          {{ preview.registered.length }} registered and attended ·
          {{ preview.unregistered.length }} unregistered · {{ preview.absent.length }} registered
          absent · {{ preview.unresolved.length }} unresolved
        </p>
        <p v-if="preview && attendanceMode === 'replace'" class="adm-note">
          Preview: {{ replaceDelta }} omitted row{{ replaceDelta === 1 ? '' : 's' }} will lose this
          source's ownership. Rows owned by another source remain.
        </p>
        <div v-if="preview" class="adm-table-wrap">
          <table class="adm-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Email</th>
                <th>Duration</th>
                <th v-if="ops.attendance_mode === 'reviewed'">Eligible</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in previewRows" :key="row.email + row.cat + (row.source_row_id || '')">
                <td>{{ row.cat }}</td>
                <td class="mono">{{ row.email || '–' }}</td>
                <td class="mono">{{ row.duration_seconds ?? '–' }}</td>
                <td v-if="ops.attendance_mode === 'reviewed'">
                  <input
                    type="checkbox"
                    :checked="row.eligible"
                    :disabled="row.cat !== 'registered'"
                    @change="markEligible(row.email, $event.target.checked)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="opsError" class="adm-msg err" role="alert">{{ opsError }}</p>
        <p v-if="opsNotice" class="adm-msg ok" role="status">{{ opsNotice }}</p>
        <div class="adm-actions">
          <button
            type="button"
            class="adm-btn ghost"
            :disabled="busy || !preview"
            @click="saveAttendance"
          >
            Save attendance
          </button>
          <button type="button" class="adm-btn ghost" :disabled="busy" @click="downloadRecords">
            Download records
          </button>
          <button
            v-if="ops.entry_mode !== 'open'"
            type="button"
            class="adm-btn mari"
            :disabled="busy"
            @click="release"
          >
            Release certificates
          </button>
        </div>
      </div>
    </AdminDialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import LineIcon from '../site/LineIcon.vue';
import AdminDialog from './AdminDialog.vue';
import AdminSelect from './AdminSelect.vue';
import { askConfirm } from '../../lib/admin-confirm.js';
import AdminCohortSelect from './AdminCohortSelect.vue';
import { auth, errorText, isRc, isSuperAdmin } from '../../lib/auth.js';
import {
  applyReviewedEligibility,
  POSTER_MAX_BYTES,
  POSTER_TYPES,
  TEMPLATE_MAX_BYTES,
  TEMPLATE_TYPES,
  canManageEvent,
  cancelRequest,
  deleteEvent,
  downloadCsv,
  exportEventRecords,
  flattenExportRows,
  getAvailableCohorts,
  importAttendance,
  isMaskedEmail,
  listEventRegistrations,
  listAttendance,
  listEvents,
  membersOnlyAudience,
  normalizeEmail,
  parseCsv,
  previewAttendance,
  releaseCertificates,
  saveEvent,
  requestEventPublish,
  setEventCancelled,
  suggestMeetMapping,
  uploadCertificateTemplate,
  uploadEventPoster,
} from '../../lib/admin.js';
import { img } from '../../lib/events.js';

const props = defineProps({
  lookups: { type: Object, required: true },
  initialId: { type: String, default: null },
});
const emit = defineEmits(['changed']);

const view = ref('upcoming');
const events = ref([]);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const notice = ref('');
const form = ref(null);
const formError = ref('');
const dlg = ref(null);
const opsDlg = ref(null);
const cohorts = ref(null);
const ops = ref(null);
const opsError = ref('');
const opsNotice = ref('');
const preview = ref(null);
const existingAttendance = ref([]);
const attendanceMode = ref('merge');
const attendanceSource = ref('attendance-sheet-1');
const replaceDelta = computed(() => {
  const sourceId = attendanceSource.value.trim();
  const keys = new Set(
    (preview.value?.importRows ?? []).map((row) =>
      row.email && !isMaskedEmail(normalizeEmail(row.email))
        ? normalizeEmail(row.email)
        : `unresolved:${sourceId}:${row.source_row_id}`
    )
  );
  return existingAttendance.value.filter(
    (row) =>
      (row.import_sources ?? [row.import_source]).includes(sourceId) && !keys.has(row.row_key)
  ).length;
});
const attendFile = ref('');
const attendDragging = ref(false);
const attend = reactive({
  headers: [],
  rows: [],
  mapping: { email: -1, duration: -1, first: -1, last: -1 },
});

const lockedScope = computed(() => {
  if (isRc.value) {
    const name = props.lookups.regions.find((r) => r.id === auth.dashboard?.region_id)?.name;
    return `This event belongs to ${name || 'your region'}.`;
  }
  const name = props.lookups.communities.find((c) => c.id === auth.dashboard?.community_id)?.name;
  const only = membersOnlyAudience(props.lookups, auth.dashboard?.community_id);
  return `This event belongs to the ${name || 'your'} community.${only ? ` ${only} see it.` : ''}`;
});

const myRegionName = computed(
  () => props.lookups.regions.find((r) => r.id === auth.dashboard?.region_id)?.name ?? 'your region'
);
const SA_SCOPES = [
  { value: 'house', label: 'House (every region)' },
  { value: 'region', label: 'A region' },
  { value: 'community', label: 'A community' },
];
const rcScopes = computed(() => [
  { value: 'region', label: `My region (${myRegionName.value})` },
  { value: 'house', label: 'Whole house' },
]);
const ATTENDANCE_MODES = [
  { value: 'meet', label: 'Google Meet (≥20 minutes)' },
  { value: 'reviewed', label: 'Reviewed list' },
];
const ENTRY_MODES = [
  { value: 'register', label: 'Register on a form' },
  { value: 'open', label: 'Open to all — no form' },
];
const IMPORT_MODES = [
  { value: 'merge', label: 'Merge; keep omitted rows' },
  { value: 'replace', label: 'Replace one named source' },
];
// Which file column holds a field: -1 means the file has none.
const columnOptions = computed(() => [
  { value: -1, label: 'Not in this file' },
  ...attend.headers.map((h, i) => ({ value: i, label: h })),
]);
// An RC publishing a house-wide event files a request instead.
const needsApproval = computed(
  () =>
    isRc.value && !isSuperAdmin.value && form.value?.scope === 'house' && !form.value?.published_at
);
const posterPreview = (url) => img.thumb(url) ?? url;

const scopeOf = (e) => {
  if (e.community_id)
    return `${props.lookups.communities.find((c) => c.id === e.community_id)?.name ?? ''} community${membersOnlyAudience(props.lookups, e.community_id) ? ' · members only' : ''}`;
  if (e.region_id) return props.lookups.regions.find((r) => r.id === e.region_id)?.name ?? 'Region';
  return 'House-wide';
};
const isLive = (e) =>
  e.starts_at &&
  e.ends_at &&
  new Date(e.starts_at) <= new Date() &&
  new Date() < new Date(e.ends_at);
const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '–';
const when = (e) =>
  e.archive && e.display_date ? e.display_date : `${fmt(e.starts_at)} – ${fmt(e.ends_at)}`;
const toLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocal = (v) => (v ? new Date(v).toISOString() : null);

const previewRows = computed(() => {
  if (!preview.value) return [];
  return [
    ...preview.value.registered.map((r) => ({ ...r, cat: 'registered' })),
    ...preview.value.unregistered.map((r) => ({ ...r, cat: 'unregistered' })),
    ...preview.value.absent.map((r) => ({ ...r, cat: 'absent' })),
    ...preview.value.unresolved.map((r) => ({ ...r, cat: 'unresolved' })),
  ];
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    events.value = (await listEvents({ view: view.value })).filter(canManageEvent);
  } catch (e) {
    error.value = errorText(e);
  } finally {
    loading.value = false;
  }
}
onMounted(async () => {
  try {
    cohorts.value = await getAvailableCohorts();
  } catch (e) {
    error.value = errorText(e);
  }
  await load();
  const row = events.value.find((r) => r.id === props.initialId);
  if (row) edit(row);
});

function show(v) {
  view.value = v;
  load();
}

function defaultScope() {
  if (isSuperAdmin.value) return { scope: 'house', region_id: null, community_id: null };
  if (isRc.value)
    return { scope: 'region', region_id: auth.dashboard.region_id, community_id: null };
  return { scope: 'community', region_id: null, community_id: auth.dashboard.community_id };
}

defineExpose({
  create: () => edit(),
  openRecord: async (id) => {
    await load();
    const row = events.value.find((r) => r.id === id);
    if (row) edit(row);
  },
});

function edit(e) {
  formError.value = '';
  const start = new Date(Date.now() + 864e5);
  start.setMinutes(0, 0, 0);
  if (e) {
    form.value = {
      ...e,
      starts: toLocal(e.starts_at),
      ends: toLocal(e.ends_at),
      description: e.description ?? '',
      audience_cohorts: e.audience_cohorts ?? [],
      attendance_mode: e.attendance_mode || 'meet',
      certificate_template_url: e.certificate_template_url ?? '',
      scope: e.community_id ? 'community' : e.region_id ? 'region' : 'house',
      archive: !!e.archive,
      is_public: !!e.is_public,
      entry_mode: e.entry_mode === 'open' ? 'open' : 'register',
    };
  } else {
    form.value = {
      name: '',
      description: '',
      starts: toLocal(start),
      ends: toLocal(new Date(start.getTime() + 36e5)),
      audience_cohorts: [],
      attendance_mode: 'meet',
      entry_mode: 'register',
      certificate_template_url: '',
      archive: false,
      is_public: false,
      gmail_link: '',
      registration_link: '',
      ...defaultScope(),
    };
  }
}

function onScope() {
  if (form.value.scope === 'house') {
    form.value.region_id = null;
    form.value.community_id = null;
  } else if (form.value.scope === 'region') {
    form.value.community_id = null;
    form.value.region_id ??= props.lookups.regions[0]?.id;
  } else {
    form.value.region_id = null;
    form.value.community_id ??= props.lookups.communities[0]?.id;
  }
}

function payload() {
  const rcHouse = isRc.value && !isSuperAdmin.value && form.value.scope === 'house';
  const scope = isSuperAdmin.value || rcHouse ? form.value : { ...form.value, ...defaultScope() };
  const communityId = scope.scope === 'community' ? scope.community_id : null;
  return {
    ...scope,
    starts_at: fromLocal(form.value.starts),
    ends_at: fromLocal(form.value.ends),
    region_id: scope.scope === 'region' ? scope.region_id : null,
    community_id: communityId,
    is_public: !!scope.is_public && !membersOnlyAudience(props.lookups, communityId),
  };
}

// A members-only community's events never go on the public Events page (the database rejects it).
const membersOnlyEvent = computed(
  () => !!membersOnlyAudience(props.lookups, payload().community_id)
);

function friendly(e) {
  const m = e?.message ?? '';
  if (/events_period/.test(m)) return 'The event has to end after it starts.';
  if (/_https/.test(m)) return 'Links must start with https://';
  if (/events_name_length/.test(m)) return 'Give the event a name (up to 200 characters).';
  if (/cohort/.test(m))
    return 'Choose only available cohorts, including at most the next future one.';
  if (/events_image_cloudinary/.test(m)) return 'Posters must be uploaded here.';
  if (/Open sessions do not take a registration form/.test(m))
    return 'Open sessions do not take a registration form.';
  if (/Remove the registration form before making this an open session/.test(m))
    return 'Remove the registration form before making this an open session.';
  if (/waiting for/.test(m))
    return 'This event is waiting for a Super Admin; cancel the request to edit it.';
  if (e?.code === '42501') return 'You cannot change this event.';
  return errorText(e);
}

async function save(mode) {
  const meet = (form.value.gmail_link || '').trim();
  if (
    form.value.entry_mode === 'open' &&
    (mode === 'publish' || (form.value.published_at && mode !== 'unpublish')) &&
    !/^https:\/\//i.test(meet)
  ) {
    formError.value = 'Open sessions need a meeting link that starts with https://';
    return;
  }
  if (
    mode === 'unpublish' &&
    !(await askConfirm({
      title: 'Unpublish this event?',
      message: 'It goes back to a draft and disappears for members until you publish it again.',
      confirmLabel: 'Unpublish',
      danger: true,
    }))
  )
    return;
  busy.value = true;
  formError.value = '';
  try {
    if (mode === 'publish' && needsApproval.value) {
      const id = await saveEvent(payload());
      await requestEventPublish(id);
      notice.value = 'Sent to a Super Admin. The event goes live once they approve it.';
    } else {
      await saveEvent(payload(), {
        publish: mode === 'publish',
        unpublish: mode === 'unpublish',
      });
    }
    dlg.value?.close();
    await load();
    emit('changed');
  } catch (e) {
    formError.value = friendly(e);
  } finally {
    busy.value = false;
  }
}

const posterBusy = ref(false);
const posterName = ref('');
const dragging = ref(false);
const nameInput = ref(null);
const posterStatus = computed(() => {
  if (posterBusy.value) return `Uploading ${posterName.value}…`;
  if (!form.value?.name) return 'Add the event name first, then choose a file.';
  if (form.value?.image_url) return posterName.value || 'Poster saved';
  return 'No file chosen';
});
// Without a name the poster cannot be saved yet: send the cursor to the name instead of
// opening a file dialog that would then do nothing.
function needName(ev) {
  if (form.value?.name) return;
  ev.preventDefault();
  nameInput.value?.focus();
}
async function onPoster(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  await sendPoster(file);
}
function onPosterDrop(ev) {
  dragging.value = false;
  if (!form.value?.name) {
    nameInput.value?.focus();
    return;
  }
  sendPoster(ev.dataTransfer?.files?.[0]);
}
async function sendPoster(file) {
  if (!file || !form.value) return;
  if (!POSTER_TYPES.includes(file.type)) {
    formError.value = 'Use a JPG, PNG or WebP image.';
    return;
  }
  if (file.size > POSTER_MAX_BYTES) {
    formError.value = 'The image is larger than 10 MB.';
    return;
  }
  posterName.value = file.name;
  formError.value = '';
  busy.value = posterBusy.value = true;
  try {
    // A poster belongs to a saved event: save the draft first if this is a new one.
    if (!form.value.id) form.value.id = await saveEvent(payload());
    Object.assign(form.value, await uploadEventPoster(form.value.id, file));
    await saveEvent(payload());
  } catch (e) {
    formError.value = friendly(e);
  } finally {
    busy.value = posterBusy.value = false;
  }
}

function clearPoster() {
  Object.assign(form.value, { image_url: null, image_width: null, image_height: null });
}

const cancelPublish = (e) => act(() => cancelRequest(e.pending_request_id));

const templateBusy = ref(false);
const templateDragging = ref(false);
const templateStatus = computed(() => {
  if (templateBusy.value) return 'Uploading…';
  return form.value?.certificate_template_url ? 'Template saved' : 'No file chosen';
});
function onTemplate(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  sendTemplate(file);
}
function onTemplateDrop(ev) {
  templateDragging.value = false;
  sendTemplate(ev.dataTransfer?.files?.[0]);
}
async function sendTemplate(file) {
  if (!file || !form.value?.id) return;
  if (!TEMPLATE_TYPES.includes(file.type)) {
    formError.value = 'Use a PNG, JPG or WebP image.';
    return;
  }
  if (file.size > TEMPLATE_MAX_BYTES) {
    formError.value = 'The image is larger than 10 MB.';
    return;
  }
  formError.value = '';
  busy.value = templateBusy.value = true;
  try {
    form.value.certificate_template_url = await uploadCertificateTemplate(form.value.id, file);
  } catch (e) {
    formError.value = errorText(e);
  } finally {
    busy.value = templateBusy.value = false;
  }
}

async function act(run) {
  busy.value = true;
  error.value = '';
  try {
    await run();
    await load();
    emit('changed');
  } catch (e) {
    error.value = friendly(e);
  } finally {
    busy.value = false;
  }
}
const toggleCancel = (e) => act(() => setEventCancelled(e.id, !e.cancelled_at));
const remove = async (e) => {
  const yes = await askConfirm({
    title: `Remove “${e.name}”?`,
    message: 'Members will no longer see this event.',
    confirmLabel: 'Remove event',
    danger: true,
  });
  if (yes) act(() => deleteEvent(e.id));
};

async function openOps(e) {
  ops.value = e;
  opsError.value = '';
  opsNotice.value = '';
  preview.value = null;
  attend.headers = [];
  attend.rows = [];
  attendFile.value = '';
  try {
    existingAttendance.value = await listAttendance(e.id);
  } catch (error) {
    existingAttendance.value = [];
    opsError.value = errorText(error);
  }
}

function onAttendFile(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  readAttendance(file);
}
function onAttendDrop(ev) {
  attendDragging.value = false;
  readAttendance(ev.dataTransfer?.files?.[0]);
}
function readAttendance(file) {
  preview.value = null;
  if (!file || !ops.value) return;
  if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
    opsError.value = 'Use a CSV file.';
    return;
  }
  opsError.value = '';
  attendFile.value = file.name;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const rows = parseCsv(String(reader.result || ''));
      attend.rows = rows;
      attend.headers = rows[0] ?? [];
      attendanceSource.value =
        file.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'attendance-upload';
      Object.assign(attend.mapping, suggestMeetMapping(attend.headers));
      const registrations = await listEventRegistrations(ops.value.id);
      preview.value = previewAttendance({
        rows,
        mapping: attend.mapping,
        registrations,
        mode: ops.value.attendance_mode,
      });
    } catch (e) {
      opsError.value = errorText(e);
    }
  };
  reader.readAsText(file);
}

function markEligible(email, eligible) {
  if (!preview.value) return;
  applyReviewedEligibility(preview.value, email, eligible);
}

async function saveAttendance() {
  if (!preview.value || !ops.value) return;
  if (!attendanceSource.value.trim()) {
    opsError.value = 'Enter a source name before importing.';
    return;
  }
  if (
    attendanceMode.value === 'replace' &&
    !(await askConfirm({
      title: `Replace “${attendanceSource.value.trim()}”?`,
      message: `${replaceDelta.value} omitted row${replaceDelta.value === 1 ? '' : 's'} will lose this source's ownership. Rows owned by other sources stay.`,
      confirmLabel: 'Replace',
    }))
  )
    return;
  busy.value = true;
  opsError.value = '';
  opsNotice.value = '';
  try {
    const result = await importAttendance(ops.value.id, preview.value.importRows, {
      mode: attendanceMode.value,
      sourceId: attendanceSource.value.trim(),
    });
    opsNotice.value = `Saved. ${result.matched ?? 0} registered, ${result.unregistered ?? 0} unregistered, ${result.unresolved ?? 0} unresolved.`;
  } catch (e) {
    opsError.value = errorText(e);
  } finally {
    busy.value = false;
  }
}

async function downloadRecords() {
  if (!ops.value) return;
  busy.value = true;
  opsError.value = '';
  try {
    const data = await exportEventRecords(ops.value.id);
    downloadCsv(`${ops.value.name}-records.csv`, flattenExportRows(data));
  } catch (e) {
    opsError.value = errorText(e);
  } finally {
    busy.value = false;
  }
}

async function release() {
  if (!ops.value || ops.value.entry_mode === 'open') return;
  const yes = await askConfirm({
    title: 'Release certificates?',
    message:
      'Certificates are issued to every student the saved attendance marks as eligible. Save the attendance first if you have a newer list.',
    confirmLabel: 'Release',
  });
  if (!yes) return;
  busy.value = true;
  opsError.value = '';
  opsNotice.value = '';
  try {
    const result = await releaseCertificates(ops.value.id);
    opsNotice.value = `Released ${result.issued ?? 0} certificate${result.issued === 1 ? '' : 's'}. ${result.pending_names ?? 0} still need to confirm a certificate name.`;
    emit('changed');
  } catch (e) {
    opsError.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.certs-h {
  margin: 10px 0 -4px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
.poster {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.poster img {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  object-fit: cover;
  background: var(--sunk);
  border: 1px solid var(--line);
}
.poster-acts {
  display: grid;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
  justify-items: start;
}
.between {
  justify-content: space-between;
  align-items: center;
}
</style>

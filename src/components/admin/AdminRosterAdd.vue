<!-- Add students to the roster before their first Google sign-in: one, pasted from Sheets, or a
     CSV. An RC adds to their own region; Super Admins choose the region, or leave it empty. -->
<template>
  <AdminDialog title="Add students" wide @close="emit('close')">
    <div class="adm-chips add-modes">
      <button
        v-for="item in addModes"
        :key="item.id"
        class="adm-chip"
        :class="{ on: addMode === item.id }"
        @click="addMode = item.id"
      >
        {{ item.label }}
      </button>
    </div>
    <form v-if="addMode === 'one'" class="adm-form" @submit.prevent="addOne">
      <p class="adm-kicker wide">Add a student</p>
      <label class="adm-field wide">
        <span>IITM email</span>
        <input
          v-model.trim="one.email"
          class="adm-input"
          type="email"
          required
          placeholder="21f1000000@ds.study.iitm.ac.in"
        />
        <small>Use an IITM student email from ds, es, mg or ae.study.iitm.ac.in.</small>
      </label>
      <label class="adm-field wide">
        <span>Full name</span>
        <input v-model.trim="one.full_name" class="adm-input" maxlength="200" />
        <small>Leave blank if the full name is unknown.</small>
      </label>
      <label class="adm-field">
        <span>Phone (optional)</span>
        <input
          v-model.trim="one.phone"
          class="adm-input"
          inputmode="tel"
          placeholder="+919876543210"
        />
      </label>
      <label class="adm-field">
        <span>Gender (optional)</span>
        <AdminSelect v-model="one.gender" :options="GENDER_OPTIONS" />
      </label>
      <label v-if="isSuperAdmin" class="adm-field wide">
        <span>Region</span>
        <AdminSelect
          v-model="one.region_id"
          :options="[{ id: null, name: 'Not allocated yet' }, ...lookups.regions]"
          value-key="id"
          label-key="name"
        />
      </label>
      <p v-if="isSuperAdmin && !one.region_id" class="adm-note wide">
        Without a region, only Super Admins can see this roster entry.
      </p>
      <p v-if="!isSuperAdmin" class="adm-note wide">Added to {{ myRegion }}.</p>
      <p v-if="oneMsg" class="adm-msg wide" :class="oneOk ? 'ok' : 'err'" role="status">
        {{ oneMsg }}
      </p>
      <div class="wide adm-actions">
        <button type="submit" class="adm-btn mari" :disabled="busy">Add to roster</button>
      </div>
    </form>

    <form v-if="addMode === 'paste'" class="adm-form" @submit.prevent="addMany">
      <p class="adm-kicker wide">Paste from a sheet</p>
      <label class="adm-field wide">
        <span>One student per line</span>
        <textarea
          v-model="paste"
          class="adm-input tall"
          placeholder="email, full name, phone, region, gender"
        />
        <small>
          Columns: email, full name (optional), phone (optional){{
            isSuperAdmin ? ', region (name or code, optional)' : ''
          }}, gender (optional). Copy straight from Google Sheets; a header row is skipped.
        </small>
      </label>
      <p class="adm-note wide">
        {{ parsed.length }} student{{ parsed.length === 1 ? '' : 's' }} found.
      </p>
      <p v-if="parsed.some(badRow)" class="adm-msg err wide" role="alert">
        Fix unknown region or gender labels before adding students. Gender is Female or Male.
      </p>
      <ul v-if="bulkResult" class="results wide">
        <li v-for="r in bulkResult.filter((x) => !x.ok)" :key="r.email">
          <span class="mono">{{ r.email || '(no email)' }}</span
          >: {{ r.error }}
        </li>
      </ul>
      <p v-if="bulkMsg" class="adm-msg wide" :class="bulkOk ? 'ok' : 'err'" role="status">
        {{ bulkMsg }}
      </p>
      <div class="wide adm-actions">
        <button
          type="submit"
          class="adm-btn"
          :disabled="busy || !parsed.length || parsed.length > 500 || parsed.some(badRow)"
        >
          Add {{ parsed.length || '' }} to roster
        </button>
      </div>
    </form>

    <form v-if="addMode === 'csv'" class="adm-form" @submit.prevent="importCsv">
      <p class="adm-kicker wide">Upload a CSV</p>
      <div class="adm-field wide">
        <span>File</span>
        <label
          class="adm-drop"
          :class="{ over: csvDragging }"
          @dragenter.prevent="csvDragging = true"
          @dragover.prevent
          @dragleave="csvDragging = false"
          @drop.prevent="onFileDrop"
        >
          <input
            class="adm-pick-input"
            type="file"
            accept=".csv,text/csv"
            aria-label="Upload roster CSV"
            @change="onFile"
          />
          <LineIcon name="upload" class="adm-drop-icon" />
          <span class="adm-drop-title">{{ csvFile ? 'Replace CSV' : 'Choose a CSV file' }}</span>
          <span class="adm-drop-sub">{{ csvFile || 'No file chosen' }}</span>
        </label>
        <small>
          Map the header row to email (required) and optional name, region, phone and gender.
          Duplicate emails in the file are kept once. Existing members are not overwritten.
        </small>
      </div>
      <template v-if="csv.headers.length">
        <label v-for="field in CSV_FIELDS" :key="field.key" class="adm-field">
          <span>{{ field.label }}</span>
          <AdminSelect v-model="csv.mapping[field.key]" :options="csvColumns" />
        </label>
        <p class="adm-note wide">
          {{ uniqueCsv.length }} row{{ uniqueCsv.length === 1 ? '' : 's' }} after de-duplicating
          this file. {{ csvRows.filter((r) => r.duplicate).length }} duplicate line{{
            csvRows.filter((r) => r.duplicate).length === 1 ? '' : 's'
          }}
          skipped.
        </p>
        <div v-if="csvPreview.length" class="adm-table-wrap wide">
          <table class="adm-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Region</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in csvPreview" :key="r.email">
                <td class="mono">{{ r.email }}</td>
                <td>{{ r.full_name || '–' }}</td>
                <td>{{ r.region_error || (r.region_id ? regionOf(r.region_id) : '–') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <p v-if="uniqueCsv.some(badRow)" class="adm-msg err wide" role="alert">
        Fix unknown region or gender labels before importing. Gender is Female or Male.
      </p>
      <ul v-if="csvResult" class="results wide">
        <li v-for="r in csvResult.filter((x) => !x.ok)" :key="r.email">
          <span class="mono">{{ r.email || '(no email)' }}</span
          >: {{ r.error }}
        </li>
      </ul>
      <p v-if="csvMsg" class="adm-msg wide" :class="csvOk ? 'ok' : 'err'" role="status">
        {{ csvMsg }}
      </p>
      <div class="wide adm-actions">
        <button
          type="submit"
          class="adm-btn mari"
          :disabled="busy || !uniqueCsv.length || uniqueCsv.length > 500 || uniqueCsv.some(badRow)"
        >
          Import {{ uniqueCsv.length || '' }}
        </button>
        <button v-if="csvResult" type="button" class="adm-btn ghost" @click="exportCsvResult">
          Download results
        </button>
      </div>
    </form>
  </AdminDialog>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import LineIcon from '../site/LineIcon.vue';
import AdminDialog from './AdminDialog.vue';
import AdminSelect from './AdminSelect.vue';
import { auth, errorText, isSuperAdmin } from '../../lib/auth.js';
import {
  GENDER_OPTIONS,
  downloadCsv,
  parseCsv,
  parseRosterPaste,
  rosterAddMany,
  rowsFromRosterCsv,
  suggestRosterMapping,
} from '../../lib/admin.js';

const props = defineProps({ lookups: { type: Object, required: true } });
const emit = defineEmits(['changed', 'close']);

const addMode = ref('one');
const addModes = [
  { id: 'one', label: 'One student' },
  { id: 'paste', label: 'Paste from Sheets' },
  { id: 'csv', label: 'Upload CSV' },
];
const CSV_FIELDS = [
  { key: 'email', label: 'Email' },
  { key: 'full_name', label: 'Name' },
  { key: 'region', label: 'Region' },
  { key: 'phone', label: 'Phone' },
  { key: 'gender', label: 'Gender' },
];

const regionOf = (id) => props.lookups.regions.find((r) => r.id === id)?.name ?? '–';
const myRegion = computed(() => regionOf(auth.dashboard?.region_id));

const busy = ref(false);

const one = reactive({
  email: '',
  full_name: '',
  phone: '',
  gender: '',
  region_id: null,
});
const oneMsg = ref('');
const oneOk = ref(false);

const paste = ref('');
const parsed = computed(() => parseRosterPaste(paste.value, props.lookups.regions));
const bulkResult = ref(null);
const bulkMsg = ref('');
const bulkOk = ref(false);

const csv = reactive({
  headers: [],
  rows: [],
  mapping: { email: -1, full_name: -1, phone: -1, region: -1, gender: -1 },
});
const csvRows = computed(() => rowsFromRosterCsv(csv.rows, csv.mapping, props.lookups.regions));
// Which file column holds a field: -1 means the file has none.
const csvColumns = computed(() => [
  { value: -1, label: 'Not in this file' },
  ...csv.headers.map((h, i) => ({ value: i, label: h })),
]);
const uniqueCsv = computed(() => {
  const seen = new Set();
  return csvRows.value.filter((r) => {
    if (r.duplicate || seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });
});
const csvPreview = computed(() => uniqueCsv.value.slice(0, 8));
const csvResult = ref(null);
const csvMsg = ref('');
const csvOk = ref(false);
const csvFile = ref('');
const csvDragging = ref(false);

const badRow = (r) => !!(r.region_error || r.gender_error);

function scoped(row) {
  return { ...row, region_id: isSuperAdmin.value ? row.region_id : null };
}

function summarize(result) {
  const rows = Array.isArray(result) ? result : [];
  const n = (cat) =>
    rows.filter((r) => r.category === cat || (cat === 'added' && r.ok && !r.category)).length;
  const added = n('added');
  const processed = n('processed');
  const existing = n('existing');
  const invalid = n('invalid') || rows.filter((r) => !r.ok && r.category !== 'conflict').length;
  const conflict = n('conflict');
  return { rows, added, existing, processed, invalid, conflict };
}

function summaryText(s) {
  if (!isSuperAdmin.value)
    return `${s.processed} processed, ${s.invalid} invalid. Existing identities are preserved.`;
  return `${s.added} added, ${s.existing} already present, ${s.invalid} invalid, ${s.conflict} conflicting.`;
}

async function addOne() {
  busy.value = true;
  oneMsg.value = '';
  try {
    const s = summarize(await rosterAddMany([scoped(one)]));
    oneOk.value = s.invalid + s.conflict === 0;
    oneMsg.value = summaryText(s);
    if (!oneOk.value) return;
    Object.assign(one, { email: '', full_name: '', phone: '', gender: '' });
    emit('changed');
  } catch (e) {
    oneOk.value = false;
    oneMsg.value = errorText(e);
  } finally {
    busy.value = false;
  }
}

async function addMany() {
  busy.value = true;
  bulkMsg.value = '';
  bulkResult.value = null;
  try {
    const result = await rosterAddMany(parsed.value.map(scoped));
    const s = summarize(result);
    bulkResult.value = s.rows;
    bulkOk.value = s.invalid + s.conflict === 0;
    bulkMsg.value = summaryText(s);
    if (bulkOk.value) paste.value = '';
    emit('changed');
  } catch (e) {
    bulkOk.value = false;
    bulkMsg.value = errorText(e);
  } finally {
    busy.value = false;
  }
}

function onFile(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  readRoster(file);
}
function onFileDrop(ev) {
  csvDragging.value = false;
  readRoster(ev.dataTransfer?.files?.[0]);
}
function readRoster(file) {
  csvResult.value = null;
  csvMsg.value = '';
  csv.headers = [];
  csv.rows = [];
  csvFile.value = '';
  if (!file) return;
  if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
    csvOk.value = false;
    csvMsg.value = 'Use a CSV file.';
    return;
  }
  csvFile.value = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(String(reader.result || ''));
    csv.rows = rows;
    csv.headers = rows[0] ?? [];
    Object.assign(csv.mapping, suggestRosterMapping(csv.headers));
  };
  reader.onerror = () => {
    csvMsg.value = 'The file could not be read.';
    csvOk.value = false;
  };
  reader.readAsText(file);
}

async function importCsv() {
  if (csv.mapping.email < 0) {
    csvOk.value = false;
    csvMsg.value = 'Map a column to email before importing.';
    return;
  }
  busy.value = true;
  csvMsg.value = '';
  csvResult.value = null;
  try {
    const result = await rosterAddMany(uniqueCsv.value.map(scoped));
    const s = summarize(result);
    csvResult.value = s.rows;
    csvOk.value = s.invalid + s.conflict === 0;
    csvMsg.value = summaryText(s);
    emit('changed');
  } catch (e) {
    csvOk.value = false;
    csvMsg.value = errorText(e);
  } finally {
    busy.value = false;
  }
}

function exportCsvResult() {
  downloadCsv('roster-import-results.csv', csvResult.value || [], [
    'email',
    'ok',
    'category',
    'error',
  ]);
}
</script>

<style scoped>
.add-modes {
  margin-bottom: 20px;
}
.tall {
  min-height: 150px;
  font-family: var(--mono);
  font-size: 13px;
}
.results {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--verm);
}
</style>

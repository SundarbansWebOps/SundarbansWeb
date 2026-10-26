<template>
  <div>
    <p v-if="error" class="adm-msg err" role="alert">{{ error }}</p>
    <p v-if="notice" class="adm-msg ok" role="status">{{ notice }}</p>
    <div class="request-desk" :class="{ 'mobile-open': mobileOpen }">
      <aside class="adm-card queue" aria-label="Request queue">
        <div class="adm-chips filters">
          <button
            class="adm-chip"
            :class="{ on: status === 'pending' && bucket === 'mine' }"
            @click="show('pending')"
          >
            For you</button
          ><button
            class="adm-chip"
            :class="{ on: status === 'pending' && bucket === 'waiting' }"
            @click="show('pending', 'waiting')"
          >
            Waiting for someone else</button
          ><button class="adm-chip" :class="{ on: status === 'decided' }" @click="show('decided')">
            Decided
          </button>
        </div>
        <button
          v-for="r in visible"
          :key="r.id"
          class="queue-row"
          :aria-current="selected?.id === r.id ? 'true' : undefined"
          @click="select(r)"
        >
          <b
            ><span class="adm-badge mari">{{ requestLabel(r) }}</span> {{ targetName(r) }}</b
          ><small
            >{{ ageOf(r.requested_at) }} ·
            {{
              r.status === 'pending'
                ? r.can_decide
                  ? 'Needs your review'
                  : r.waiting_on
                : r.status
            }}</small
          >
        </button>
        <div v-if="!visible.length && !loading" class="empty">
          <img :src="clearArt" alt="" /><b>Nothing here</b>
          <p>
            {{
              status === 'decided'
                ? 'Decisions appear here after review.'
                : 'No requests in this queue.'
            }}
          </p>
        </div>
        <p v-if="loading" class="adm-note" role="status">Loading requests...</p>
        <button
          v-if="requests.length < total && !legacy"
          class="adm-btn ghost small"
          :disabled="loading"
          @click="load(true)"
        >
          Load older requests
        </button>
        <p class="queue-footer keys">J / K move · A approve · R rejection note</p>
      </aside>
      <article v-if="selected" class="adm-card request-detail">
        <button class="adm-btn ghost small back" @click="mobileOpen = false">
          Back to requests
        </button>
        <p class="adm-kicker">{{ requestLabel(selected) }}</p>
        <h2>{{ targetName(selected) }}</h2>
        <p class="adm-note">
          Asked {{ ageOf(selected.requested_at) }} ·
          {{ dateOf(selected.requested_at, { year: 'numeric' }) }}
        </p>
        <div class="people">
          <div class="person">
            <b>{{ nameOf(targetOf(selected)) }}</b
            ><small>{{ targetOf(selected)?.email || 'Identity no longer available' }}</small
            ><small>{{ targetOf(selected)?.member_code }}</small>
          </div>
          <div class="person">
            <small>Requested by</small
            ><b>{{
              selected.requested_by === me
                ? 'You'
                : selected.category === 'admin'
                  ? nameOf(selected.requester)
                  : 'The student'
            }}</b
            ><small>{{
              selected.category === 'admin'
                ? 'A different Super Admin decides'
                : selected.category === 'region'
                  ? 'Current-region coordinator or Super Admin decides'
                  : 'A Super Admin decides'
            }}</small>
          </div>
        </div>
        <h3>Reason</h3>
        <blockquote>{{ selected.reason }}</blockquote>
        <h3>What changes</h3>
        <div class="adm-table-wrap">
          <table class="adm-table diff">
            <thead>
              <tr>
                <th>Field</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="field in requestDiff(selected, lookups)" :key="field.field">
                <td>{{ field.field }}</td>
                <td>{{ field.before }}</td>
                <td>
                  <mark>{{ field.after }}</mark>
                </td>
              </tr>
              <tr v-if="!requestDiff(selected, lookups).length">
                <td>Account</td>
                <td>{{ targetOf(selected)?.account_status || 'Recorded student account' }}</td>
                <td>{{ requestLabel(selected) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="consequence">{{ requestConsequence(selected) }}</p>
        <button
          v-if="
            (selected.type === 'form_publish' || selected.type === 'form_delete') &&
            selected.target_form_id
          "
          type="button"
          class="adm-btn ghost small"
          @click="emit('navigate', 'forms', selected.target_form_id)"
        >
          Open the form
        </button>
        <h3>Request history</h3>
        <ul class="history">
          <li>Requested {{ dateOf(selected.requested_at, { year: 'numeric' }) }}</li>
          <li v-for="entry in selected.history || []" :key="entry.id">
            {{ REQUEST_LABEL[entry.type] || entry.category }} · {{ entry.status }} ·
            {{ dateOf(entry.reviewed_at || entry.requested_at)
            }}<small v-if="entry.review_note">{{ entry.review_note }}</small>
          </li>
          <li v-if="selected.reviewed_at">
            {{ selected.status }} {{ dateOf(selected.reviewed_at)
            }}<small>{{ selected.review_note }}</small>
          </li>
        </ul>
        <p v-if="legacy" class="adm-note">
          Earlier request history will be available after the dashboard database update.
        </p>
        <div v-if="selected.status === 'pending'" class="decision">
          <template v-if="selected.can_decide"
            ><label class="adm-field"
              ><span>Review note, optional</span
              ><input
                ref="rejectionNote"
                v-model.trim="notes[selected.id]"
                class="adm-input"
                maxlength="2000"
            /></label>
            <div class="decision-actions">
              <button
                :class="['adm-btn', selected.type === 'member_hard_delete' ? 'danger' : 'mari']"
                :disabled="busy"
                @click="approve(selected)"
              >
                {{
                  selected.type === 'member_hard_delete' ? 'Approve and erase' : 'Approve'
                }}</button
              ><button class="adm-btn danger" :disabled="busy" @click="reject(selected)">
                Reject
              </button>
            </div></template
          >
          <template v-else
            ><p class="adm-note">
              Waiting for {{ selected.waiting_on.toLowerCase() }}.
              {{ selected.requested_by === me ? 'You cannot approve your own request.' : '' }}
            </p>
            <button
              v-if="selected.category === 'admin' && selected.requested_by === me"
              class="adm-btn danger"
              :disabled="busy"
              @click="cancel(selected)"
            >
              Cancel request
            </button></template
          >
        </div>
        <p v-else class="outcome">
          {{ selected.status }} · {{ dateOf(selected.reviewed_at)
          }}<template v-if="selected.review_note"> · {{ selected.review_note }}</template>
        </p>
      </article>
      <div v-else class="adm-card request-detail empty">
        <img :src="clearArt" alt="" />
        <h2>Choose a request</h2>
        <p>Open a request to see the reason, before values and proposed change.</p>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { askConfirm } from '../../lib/admin-confirm.js';
import { auth, errorText, isSuperAdmin } from '../../lib/auth.js';
import {
  REQUEST_LABEL,
  approveRequest,
  cancelRequest,
  executeContactChange,
  executeHardDelete,
  loadRequestDesk,
  rejectRequest,
  reviewCertificateNameRequest,
  reviewRegionRequest,
  syncSignInAccess,
} from '../../lib/admin.js';

import { nameOf, dateOf, ageOf, requestDiff, requestConsequence } from '../../lib/admin-display.js';
import { ADMIN_ART } from './admin-art.js';
const clearArt = ADMIN_ART.emptyClear;

const props = defineProps({
  lookups: { type: Object, required: true },
  initialId: { type: String, default: null },
});
const emit = defineEmits(['changed', 'navigate']);

const me = computed(() => auth.profile?.id);
const status = ref('pending');
const bucket = ref('mine');
const selectedId = ref(props.initialId);
const mobileOpen = ref(!!props.initialId);
const total = ref(0);
const page = ref(0);
const legacy = ref(false);
const rejectionNote = ref(null);
const visible = computed(() =>
  status.value !== 'pending'
    ? requests.value
    : requests.value.filter((r) => (bucket.value === 'mine' ? r.can_decide : !r.can_decide))
);
const selected = computed(
  () => visible.value.find((r) => r.id === selectedId.value) || visible.value[0]
);
watch(() => props.initialId, openRecord);
function openRecord(id) {
  const row = requests.value.find((r) => r.id === id);
  if (row) bucket.value = row.can_decide ? 'mine' : 'waiting';
  selectedId.value = id;
  mobileOpen.value = true;
}
function select(r) {
  selectedId.value = r.id;
  mobileOpen.value = true;
}
function shortcut(key, event) {
  if (!selected.value) return;
  if (key === 'j' || key === 'k') {
    event.preventDefault();
    const i = visible.value.indexOf(selected.value);
    select(
      visible.value[Math.max(0, Math.min(visible.value.length - 1, i + (key === 'j' ? 1 : -1)))]
    );
  }
  if (key === 'a' && selected.value.can_decide && !busy.value) {
    event.preventDefault();
    approve(selected.value);
  }
  if (key === 'r' && selected.value.can_decide) {
    event.preventDefault();
    rejectionNote.value?.focus();
  }
}
defineExpose({ openRecord, shortcut });
const requests = ref([]);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const notice = ref('');
const notes = reactive({});

const targetOf = (r) => r.target || r.target_snapshot?.member || r.member;
const targetName = (r) =>
  r.type === 'event_publish'
    ? r.requested_change?.event_name || 'Event'
    : r.type === 'form_publish' || r.type === 'form_delete'
      ? r.requested_change?.form_title || 'Form'
      : nameOf(targetOf(r));
const requestLabel = (r) =>
  REQUEST_LABEL[r.type] || (r.category === 'region' ? 'Region change' : 'Certificate name');
// Approvals that change whether the student may sign in.
const AFFECTS_SIGN_IN = new Set(['member_deletion', 'member_blacklist', 'member_status_change']);

async function load(more = false) {
  loading.value = true;
  error.value = '';
  try {
    const nextPage = more ? page.value + 1 : 0;
    const result = await loadRequestDesk({ status: status.value, page: nextPage });
    requests.value = more ? requests.value.concat(result.rows) : result.rows;
    total.value = result.total;
    legacy.value = !!result.legacy;
    page.value = nextPage;
    if (props.initialId) openRecord(props.initialId);
  } catch (e) {
    error.value = errorText(e);
  } finally {
    loading.value = false;
  }
}
onMounted(() => load());
function show(s, group = 'mine') {
  status.value = s;
  bucket.value = group;
  selectedId.value = null;
  mobileOpen.value = false;
  notice.value = '';
  load();
}

async function act(run, message) {
  busy.value = true;
  error.value = notice.value = '';
  try {
    await run();
    notice.value = message;
    await load();
    emit('changed');
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}

function approve(r) {
  if (r.category === 'region') return reviewRegion(r, true);
  if (r.category === 'certificate') return reviewCert(r, true);
  if (r.type === 'member_contact_change')
    return act(
      () => executeContactChange(r.id, notes[r.id]),
      'Approved. Their sign-in now uses the new email.'
    );
  if (r.type === 'member_hard_delete') {
    return askConfirm({
      title: `Erase ${targetName(r)}?`,
      message: 'Their account and data are removed for good. This cannot be undone.',
      confirmLabel: 'Erase permanently',
      danger: true,
    }).then(
      (yes) => yes && act(() => executeHardDelete(r.id), 'Erased. Their account has been removed.')
    );
  }
  return act(async () => {
    await approveRequest(r.id, notes[r.id]);
    if (AFFECTS_SIGN_IN.has(r.type)) {
      try {
        await syncSignInAccess(r.target_member_id);
      } catch (e) {
        throw new Error(
          `Approved, but sign-in access was not updated yet (${e.message}). Ask the web admin to check the apply-account-status function.`
        );
      }
    }
  }, 'Approved and applied.');
}
const reject = (r) =>
  r.category === 'region'
    ? reviewRegion(r, false)
    : r.category === 'certificate'
      ? reviewCert(r, false)
      : act(() => rejectRequest(r.id, notes[r.id]), 'Rejected. Nothing was changed.');
const cancel = (r) => act(() => cancelRequest(r.id), 'Request cancelled.');
const reviewRegion = (r, approve) =>
  act(
    () => reviewRegionRequest(r.id, approve, notes[r.id]),
    approve ? 'Region change applied.' : 'Region request rejected. Nothing was changed.'
  );
const reviewCert = (r, approve) =>
  act(
    () => reviewCertificateNameRequest(r.id, approve, notes[r.id]),
    approve
      ? 'Certificate name updated for future certificates.'
      : 'Certificate-name request rejected.'
  );
</script>

<style scoped>
.request-desk {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.queue {
  position: sticky;
  top: calc(var(--nav-h, 64px) + 22px);
  max-height: calc(100svh - var(--nav-h, 64px) - 44px);
  overflow: auto;
  padding: 8px;
}
.filters {
  padding: 4px 2px 12px;
}
.queue-row {
  display: block;
  width: 100%;
  background: transparent;
  color: var(--ink);
  border: 1px solid transparent;
  border-radius: 10px;
  text-align: left;
  font: inherit;
  padding: 12px 10px;
  cursor: pointer;
}
.queue-row[aria-current] {
  background: var(--mari-soft);
  border-color: var(--mari);
}
.queue-row:hover {
  background: color-mix(in srgb, var(--mari-soft) 55%, transparent);
}
.queue-row b {
  display: block;
  font-size: 14px;
  font-weight: 600;
}
.queue-row small {
  display: block;
  font-size: 12px;
  color: var(--ink-3);
  margin-top: 5px;
}
.queue-footer {
  color: var(--ink-3);
  font-size: 11px;
  border-top: 1px solid var(--line);
  margin: 12px 4px 0;
  padding: 12px 0 4px;
}
.request-detail {
  padding: 22px;
  min-width: 0;
}
h2 {
  margin: 4px 0 6px;
  font-size: 24px;
  line-height: 1.1;
  letter-spacing: -0.02em;
}
h3 {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-3);
  margin: 22px 0 8px;
}
.people {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 20px;
}
.person {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
}
.person b,
.person small {
  display: block;
  overflow-wrap: anywhere;
}
.person small {
  color: var(--ink-3);
  font-size: 12px;
  margin-top: 4px;
}
blockquote {
  margin: 0;
  padding: 10px 12px;
  border-left: 3px solid var(--mari);
  background: color-mix(in srgb, var(--mari-soft) 55%, transparent);
  border-radius: 0 10px 10px 0;
  color: var(--ink-2);
  white-space: pre-line;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.diff {
  border: 1px solid var(--line);
}
.diff td {
  overflow-wrap: anywhere;
}
.diff mark {
  background: var(--mari-soft);
  color: var(--mari-ink);
  padding: 2px 4px;
}
.consequence {
  background: color-mix(in srgb, var(--mari-soft) 55%, transparent);
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  padding: 12px;
  font-size: 14px;
  color: var(--ink-2);
}
.history {
  padding-left: 18px;
  font-size: 13px;
  color: var(--ink-2);
}
.history li {
  padding-bottom: 8px;
}
.history small {
  display: block;
  color: var(--ink-3);
  white-space: pre-line;
}
.decision {
  margin-top: 22px;
  border-top: 1px solid var(--line);
  padding-top: 16px;
}
.decision-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.outcome {
  background: var(--mari-soft);
  color: var(--mari-ink);
  border-radius: 10px;
  padding: 12px;
  white-space: pre-line;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 16px;
}
.empty img {
  width: 140px;
}
.empty p {
  color: var(--ink-3);
  font-size: 14px;
}
.back {
  display: none;
}
@media (max-width: 1020px) {
  .request-desk {
    grid-template-columns: 280px minmax(0, 1fr);
  }
  .people {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (hover: none), (max-width: 760px) {
  .keys {
    display: none;
  }
}
@media (max-width: 760px) {
  .request-desk {
    display: block;
  }
  .queue {
    position: static;
    max-height: none;
  }
  .request-detail {
    display: none;
    padding: 16px;
  }
  .mobile-open .queue {
    display: none;
  }
  .mobile-open .request-detail {
    display: block;
  }
  .back {
    display: inline-flex;
    margin-bottom: 16px;
  }
}
</style>

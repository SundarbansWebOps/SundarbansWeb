<!-- Organizer forms: house, region, community or bound to an event. Question order is stored as
     given. The invite link is WhatsApp-only and shown to a student after they submit, not before. -->
<template>
  <div>
    <div class="adm-toolbar between">
      <p class="adm-note">
        {{ forms.length }} form{{ forms.length === 1 ? '' : 's' }} you can manage.
      </p>
      <button type="button" class="adm-btn mari" @click="edit()">New form</button>
    </div>
    <p v-if="error" class="adm-msg err" role="alert">{{ error }}</p>
    <p v-if="notice" class="adm-msg ok" role="status">{{ notice }}</p>

    <ul v-if="mine.length" class="adm-list">
      <li v-for="f in mine" :key="f.id" class="adm-row">
        <div>
          <b>{{ f.title }}</b>
          <div class="adm-meta">
            <span>{{ scopeOf(f) }}</span>
            <span v-if="f.pending_request_type === 'form_delete'" class="adm-badge mari"
              >waiting to be removed</span
            >
            <span v-else-if="f.pending_request_id" class="adm-badge mari"
              >waiting for approval</span
            >
            <span v-else-if="f.archived_at" class="adm-badge">archived</span>
            <span v-else-if="formStatus(f) === 'draft'" class="adm-badge">draft</span>
            <span v-else-if="formStatus(f) === 'scheduled'" class="adm-badge">scheduled</span>
            <span v-else-if="formStatus(f) === 'open'" class="adm-badge mari">
              open to audience
            </span>
            <span v-else class="adm-badge">closed</span>
            <span v-if="f.event_id" class="adm-badge">event registration</span>
            <span v-if="f.joins_community" class="adm-badge">join form</span>
          </div>
        </div>
        <div class="adm-chips">
          <button
            v-if="f.pending_request_id && !isSuperAdmin"
            type="button"
            class="adm-btn danger small"
            :disabled="busy"
            @click="cancelPending(f)"
          >
            Cancel request
          </button>
          <template v-else>
            <button type="button" class="adm-btn ghost small" @click="edit(f)">Edit</button>
            <button type="button" class="adm-btn ghost small" @click="openResponses(f)">
              Responses
            </button>
            <button
              type="button"
              :class="['adm-btn', 'small', f.archived_at ? 'ghost' : 'danger']"
              @click="archive(f)"
            >
              {{ f.archived_at ? 'Restore' : 'Archive' }}
            </button>
            <button
              v-if="isSuperAdmin"
              type="button"
              class="adm-btn danger small"
              :disabled="busy"
              @click="removeForm(f)"
            >
              Remove
            </button>
            <button
              v-else
              type="button"
              class="adm-btn danger small"
              :disabled="busy"
              @click="askRemoveForm(f)"
            >
              Ask Super Admin to remove
            </button>
          </template>
        </div>
      </li>
    </ul>
    <p v-else-if="!loading" class="adm-empty">No forms in your scope yet.</p>

    <AdminDialog
      v-if="form"
      ref="dlg"
      wide
      :title="form.id ? 'Edit form' : 'New form'"
      @close="onEditorClose"
    >
      <form :id="editorId" class="editor" @submit.prevent="save(false)">
        <p v-if="form.archived_at" class="adm-note">
          Archived forms stay available to organizers and can be restored.
        </p>
        <p v-if="form.pending_request_id" class="adm-note">
          {{ pendingFormNote }}
        </p>
        <p v-else-if="form.published_at" class="adm-note">
          This form is published. Saving changes updates it straight away.{{
            approvalScope ? ' If you unpublish it, a Super Admin has to approve it again.' : ''
          }}
        </p>

        <section class="grp" aria-labelledby="form-details-heading">
          <h3 id="form-details-heading" class="adm-kicker">Details</h3>
          <div class="adm-form">
            <label class="adm-field wide">
              <span>Title</span>
              <input
                v-model.trim="form.title"
                class="adm-input"
                required
                maxlength="200"
                :disabled="eventCopyLock"
              />
              <small v-if="eventCopyLock">From the event. Edit it there.</small>
            </label>
            <label class="adm-field wide">
              <span>Description</span>
              <textarea
                v-model.trim="form.description"
                class="adm-input"
                maxlength="4000"
                :disabled="eventCopyLock"
              />
              <small v-if="eventCopyLock">From the event. Edit it there.</small>
            </label>
          </div>
        </section>

        <section class="grp" aria-labelledby="form-audience-heading">
          <h3 id="form-audience-heading" class="adm-kicker">Who sees it</h3>
          <div class="adm-form">
            <label class="adm-field">
              <span>Form kind</span>
              <AdminSelect v-model="form.form_kind" :options="FORM_KINDS" />
            </label>
            <label class="adm-field">
              <span>Scope</span>
              <AdminSelect
                v-model="form.scope"
                :options="scopeOptions"
                :disabled="eventBoundLock"
                @change="onScope"
              />
            </label>
            <label v-if="form.form_kind === 'group'" class="adm-field">
              <span>Group label</span>
              <input v-model.trim="form.group_label" class="adm-input" maxlength="80" />
            </label>
            <label v-if="form.form_kind === 'group'" class="adm-field wide">
              <span>Group purpose</span>
              <input v-model.trim="form.group_purpose" class="adm-input" maxlength="300" />
              <small
                >Copy from the verified source. Applicants see it beside the group label.</small
              >
            </label>
            <label v-if="form.scope === 'region'" class="adm-field">
              <span>Region</span>
              <AdminSelect
                v-model="form.region_id"
                :options="lookups.regions"
                value-key="id"
                label-key="name"
                :disabled="isRc"
              />
            </label>
            <label v-if="form.scope === 'community'" class="adm-field">
              <span>Community</span>
              <AdminSelect
                v-model="form.community_id"
                :options="lookups.communities"
                value-key="id"
                label-key="name"
                :disabled="isHead"
              />
              <small v-if="membersOnlyAudience(lookups, form.community_id)"
                >{{ membersOnlyAudience(lookups, form.community_id) }} see it.</small
              >
            </label>
            <label v-if="form.scope === 'community'" class="adm-check wide">
              <input v-model="form.joins_community" type="checkbox" />
              <span>Joins the community: approving a response adds the student to it</span>
            </label>
            <label v-if="form.scope === 'event'" class="adm-field">
              <span>Event</span>
              <AdminSelect
                v-model="form.event_id"
                :options="eventSelectOptions"
                :disabled="eventBoundLock"
              />
              <small>{{
                bindableEvents.length
                  ? 'No-form events do not take a registration form.'
                  : 'No event can take a form. No-form events do not take one.'
              }}</small>
            </label>
          </div>
        </section>

        <section class="grp" aria-labelledby="form-responses-heading">
          <h3 id="form-responses-heading" class="adm-kicker">Responses</h3>
          <div class="adm-form">
            <label class="adm-check wide">
              <input v-model="form.is_open" type="checkbox" />
              <span>Accepting responses</span>
            </label>
            <label class="adm-field">
              <span>Opens</span>
              <input v-model="form.opens" class="adm-input" type="datetime-local" />
            </label>
            <label class="adm-field">
              <span>Closes</span>
              <input v-model="form.closes" class="adm-input" type="datetime-local" />
            </label>
            <p class="adm-note wide">Leave a date empty for no limit.</p>
          </div>
        </section>

        <section class="grp" aria-labelledby="form-cohorts-heading">
          <h3 id="form-cohorts-heading" class="adm-kicker">Audience</h3>
          <AdminCohortSelect v-if="cohorts" v-model="form.audience_cohorts" :cohorts="cohorts" />
        </section>

        <section class="grp" aria-labelledby="form-invite-heading">
          <h3 id="form-invite-heading" class="adm-kicker">WhatsApp invite</h3>
          <div class="adm-form">
            <label class="adm-field wide">
              <span>WhatsApp invite (optional)</span>
              <input
                v-model.trim="form.invite_url"
                class="adm-input"
                type="url"
                :disabled="form.remove_invite"
                placeholder="https://chat.whatsapp.com/…"
              />
              <small>
                Students see it only after they submit. Use a chat.whatsapp.com or wa.me HTTPS link.
                A saved invite stays private; enter a new link to replace it.
              </small>
            </label>
            <label v-if="form.id" class="adm-check wide" :class="{ danger: form.remove_invite }">
              <input v-model="form.remove_invite" type="checkbox" />
              <span>Remove the saved WhatsApp invite</span>
            </label>
          </div>
        </section>

        <section class="grp" aria-labelledby="form-questions-heading">
          <h3 id="form-questions-heading" class="adm-kicker">Questions</h3>
          <p class="adm-note">Students answer in this order.</p>
          <ol class="questions">
            <li v-for="(field, i) in form.fields" :key="field._id" class="adm-card question">
              <div class="question-head">
                <span class="adm-kicker">Question {{ i + 1 }}</span>
                <div class="adm-chips">
                  <button
                    type="button"
                    class="adm-btn ghost small"
                    :disabled="i === 0"
                    @click="move(i, -1)"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    class="adm-btn ghost small"
                    :disabled="i === form.fields.length - 1"
                    @click="move(i, 1)"
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    class="adm-btn danger small"
                    @click="form.fields.splice(i, 1)"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div class="adm-form">
                <label class="adm-field wide">
                  <span>Question</span>
                  <input
                    v-model.trim="field.label"
                    class="adm-input"
                    required
                    maxlength="300"
                    @change="syncKey(field, i)"
                  />
                </label>
                <label class="adm-field">
                  <span>Answer type</span>
                  <AdminSelect v-model="field.type" :options="TYPE_OPTIONS" />
                </label>
                <div class="checks">
                  <label class="adm-check">
                    <input v-model="field.required" type="checkbox" />
                    <span>Required</span>
                  </label>
                  <label v-if="isChoice(field)" class="adm-check">
                    <input v-model="field.allow_other" type="checkbox" />
                    <span>Allow “Other”</span>
                  </label>
                </div>
                <label v-if="isChoice(field)" class="adm-field wide">
                  <span>Options (one per line)</span>
                  <textarea v-model="field.optionsText" class="adm-input" />
                </label>
                <details class="advanced wide">
                  <summary>Advanced</summary>
                  <div class="adm-form advanced-body">
                    <label class="adm-field">
                      <span>Key</span>
                      <input
                        v-model.trim="field.key"
                        class="adm-input mono"
                        required
                        maxlength="64"
                      />
                      <small>Identifies the answer. Must be unique in this form.</small>
                    </label>
                    <label class="adm-field">
                      <span>Prefill from profile</span>
                      <AdminSelect v-model="field.prefill" :options="PREFILL_OPTIONS" />
                    </label>
                  </div>
                </details>
              </div>
            </li>
          </ol>
          <button type="button" class="adm-btn ghost add-question" @click="addField">
            Add question
          </button>
        </section>
      </form>

      <template #footer>
        <p v-if="formError" class="adm-msg err foot-msg" role="alert">{{ formError }}</p>
        <button
          v-if="form.published_at && !form.pending_request_id"
          type="button"
          class="adm-btn danger push"
          :disabled="busy"
          @click="save('unpublish')"
        >
          Unpublish
        </button>
        <button
          v-if="form.id && isSuperAdmin && !form.pending_request_id"
          type="button"
          class="adm-btn danger"
          :disabled="busy"
          @click="removeForm(form)"
        >
          Remove form
        </button>
        <button
          v-else-if="form.id && !isSuperAdmin && !form.pending_request_id"
          type="button"
          class="adm-btn danger"
          :disabled="busy"
          @click="askRemoveForm(form)"
        >
          Ask Super Admin to remove
        </button>
        <template v-if="form.published_at">
          <button type="submit" class="adm-btn mari" :form="editorId" :disabled="busy">
            Save changes
          </button>
        </template>
        <template v-else>
          <button type="submit" class="adm-btn ghost" :form="editorId" :disabled="busy">
            Save draft
          </button>
          <button type="button" class="adm-btn mari" :disabled="busy" @click="save('publish')">
            {{ approvalScope ? 'Ask a Super Admin to publish' : 'Publish' }}
          </button>
        </template>
      </template>
    </AdminDialog>

    <AdminDialog
      v-if="responsesFor"
      ref="respDlg"
      fullscreen
      :title="`${responsesFor.title} responses`"
      @close="responsesFor = null"
    >
      <div class="resp-bar">
        <p class="adm-note" aria-live="polite">
          <template v-if="!respLoading && !respError">
            <b>{{ responses.length }}</b>
            {{ responses.length === 1 ? 'response' : 'responses' }}
            · {{ responseFields.length }}
            {{ responseFields.length === 1 ? 'question' : 'questions' }}
            <span class="resp-scope"> · {{ scopeOf(responsesFor) }}</span>
          </template>
        </p>
        <button
          type="button"
          class="adm-btn ghost small"
          :disabled="respLoading || !responses.length"
          @click="downloadResponses"
        >
          Download CSV
        </button>
      </div>
      <div v-if="responses.length" class="resp-tools">
        <div class="adm-chips" role="group" aria-label="Filter by review status">
          <button
            v-for="o in STATUS_FILTERS"
            :key="o.value"
            type="button"
            class="adm-chip"
            :class="{ on: statusFilter === o.value }"
            :aria-pressed="statusFilter === o.value"
            @click="statusFilter = o.value"
          >
            {{ o.label }} <span class="n">{{ statusCounts[o.value] }}</span>
          </button>
        </div>
        <label class="sort">
          <span>Sort</span>
          <AdminSelect v-model="sortOrder" :options="SORT_ORDERS" />
        </label>
      </div>
      <p v-if="respError" class="adm-msg err" role="alert">{{ respError }}</p>
      <p v-if="reviewError" class="adm-msg err" role="alert">{{ reviewError }}</p>
      <p v-if="refreshNotice" class="adm-msg" role="status">{{ refreshNotice }}</p>
      <p v-if="respLoading" class="adm-empty" role="status">Loading responses…</p>
      <p v-else-if="!responses.length && !respError" class="adm-empty">Nobody has answered yet.</p>
      <p v-else-if="responses.length && !shownResponses.length" class="adm-empty">
        No {{ statusFilter }} responses.
      </p>
      <div v-else-if="shownResponses.length" class="resp-wrap">
        <table class="resp">
          <thead>
            <tr>
              <th scope="col" class="who">Submitted by</th>
              <th scope="col">Submitted</th>
              <th scope="col" class="review">Review</th>
              <th v-for="f in responseFields" :key="f.identity" scope="col">{{ f.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in shownResponses" :key="r.id">
              <td class="who">
                <span class="serial" :title="`Response ${r.serial} in order received`"
                  >#{{ r.serial }}</span
                >
                {{ r.email }}
                <small v-if="memberName(r)" class="member-name">{{ memberName(r) }}</small>
              </td>
              <td class="when">
                {{ day(r.submitted_at) }}
                <small v-if="r.resubmitted_at" class="resent"
                  >Resent {{ day(r.resubmitted_at) }}</small
                >
              </td>
              <td class="review">
                <span class="adm-badge" :class="STATUS_TONE[r.review_status]">{{
                  REVIEW_LABEL[r.review_status] ?? 'Pending'
                }}</span>
                <p v-if="r.review_status === 'rejected' && r.review_reason" class="why">
                  {{ r.review_reason }}
                </p>
                <p v-if="r.review_status !== 'pending' && reviewedBy(r)" class="by">
                  {{ reviewedBy(r) }}
                </p>
                <div class="adm-chips actions">
                  <button
                    v-if="r.review_status !== 'approved'"
                    type="button"
                    class="adm-btn mari small"
                    :disabled="saving[r.id]"
                    :aria-label="`Approve ${r.email}`"
                    @click="review(r, 'approved')"
                  >
                    Approve
                  </button>
                  <button
                    v-if="r.review_status !== 'rejected'"
                    type="button"
                    class="adm-btn danger small"
                    :disabled="saving[r.id]"
                    :aria-label="`Reject ${r.email}`"
                    @click="askReject(r)"
                  >
                    Reject
                  </button>
                  <button
                    v-if="r.review_status !== 'pending'"
                    type="button"
                    class="adm-btn ghost small"
                    :disabled="saving[r.id]"
                    :aria-label="`Undo review of ${r.email}`"
                    @click="review(r, 'pending')"
                  >
                    Undo
                  </button>
                </div>
              </td>
              <td v-for="f in responseFields" :key="f.identity">
                <span v-if="answerText(r, f) === '–'" class="none">–</span>
                <template v-else>{{ answerText(r, f) }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminDialog>

    <AdminDialog
      v-if="rejecting"
      ref="rejectDlg"
      :title="`Reject #${rejecting.serial}`"
      @close="rejecting = null"
    >
      <form :id="rejectId" class="reject" @submit.prevent="confirmReject">
        <p class="adm-note">
          The student sees this reason on their Lounge and can correct their answers and apply
          again.
        </p>
        <div class="adm-chips" role="group" aria-label="Common rejection reasons">
          <button
            v-for="reason in REJECT_REASONS"
            :key="reason"
            type="button"
            class="adm-chip"
            :class="{ on: rejectReason === reason }"
            :aria-pressed="rejectReason === reason"
            @click="rejectReason = reason"
          >
            {{ reason }}
          </button>
        </div>
        <label class="adm-field">
          <span>Reason</span>
          <textarea
            v-model="rejectReason"
            class="adm-input"
            required
            :maxlength="REVIEW_REASON_MAX"
            rows="3"
          />
          <small>{{ rejectReason.length }} / {{ REVIEW_REASON_MAX }}</small>
        </label>
        <p v-if="rejectError" class="adm-msg err" role="alert">{{ rejectError }}</p>
      </form>
      <template #footer>
        <button type="button" class="adm-btn ghost" @click="rejectDlg?.close()">Cancel</button>
        <button
          type="submit"
          class="adm-btn danger"
          :form="rejectId"
          :disabled="!rejectReason.trim() || saving[rejecting.id]"
        >
          Reject response
        </button>
      </template>
    </AdminDialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, useId, watch } from 'vue';
import AdminDialog from './AdminDialog.vue';
import AdminSelect from './AdminSelect.vue';
import AdminCohortSelect from './AdminCohortSelect.vue';
import { askConfirm } from '../../lib/admin-confirm.js';
import { auth, errorText, isRc, isSuperAdmin } from '../../lib/auth.js';
import {
  FORM_FIELD_TYPES,
  cancelRequest,
  deleteLoungeForm,
  PREFILL_KEYS,
  REJECT_REASONS,
  REVIEW_LABEL,
  REVIEW_REASON_MAX,
  canManageEvent,
  downloadCsv,
  exportFormResponses,
  fieldKeyFromLabel,
  formResponsesToCsv,
  getAvailableCohorts,
  listEvents,
  listForms,
  membersOnlyAudience,
  requestFormDelete,
  requestFormPublish,
  reviewFormResponse,
  saveForm,
  sortResponses,
} from '../../lib/admin.js';

const props = defineProps({
  lookups: { type: Object, required: true },
  initialId: { type: String, default: null },
});
const emit = defineEmits(['changed', 'navigate']);

const TYPE_LABEL = {
  text: 'Short text',
  textarea: 'Long text',
  email: 'Email',
  phone: 'Phone number',
  select: 'Choose one',
  checkbox: 'Tick box',
  multiselect: 'Choose many',
};
const PREFILL_LABEL = { name: 'Preferred name', phone: 'Phone number', email: 'Email' };
const TYPE_OPTIONS = FORM_FIELD_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] ?? t }));
const PREFILL_OPTIONS = [
  { value: '', label: 'Nothing' },
  ...PREFILL_KEYS.map((p) => ({ value: p, label: PREFILL_LABEL[p] ?? p })),
];
const FORM_KINDS = [
  { value: 'general', label: 'General form' },
  { value: 'group', label: 'Group application' },
  { value: 'recruitment', label: 'Recruitment' },
];
const SORT_ORDERS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];
const editorId = useId();
const rejectId = useId();
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];
const STATUS_TONE = { pending: '', approved: 'mari', rejected: 'verm' };

const isHead = computed(
  () => auth.dashboard?.position === 'head' || auth.dashboard?.position === 'co_head'
);
const scopeOptions = computed(() =>
  [
    isSuperAdmin.value && { value: 'house', label: 'Whole house' },
    (isSuperAdmin.value || isRc.value) && { value: 'region', label: 'Region' },
    (isSuperAdmin.value || isHead.value) && { value: 'community', label: 'Community' },
    { value: 'event', label: 'Bound to an event' },
  ].filter(Boolean)
);
const forms = ref([]);
const events = ref([]);
const cohorts = ref(null);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const notice = ref('');
const form = ref(null);
const openedFromEvent = ref(null);
const formError = ref('');
const eventCopyLock = computed(() => form.value?.scope === 'event' && !!form.value?.event_id);
const pendingFormNote = computed(() => {
  if (!form.value?.pending_request_id) return '';
  if (form.value.pending_request_type === 'form_delete') {
    return isSuperAdmin.value
      ? 'An organizer asked to remove this form. Approve or reject it in Requests.'
      : 'Waiting for a Super Admin to remove it. Cancel the request to edit it.';
  }
  return isSuperAdmin.value
    ? 'A Head asked to publish this form. Approve or reject it in Requests.'
    : 'Waiting for a Super Admin to publish it. Cancel the request to edit it.';
});
const eventBoundLock = computed(
  () => !!openedFromEvent.value || !!(form.value?.id && form.value.event_id)
);
const dlg = ref(null);
const responsesFor = ref(null);
const responses = ref([]);
const responseFields = ref([]);
const respError = ref('');
const respLoading = ref(false);
const statusFilter = ref('all');
const sortOrder = ref('newest');
const saving = reactive({});
const reviewError = ref('');
const refreshNotice = ref('');
const rejecting = ref(null);
const rejectReason = ref('');
const rejectError = ref('');
const rejectDlg = ref(null);
let fieldN = 0;

const statusOf = (r) => r.review_status ?? 'pending';
const statusCounts = computed(() => {
  const counts = { all: responses.value.length, pending: 0, approved: 0, rejected: 0 };
  for (const r of responses.value) counts[statusOf(r)] += 1;
  return counts;
});
// Serials come from the server and never change with the view.
const shownResponses = computed(() =>
  sortResponses(
    statusFilter.value === 'all'
      ? responses.value
      : responses.value.filter((r) => statusOf(r) === statusFilter.value),
    sortOrder.value
  )
);
const memberName = (r) => r.member_full_name || r.member_preferred_name || '';
const reviewedBy = (r) =>
  [r.reviewer_name ?? r.reviewer_email, r.reviewed_at && day(r.reviewed_at)]
    .filter(Boolean)
    .join(' · ');

const mine = computed(() => forms.value.filter((f) => f.can_manage !== false));
// A Super Admin publishes Head and Co-Head forms: community forms and forms on a community event.
const approvalScope = computed(
  () =>
    !isSuperAdmin.value &&
    (form.value?.scope === 'community' ||
      (form.value?.scope === 'event' &&
        events.value.find((e) => e.id === form.value.event_id)?.community_id != null))
);
const bindableEvents = computed(() =>
  events.value.filter(
    (event) =>
      canManageEvent(event) &&
      event.entry_mode !== 'open' &&
      !event.archive &&
      !event.cancelled_at &&
      event.published_at &&
      event.ends_at &&
      new Date(event.ends_at) > new Date()
  )
);
const eventOptions = computed(() => {
  const eligible = bindableEvents.value;
  const selected = events.value.find((event) => event.id === form.value?.event_id);
  if (
    selected &&
    canManageEvent(selected) &&
    selected.entry_mode !== 'open' &&
    !eligible.some((event) => event.id === selected.id)
  ) {
    return [selected, ...eligible];
  }
  return eligible;
});
const eventStatus = (event) => {
  if (!event.published_at) return 'draft';
  if (event.cancelled_at) return 'cancelled';
  if (event.archive) return 'archive';
  if (event.ends_at && new Date(event.ends_at) <= new Date()) return 'past';
  return 'upcoming';
};
const eventSelectOptions = computed(() =>
  eventOptions.value.map((e) => ({ value: e.id, label: `${e.name} · ${eventStatus(e)}` }))
);
const scopeOf = (f) => {
  if (f.event_id) return 'Event form';
  if (f.community_id)
    return `${props.lookups.communities.find((c) => c.id === f.community_id)?.name ?? ''} community${membersOnlyAudience(props.lookups, f.community_id) ? ' · members only' : ''}`;
  if (f.region_id) return props.lookups.regions.find((r) => r.id === f.region_id)?.name ?? 'Region';
  return 'House-wide';
};
const formStatus = (f) => {
  const now = Date.now();
  if (!f.published_at) return 'draft';
  if (f.is_open === false || (f.closes_at && new Date(f.closes_at).getTime() <= now)) {
    return 'closed';
  }
  if (new Date(f.published_at).getTime() > now) return 'scheduled';
  if (f.opens_at && new Date(f.opens_at).getTime() > now) return 'scheduled';
  return 'open';
};
const day = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '–';
const toLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocal = (v) => (v ? new Date(v).toISOString() : null);
const isChoice = (field) => field.type === 'select' || field.type === 'multiselect';

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [all, ev, coh] = await Promise.all([
      listForms(),
      listEvents({ view: 'upcoming' }).catch(() => []),
      getAvailableCohorts(),
    ]);
    const drafts = await listEvents({ view: 'drafts' }).catch(() => []);
    const past = await listEvents({ view: 'past' }).catch(() => []);
    forms.value = all;
    events.value = [...ev, ...drafts, ...past];
    cohorts.value = coh;
  } catch (e) {
    error.value = errorText(e);
  } finally {
    loading.value = false;
  }
}
onMounted(async () => {
  await load();
  const row = forms.value.find((r) => r.id === props.initialId);
  if (row) edit(row);
});

function defaultScope() {
  if (isSuperAdmin.value)
    return { scope: 'house', region_id: null, community_id: null, event_id: null };
  if (isRc.value)
    return {
      scope: 'region',
      region_id: auth.dashboard.region_id,
      community_id: null,
      event_id: null,
    };
  return {
    scope: 'community',
    region_id: null,
    community_id: auth.dashboard.community_id,
    event_id: null,
  };
}

function wrapField(f) {
  fieldN += 1;
  return {
    _id: fieldN,
    key: f.key,
    label: f.label,
    type: f.type,
    required: !!f.required,
    prefill: f.prefill || '',
    allow_other: !!f.allow_other,
    optionsText: (f.options || []).join('\n'),
  };
}

defineExpose({
  create: () => edit(),
  openRecord: async (id) => {
    await load();
    const row = forms.value.find((r) => r.id === id);
    if (row) edit(row);
  },
  openForEvent: async (event, formId) => {
    openedFromEvent.value = event.id;
    await load();
    const existing =
      forms.value.find((row) => row.id === formId) ||
      forms.value.find((row) => row.event_id === event.id);
    if (existing) {
      edit(existing);
      return;
    }
    edit();
    form.value.title = event.name || '';
    form.value.description = event.description || '';
    form.value.scope = 'event';
    form.value.event_id = event.id;
    form.value.region_id = null;
    form.value.community_id = null;
    form.value.joins_community = false;
  },
});

function edit(f) {
  formError.value = '';
  if (f) {
    form.value = {
      ...f,
      description: f.description ?? '',
      invite_url: '',
      remove_invite: false,
      audience_cohorts: f.audience_cohorts ?? [],
      form_kind: f.form_kind || 'general',
      group_label: f.group_label || '',
      group_purpose: f.group_purpose || '',
      is_open: f.is_open !== false,
      joins_community: !!f.joins_community,
      opens: toLocal(f.opens_at),
      closes: toLocal(f.closes_at),
      scope: f.event_id ? 'event' : f.community_id ? 'community' : f.region_id ? 'region' : 'house',
      fields: (f.fields || []).map(wrapField),
    };
  } else {
    form.value = {
      title: '',
      description: '',
      form_kind: 'general',
      group_label: '',
      group_purpose: '',
      invite_url: '',
      remove_invite: false,
      is_open: true,
      joins_community: false,
      audience_cohorts: [],
      opens: '',
      closes: '',
      fields: [],
      ...defaultScope(),
    };
  }
}

watch(
  () => form.value?.event_id,
  (id) => {
    if (!form.value || form.value.id || form.value.scope !== 'event' || !id) return;
    const event = events.value.find((row) => row.id === id);
    if (!event) return;
    if (!form.value.title) form.value.title = event.name || '';
    if (!form.value.description) form.value.description = event.description || '';
  }
);

function onEditorClose() {
  form.value = null;
  if (openedFromEvent.value) {
    const id = openedFromEvent.value;
    openedFromEvent.value = null;
    emit('navigate', 'events', id);
  }
}

function onScope() {
  if (form.value.scope === 'house') {
    form.value.region_id = form.value.community_id = form.value.event_id = null;
  } else if (form.value.scope === 'region') {
    form.value.community_id = form.value.event_id = null;
    form.value.region_id = isRc.value
      ? auth.dashboard.region_id
      : (form.value.region_id ?? props.lookups.regions[0]?.id);
  } else if (form.value.scope === 'community') {
    form.value.region_id = form.value.event_id = null;
    form.value.community_id = isHead.value
      ? auth.dashboard.community_id
      : (form.value.community_id ?? props.lookups.communities[0]?.id);
  } else {
    form.value.region_id = form.value.community_id = null;
    const eligible = bindableEvents.value;
    const current = eligible.find((event) => event.id === form.value.event_id);
    form.value.event_id = current?.id ?? eligible[0]?.id ?? null;
  }
}

function addField() {
  form.value.fields.push(
    wrapField({
      key: fieldKeyFromLabel(
        `field ${form.value.fields.length + 1}`,
        form.value.fields.map((x) => x.key)
      ),
      label: '',
      type: 'text',
      required: false,
    })
  );
}
function syncKey(field, i) {
  if (!field.key || /^field_?\d*$/.test(field.key) || field.key === 'field') {
    field.key = fieldKeyFromLabel(
      field.label,
      form.value.fields.filter((_, j) => j !== i).map((x) => x.key)
    );
  }
}
function move(i, dir) {
  const j = i + dir;
  const fields = form.value.fields;
  const tmp = fields[i];
  fields[i] = fields[j];
  fields[j] = tmp;
}

function fieldPayload(field) {
  const row = {
    key: field.key,
    label: field.label,
    type: field.type,
    required: !!field.required,
  };
  if (field.prefill) row.prefill = field.prefill;
  if (field.type === 'select' || field.type === 'multiselect') {
    row.options = field.optionsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (field.allow_other) row.allow_other = true;
  }
  return row;
}

async function save(mode) {
  formError.value = '';
  if (form.value.scope === 'event') {
    const bound = events.value.find((event) => event.id === form.value.event_id);
    if (!form.value.event_id || bound?.entry_mode === 'open') {
      formError.value = bindableEvents.value.length
        ? 'Choose an event that takes a registration form.'
        : 'Open sessions do not take a form.';
      return;
    }
  }
  busy.value = true;
  try {
    const published_at =
      mode === 'publish'
        ? new Date().toISOString()
        : mode === 'unpublish'
          ? null
          : form.value.published_at || null;
    const payload = {
      id: form.value.id,
      title: form.value.title,
      description: form.value.description || null,
      fields: form.value.fields.map(fieldPayload),
      region_id: form.value.scope === 'region' ? form.value.region_id : null,
      community_id: form.value.scope === 'community' ? form.value.community_id : null,
      event_id: form.value.scope === 'event' ? form.value.event_id : null,
      joins_community: form.value.scope === 'community' && !!form.value.joins_community,
      is_open: !!form.value.is_open,
      published_at,
      opens_at: fromLocal(form.value.opens),
      closes_at: fromLocal(form.value.closes),
      audience_cohorts: form.value.audience_cohorts ?? [],
      form_kind: form.value.form_kind || 'general',
      group_label: form.value.form_kind === 'group' ? form.value.group_label || null : null,
      group_purpose: form.value.form_kind === 'group' ? form.value.group_purpose || null : null,
      archived_at: form.value.archived_at || null,
      source_url: form.value.source_url || null,
    };
    if (form.value.remove_invite) payload.invite_url = null;
    else if (form.value.invite_url) payload.invite_url = form.value.invite_url;
    if (mode === 'publish' && approvalScope.value) {
      const id = await saveForm({ ...payload, published_at: null });
      await requestFormPublish(id);
      notice.value = 'Sent to a Super Admin. The form opens once they approve it.';
    } else {
      await saveForm(payload);
      notice.value = mode === 'publish' ? 'Published.' : 'Saved.';
    }
    emit('changed');
    if (openedFromEvent.value) {
      const id = openedFromEvent.value;
      openedFromEvent.value = null;
      form.value = null;
      emit('navigate', 'events', id);
      return;
    }
    dlg.value?.close();
    await load();
  } catch (e) {
    const m = e?.message ?? '';
    formError.value = /Open sessions do not take a registration form/.test(m)
      ? 'Open sessions do not take a registration form.'
      : errorText(e);
  } finally {
    busy.value = false;
  }
}

async function archive(f) {
  const archived_at = f.archived_at ? null : new Date().toISOString();
  busy.value = true;
  error.value = '';
  try {
    await saveForm({ ...f, archived_at });
    notice.value = archived_at ? 'Archived. Existing responses remain available.' : 'Restored.';
    await load();
    emit('changed');
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}

async function cancelPending(f) {
  busy.value = true;
  error.value = '';
  try {
    await cancelRequest(f.pending_request_id);
    notice.value =
      f.pending_request_type === 'form_delete'
        ? 'Request cancelled.'
        : 'Request cancelled. The form is a draft you can edit again.';
    await load();
    emit('changed');
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}

function removeConfirmCopy(f) {
  return f.event_id
    ? 'This deletes the form and every response forever. The event can then be set to No form.'
    : 'This deletes the form and every response forever.';
}

async function removeForm(f) {
  const yes = await askConfirm({
    title: `Remove “${f.title}”?`,
    message: removeConfirmCopy(f),
    confirmLabel: 'Remove form',
    danger: true,
  });
  if (!yes) return;
  busy.value = true;
  error.value = '';
  formError.value = '';
  try {
    await deleteLoungeForm(f.id);
    notice.value = 'Form removed.';
    if (form.value?.id === f.id) {
      form.value = null;
      dlg.value?.close();
    }
    await load();
    emit('changed');
  } catch (e) {
    const text = errorText(e);
    if (form.value) formError.value = text;
    else error.value = text;
  } finally {
    busy.value = false;
  }
}

async function askRemoveForm(f) {
  const yes = await askConfirm({
    title: `Ask Super Admin to remove “${f.title}”?`,
    message: 'A Super Admin has to delete it. That cannot be undone after they approve.',
    confirmLabel: 'Ask Super Admin',
    danger: true,
  });
  if (!yes) return;
  busy.value = true;
  error.value = '';
  formError.value = '';
  try {
    await requestFormDelete(f.id);
    notice.value = 'Sent to a Super Admin.';
    await load();
    if (form.value?.id === f.id) {
      const updated = forms.value.find((row) => row.id === f.id);
      if (updated) Object.assign(form.value, updated);
    }
    emit('changed');
  } catch (e) {
    const text = errorText(e);
    if (form.value) formError.value = text;
    else error.value = text;
  } finally {
    busy.value = false;
  }
}

function answerText(row, field) {
  const captured = (row.field_schema || []).find(
    (item) => JSON.stringify([item.key, item.label || item.key, item.type || '']) === field.identity
  );
  if (!captured) return '–';
  const value = row.answers?.[captured.key];
  if (Array.isArray(value)) return value.join('; ');
  if (value == null || value === '') return '–';
  return String(value);
}

async function openResponses(f) {
  responsesFor.value = f;
  responses.value = [];
  responseFields.value = [];
  respError.value = '';
  reviewError.value = '';
  refreshNotice.value = '';
  statusFilter.value = 'all';
  sortOrder.value = 'newest';
  respLoading.value = true;
  try {
    const rows = await exportFormResponses(f.id);
    responses.value = rows;
    responseFields.value = formResponsesToCsv(rows).fields;
  } catch (e) {
    respError.value = errorText(e);
  } finally {
    respLoading.value = false;
  }
}

function askReject(r) {
  rejecting.value = r;
  rejectReason.value = '';
  rejectError.value = '';
}

// Re-reads the list so reviewer and time come from the database. Returns false when that fails.
async function refreshResponses(formId) {
  try {
    const rows = await exportFormResponses(formId);
    if (responsesFor.value?.id === formId) responses.value = rows;
    return true;
  } catch {
    return false;
  }
}

// The decision is saved once the RPC succeeds: patch the row from its result so the table is right
// at once, then refresh in the background. A failed refresh is a notice, never a failed review.
async function review(r, status, reason = null) {
  if (saving[r.id]) return false;
  saving[r.id] = true;
  reviewError.value = '';
  refreshNotice.value = '';
  const formId = responsesFor.value?.id;
  try {
    const saved = await reviewFormResponse(
      r.id,
      status,
      r.resubmitted_at ?? r.submitted_at,
      reason
    );
    if (responsesFor.value?.id === formId) {
      const pending = saved.review_status === 'pending';
      responses.value = responses.value.map((x) =>
        x.id === r.id
          ? {
              ...x,
              review_status: saved.review_status,
              review_reason: saved.review_reason,
              reviewed_at: saved.reviewed_at,
              reviewer_name: pending ? null : (auth.profile?.full_name ?? null),
              reviewer_email: pending ? null : (auth.profile?.email ?? null),
            }
          : x
      );
    }
    refreshResponses(formId).then((ok) => {
      if (!ok && responsesFor.value?.id === formId)
        refreshNotice.value = "Saved, but couldn't refresh the list.";
    });
    return true;
  } catch (e) {
    if (e?.code === 'PT409') {
      // The member changed their answers since this list loaded: drop the decision and reload.
      rejectDlg.value?.close();
      reviewError.value = errorText(e);
      if (!(await refreshResponses(formId)))
        refreshNotice.value = "Couldn't refresh the list. Close and reopen it.";
    } else if (rejecting.value) rejectError.value = errorText(e);
    else reviewError.value = errorText(e);
    return false;
  } finally {
    delete saving[r.id];
  }
}

async function confirmReject() {
  const target = rejecting.value;
  const reason = rejectReason.value.trim();
  if (!target || !reason) return;
  rejectError.value = '';
  if (await review(target, 'rejected', reason)) rejectDlg.value?.close();
}

function downloadResponses() {
  const csv = formResponsesToCsv(responses.value);
  downloadCsv(`${responsesFor.value.title}-responses.csv`, csv.rows, csv.columns);
}
</script>

<style scoped>
.between {
  justify-content: space-between;
  align-items: center;
}
.grp + .grp {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
}
.editor > .adm-note {
  margin-bottom: 20px;
}
.grp .adm-kicker {
  margin-bottom: 14px;
  font-size: 12px;
  color: var(--ink-2);
}
.grp > .adm-note {
  margin-bottom: 14px;
}
.checks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  align-self: end;
  min-height: 40px;
  gap: 10px 24px;
}
.questions {
  display: grid;
  gap: 12px;
  margin: 0 0 14px;
  padding: 0;
  list-style: none;
}
.question {
  display: grid;
  gap: 14px;
}
.question-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.question-head .adm-kicker {
  margin: 0;
}
.advanced {
  padding-top: 10px;
  border-top: 1px dashed var(--line);
}
.advanced summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
  color: var(--ink-2);
}
.advanced-body {
  margin-top: 14px;
}
.add-question {
  width: 100%;
}
.push {
  margin-right: auto;
}
.foot-msg {
  flex-basis: 100%;
}
.resp-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.resp-bar b {
  color: var(--ink);
}
.resp-wrap {
  max-height: calc(100dvh - 220px);
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--card);
}
.resp {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 14px;
}
.resp th,
.resp td {
  min-width: 140px;
  max-width: 280px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
  white-space: pre-line;
}
.resp tbody tr:last-child td {
  border-bottom: 0;
}
.resp th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding-top: 10px;
  padding-bottom: 10px;
  background: var(--sunk);
  font-size: 12.5px;
  font-weight: 650;
  color: var(--ink-2);
}
.resp .who {
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 220px;
  background: var(--card);
}
.resp th.who {
  z-index: 3;
  background: var(--sunk);
}
.resp td.who {
  font-family: var(--mono);
  font-size: 13px;
}
.resp .when {
  min-width: 0;
  white-space: nowrap;
  color: var(--ink-2);
  font-size: 13px;
}
.none {
  color: var(--ink-3);
}
.resp-scope {
  color: var(--ink-3);
  font-size: 12px;
}
.mono {
  font-family: var(--mono);
  font-size: 13px;
}
.resp-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  margin-bottom: 14px;
}
.resp-tools .n {
  margin-left: 4px;
  font-variant-numeric: tabular-nums;
  opacity: 0.75;
}
.sort {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}
.sort .adm-select {
  min-width: 140px;
}
.serial {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--sunk);
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 700;
}
.member-name {
  display: block;
  margin-top: 3px;
  color: var(--ink-2);
  font-family: var(--font);
  font-size: 12.5px;
}
.resp .review {
  min-width: 210px;
}
.why {
  margin: 6px 0 0;
  color: var(--verm);
  font-size: 13px;
  white-space: pre-line;
}
.by {
  margin: 4px 0 0;
  color: var(--ink-3);
  font-size: 12px;
}
.resent {
  display: block;
  margin-top: 4px;
  color: var(--ink-3);
  font-size: 12px;
}
.actions {
  margin-top: 8px;
}
.reject {
  display: grid;
  gap: 14px;
}
.reject .adm-input {
  height: auto;
  resize: vertical;
}
@media (max-width: 760px) {
  .resp-wrap {
    max-height: calc(100dvh - 180px);
  }
}
</style>

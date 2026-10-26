<!-- Every student in scope, signed in or not yet (Super Admin: all; RC: own region; Head or
     Co-Head: their community's tagged students). Open one to see their details and community
     tags. Super Admins and RCs file requests about signed-in students and add students; a Super
     Admin tags and untags; a Head or Co-Head asks a Super Admin to remove a tag. -->
<template>
  <div>
    <div class="adm-toolbar">
      <label class="adm-field grow">
        <span>Search</span>
        <input
          v-model.trim="query"
          class="adm-input"
          type="search"
          maxlength="100"
          placeholder="Name, email, phone or roll number"
          @input="onSearch"
        />
      </label>
      <label class="adm-field">
        <span>Status</span>
        <AdminSelect v-model="status" :options="statuses" value-key="id" @change="reload" />
      </label>
      <label v-if="isSuperAdmin" class="adm-field">
        <span>Region</span>
        <AdminSelect
          v-model="regionId"
          :options="[{ id: null, name: 'All regions' }, ...lookups.regions]"
          value-key="id"
          label-key="name"
          @change="reload"
        />
      </label>
      <!-- A Head or Co-Head sees only their own community's students, so there is nothing to filter. -->
      <label v-if="isSuperAdmin || isRc" class="adm-field">
        <span>Community</span>
        <AdminSelect
          v-model="communityId"
          :options="[{ id: null, name: 'Any community' }, ...visibleCommunities]"
          value-key="id"
          label-key="name"
          @change="reload"
        />
      </label>
      <!-- Add students lives in the admin bar; tagging many at once is a Super Admin's. -->
      <button v-if="isSuperAdmin" type="button" class="adm-btn ghost" @click="tagging = true">
        Add to a community
      </button>
    </div>

    <p v-if="error" class="adm-msg err" role="alert">{{ error }}</p>
    <p v-if="query && query.length < 3" class="adm-note">Type at least 3 characters to search.</p>
    <p v-else-if="query" class="adm-note">
      Name and phone find signed-in students. Email and roll number find everyone.
    </p>
    <p v-if="!loading && !error && rows.length" class="adm-note count" role="status">
      Showing {{ rows.length }} of {{ total }} {{ total === 1 ? 'student' : 'students' }}.
    </p>

    <div v-if="rows.length" class="adm-card student-table adm-table-wrap">
      <table class="adm-table stack">
        <thead>
          <tr>
            <th class="serial" scope="col">#</th>
            <th>Student</th>
            <th>Region</th>
            <th>Communities</th>
            <th>Status</th>
            <th><span class="visually-hidden">Open profile</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(m, i) in rows"
            :key="m.id ?? m.email"
            class="student-row"
            @click="onRowClick($event, m)"
          >
            <td class="serial">{{ i + 1 }}</td>
            <td>
              <button class="student-name" @click="open(m)">
                <b>{{ m.preferred_name || m.full_name || 'Name not set' }}</b
                ><small>{{ m.email }}</small
                ><small v-if="m.member_code" class="mono">{{ m.member_code }}</small
                ><small v-if="m.phone" class="mono">{{ m.phone }}</small>
              </button>
            </td>
            <td data-label="Region">{{ regionOf(m.region_id) }}</td>
            <td data-label="Communities">
              <span v-if="m.communities.length" class="tags">
                <span v-for="c in m.communities" :key="c" class="adm-badge">{{
                  communityName(c)
                }}</span>
              </span>
              <span v-else class="none">–</span>
            </td>
            <td data-label="Status">
              <span class="adm-badge" :class="statusTone(m.account_status)">{{
                statusLabel(m.account_status)
              }}</span>
            </td>
            <td>
              <button
                class="adm-btn small open"
                :aria-label="`Open ${m.preferred_name || m.full_name || m.email}`"
                @click="open(m)"
              >
                Open <LineIcon name="next" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="!loading && !error" class="adm-empty">
      {{
        query.length >= 3
          ? 'No student matches that search.'
          : isHead && !isSuperAdmin && !isRc
            ? 'No student is tagged with your community yet. Approving a response on its join form tags the student.'
            : 'No students match these filters.'
      }}
    </p>
    <p v-if="loading" class="adm-note" role="status">Loading students…</p>
    <div v-if="rows.length < total" class="more">
      <button type="button" class="adm-btn ghost" :disabled="loading" @click="load(true)">
        Show more ({{ total - rows.length }} left)
      </button>
    </div>

    <AdminRosterAdd v-if="adding" :lookups="lookups" @changed="changed" @close="adding = false" />
    <AdminCommunityAdd
      v-if="tagging"
      :lookups="lookups"
      @changed="changed"
      @close="tagging = false"
    />

    <AdminDialog v-if="detail" ref="dlg" side :title="detailTitle" @close="detail = null">
      <template v-if="mode === 'view'">
        <dl class="adm-facts">
          <div v-if="detail.member.member_code">
            <dt>Roll / code</dt>
            <dd class="mono">{{ detail.member.member_code }}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{{ statusLabel(detail.member.account_status) }}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{{ detail.member.email }}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd class="mono">{{ detail.member.phone || '–' }}</dd>
          </div>
          <div>
            <dt>Region</dt>
            <dd>{{ regionOf(detail.member.region_id) }}</dd>
          </div>
          <div>
            <dt>Gender</dt>
            <dd>{{ detail.member.gender || '–' }}</dd>
          </div>
          <div>
            <dt>Full name</dt>
            <dd>{{ detail.member.full_name || '–' }}</dd>
          </div>
          <div v-if="!onRoster">
            <dt>Preferred name</dt>
            <dd>{{ detail.member.preferred_name || '–' }}</dd>
          </div>
          <div v-if="detail.full">
            <dt>Position</dt>
            <dd>{{ positionText(detail.position) }}</dd>
          </div>
          <div>
            <dt>{{ onRoster ? 'Added' : 'Joined' }}</dt>
            <dd>{{ day(detail.member.created_at) }}</dd>
          </div>
          <div v-if="detail.full">
            <dt>Regional form</dt>
            <dd>
              {{ detail.regional ? `Filled ${day(detail.regional.updated_at)}` : 'Not filled' }}
            </dd>
          </div>
        </dl>

        <p v-if="done" class="adm-msg ok spaced" role="status">{{ done }}</p>
        <p v-if="actionError" class="adm-msg err spaced" role="alert">{{ actionError }}</p>

        <p class="adm-kicker spaced">Communities</p>
        <ul v-if="detail.communities.length" class="tag-list">
          <li v-for="c in detail.communities" :key="c">
            <span>{{ communityName(c) }}</span>
            <button
              v-if="isSuperAdmin"
              type="button"
              class="adm-btn danger small"
              :disabled="busy"
              @click="untag(c)"
            >
              Remove
            </button>
            <button
              v-else-if="c === myCommunityId"
              type="button"
              class="adm-btn ghost small"
              @click="askUntag(c)"
            >
              Ask to remove
            </button>
          </li>
        </ul>
        <p v-else class="adm-note">Not in any community{{ isSuperAdmin ? '' : ' you can see' }}.</p>
        <form
          v-if="isSuperAdmin && untagged.length && detail.member.account_status !== 'deleted'"
          class="tag-add"
          @submit.prevent="tag"
        >
          <label class="adm-field">
            <span>Add to</span>
            <AdminSelect
              v-model="form.tag_id"
              :options="untagged"
              value-key="id"
              label-key="name"
            />
          </label>
          <button type="submit" class="adm-btn ghost" :disabled="busy || !form.tag_id">Add</button>
        </form>

        <template v-if="onRoster && (isSuperAdmin || isRc)">
          <p class="adm-kicker spaced">Roster</p>
          <p class="adm-note">This student has not signed in yet.</p>
          <div class="ask-grid">
            <button type="button" class="adm-btn danger" :disabled="busy" @click="removeRoster">
              Remove from roster
            </button>
          </div>
        </template>

        <template v-if="detail.full">
          <p class="adm-kicker spaced">Ask for a change</p>
          <div class="ask-grid">
            <button v-if="canEdit" type="button" class="adm-btn mari" @click="startEdit">
              Edit details
            </button>
            <button
              v-if="canRequestRemoval"
              type="button"
              class="adm-btn danger"
              @click="ask('delete')"
            >
              Delete
            </button>
            <button
              v-if="canRequestRemoval"
              type="button"
              class="adm-btn danger"
              @click="ask('blacklist')"
            >
              Blacklist
            </button>
            <template v-if="isSuperAdmin && !isSelf">
              <button
                v-if="detail.member.account_status !== 'deleted'"
                type="button"
                class="adm-btn ghost"
                @click="startEmail"
              >
                Change login email
              </button>
              <button
                v-for="a in statusActions"
                :key="a"
                type="button"
                :class="['adm-btn', a === 'suspend' ? 'danger' : 'ghost']"
                @click="ask(a)"
              >
                {{ STATUS_ACTION_LABEL[a] }}
              </button>
              <button v-if="canErase" type="button" class="adm-btn danger" @click="ask('erase')">
                Erase permanently
              </button>
              <button
                v-if="detail.position"
                type="button"
                class="adm-btn danger"
                @click="ask('revoke')"
              >
                Revoke position
              </button>
              <button
                v-else-if="detail.member.account_status === 'active'"
                type="button"
                class="adm-btn ghost"
                @click="startPosition"
              >
                Give a position
              </button>
            </template>
          </div>
          <p v-if="!canEdit && !isSuperAdmin" class="adm-note spaced">
            Coordinators and Super Admins are changed by a Super Admin only.
          </p>
        </template>
      </template>

      <form v-else-if="mode === 'edit'" class="adm-form" @submit.prevent="submitEdit">
        <label class="adm-field wide">
          <span>Full name (as on the roster)</span>
          <input v-model="form.full_name" class="adm-input" maxlength="200" />
          <small>Leave an unknown name unchanged. A new full name cannot be blank.</small>
        </label>
        <label class="adm-field">
          <span>Preferred name</span>
          <input v-model="form.preferred_name" class="adm-input" maxlength="100" />
        </label>
        <label class="adm-field">
          <span>Gender</span>
          <AdminSelect v-model="form.gender" :options="GENDER_OPTIONS" />
        </label>
        <label class="adm-field">
          <span>Phone (optional)</span>
          <input
            v-model="form.phone"
            class="adm-input"
            inputmode="tel"
            placeholder="+919876543210"
          />
        </label>
        <label class="adm-field">
          <span>Region</span>
          <AdminSelect
            v-model="form.region_id"
            :options="lookups.regions"
            value-key="id"
            label-key="name"
          />
        </label>
        <label class="adm-field wide">
          <span>Why</span>
          <textarea v-model.trim="form.reason" class="adm-input" required maxlength="2000" />
          <small>
            A Super Admin reads this before approving. The login email is changed separately (Super
            Admins: Change login email).
          </small>
        </label>
        <p v-if="actionError" class="adm-msg err wide" role="alert">{{ actionError }}</p>
        <div class="wide adm-actions">
          <button type="button" class="adm-btn ghost" @click="mode = 'view'">Back</button>
          <button type="submit" class="adm-btn mari" :disabled="busy">Send for approval</button>
        </div>
      </form>

      <form v-else-if="mode === 'position'" class="adm-form" @submit.prevent="submitPosition">
        <label class="adm-field">
          <span>Position</span>
          <AdminSelect v-model="form.position" :options="positionOptions" />
        </label>
        <label v-if="form.position !== 'rc'" class="adm-field">
          <span>Community</span>
          <AdminSelect
            v-model="form.community_id"
            :options="lookups.communities"
            value-key="id"
            label-key="name"
          />
        </label>
        <label class="adm-field wide">
          <span>Why</span>
          <textarea v-model.trim="form.reason" class="adm-input" required maxlength="2000" />
          <small>
            A region may have at most two coordinators. International has none. Another Super Admin
            approves this. Super Admin accounts are fixed.
          </small>
        </label>
        <p v-if="actionError" class="adm-msg err wide" role="alert">{{ actionError }}</p>
        <div class="wide adm-actions">
          <button type="button" class="adm-btn ghost" @click="mode = 'view'">Back</button>
          <button type="submit" class="adm-btn mari" :disabled="busy">Send for approval</button>
        </div>
      </form>

      <form v-else-if="mode === 'email'" class="adm-form" @submit.prevent="submitEmail">
        <p class="adm-note wide">
          Their Google sign-in moves to the new address. Another Super Admin has to approve it.
        </p>
        <label class="adm-field wide">
          <span>New IITM email</span>
          <input
            v-model.trim="form.email"
            class="adm-input"
            type="email"
            required
            placeholder="21f1000000@ds.study.iitm.ac.in"
          />
        </label>
        <label class="adm-field wide">
          <span>Why</span>
          <textarea v-model.trim="form.reason" class="adm-input" required maxlength="2000" />
        </label>
        <p v-if="actionError" class="adm-msg err wide" role="alert">{{ actionError }}</p>
        <div class="wide adm-actions">
          <button type="button" class="adm-btn ghost" @click="mode = 'view'">Back</button>
          <button type="submit" class="adm-btn mari" :disabled="busy">Send for approval</button>
        </div>
      </form>

      <form v-else-if="mode === 'reason'" class="adm-form" @submit.prevent="submitReason">
        <p class="adm-note wide">{{ pending.explain }}</p>
        <label class="adm-field wide">
          <span>Why</span>
          <textarea v-model.trim="form.reason" class="adm-input" required maxlength="2000" />
        </label>
        <p v-if="actionError" class="adm-msg err wide" role="alert">{{ actionError }}</p>
        <div class="wide adm-actions">
          <button type="button" class="adm-btn ghost" @click="mode = 'view'">Back</button>
          <button
            type="submit"
            class="adm-btn"
            :class="pending.danger ? 'danger' : 'mari'"
            :disabled="busy"
          >
            {{ pending.cta }}
          </button>
        </div>
      </form>
    </AdminDialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import AdminDialog from './AdminDialog.vue';
import AdminSelect from './AdminSelect.vue';
import AdminCommunityAdd from './AdminCommunityAdd.vue';
import AdminRosterAdd from './AdminRosterAdd.vue';
import LineIcon from '../site/LineIcon.vue';
import { askConfirm } from '../../lib/admin-confirm.js';
import { auth, errorText, isHead, isRc, isSuperAdmin } from '../../lib/auth.js';
import {
  GENDER_OPTIONS,
  POSITION_LABEL,
  STATUS_ACTION_LABEL,
  addCommunityMembers,
  getMember,
  isInternationalRegion,
  listStudents,
  removeCommunityMember,
  requestBlacklist,
  requestDeletion,
  requestContactChange,
  requestHardDelete,
  requestPosition,
  requestStatus,
  requestTagRemoval,
  requestUpdate,
  rosterRemove,
} from '../../lib/admin.js';

const props = defineProps({
  lookups: { type: Object, required: true },
  initialId: { type: String, default: null },
});
const emit = defineEmits(['changed']);

const query = ref('');
const status = ref('current');
const regionId = ref(null);
const communityId = ref(null);
const rows = ref([]);
const total = ref(0);
const page = ref(0);
const loading = ref(false);
const error = ref('');
const adding = ref(false);
const tagging = ref(false);

const statuses = computed(() => [
  { id: 'current', label: 'Everyone' },
  { id: 'signed_in', label: 'Signed in' },
  { id: 'not_signed_in', label: 'Not signed in yet' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'blacklisted', label: 'Blacklisted' },
  ...(isSuperAdmin.value ? [{ id: 'deleted', label: 'Deleted' }] : []),
]);
const STATUS_LABEL = {
  active: 'Signed in',
  not_signed_in: 'Not signed in yet',
  suspended: 'Suspended',
  blacklisted: 'Blacklisted',
  deleted: 'Deleted',
};
const canAddStudents = computed(() => isSuperAdmin.value || isRc.value);
const myCommunityId = computed(() => (isHead.value ? auth.dashboard?.community_id : null));
// A members-only community's tags show only to Super Admins and its own Head and Co-Head.
const visibleCommunities = computed(() =>
  props.lookups.communities.filter(
    (c) => !c.members_only || isSuperAdmin.value || c.id === myCommunityId.value
  )
);

const regionOf = (id) => props.lookups.regions.find((r) => r.id === id)?.name ?? '–';
const communityName = (id) => props.lookups.communities.find((c) => c.id === id)?.name ?? '–';
const statusLabel = (s) => STATUS_LABEL[s] ?? s;
const statusTone = (s) =>
  ['active', 'not_signed_in'].includes(s) ? '' : s === 'suspended' ? 'mari' : 'verm';
const day = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '–';
const positionText = (p) =>
  !p
    ? 'None'
    : p.position === 'rc'
      ? `RC, ${regionOf(p.region_id)}`
      : `${POSITION_LABEL[p.position]}, ${communityName(p.community_id)}`;

const filters = () => ({
  query: query.value.length >= 3 ? query.value.slice(0, 100) : '',
  status: status.value,
  regionId: regionId.value,
  communityId: communityId.value,
});

let loadId = 0;
async function load(more = false) {
  const id = ++loadId;
  const nextPage = more ? page.value + 1 : 0;
  loading.value = true;
  error.value = '';
  try {
    const result = await listStudents({ ...filters(), page: nextPage });
    if (id !== loadId) return;
    rows.value = more ? rows.value.concat(result.rows) : result.rows;
    total.value = result.total;
    page.value = nextPage;
  } catch (e) {
    if (id !== loadId) return;
    error.value = errorText(e);
  } finally {
    if (id === loadId) loading.value = false;
  }
}
const reload = () => load();

let searchTimer;
function onSearch() {
  clearTimeout(searchTimer);
  if (query.value && query.value.length < 3) return;
  searchTimer = setTimeout(reload, 300);
}

function changed() {
  reload();
  emit('changed');
}

function create() {
  if (canAddStudents.value) adding.value = true;
}

onMounted(() => {
  reload();
  if (props.initialId) open(props.initialId);
});
onBeforeUnmount(() => {
  loadId++;
  clearTimeout(searchTimer);
});
defineExpose({ openRecord: open, create });

// Detail and requests

// detail: { member, communities, full } plus position and regional when full. Super Admins and
// RCs read a signed-in student's whole record; roster students and a Head's view use the row.
const detail = ref(null);
const mode = ref('view');
const busy = ref(false);
const done = ref('');
const actionError = ref('');
const pending = ref(null);
const form = reactive({});

const detailTitle = computed(() =>
  detail.value
    ? detail.value.member.preferred_name ||
      detail.value.member.full_name ||
      detail.value.member.email
    : ''
);
const onRoster = computed(() => detail.value?.member.account_status === 'not_signed_in');
const untagged = computed(() =>
  props.lookups.communities.filter((c) => !detail.value?.communities.includes(c.id))
);
const isSelf = computed(() => detail.value?.member.id === auth.profile?.id);
const targetIsAdmin = computed(() => !!detail.value?.position);
const internationalTarget = computed(() =>
  isInternationalRegion(props.lookups.regions.find((r) => r.id === detail.value?.member.region_id))
);
const positionOptions = computed(() =>
  [
    !internationalTarget.value && {
      value: 'rc',
      label: `Regional Coordinator (${regionOf(detail.value?.member.region_id)})`,
    },
    { value: 'head', label: 'Community Head' },
    { value: 'co_head', label: 'Community Co-Head' },
  ].filter(Boolean)
);
const canEdit = computed(
  () =>
    !isSelf.value &&
    detail.value?.member.account_status !== 'deleted' &&
    (isSuperAdmin.value || !targetIsAdmin.value)
);
const canRequestRemoval = computed(
  () =>
    !isSelf.value &&
    !targetIsAdmin.value &&
    !['deleted', 'blacklisted'].includes(detail.value?.member.account_status)
);
const statusActions = computed(() => {
  const s = detail.value?.member.account_status;
  return (
    {
      active: ['suspend'],
      suspended: ['reinstate'],
      deleted: ['restore'],
      blacklisted: ['lift_blacklist'],
    }[s] ?? []
  );
});
const canErase = computed(() => {
  const m = detail.value?.member;
  return (
    m?.account_status === 'deleted' &&
    m.deleted_at &&
    Date.now() - new Date(m.deleted_at) >= 30 * 864e5
  );
});

// A click anywhere on the row opens the student. Buttons keep their own handlers,
// so clicks on them are left alone here to avoid opening twice.
function onRowClick(event, row) {
  if (event.target.closest('button, a, select, input, label')) return;
  open(row);
}

const fromRow = (row) => ({
  member: { ...row, created_at: row.joined_at },
  communities: row.communities ?? [],
  full: false,
});

// Opens a list row, or a member id from search and links elsewhere in Admin.
async function open(rowOrId) {
  done.value = actionError.value = '';
  mode.value = 'view';
  const row = typeof rowOrId === 'string' ? null : rowOrId;
  const id = row ? row.id : rowOrId;
  if (row && (row.kind === 'roster' || !(isSuperAdmin.value || isRc.value))) {
    detail.value = fromRow(row);
    reset();
    return;
  }
  try {
    const record = await getMember(id);
    if (!record.member) throw new Error('This student is outside your scope.');
    let communities = row?.communities;
    if (!communities) {
      // Linked by id: the tags come from the list, found by exact email.
      const found = await listStudents({
        query: record.member.email,
        status: record.member.account_status === 'deleted' ? 'deleted' : 'current',
      });
      communities = found.rows.find((r) => r.email === record.member.email)?.communities ?? [];
    }
    detail.value = { ...record, communities, full: true };
    reset();
  } catch (e) {
    error.value = errorText(e);
  }
}

function setTags(email, communities) {
  if (detail.value?.member.email === email) detail.value.communities = communities;
  const row = rows.value.find((r) => r.email === email);
  if (row) row.communities = communities;
}

async function tag() {
  const { email } = detail.value.member;
  const cid = form.tag_id;
  busy.value = true;
  done.value = actionError.value = '';
  try {
    const result = await addCommunityMembers(cid, [email]);
    if (result?.not_in_house?.length || result?.invalid?.length)
      throw new Error('Only students in the house can be tagged.');
    setTags(
      email,
      [...detail.value.communities, cid].sort((a, b) => a - b)
    );
    done.value = `Added to ${communityName(cid)}.`;
    form.tag_id = untagged.value[0]?.id ?? null;
    emit('changed');
  } catch (e) {
    actionError.value = errorText(e);
  } finally {
    busy.value = false;
  }
}

async function untag(cid) {
  const { email } = detail.value.member;
  const name = communityName(cid);
  const yes = await askConfirm({
    title: `Remove from ${name}?`,
    message: `${email} loses the ${name} tag.`,
    confirmLabel: 'Remove',
    danger: true,
  });
  if (!yes) return;
  busy.value = true;
  done.value = actionError.value = '';
  try {
    await removeCommunityMember(cid, email);
    setTags(
      email,
      detail.value.communities.filter((c) => c !== cid)
    );
    done.value = `Removed from ${name}.`;
    form.tag_id = untagged.value[0]?.id ?? null;
    emit('changed');
  } catch (e) {
    actionError.value = errorText(e);
  } finally {
    busy.value = false;
  }
}

function askUntag(cid) {
  const name = communityName(cid);
  pending.value = {
    explain: `A Super Admin reviews this. Once approved, the student loses the ${name} tag.`,
    cta: 'Ask to remove',
    danger: true,
    run: (_, why) => requestTagRemoval(cid, detail.value.member.email, why),
  };
  reset();
  mode.value = 'reason';
}

async function removeRoster() {
  const { email } = detail.value.member;
  const yes = await askConfirm({
    title: 'Remove from the roster?',
    message: `${email} will no longer be able to sign in for the first time.`,
    confirmLabel: 'Remove',
    danger: true,
  });
  if (!yes) return;
  busy.value = true;
  actionError.value = '';
  try {
    await rosterRemove(email);
    detail.value = null;
    changed();
  } catch (e) {
    actionError.value = errorText(e);
  } finally {
    busy.value = false;
  }
}

function reset(extra = {}) {
  for (const k of Object.keys(form)) delete form[k];
  Object.assign(form, { reason: '', tag_id: untagged.value[0]?.id ?? null }, extra);
  actionError.value = '';
}

function startEdit() {
  const m = detail.value.member;
  reset({
    full_name: m.full_name,
    preferred_name: m.preferred_name ?? '',
    gender: m.gender ?? '',
    phone: m.phone,
    region_id: m.region_id,
  });
  mode.value = 'edit';
}

const ASK = {
  delete: {
    explain:
      'The student is removed from the house and can no longer sign in. A Super Admin can restore them later.',
    cta: 'Ask to delete',
    danger: true,
    run: (id, why) => requestDeletion(id, why),
  },
  blacklist: {
    explain:
      'The account is blacklisted. Sign-in is blocked until a Super Admin lifts the blacklist.',
    cta: 'Ask to blacklist',
    danger: true,
    run: (id, why) => requestBlacklist(id, why),
  },
  suspend: {
    explain: 'The student cannot sign in until reinstated.',
    cta: 'Ask to suspend',
    run: (id, why) => requestStatus(id, 'suspend', why),
  },
  reinstate: {
    explain: 'The student can sign in again.',
    cta: 'Ask to reinstate',
    run: (id, why) => requestStatus(id, 'reinstate', why),
  },
  restore: {
    explain: 'The deleted student becomes active again.',
    cta: 'Ask to restore',
    run: (id, why) => requestStatus(id, 'restore', why),
  },
  lift_blacklist: {
    explain: 'The blacklist ends; a blacklisted (not deleted) student becomes active again.',
    cta: 'Ask to lift',
    run: (id, why) => requestStatus(id, 'lift_blacklist', why),
  },
  erase: {
    explain:
      'Permanent: personal details are erased and the account is removed. A second Super Admin carries it out from Requests.',
    cta: 'Ask to erase',
    danger: true,
    run: (id, why) => requestHardDelete(id, why),
  },
  revoke: {
    explain: 'The student stops being a coordinator or community lead.',
    cta: 'Ask to revoke',
    run: (id, why) => requestPosition(id, 'revoke', null, null, why),
  },
};

function ask(kind) {
  pending.value = ASK[kind];
  reset();
  mode.value = 'reason';
}

async function file(run) {
  busy.value = true;
  actionError.value = '';
  try {
    await run();
    done.value = isSuperAdmin.value
      ? 'Request sent. Another Super Admin has to approve it.'
      : 'Request sent. A Super Admin will review it.';
    mode.value = 'view';
    emit('changed');
  } catch (e) {
    actionError.value = errorText(e);
  } finally {
    busy.value = false;
  }
}

function submitReason() {
  return file(() => pending.value.run(detail.value.member.id, form.reason));
}

function submitEdit() {
  const m = detail.value.member;
  const changes = {};
  for (const k of ['full_name', 'preferred_name', 'gender', 'phone', 'region_id']) {
    const before = m[k] ?? '';
    const after = typeof form[k] === 'string' ? form[k].trim() : form[k];
    if (String(after ?? '') !== String(before)) changes[k] = after === '' ? null : after;
  }
  if (Object.hasOwn(changes, 'full_name') && !changes.full_name) {
    actionError.value = 'A new full name cannot be blank.';
    return;
  }
  if (!Object.keys(changes).length) {
    actionError.value = 'Nothing has changed.';
    return;
  }
  return file(() => requestUpdate(m.id, changes, form.reason));
}

function submitPosition() {
  return file(() =>
    requestPosition(
      detail.value.member.id,
      'assign',
      form.position,
      form.position === 'rc' ? null : form.community_id,
      form.reason
    )
  );
}

function startEmail() {
  reset({ email: '' });
  mode.value = 'email';
}

function submitEmail() {
  return file(() => requestContactChange(detail.value.member.id, form.email, form.reason));
}

function startPosition() {
  reset({
    position: internationalTarget.value ? 'head' : 'rc',
    community_id: props.lookups.communities[0]?.id ?? null,
  });
  mode.value = 'position';
}
</script>

<style scoped>
.student-table {
  padding: 0;
}
.student-row {
  cursor: pointer;
}
.student-row:hover {
  background: var(--sunk);
}
/* A running count down the list, like a spreadsheet's row numbers; Show more carries it on. */
.serial {
  width: 1%;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
td.serial {
  padding-top: 12px; /* level with the name, which sits 4px down in its button */
}
.student-name {
  background: transparent;
  color: var(--ink);
  border: 0;
  font: inherit;
  text-align: left;
  padding: 4px 0;
  cursor: pointer;
}
.student-name b {
  display: block;
  font-size: 14px;
}
.open svg {
  width: 14px;
  height: 14px;
}
.ask-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 170px), 1fr));
  gap: 8px;
  margin-top: 8px;
}
.ask-grid .adm-btn {
  justify-content: center;
  width: 100%;
  text-align: center;
}
@media (max-width: 640px) {
  /* On a phone card the number sits in the top corner and the name keeps the full first line. */
  .student-row {
    position: relative;
  }
  .student-row .serial {
    position: absolute;
    top: 12px;
    right: 14px;
    width: auto;
    padding: 0;
  }
  .student-row td:nth-child(2) {
    grid-column: 1 / -1;
    padding-right: 40px;
  }
  .open {
    width: 100%;
    justify-content: center;
  }
}
.student-name small {
  display: block;
  font-size: 12px;
  color: var(--ink-3);
  overflow-wrap: anywhere;
}

.grow {
  flex: 1 1 280px;
}
.count {
  margin: 0 0 10px;
}
.tags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}
.none {
  color: var(--ink-3);
}
.tag-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.tag-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
}
.tag-add {
  display: flex;
  align-items: end;
  gap: 8px;
  margin-top: 10px;
}
.adm-select {
  min-width: 160px;
}
.more {
  display: flex;
  justify-content: center;
  margin-top: 14px;
}
.spaced {
  margin-top: 18px;
}
</style>

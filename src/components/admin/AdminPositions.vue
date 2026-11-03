<!-- Positions (Super Admin): 0–2 RCs per region, a Head and up to two Co-Heads per community. International
     has no RC. Revoking or giving a position is a request another Super Admin approves; give one
     from the Students tab. Super Admin accounts are fixed — there is no add/remove here. -->
<template>
  <div class="grid">
    <section class="position-group" aria-labelledby="regional-coordinators-title">
      <header class="group-head">
        <div>
          <p id="regional-coordinators-title" class="adm-kicker">Regional Coordinators</p>
          <p class="adm-note">
            Two slots per region. Names, member IDs and assignment dates are shown.
          </p>
        </div>
        <span class="adm-badge mari">{{ regionalCount }} assigned</span>
      </header>
      <ul class="adm-list">
        <li v-for="r in lookups.regions" :key="r.id" class="region-card">
          <div class="region-head">
            <b>{{ r.name }}</b>
            <span v-if="isInternationalRegion(r)" class="adm-badge">No coordinator slots</span>
            <span v-else class="adm-badge" :class="rcsOf(r.id).length ? 'mari' : ''">
              {{ rcsOf(r.id).length }}/2 filled
            </span>
          </div>
          <div v-if="!isInternationalRegion(r) && rcsOf(r.id).length" class="holder-list">
            <div v-for="p in rcsOf(r.id)" :key="p.id" class="position-holder">
              <span class="person-avatar" aria-hidden="true">{{ initials(p.member) }}</span>
              <div class="person-info">
                <b>{{ fullName(p.member) }}</b>
                <span class="person-detail">
                  <template v-if="p.member?.member_code">{{ p.member.member_code }}</template>
                  <template v-if="p.member?.member_code && p.member?.email"> · </template>
                  <template v-if="p.member?.email">{{ p.member.email }}</template>
                  <template v-if="!p.member?.member_code && !p.member?.email">
                    {{
                      p.member
                        ? `Member ${p.member.id.slice(-8)}`
                        : `Profile unavailable · ${p.member_id.slice(-8)}`
                    }}
                  </template>
                </span>
                <span class="assignment-date">Assigned {{ day(p.started_at) }}</span>
              </div>
              <button
                v-if="p.member?.id"
                type="button"
                class="adm-btn danger small"
                :aria-label="`Revoke ${fullName(p.member)} as Regional Coordinator for ${r.name}`"
                @click="ask(p)"
              >
                Revoke
              </button>
            </div>
          </div>
          <div v-else-if="!isInternationalRegion(r)" class="vacant-slot">
            <span class="vacant-dot" aria-hidden="true"></span>
            No regional coordinator assigned
          </div>
        </li>
      </ul>
    </section>
    <section class="position-group" aria-labelledby="community-leads-title">
      <header class="group-head">
        <div>
          <p id="community-leads-title" class="adm-kicker">Community leads</p>
          <p class="adm-note">One Head and up to two Co-Heads for each community.</p>
        </div>
        <span class="adm-badge mari">{{ communityCount }} assigned</span>
      </header>
      <ul class="adm-list">
        <template v-for="c in lookups.communities" :key="c.id">
          <li v-for="p in ['head', 'co_head']" :key="`${c.id}-${p}`" class="community-slot">
            <div class="region-head">
              <b>{{ c.name }}</b>
              <span class="adm-badge">{{ POSITION_LABEL[p] }}</span>
            </div>
            <div v-if="holdersOf(c.id, p).length" class="holder-list">
              <div v-for="h in holdersOf(c.id, p)" :key="h.id" class="position-holder">
                <span class="person-avatar" aria-hidden="true">{{ initials(h.member) }}</span>
                <div class="person-info">
                  <b>{{ fullName(h.member) }}</b>
                  <span class="person-detail">
                    <template v-if="h.member?.member_code">{{ h.member.member_code }}</template>
                    <template v-if="h.member?.member_code && h.member?.email"> · </template>
                    <template v-if="h.member?.email">{{ h.member.email }}</template>
                    <template v-if="!h.member?.member_code && !h.member?.email">
                      {{
                        h.member
                          ? `Member ${h.member.id.slice(-8)}`
                          : `Profile unavailable · ${h.member_id.slice(-8)}`
                      }}
                    </template>
                  </span>
                  <span class="assignment-date">Assigned {{ day(h.started_at) }}</span>
                </div>
                <button
                  v-if="h.member?.id"
                  type="button"
                  class="adm-btn danger small"
                  :aria-label="`Revoke ${fullName(h.member)} as ${POSITION_LABEL[p]} for ${c.name}`"
                  @click="ask(h)"
                >
                  Revoke
                </button>
              </div>
            </div>
            <div
              v-for="seat in SEATS[p] - holdersOf(c.id, p).length"
              :key="seat"
              class="vacant-slot"
            >
              <span class="vacant-dot" aria-hidden="true"></span>
              {{ p === 'head' ? 'Position vacant' : 'Co-Head seat vacant' }}
            </div>
          </li>
        </template>
      </ul>
      <p class="adm-note spaced">
        To fill a vacant post, open the student on the Students tab and choose Give a position.
        Super Admin login emails stay the three fixed accounts.
      </p>
    </section>
    <p v-if="error" class="adm-msg err wide" role="alert">{{ error }}</p>
    <p v-if="notice" class="adm-msg ok wide" role="status">{{ notice }}</p>

    <AdminDialog v-if="target" ref="dlg" title="Revoke position" @close="target = null">
      <form class="adm-form" @submit.prevent="submit">
        <p class="adm-note wide">
          {{ fullName(target.member) }} stops being {{ POSITION_LABEL[target.position] }} once
          another Super Admin approves.
        </p>
        <label class="adm-field wide">
          <span>Why</span>
          <textarea v-model.trim="reason" class="adm-input" required maxlength="2000" />
        </label>
        <p v-if="formError" class="adm-msg err wide" role="alert">{{ formError }}</p>
        <div class="wide adm-actions">
          <button type="submit" class="adm-btn mari" :disabled="busy">Send for approval</button>
        </div>
      </form>
    </AdminDialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import AdminDialog from './AdminDialog.vue';
import { errorText } from '../../lib/auth.js';
import {
  POSITION_LABEL,
  isInternationalRegion,
  listPositions,
  requestPosition,
} from '../../lib/admin.js';

defineProps({ lookups: { type: Object, required: true } });
const emit = defineEmits(['changed']);

const positions = ref([]);
const error = ref('');
const notice = ref('');
const target = ref(null);
const reason = ref('');
const formError = ref('');
const busy = ref(false);
const dlg = ref(null);

const regionalCount = computed(() => positions.value.filter((p) => p.position === 'rc').length);
const communityCount = computed(
  () => positions.value.filter((p) => p.position === 'head' || p.position === 'co_head').length
);
const rcsOf = (regionId) =>
  positions.value.filter((p) => p.position === 'rc' && p.region_id === regionId);
// Seats per community: one Head, up to two Co-Heads (enforced by the DB trigger).
const SEATS = { head: 1, co_head: 2 };
const holdersOf = (communityId, position) =>
  positions.value.filter((p) => p.position === position && p.community_id === communityId);
const fullName = (member) =>
  member?.full_name?.trim() || member?.preferred_name?.trim() || 'Name not set';
const initials = (member) => {
  const name = fullName(member);
  if (name === 'Name not set') return '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase();
};
const day = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

async function load() {
  try {
    positions.value = await listPositions();
  } catch (e) {
    error.value = errorText(e);
  }
}
onMounted(load);

function ask(p) {
  target.value = p;
  reason.value = '';
  formError.value = '';
}

async function submit() {
  busy.value = true;
  formError.value = '';
  try {
    await requestPosition(target.value.member.id, 'revoke', null, null, reason.value);
    notice.value = 'Request sent. Another Super Admin has to approve it.';
    dlg.value?.close();
    emit('changed');
  } catch (e) {
    formError.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 24px;
  align-items: start;
}
.position-group {
  min-width: 0;
}
.group-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.group-head .adm-kicker {
  margin-bottom: 5px;
}
.group-head .adm-note {
  max-width: 48ch;
}
.region-card,
.community-slot {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--line) 55%, transparent);
  border-radius: 12px;
  background: var(--card);
}
.region-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}
.region-head > b {
  min-width: 0;
  overflow-wrap: anywhere;
}
.holder-list {
  display: grid;
  gap: 8px;
}
.position-holder {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--line) 48%, transparent);
  border-radius: 10px;
  background: var(--paper);
}
.person-avatar {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid color-mix(in srgb, var(--mari) 42%, var(--line));
  border-radius: 50%;
  background: var(--mari-soft);
  color: var(--mari-ink);
  font-size: 13px;
  font-weight: 800;
}
.person-info {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.person-info > b,
.person-detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.person-detail,
.assignment-date {
  color: var(--ink-2);
  font-size: 12px;
}
.assignment-date {
  color: var(--ink-3);
}
.vacant-slot {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 10px;
  border: 1px dashed var(--line-strong);
  border-radius: 9px;
  color: var(--ink-3);
  font-size: 13px;
}
.vacant-dot {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: var(--ink-3);
}
.wide {
  grid-column: 1 / -1;
}
.spaced {
  margin-top: 14px;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 560px) {
  .group-head {
    align-items: flex-start;
  }
  .position-holder {
    grid-template-columns: 34px minmax(0, 1fr);
  }
  .person-avatar {
    width: 34px;
    height: 34px;
  }
  .position-holder .adm-btn {
    grid-column: 2;
    justify-self: start;
  }
}
</style>

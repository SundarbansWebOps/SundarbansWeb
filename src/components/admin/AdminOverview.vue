<template>
  <div class="desk-grid">
    <section class="adm-card hero" aria-labelledby="summary-h">
      <div
        class="hero-art"
        :class="`hero-${timeOfDay}`"
        :style="{ '--hero-image': `url('${heroArt}')` }"
      >
        <div class="hero-text">
          <div class="eyebrow">{{ today }}</div>
          <h1 id="summary-h">{{ greeting }}, {{ displayName }}</h1>
          <p v-if="summary">{{ summary }}</p>
        </div>
      </div>
      <div v-if="membersVisible" class="kpis">
        <button v-if="membersVisible" class="kpi" @click="emit('navigate', 'requests')">
          <span>Waiting for you</span><b>{{ number(data.queue?.for_you) }}</b
          ><small>Requests that need your decision</small>
        </button>
        <button v-if="membersVisible" class="kpi" @click="emit('navigate', 'students')">
          <span>Students</span><b>{{ number(data.counts?.members) }}</b
          ><small>Signed-in student accounts</small>
        </button>
        <button v-if="membersVisible" class="kpi" @click="emit('navigate', 'students')">
          <span>Roster invitations</span><b>{{ number(data.counts?.roster) }}</b
          ><small>Awaiting first sign-in</small>
        </button>
        <button class="kpi" @click="emit('navigate', 'events')">
          <span>{{ isLive(data.events?.[0]) ? 'Live now' : 'Next event' }}</span
          ><b class="event-day">{{
            data.events?.[0]
              ? isLive(data.events[0])
                ? 'Live'
                : dateOf(data.events[0].starts_at)
              : '—'
          }}</b
          ><small>{{ data.events?.[0]?.name || 'Nothing scheduled' }}</small>
        </button>
      </div>
    </section>

    <section v-if="membersVisible" class="adm-card review span8" aria-labelledby="review-h">
      <header class="card-head">
        <h2 id="review-h">Needs your review</h2>
        <div class="adm-chips" role="group" aria-label="Request queue">
          <button
            class="adm-chip"
            :class="{ on: !waiting }"
            :aria-pressed="!waiting"
            @click="waiting = false"
          >
            For you <span class="n">{{ yourRequests.length }}</span></button
          ><button
            class="adm-chip"
            :class="{ on: waiting }"
            :aria-pressed="waiting"
            @click="waiting = true"
          >
            Waiting for someone else <span class="n">{{ otherRequests.length }}</span>
          </button>
        </div>
        <button class="link" @click="emit('navigate', 'requests')">
          Open review <LineIcon name="next" />
        </button>
      </header>
      <button
        v-for="r in preview"
        :key="r.id"
        class="request-row"
        @click="emit('navigate', 'requests', r.id)"
      >
        <span class="avatar">{{ requestTarget(r).slice(0, 1) }}</span>
        <span class="row-text"
          ><b
            ><span class="adm-badge mari">{{
              REQUEST_LABEL[r.type] ||
              (r.category === 'region' ? 'Region change' : 'Certificate name')
            }}</span>
            {{ requestTarget(r) }}</b
          ><small>{{ r.reason }}</small></span
        >
        <span class="age"
          >{{ ageOf(r.requested_at)
          }}<small>{{ r.can_decide ? 'Review' : r.waiting_on }}</small></span
        >
      </button>
      <div v-if="!preview.length" class="empty">
        <img :src="clearArt" alt="" /><b>Nothing needs your decision</b>
        <p>
          {{
            waiting
              ? 'No requests are waiting on other admins.'
              : 'New requests appear here when they need a review.'
          }}
        </p>
      </div>
    </section>

    <section class="adm-card" :class="membersVisible ? 'span4' : 'span12'" aria-labelledby="next-h">
      <header class="card-head">
        <h2 id="next-h">Live and next</h2>
        <button class="link" @click="emit('navigate', 'events')">
          Events <LineIcon name="next" />
        </button>
      </header>
      <button
        v-for="event in data.events"
        :key="event.id"
        class="event-row"
        @click="emit('navigate', 'events', event.id)"
      >
        <span class="date"
          ><small>{{ dateOf(event.starts_at, { month: 'short', day: undefined }) }}</small
          ><b>{{ new Date(event.starts_at).getDate() }}</b></span
        >
        <span class="row-text"
          ><b>{{ event.name }}</b
          ><small>{{ dateOf(event.starts_at) }} · {{ event.location || 'Location not set' }}</small
          ><small v-if="event.registrations != null"
            >{{ event.registrations }} registrations</small
          ></span
        >
      </button>
      <div v-if="!data.events?.length" class="empty">
        <img :src="boatArt" alt="" /><b>No live or upcoming events</b>
      </div>
    </section>

    <section
      v-if="membersVisible"
      class="adm-card"
      :class="isSuperAdmin ? 'span4' : 'span6'"
      aria-labelledby="notices-h"
    >
      <header class="card-head">
        <h2 id="notices-h">Live notices</h2>
        <button class="link" @click="emit('navigate', 'notices')">All</button>
      </header>
      <button
        v-for="notice in data.notices"
        :key="notice.id"
        class="list-row"
        @click="emit('navigate', 'notices', notice.id)"
      >
        <b>{{ notice.title }}</b
        ><small>{{ notice.ends_at ? `Ends ${dateOf(notice.ends_at)}` : 'No end date' }}</small>
      </button>
      <div v-if="!data.notices?.length" class="empty compact-empty">
        <b>No live notices</b>
        <p>Current notices for your scope will appear here.</p>
      </div>
    </section>
    <section
      class="adm-card"
      :class="isSuperAdmin ? 'span4' : membersVisible ? 'span6' : 'span12'"
      aria-labelledby="forms-h"
    >
      <header class="card-head">
        <h2 id="forms-h">Open forms</h2>
        <button class="link" @click="emit('navigate', 'forms')">All</button>
      </header>
      <button
        v-for="form in data.forms"
        :key="form.id"
        class="list-row"
        @click="emit('navigate', 'forms', form.id)"
      >
        <b>{{ form.title }}</b
        ><small
          >{{ form.closes_at ? `Closes ${dateOf(form.closes_at)}` : 'No closing date'
          }}<template v-if="form.responses != null">
            · {{ form.responses }} responses</template
          ></small
        >
      </button>
      <div v-if="!data.forms?.length" class="empty compact-empty">
        <b>No forms accepting responses</b>
        <p>Open forms for your scope will appear here.</p>
      </div>
    </section>

    <section v-if="isSuperAdmin" class="adm-card span4" aria-labelledby="activity-h">
      <header class="card-head">
        <h2 id="activity-h">Recent changes</h2>
        <button class="link" @click="emit('navigate', 'audit')">
          Audit log <LineIcon name="next" />
        </button>
      </header>
      <div v-for="entry in data.audit" :key="entry.id" class="feed">
        <span class="avatar">{{ (entry.actor || 'System').slice(0, 1) }}</span>
        <div>
          <b>{{ entry.actor || 'System' }}</b> {{ entry.action.replaceAll(/[._]/g, ' ')
          }}<small>{{ ageOf(entry.created_at) }}</small>
        </div>
      </div>
      <div v-if="!data.audit?.length" class="empty compact-empty">
        <b>No recent changes</b>
        <p>Admin activity will appear here when something changes.</p>
      </div>
    </section>

    <AdminRegionRank v-if="isSuperAdmin" class="adm-card span12" />
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { auth, isRc, isSuperAdmin } from '../../lib/auth.js';
import { REQUEST_LABEL } from '../../lib/admin.js';
import { ageOf, dateOf, nameOf } from '../../lib/admin-display.js';
import LineIcon from '../site/LineIcon.vue';
import AdminRegionRank from './AdminRegionRank.vue';
import { ADMIN_ART } from './admin-art.js';
const clearArt = ADMIN_ART.emptyClear;
const boatArt = ADMIN_ART.emptyBoat;
const props = defineProps({
  data: { type: Object, required: true },
});
const emit = defineEmits(['navigate']);
const membersVisible = computed(() => isSuperAdmin.value || isRc.value);
const waiting = ref(false);
const yourRequests = computed(() => (props.data.requests || []).filter((r) => r.can_decide));
const otherRequests = computed(() => (props.data.requests || []).filter((r) => !r.can_decide));
const now = ref(new Date());
let clockInterval;
onMounted(() => {
  clockInterval = window.setInterval(() => (now.value = new Date()), 60_000);
});
onBeforeUnmount(() => window.clearInterval(clockInterval));
const today = computed(() =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now.value)
);
const hour = computed(() =>
  Number(
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now.value)
  )
);
const timeOfDay = computed(() =>
  hour.value < 12 ? 'morning' : hour.value < 17 ? 'afternoon' : 'evening'
);
const heroArt = computed(() => {
  if (timeOfDay.value === 'afternoon') return ADMIN_ART.bannerAfternoon;
  if (timeOfDay.value === 'evening') return ADMIN_ART.bannerEvening;
  return ADMIN_ART.banner;
});
const greeting = computed(() => `Good ${timeOfDay.value}`);
const displayName = computed(() => {
  const name =
    auth.session?.user?.user_metadata?.full_name ||
    auth.session?.user?.user_metadata?.name ||
    auth.profile?.full_name ||
    auth.profile?.preferred_name;
  return name?.trim() || 'Web Admin';
});
const preview = computed(() =>
  (waiting.value ? otherRequests.value : yourRequests.value).slice(0, 5)
);
const summary = computed(() => {
  const count = props.data.queue?.for_you;
  const event = props.data.events?.[0];
  const nextEvent = event?.name;
  const eventMessage = nextEvent
    ? `${nextEvent} is ${isLive(event) ? 'live now' : 'coming up'}.`
    : '';
  if (!membersVisible.value) return eventMessage || 'Your events and forms are gathered below.';
  if (count == null) return 'Review requests and upcoming events for your scope.';
  const requests = `${count} request${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} your decision`;
  if (count) return `${requests}.${eventMessage ? ` ${eventMessage}` : ''}`;
  return eventMessage;
});
const requestTarget = (request) =>
  request.type === 'event_publish'
    ? request.requested_change?.event_name || 'Event'
    : request.type === 'form_publish' || request.type === 'form_delete'
      ? request.requested_change?.form_title || 'Form'
      : nameOf(request.target || request.member || request.target_snapshot?.member);
const isLive = (event) =>
  event &&
  new Date(event.starts_at).getTime() <= Date.now() &&
  new Date(event.ends_at).getTime() > Date.now();
const number = (value) => (value == null ? '—' : value.toLocaleString('en-IN'));
</script>
<style scoped src="./overview.css"></style>

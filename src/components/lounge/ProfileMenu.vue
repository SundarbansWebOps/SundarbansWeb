<!--
  The profile menu from the avatar: a sheet of ghat paper with the band on top. Who you are
  (preferred name as the title, never the roll number; then roll, region and Regional
  Coordinator), then My certificates, Edit profile, the "I've joined all my groups" switch,
  Retake the tour and the theme. Sign out is
  in the public site's navbar, one tap away via the Lounge header's Website link.
  Comes down from under the header on every width (the drop variant in LoungeDialog.vue).
-->
<template>
  <LoungeDialog ref="dlg" variant="drop" labelledby="pm-h" @close="emit('close')">
    <div class="pm">
      <div class="pm-who">
        <span class="pm-av" :class="{ crest: !initials && !avatarUrl }" aria-hidden="true">
          <img
            v-if="avatarUrl"
            :src="avatarUrl"
            alt=""
            referrerpolicy="no-referrer"
            @error="avatarFailed"
          />
          <span v-else-if="initials">{{ initials }}</span>
          <img v-else :src="CREST" alt="" />
        </span>
        <div class="pm-id">
          <p class="gp-kicker">Your profile</p>
          <h2 v-if="callName" id="pm-h">{{ callName }}</h2>
          <template v-else>
            <h2 id="pm-h" class="pm-noname">No name yet</h2>
            <button type="button" class="gp-chip pm-add" @click="go('edit')">Add your name</button>
          </template>
        </div>
      </div>

      <dl class="pm-facts">
        <div>
          <dt>Roll</dt>
          <dd class="tnum">{{ member.roll }}</dd>
        </div>
        <div>
          <dt>Region</dt>
          <dd>{{ member.region.name || 'Not set' }}</dd>
        </div>
        <div>
          <dt>Regional Coordinator</dt>
          <dd>{{ member.coordinator.name }}</dd>
        </div>
      </dl>

      <ul class="pm-acts">
        <li>
          <button type="button" @click="go('certs')">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="9" r="5.5" />
              <path d="m8.5 13.5-1.8 7 5.3-2.6 5.3 2.6-1.8-7" />
            </svg>
            <span>My certificates</span>
            <b class="pm-n tnum">{{ certCount }}</b>
          </button>
        </li>
        <li v-if="callName">
          <button type="button" @click="go('edit')">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
              <path d="m13.5 6.5 4 4" />
            </svg>
            <span>Edit profile</span>
          </button>
        </li>
        <li v-if="!isSuperAdmin">
          <button
            type="button"
            role="switch"
            class="pm-sw-row"
            :aria-checked="hidden"
            :disabled="saving"
            @click="toggleGroups"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 16c3 0 3-2 6-2s3 2 6 2 3-2 6-2" />
              <path d="M6 12.5 8 9h8l2 3.5" />
              <path d="m5 20 .4-1.5M19 20l-.4-1.5" />
            </svg>
            <span>
              I've joined all my groups
              <small>Hides the WhatsApp groups on your Lounge. Switch it off to see them.</small>
            </span>
            <i class="pm-sw" :class="{ on: hidden }" aria-hidden="true"></i>
          </button>
          <p v-if="saveError" class="pm-err" role="alert">{{ saveError }}</p>
        </li>
        <!-- Groups an admin added you to leave the Lounge; this brings them back. Moot while
             everything is hidden, and only offered once you are in a group. -->
        <li v-if="!isSuperAdmin && !hidden && (hasJoinedGroups || shownJoined)">
          <button
            type="button"
            role="switch"
            class="pm-sw-row"
            :aria-checked="shownJoined"
            :disabled="savingJoined"
            @click="toggleJoined"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12.5 4.2 4L19 7" />
            </svg>
            <span>
              Show groups I'm in
              <small>Brings back the WhatsApp groups an admin has added you to.</small>
            </span>
            <i class="pm-sw" :class="{ on: shownJoined }" aria-hidden="true"></i>
          </button>
          <p v-if="joinedError" class="pm-err" role="alert">{{ joinedError }}</p>
        </li>
        <li>
          <button type="button" @click="go('tour')">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 17c3 0 3-2 6-2s3 2 6 2 3-2 6-2" />
              <path d="M5 13.5 7.5 9h9l2.5 4.5" />
              <path d="M12 9V3.5" />
            </svg>
            <span>Retake the tour</span>
          </button>
        </li>
        <li>
          <button type="button" @click="go('theme')">
            <svg v-if="theme === 'dark'" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4.2" />
              <path
                d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"
              />
            </svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z" />
            </svg>
            <span>{{ theme === 'dark' ? 'Switch to day' : 'Switch to night' }}</span>
          </button>
        </li>
        <li v-if="canAdmin">
          <button type="button" @click="leaveTo('/admin')">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
              <path d="m8.8 12.2 2.2 2.2 4.4-4.6" />
            </svg>
            <span>Admin lounge</span>
          </button>
        </li>
      </ul>
    </div>
  </LoungeDialog>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import CREST from '../../assets/crest.webp';
import LoungeDialog from './LoungeDialog.vue';
import * as ev from './events.js';
import { member } from './fixtures.js';
import { callName, initialsOf, theme } from './state.js';
import { avatarFailed, avatarUrl, canAdmin, errorText, isSuperAdmin } from '../../lib/auth.js';
import { hasJoinedGroups, saveGroupFormsHidden, saveJoinedGroupsShown } from './session.js';

const emit = defineEmits(['close', 'edit', 'certs', 'tour', 'theme']);
const router = useRouter();
const dlg = ref(null);

const hidden = computed(() => !!member.group_forms_hidden);
const saving = ref(false);
const saveError = ref('');
async function toggleGroups() {
  if (saving.value) return;
  saving.value = true;
  saveError.value = '';
  try {
    await saveGroupFormsHidden(!hidden.value);
  } catch (err) {
    saveError.value = errorText(err) || 'That did not save. Try again.';
  } finally {
    saving.value = false;
  }
}

const shownJoined = computed(() => !!member.joined_groups_shown);
const savingJoined = ref(false);
const joinedError = ref('');
async function toggleJoined() {
  if (savingJoined.value) return;
  savingJoined.value = true;
  joinedError.value = '';
  try {
    await saveJoinedGroupsShown(!shownJoined.value);
  } catch (err) {
    joinedError.value = errorText(err) || 'That did not save. Try again.';
  } finally {
    savingJoined.value = false;
  }
}

const initials = computed(() => initialsOf(callName.value));
const certCount = computed(() => ev.certificates?.value?.length ?? 0);

/* Closing the menu from the UI pops its history entry (layers.js) asynchronously; a push made
   before that Back lands would be cancelled by it, so wait for it first. */
async function leaveTo(path) {
  const backDone = history.state?.loungeLayer
    ? new Promise((done) => {
        addEventListener('popstate', done, { once: true });
        setTimeout(done, 800);
      })
    : null;
  await dlg.value?.close();
  await backDone;
  router.push({ path });
}
/* Edit and My certificates replace this menu (same Back entry); tour and theme close it. */
async function go(what) {
  if (what === 'edit' || what === 'certs') {
    emit(what);
    dlg.value?.swap();
  } else {
    await dlg.value?.close();
    emit(what);
  }
}
</script>

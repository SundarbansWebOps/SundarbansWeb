<!-- Super Admin search of the student directory: name, phone and the rest for every student in
     the house upload, signed in or not. Each student shows the live record (their member row once
     signed in, else their roster row) beside the upload, with the fields that disagree marked.
     Search only, at most 50 rows; the database records every search in the activity log. -->
<template>
  <div>
    <form class="adm-toolbar directory-form" novalidate @submit.prevent="search">
      <label class="adm-field grow">
        <span>Name, email or phone</span>
        <input
          v-model.trim="query"
          class="adm-input"
          type="search"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          placeholder="Asha, 25f1000000 or 98765"
          maxlength="200"
          :aria-invalid="invalid ? 'true' : undefined"
          :aria-describedby="invalid ? 'directory-invalid' : undefined"
          @input="reset"
        />
      </label>
      <button type="submit" class="adm-btn mari" :disabled="busy">
        <LineIcon name="search" />{{ busy ? 'Searching' : 'Search' }}
      </button>
    </form>
    <p v-if="invalid" id="directory-invalid" class="adm-msg err" role="alert">{{ invalid }}</p>
    <p v-if="error" class="adm-msg err" role="alert">{{ error }}</p>

    <p v-if="busy" class="adm-note" role="status">Searching the directory...</p>

    <p v-else-if="result && !result.rows.length" class="adm-empty" role="status">
      No student in the directory matches this.
    </p>

    <template v-else-if="result">
      <p class="adm-note directory-count" role="status">
        {{ countText }} Highlighted rows disagree between the live record and the upload.
      </p>
      <div class="adm-stack">
        <article
          v-for="(s, i) in result.rows"
          :key="s.email"
          class="adm-card directory-student"
          :aria-labelledby="`directory-${i}`"
        >
          <header class="directory-head">
            <div>
              <h3 :id="`directory-${i}`">
                {{ s.full_name || s.live?.full_name || 'Name not set' }}
              </h3>
              <small class="directory-email">{{ s.email }}</small>
            </div>
            <span class="adm-badge" :class="s.signed_in ? '' : 'mari'">{{
              s.signed_in ? 'Signed in' : 'Not signed in'
            }}</span>
          </header>
          <div class="adm-table-wrap">
            <table class="adm-table directory-compare">
              <thead>
                <tr>
                  <th scope="col"><span class="visually-hidden">Field</span></th>
                  <th scope="col">{{ liveHeading(s.live) }}</th>
                  <th scope="col">Upload, 23 Oct</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="f in FIELDS" :key="f.key" :class="{ differs: differs(f, s.live, s) }">
                  <th scope="row">{{ f.label }}</th>
                  <td :class="{ mono: f.mono }">
                    {{ (s.live && s.live[f.key]) || '–' }}
                    <small
                      v-if="f.key === 'full_name' && loungeName(s.live)"
                      class="directory-lounge"
                      >Lounge: {{ loungeName(s.live) }}</small
                    >
                    <span v-if="differs(f, s.live, s)" class="visually-hidden">, differs</span>
                  </td>
                  <td :class="{ mono: f.mono }">{{ s[f.key] || '–' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import LineIcon from '../site/LineIcon.vue';
import { searchDirectory } from '../../lib/admin.js';
import { errorText } from '../../lib/auth.js';

const query = ref('');
const busy = ref(false);
const error = ref('');
const invalid = ref('');
const result = ref(null);
let sequence = 0;

const FIELDS = [
  { key: 'full_name', label: 'Name' },
  { key: 'phone', label: 'Phone', mono: true },
  { key: 'region_name', label: 'Region' },
  { key: 'gender', label: 'Gender' },
  { key: 'term', label: 'Term', mono: true },
];
const SOURCES = { member: 'Live, member', roster: 'Live, roster' };
const liveHeading = (live) => SOURCES[live?.source] || 'Live, not on roster';

// Only two filled values that disagree count; an empty live field is the clean-up, not a clash.
const norm = (key, v) =>
  key === 'phone'
    ? String(v).replace(/[^0-9]/g, '')
    : String(v).trim().replace(/\s+/g, ' ').toLowerCase();
const differs = (f, live, upload) =>
  !!(live?.[f.key] && upload[f.key]) && norm(f.key, live[f.key]) !== norm(f.key, upload[f.key]);
const loungeName = (live) =>
  live?.preferred_name && live.preferred_name !== live.full_name ? live.preferred_name : '';

const countText = computed(() => {
  const { total, rows } = result.value;
  if (total > rows.length)
    return `Showing the first ${rows.length} of ${total}. Type more to narrow it.`;
  return total === 1 ? '1 student.' : `${total} students.`;
});

// Typing again clears the last answer, so nothing stale sits beside a new search.
function reset() {
  sequence++;
  busy.value = false;
  invalid.value = error.value = '';
  result.value = null;
}

async function search() {
  const value = query.value;
  reset();
  // Same minimum the database enforces; it checks again.
  if (value.length < 3) {
    invalid.value = value ? 'Type at least 3 characters.' : 'Type a name, email or phone.';
    return;
  }
  const token = sequence;
  busy.value = true;
  try {
    const found = await searchDirectory(value);
    if (token === sequence) result.value = found;
  } catch (e) {
    if (token === sequence) error.value = errorText(e);
  } finally {
    if (token === sequence) busy.value = false;
  }
}

onBeforeUnmount(() => sequence++);
</script>

<style scoped>
.grow {
  flex: 1 1 280px;
}
.directory-form {
  align-items: flex-end;
}
.directory-form .adm-btn svg {
  width: 16px;
  height: 16px;
}
.directory-count {
  margin: 16px 0 8px;
}
.directory-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px 12px;
  margin-bottom: 10px;
}
.directory-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
.directory-compare {
  table-layout: fixed;
}
.directory-compare thead th:first-child {
  width: 76px;
}
.directory-compare td {
  overflow-wrap: anywhere;
}
.directory-compare tbody th {
  text-transform: none;
  letter-spacing: 0;
  font-size: 12.5px;
  font-weight: 600;
}
.directory-compare tr.differs td {
  background: color-mix(in srgb, var(--mari-soft) 55%, transparent);
  color: var(--mari-ink);
  font-weight: 650;
}
@media (max-width: 560px) {
  .directory-student {
    padding: 14px;
  }
  .directory-compare thead th:first-child {
    width: 60px;
  }
}
.directory-lounge {
  display: block;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 500;
}
.directory-email {
  color: var(--ink-3);
  font-size: 12.5px;
  overflow-wrap: anywhere;
}
</style>

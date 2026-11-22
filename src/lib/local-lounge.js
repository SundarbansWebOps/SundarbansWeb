// Synthetic loopback fixtures for local end-to-end exploration. Never sends a database request.
// Unsupported operations fail visibly rather than pretending that the real backend passed.
const params = new URLSearchParams(location.search);
const guest = params.get('local-guest') === '1'; // start signed out, as a public visitor
const KEY = `sundarbans-local-lounge:v3:${params.get('local-region') || '1'}:${params.get('local-tour') || '0'}:${guest ? 'guest' : 'member'}`;
const regions = [
  { id: 1, code: 'region_01', name: 'Patna' },
  { id: 2, code: 'region_02', name: 'Delhi NCR' },
  { id: 21, code: 'international', name: 'International' },
];
const regionId = Number(params.get('local-region') || 1);
const now = Date.now();
const iso = (offset) => new Date(now + offset * 3600000).toISOString();
const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true, prefill: 'name' },
  { key: 'phone', label: 'Phone', type: 'phone', required: false, prefill: 'phone' },
];
const groupIds = [
  '2fe75761-88af-5422-a3c7-d8e86830d3e2',
  '5a905465-ec6c-50f2-9503-40cc2e97d00d',
  '4f142402-d390-512b-89e3-8193705b809e',
  'ef6e5e79-5ea5-56dc-b81e-b5c75373694c',
];
// PAN BS events: open to all IITM BS, public registration through a form. One form carries a
// WhatsApp invite, the other does not, so both endings of the guest flow can be tried.
const panbsFields = [
  {
    key: 'level',
    label: 'Your level',
    type: 'select',
    required: true,
    options: ['Foundation', 'Diploma', 'Degree'],
    allow_other: true,
  },
  { key: 'ask', label: 'One question for the speaker', type: 'text', required: false },
];
const panbs = [
  {
    id: '55555555-5555-4555-8555-555555555555',
    form_id: '66666666-6666-4666-8666-666666666666',
    name: 'Mock PAN BS: Resume clinic (has WhatsApp group)',
    description:
      'Local test fixture. Register as a guest; the last step shows the WhatsApp invite.',
    starts_at: iso(30),
    ends_at: iso(32),
    invite_url: 'https://chat.whatsapp.com/LocalMockInvite123',
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    form_id: '88888888-8888-4888-8888-888888888888',
    name: 'Mock PAN BS: Python Q&A (no WhatsApp group)',
    description: 'Local test fixture. No invite on this form, so registration ends without one.',
    starts_at: iso(54),
    ends_at: iso(56),
    invite_url: null,
  },
];
const houses = [
  'Bandipur',
  'Corbett',
  'Gir',
  'Kanha',
  'Kaziranga',
  'Namdapha',
  'Nallamala',
  'Nilgiri',
  'Pichavaram',
  'Saranda',
  'Sundarbans',
  'Wayanad',
  'Not allotted yet',
];
const defaults = {
  signedIn: !guest,
  guests: [],
  profile: {
    id: 'a9000000-0000-4000-8000-000000000004',
    member_code: '99f9000004',
    email: 'local-student@example.invalid',
    full_name: 'Local Test Student',
    preferred_name: 'Local Test Student',
    phone: null,
    cohort: '26F1',
    region_id: regionId || null,
    region: regions.find((r) => r.id === regionId) || null,
    tour_seen_at: params.get('local-tour') === '1' ? null : iso(-24),
    certificate_name: null,
    certificate_name_confirmed_at: null,
    group_forms_hidden: false,
    joined_groups_shown: false,
  },
  forms: [
    ...['Technical', 'Cultural', 'Esports', 'Patna regional'].map((title, i) => ({
      id: groupIds[i],
      title: `${title} community application`,
      description: 'Local test fixture: apply, then request admission in WhatsApp.',
      form_kind: 'group',
      group_label: i === 3 ? 'Patna' : title,
      group_purpose: i === 3 ? 'Updates for your region.' : 'Explore this community.',
      archived_at: null,
      fields,
      region_id: i === 3 ? 1 : null,
      community_id: [2, 3, 1, null][i],
      event_id: null,
      is_open: true,
      accepting_responses: true,
      submitted: false,
    })),
    {
      id: '44444444-4444-4444-8444-444444444444',
      title: 'Local build night registration',
      form_kind: 'general',
      archived_at: null,
      fields,
      event_id: '33333333-3333-4333-8333-333333333333',
      region_id: null,
      is_open: true,
      accepting_responses: true,
      submitted: false,
    },
    ...panbs.map((e) => ({
      id: e.form_id,
      title: `${e.name} registration`,
      form_kind: 'general',
      archived_at: null,
      fields: panbsFields,
      event_id: e.id,
      region_id: null,
      is_open: true,
      accepting_responses: true,
      submitted: false,
      invite_url: e.invite_url,
    })),
  ],
  events: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Local build night',
      starts_at: iso(24),
      ends_at: iso(26),
      stage: 'upcoming',
      community_id: 2,
      region_id: null,
      audience_cohorts: [],
      entry_mode: 'register',
      registration: null,
    },
    {
      id: 'local-open-session',
      name: 'Local open session',
      starts_at: iso(48),
      ends_at: iso(50),
      stage: 'upcoming',
      community_id: 3,
      region_id: null,
      audience_cohorts: [],
      entry_mode: 'open',
      gmail_link: 'https://example.invalid/open-meet',
      registration: null,
    },
    {
      id: 'local-live',
      name: 'Local live gathering',
      starts_at: iso(-1),
      ends_at: iso(1),
      stage: 'live',
      region_id: 1,
      entry_mode: 'open',
      meet_link: 'https://example.invalid/local-meet',
    },
    {
      id: 'local-early',
      name: 'Local join-early session',
      starts_at: iso(0.2),
      ends_at: iso(1.2),
      stage: 'upcoming',
      community_id: 2,
      region_id: null,
      audience_cohorts: [],
      meet_link: 'https://example.invalid/local-early-meet',
      registration: null,
    },
    ...[1, 2].map((id) => ({
      id: `local-past-${id}`,
      name: `${regions.find((r) => r.id === id).name} archive fixture`,
      starts_at: iso(-72),
      ends_at: iso(-70),
      region_id: id,
      archive: true,
      attendees: null,
    })),
    {
      id: 'local-undated',
      name: 'Undated archive fixture',
      starts_at: null,
      ends_at: null,
      archive: true,
      display_date: 'September 2024',
    },
    {
      id: 'local-attendance-boundary',
      name: 'Local attendance boundary: 19m30s',
      starts_at: iso(-48),
      ends_at: iso(-46),
      attendance_mode: 'meet',
      registration: { event_id: 'local-attendance-boundary' },
      attendance: { duration_seconds: 1170, reviewed_eligible: false },
      archive: true,
    },
  ],
  notices: [
    {
      id: 'local-notice',
      title: 'Local fixture mode',
      body: 'Synthetic student and data. Changes stay in this browser; reload retains them.',
      link: 'https://example.invalid/local-notice',
      starts_at: iso(-1),
      show_banner: true,
    },
  ],
  regionRequests: [],
};
let state = defaults;
try {
  // ?local-tour=1 is always a first visit: a reload starts the tour again.
  if (params.get('local-tour') !== '1') state = JSON.parse(sessionStorage.getItem(KEY)) || defaults;
} catch {
  // Storage can be blocked; the fixture still works for this page load.
}
const persist = () => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // No persistence when browser storage is unavailable.
  }
};
const ok = (data) => ({ data: structuredClone(data), error: null });
const fail = (message) => ({ data: null, error: { message: `Local fixture: ${message}` } });
const eligible = (row) => row.region_id == null || row.region_id === state.profile.region_id;
const session = () =>
  state.signedIn ? { user: { id: state.profile.id, email: state.profile.email } } : null;

export const localSupabase = {
  auth: {
    getSession: async () => ok({ session: session() }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => {
      state.signedIn = false;
      persist();
      return ok(null);
    },
    signInWithOAuth: async () => {
      state.signedIn = true;
      persist();
      location.hash = '/lounge';
      location.reload();
      return ok(null);
    },
  },
  from(table) {
    let rows =
      table === 'members'
        ? [state.profile]
        : table === 'regions'
          ? regions
          : table === 'member_region_requests'
            ? state.regionRequests
            : null;
    const result = () => (rows ? ok(rows) : fail(`unsupported table ${table}`));
    const query = {
      select: () => query,
      order: () => query,
      eq: (key, value) => {
        rows = rows?.filter((row) => row[key] === value);
        return query;
      },
      single: async () => (rows?.[0] ? ok(rows[0]) : fail(`missing row in ${table}`)),
      maybeSingle: async () => (rows ? ok(rows[0] || null) : result()),
      then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
    };
    return query;
  },
  async rpc(name, args = {}) {
    if (name === 'list_public_past_events') return ok(state.events.filter((e) => e.archive));
    // Public PAN BS calls work signed out, as on the real site.
    if (name === 'list_public_events')
      return ok([
        ...panbs.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          starts_at: e.starts_at,
          ends_at: e.ends_at,
          event_type: 'Session',
          location: 'Online',
          panbs: true,
          registers: true,
          stage: 'upcoming',
        })),
        ...state.events.filter((e) => e.archive),
      ]);
    if (name === 'get_panbs_join_link') return ok(null);
    if (name === 'get_panbs_form') {
      const e = panbs.find((x) => x.id === args.p_event_id);
      return ok(
        e && {
          id: e.form_id,
          title: e.name,
          description: e.description,
          fields: panbsFields,
          closes_at: null,
          houses,
          banner_url: null,
          banner_alt: null,
        }
      );
    }
    if (name === 'submit_panbs_registration') {
      const e = panbs.find((x) => x.form_id === args.p_form_id);
      const email = String(args.p_email || '')
        .trim()
        .toLowerCase();
      if (!e) return fail('form unavailable');
      if (!/@([a-z0-9-]+\.)*study\.iitm\.ac\.in$/.test(email))
        return {
          data: null,
          error: {
            code: '22023',
            message: 'Use your IITM student email (ending in study.iitm.ac.in)',
          },
        };
      const key = `${e.form_id}:${email}`;
      if (state.guests.includes(key))
        return {
          data: null,
          error: { code: 'PT409', message: 'This email is already registered for this event' },
        };
      state.guests.push(key);
      persist();
      return ok({ registered: true, invite_url: e.invite_url });
    }
    if (!state.signedIn) return fail('sign in first');
    let value;
    switch (name) {
      case 'get_my_dashboard':
        return ok({ role: 'normal', position: null, region_id: state.profile.region_id });
      case 'list_lounge_events':
        return ok(state.events.filter((e) => e.archive || eligible(e)));
      case 'list_lounge_forms':
        return ok(state.forms.filter(eligible));
      case 'list_my_notices':
        return ok(state.notices);
      case 'list_my_certificates':
        return ok([]);
      case 'get_available_cohorts':
        return ok({ current: '26F3', next: '27F1', options: ['25F3', '26F1', '26F2', '26F3'] });
      case 'update_my_profile':
        Object.assign(state.profile, {
          preferred_name: args.p_preferred_name,
          phone: args.p_phone,
        });
        value = state.profile;
        break;
      case 'set_joined_groups_shown':
        state.profile.joined_groups_shown = !!args.p_shown;
        value = state.profile.joined_groups_shown;
        break;
      case 'set_group_forms_hidden':
        state.profile.group_forms_hidden = !!args.p_hidden;
        value = state.profile.group_forms_hidden;
        break;
      case 'set_my_tour_seen':
        state.profile.tour_seen_at = args.p_seen ? new Date().toISOString() : null;
        value = state.profile.tour_seen_at;
        break;
      case 'select_my_initial_region': {
        if (state.profile.region_id != null) return fail('region already selected');
        const region = regions.find((r) => r.id === args.p_region_id);
        if (!region) return fail('unknown region');
        state.profile.region_id = region.id;
        state.profile.region = region;
        value = state.profile;
        break;
      }
      case 'request_my_region_change': {
        const region = regions.find((r) => r.id === args.p_region_id);
        if (!region || region.id === state.profile.region_id) return fail('choose another region');
        if (state.regionRequests.some((r) => r.status === 'pending'))
          return fail('request pending');
        const id = crypto.randomUUID();
        state.regionRequests.push({
          id,
          member_id: state.profile.id,
          requested_region_id: region.id,
          status: 'pending',
          reason: args.p_reason,
        });
        value = id;
        break;
      }
      case 'submit_lounge_form': {
        const form = state.forms.find((f) => f.id === args.p_form_id && eligible(f));
        if (!form || form.submitted) return fail('form unavailable or already submitted');
        form.submitted = true;
        if (args.p_save_phone) state.profile.phone = args.p_answers.phone || null;
        const event = state.events.find((e) => e.id === form.event_id);
        if (event) event.registration = { event_id: event.id };
        value = {
          response_id: `local-${form.id}`,
          registered: !!event,
          invite_url:
            form.invite_url !== undefined
              ? form.invite_url
              : event
                ? null
                : 'https://example.invalid/local-whatsapp',
        };
        break;
      }
      case 'get_lounge_form_invite':
        return ok(
          state.forms.some(
            (f) => f.id === args.p_form_id && eligible(f) && f.submitted && !f.event_id
          )
            ? 'https://example.invalid/local-whatsapp'
            : (state.forms.find((f) => f.id === args.p_form_id && f.submitted)?.invite_url ?? null)
        );
      case 'set_my_notice_state': {
        const notice = state.notices.find((n) => n.id === args.p_announcement_id);
        if (!notice) return fail('notice unavailable');
        if (args.p_read) notice.read_at = new Date().toISOString();
        if (args.p_dismiss)
          Object.assign(notice, { dismissed_at: new Date().toISOString(), show_banner: false });
        value = null;
        break;
      }
      case 'confirm_my_certificate_name':
        if (state.profile.certificate_name_confirmed_at) return fail('certificate name locked');
        state.profile.certificate_name = args.p_name;
        state.profile.certificate_name_confirmed_at = new Date().toISOString();
        value = args.p_name;
        break;
      default:
        return fail(`unsupported RPC ${name}`);
    }
    persist();
    return ok(value);
  },
};

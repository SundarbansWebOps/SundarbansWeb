// The audit log's one catalogue: which category every recorded admin action belongs to, its short
// label, and how a row of `admin_audit_feed` reads as a sentence. The keys read from old_values /
// new_values are the ones the database writes (grep `write_audit` in supabase/migrations).
// Anything not listed still renders: "Priya · members.update · phone".
import { POSITION_LABEL } from './admin.js';

// A category filters by action prefixes (the part before the dot) and exact action names; the RPC
// ORs the two. `member.lookup` is data access, so People lists its member.* actions by name.
export const CATEGORIES = [
  {
    id: 'people',
    label: 'People & roster',
    prefixes: ['roster'],
    actions: [
      'member.soft_delete',
      'member.restore',
      'member.region_change',
      'member.blacklist',
      'member.blacklist_lift',
      'member.suspend',
      'member.reinstate',
      'member.contact_change',
      'member.hard_delete',
      'member.group_forms_hidden',
      'member.self_profile',
      'members.update',
    ],
  },
  { id: 'roles', label: 'Roles', prefixes: ['position', 'admin_assignments'], actions: [] },
  { id: 'requests', label: 'Requests', prefixes: ['request', 'region_request'], actions: [] },
  { id: 'forms', label: 'Forms', prefixes: ['form'], actions: [] },
  {
    id: 'events',
    label: 'Events & attendance',
    prefixes: ['events'],
    actions: ['attendance.import'],
  },
  {
    id: 'certificates',
    label: 'Certificates',
    prefixes: [],
    actions: ['certificate_name.review', 'certificates.release'],
  },
  { id: 'notices', label: 'Notices', prefixes: ['notice'], actions: [] },
  { id: 'accounts', label: 'Accounts & sign-in', prefixes: ['auth'], actions: [] },
  { id: 'data', label: 'Data access', prefixes: ['data'], actions: ['member.lookup'] },
];
const CATEGORY = new Map(CATEGORIES.map((c) => [c.id, c]));

export const ROLES = [
  { id: 'super_admin', label: 'Super Admin' },
  { id: 'rc', label: 'RC' },
  { id: 'head', label: 'Head' },
  { id: 'co_head', label: 'Co-head' },
  { id: 'system', label: 'System' },
];
const ROLE_LABEL = { ...Object.fromEntries(ROLES.map((r) => [r.id, r.label])), member: 'Member' };
export const roleLabel = (role) => ROLE_LABEL[role] ?? null;

export const RANGES = [
  { id: '24h', label: '24 h', hours: 24 },
  { id: '7d', label: '7 days', hours: 24 * 7 },
  { id: '30d', label: '30 days', hours: 24 * 30 },
  { id: '', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

// What each request type asks to do, phrased to follow "the request to …".
const REQUEST_DOES = {
  event_publish: 'publish an event house-wide',
  form_publish: 'publish a form',
  form_delete: 'remove a form',
  member_deletion: 'delete',
  member_blacklist: 'blacklist',
  member_hard_delete: 'permanently erase',
  member_profile_update: 'edit the details of',
  member_contact_change: 'change the login email of',
  member_status_change: 'change the status of',
  position_change: 'change the position of',
  community_record_update: 'edit a community record',
  community_record_deletion: 'delete a community record',
};
const NEEDS_MEMBER = new Set([
  'member_deletion',
  'member_blacklist',
  'member_hard_delete',
  'member_profile_update',
  'member_contact_change',
  'member_status_change',
  'position_change',
]);

const ROW_VERB = { insert: 'added', update: 'changed', delete: 'removed' };

// Parts of a sentence: plain strings, people (clickable into their timeline), and records.
const actor = (r) => ({
  person: r.actor_id,
  text: r.actor_name || (r.actor_id ? 'Former member' : 'System'),
});
const subject = (r, fallback = 'a member', suffix = '') =>
  r.subject_name || r.subject_id
    ? { person: r.subject_id, text: r.subject_name || 'Former member', suffix }
    : { record: true, text: fallback + suffix };
const record = (r, fallback) => ({ record: true, text: r.target_label || fallback });
const nv = (r) => (r.new_values && typeof r.new_values === 'object' ? r.new_values : {});
const ov = (r) => (r.old_values && typeof r.old_values === 'object' ? r.old_values : {});
const arrow = (a, b) => `${a ?? '—'} → ${b ?? '—'}`;
const reason = (v) => v.reason || v.review_note || v.note || null;
const approved = (r) => (nv(r).approved ? 'approved' : 'rejected');
const changedKeys = (r) =>
  [...new Set([...Object.keys(ov(r)), ...Object.keys(nv(r))])].join(', ') || null;

function positionPhrase(v, ctx) {
  const role = POSITION_LABEL[v.position] || v.position || 'a position';
  const where = v.region_id
    ? ctx.region(v.region_id)
    : v.community_id
      ? ctx.community(v.community_id)
      : null;
  return where ? `${role}, ${where}` : role;
}

function requestSentence(r, verb) {
  const v = { ...ov(r), ...nv(r) };
  const does = REQUEST_DOES[v.type];
  const parts = [actor(r), ` ${verb} `];
  if (!does) return { parts: [...parts, record(r, 'a request')], note: reason(nv(r)) };
  if (v.type === 'event_publish')
    return {
      parts: [...parts, 'publishing ', record(r, 'an event'), ' house-wide'],
      note: reason(nv(r)),
    };
  if (v.type === 'form_publish')
    return {
      parts: [...parts, 'publishing ', record(r, v.form_title || 'a form')],
      note: reason(nv(r)),
    };
  if (v.type === 'form_delete')
    return {
      parts: [...parts, 'removing ', record(r, v.form_title || 'a form')],
      note: reason(nv(r)),
    };
  return {
    parts: [
      ...parts,
      `the request to ${does}`,
      ...(NEEDS_MEMBER.has(v.type) ? [' ', subject(r)] : []),
    ],
    note: reason(nv(r)),
  };
}

// action → [category, short label, sentence(row, ctx) → { parts, note }]
const ACTIONS = {
  'roster.add': [
    'people',
    'Added to roster',
    (r) => ({
      parts: [
        actor(r),
        ' added ',
        { record: true, text: nv(r).full_name || r.target_label || r.target_id || 'a student' },
        ' to the roster',
      ],
      note: nv(r).email || r.target_id,
    }),
  ],
  'roster.claim': [
    'people',
    'Claimed roster place',
    (r) => ({ parts: [actor(r), ' signed in for the first time and claimed their roster place'] }),
  ],
  'roster.remove': [
    'people',
    'Removed from roster',
    (r) => ({
      parts: [
        actor(r),
        ' removed ',
        { record: true, text: ov(r).full_name || r.target_label || r.target_id || 'a student' },
        ' from the roster',
      ],
      note: ov(r).email || r.target_id,
    }),
  ],
  'member.soft_delete': [
    'people',
    'Deleted account',
    (r) => ({
      parts: [actor(r), ' deleted ', subject(r, 'a member', "'s"), ' account'],
      note: reason(nv(r)),
    }),
  ],
  'member.restore': [
    'people',
    'Restored account',
    (r) => ({
      parts: [actor(r), ' restored ', subject(r, 'a member', "'s"), ' account'],
      note: reason(nv(r)),
    }),
  ],
  'member.region_change': [
    'people',
    'Changed region',
    (r, ctx) => ({
      parts: [
        actor(r),
        ' moved ',
        subject(r),
        ' to ',
        { record: true, text: ctx.region(nv(r).region_id) || 'another region' },
      ],
      note: [arrow(ctx.region(ov(r).region_id), ctx.region(nv(r).region_id)), reason(nv(r))]
        .filter(Boolean)
        .join(' · '),
    }),
  ],
  'member.blacklist': [
    'people',
    'Blacklisted',
    (r) => ({ parts: [actor(r), ' blacklisted ', subject(r)], note: reason(nv(r)) }),
  ],
  'member.blacklist_lift': [
    'people',
    'Lifted blacklist',
    (r) => ({ parts: [actor(r), ' lifted the blacklist on ', subject(r)], note: reason(nv(r)) }),
  ],
  'member.suspend': [
    'people',
    'Suspended',
    (r) => ({ parts: [actor(r), ' suspended ', subject(r)], note: reason(nv(r)) }),
  ],
  'member.reinstate': [
    'people',
    'Reinstated',
    (r) => ({ parts: [actor(r), ' reinstated ', subject(r)], note: reason(nv(r)) }),
  ],
  'member.self_profile': [
    'people',
    'Filled in their details',
    (r) => ({
      parts: [actor(r), ' filled in their own details'],
      note: ['full_name', 'gender']
        .filter((k) => k in nv(r))
        .map((k) => `${k === 'full_name' ? 'full name' : k} ${nv(r)[k]}`)
        .join(' · '),
    }),
  ],
  'member.contact_change': [
    'people',
    'Changed contact details',
    (r) => ({
      parts: [actor(r), ' changed ', subject(r, 'a member', "'s"), ' contact details'],
      note: ['email', 'phone']
        .filter((k) => k in nv(r))
        .map((k) => `${k} ${arrow(ov(r)[k], nv(r)[k])}`)
        .join(' · '),
    }),
  ],
  'member.hard_delete': [
    'people',
    'Erased permanently',
    (r) => ({
      parts: [actor(r), ' permanently erased ', subject(r, nv(r).member_code || 'a member')],
    }),
  ],
  'member.group_forms_hidden': [
    'people',
    'Group forms visibility',
    (r) => ({
      parts: [
        actor(r),
        nv(r).group_forms_hidden
          ? ' hid group forms in their Lounge'
          : ' showed group forms in their Lounge',
      ],
    }),
  ],
  'members.update': [
    'people',
    'Member record changed',
    (r) => ({
      parts: [actor(r), ' changed ', subject(r, 'a member', "'s"), ' record'],
      note: changedKeys(r),
    }),
  ],
  'position.assign': [
    'roles',
    'Assigned position',
    (r, ctx) => ({ parts: [actor(r), ' made ', subject(r), ` ${positionPhrase(nv(r), ctx)}`] }),
  ],
  'position.revoke': [
    'roles',
    'Ended position',
    (r, ctx) => ({
      parts: [
        actor(r),
        ' ended ',
        subject(r, 'a member', "'s"),
        ` ${positionPhrase(ov(r), ctx)} role`,
      ],
      note: nv(r).reason?.replaceAll('_', ' ') || null,
    }),
  ],
  'admin_assignments.insert': [
    'roles',
    'Position record added',
    (r, ctx) => ({
      parts: [actor(r), ' added a position record for ', subject(r)],
      note: positionPhrase(nv(r), ctx),
    }),
  ],
  'admin_assignments.update': [
    'roles',
    'Position record changed',
    (r) => ({
      parts: [actor(r), ' changed a position record for ', subject(r)],
      note: changedKeys(r),
    }),
  ],
  'admin_assignments.delete': [
    'roles',
    'Position record removed',
    (r, ctx) => ({
      parts: [actor(r), ' removed a position record for ', subject(r)],
      note: positionPhrase(ov(r), ctx),
    }),
  ],
  'request.create': ['requests', 'Request raised', (r) => requestSentence(r, 'raised')],
  'request.approve': ['requests', 'Request approved', (r) => requestSentence(r, 'approved')],
  'request.reject': ['requests', 'Request rejected', (r) => requestSentence(r, 'rejected')],
  'request.cancel': ['requests', 'Request withdrawn', (r) => requestSentence(r, 'withdrew')],
  'region_request.review': [
    'requests',
    'Region change reviewed',
    (r, ctx) => ({
      parts: [actor(r), ` ${approved(r)} `, subject(r, 'a member', "'s"), ' region change'],
      note: arrow(ctx.region(ov(r).from_region_id), ctx.region(ov(r).to_region_id)),
    }),
  ],
  'form.delete': [
    'forms',
    'Form removed',
    (r) => ({
      parts: [actor(r), ' removed the form ', record(r, ov(r).title || 'a form')],
      note: ov(r).response_count != null ? `${ov(r).response_count} responses deleted` : null,
    }),
  ],
  'form.save': [
    'forms',
    'Form saved',
    (r) => ({
      parts: [
        actor(r),
        r.old_values ? ' edited the form ' : ' created the form ',
        record(r, nv(r).title || 'a form'),
      ],
    }),
  ],
  'form.review': [
    'forms',
    'Response reviewed',
    (r) => ({
      parts: [
        actor(r),
        ` ${nv(r).review_status === 'approved' ? 'approved' : nv(r).review_status === 'rejected' ? 'rejected' : 'reviewed'} `,
        subject(r, 'a member', "'s"),
        ' response to ',
        record(r, 'a form'),
      ],
      note: nv(r).review_reason || null,
    }),
  ],
  'form.resubmit': [
    'forms',
    'Response resubmitted',
    (r) => ({ parts: [actor(r), ' resubmitted their response to ', record(r, 'a form')] }),
  ],
  'events.insert': [
    'events',
    'Event created',
    (r) => ({ parts: [actor(r), ' created the event ', record(r, nv(r).name || 'an event')] }),
  ],
  'events.update': [
    'events',
    'Event changed',
    (r) => ({
      parts: [actor(r), ' changed the event ', record(r, nv(r).name || ov(r).name || 'an event')],
      note: changedKeys(r),
    }),
  ],
  'events.delete': [
    'events',
    'Event deleted',
    (r) => ({ parts: [actor(r), ' deleted the event ', record(r, ov(r).name || 'an event')] }),
  ],
  'attendance.import': [
    'events',
    'Attendance imported',
    (r) => ({
      parts: [actor(r), ' imported attendance for ', record(r, 'an event')],
      note: ['matched', 'unregistered', 'unresolved']
        .filter((k) => nv(r)[k] != null)
        .map((k) => `${nv(r)[k]} ${k}`)
        .join(' · '),
    }),
  ],
  'certificate_name.review': [
    'certificates',
    'Certificate name reviewed',
    (r) => ({
      parts: [actor(r), ` ${approved(r)} `, subject(r, 'a member', "'s"), ' certificate name'],
      note: arrow(ov(r).old_name, ov(r).new_name),
    }),
  ],
  'certificates.release': [
    'certificates',
    'Certificates released',
    (r) => ({
      parts: [actor(r), ' released certificates for ', record(r, 'an event')],
      note: [
        nv(r).issued != null && `${nv(r).issued} issued`,
        nv(r).pending_names && `${nv(r).pending_names} waiting on a name`,
      ]
        .filter(Boolean)
        .join(' · '),
    }),
  ],
  'notice.save': [
    'notices',
    'Notice saved',
    (r) => ({ parts: [actor(r), ' saved the notice ', record(r, nv(r).title || 'a notice')] }),
  ],
  'notice.publish': [
    'notices',
    'Notice published',
    (r) => ({ parts: [actor(r), ' published the notice ', record(r, ov(r).title || 'a notice')] }),
  ],
  'notice.unpublish': [
    'notices',
    'Notice unpublished',
    (r) => ({
      parts: [actor(r), ' unpublished the notice ', record(r, ov(r).title || 'a notice')],
    }),
  ],
  'notice.delete': [
    'notices',
    'Notice deleted',
    (r) => ({ parts: [actor(r), ' deleted the notice ', record(r, ov(r).title || 'a notice')] }),
  ],
  'auth.ban': [
    'accounts',
    'Sign-in blocked',
    (r) => ({
      parts: [actor(r), ' blocked sign-in for ', subject(r)],
      note: nv(r).account_status || null,
    }),
  ],
  'auth.unban': [
    'accounts',
    'Sign-in restored',
    (r) => ({
      parts: [actor(r), ' restored sign-in for ', subject(r)],
      note: nv(r).account_status || null,
    }),
  ],
  'auth.email_change': [
    'accounts',
    'Sign-in email changed',
    (r) => ({ parts: [actor(r), ' changed the sign-in email of ', subject(r)] }),
  ],
  'auth.email_revert': [
    'accounts',
    'Sign-in email reverted',
    (r) => ({ parts: [actor(r), ' reverted the sign-in email of ', subject(r)] }),
  ],
  'auth.delete_user': [
    'accounts',
    'Sign-in account deleted',
    (r) => ({ parts: [actor(r), ' deleted the sign-in account of ', subject(r)] }),
  ],
  'data.export': [
    'data',
    'Data exported',
    // Written by export_form_responses (lounge_forms) and export_event_records (events).
    (r) => ({
      parts: [
        actor(r),
        r.target_table === 'events'
          ? ' exported the records of '
          : r.target_table === 'lounge_forms'
            ? ' exported the responses to '
            : ' exported ',
        record(r, r.target_table === 'events' ? 'an event' : 'a form'),
      ],
      note: nv(r).rows != null ? `${nv(r).rows} rows` : null,
    }),
  ],
  'member.lookup': [
    'data',
    'Email looked up',
    (r) => ({
      parts: [actor(r), ' looked up ', { record: true, text: nv(r).email || 'an email' }],
      note: nv(r).found ? `Found · ${nv(r).source}` : 'Not found',
    }),
  ],
  'data.directory_search': [
    'data',
    'Directory searched',
    (r) => ({
      parts: [
        actor(r),
        ' searched the directory for ',
        { record: true, text: nv(r).query || 'a student' },
      ],
      note: nv(r).results != null ? `${nv(r).results} found` : null,
    }),
  ],
};

// Category for any action, catalogued or not: by exact name, then by prefix.
export function categoryOf(action) {
  const known = ACTIONS[action];
  if (known) return CATEGORY.get(known[0]);
  const prefix = action.split('.')[0];
  return CATEGORIES.find((c) => c.prefixes.includes(prefix)) ?? { id: 'other', label: 'Other' };
}

export const actionLabel = (action) => ACTIONS[action]?.[1] ?? action;

// The catalogued actions of a category, for the action picker.
export const actionsIn = (categoryId) =>
  Object.entries(ACTIONS)
    .filter(([, [cat]]) => cat === categoryId)
    .map(([id, [, label]]) => ({ id, label }));

// Rows written by table triggers; a business action in the same transaction leads its group.
export const isRowTrigger = (action) => /^(members|admin_assignments|events)\./.test(action);

export function sentence(row, ctx) {
  const say = ACTIONS[row.action]?.[2];
  if (say) {
    const out = say(row, ctx);
    return { parts: out.parts, note: out.note || null };
  }
  // Unknown action: "Priya · members.update · phone".
  const [table, op] = row.action.split('.');
  const verb = ROW_VERB[op];
  return {
    parts: [
      actor(row),
      verb && table ? ` ${verb} a ${table.replaceAll('_', ' ')} row` : ` · ${row.action}`,
    ],
    note: changedKeys(row),
    unknown: true,
  };
}

// Where a record opens in Admin: [tab, record id] or null.
export function recordLink(row) {
  const id = row.target_id;
  switch (row.target_table) {
    case 'events':
      return id ? ['events', id] : null;
    case 'lounge_forms':
      return row.action === 'form.delete' || !id ? null : ['forms', id];
    case 'form_responses':
      return nv(row).form_id ? ['forms', nv(row).form_id] : null;
    case 'announcements':
      return row.action === 'notice.delete' || !id ? null : ['notices', id];
    case 'approval_requests':
      return id ? ['requests', id] : null;
    case 'admin_assignments':
      return ['positions', null];
    default:
      return null;
  }
}

// ── Filters: URL query ⇄ RPC parameters ─────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const one = (v) => (Array.isArray(v) ? v[0] : v) ?? '';

// Reads the audit filters out of the route query; anything malformed is dropped.
export function readFilters(query) {
  const cat = CATEGORY.has(one(query.cat)) ? one(query.cat) : '';
  const allowed = new Set(actionsIn(cat).map((a) => a.id));
  const range = RANGES.some((r) => r.id === one(query.range)) ? one(query.range) : '';
  return {
    cat,
    act: cat
      ? one(query.act)
          .split(',')
          .filter((a) => allowed.has(a))
      : [],
    role: ROLE_LABEL[one(query.role)] ? one(query.role) : '',
    actor: UUID.test(one(query.actor)) ? one(query.actor) : '',
    member: UUID.test(one(query.member)) ? one(query.member) : '',
    range,
    from: range === 'custom' && DAY.test(one(query.from)) ? one(query.from) : '',
    to: range === 'custom' && DAY.test(one(query.to)) ? one(query.to) : '',
    q: one(query.q).slice(0, 100),
  };
}

// The filter part of the route query (empty values left out).
export function filtersQuery(f) {
  const q = {
    cat: f.cat,
    act: f.act?.length ? f.act.join(',') : '',
    role: f.role,
    actor: f.actor,
    member: f.member,
    range: f.range,
    from: f.range === 'custom' ? f.from : '',
    to: f.range === 'custom' ? f.to : '',
    q: f.q,
  };
  return Object.fromEntries(Object.entries(q).filter(([, v]) => v));
}

// How many filters narrow the feed (the "Clear (n)" count).
export const activeFilters = (f) =>
  [f.cat, f.role, f.actor, f.member, f.range, f.q.trim()].filter(Boolean).length;

const localDay = (day, end = false) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d + (end ? 1 : 0)).toISOString();
};

// Filter state → admin_audit_feed arguments (the cursor and limit are added by the caller).
export function feedArgs(f, now = new Date()) {
  const cat = CATEGORY.get(f.cat);
  const preset = RANGES.find((r) => r.id === f.range && r.hours);
  return {
    p_actions: f.act.length ? f.act : cat?.actions.length ? cat.actions : null,
    p_prefixes: f.act.length ? null : cat?.prefixes.length ? cat.prefixes : null,
    p_actor: f.actor || null,
    p_member: f.member || null,
    p_role: f.role || null,
    p_result: null,
    p_from: preset
      ? new Date(now.getTime() - preset.hours * 36e5).toISOString()
      : f.from
        ? localDay(f.from)
        : null,
    // The next local midnight, so the "to" day is included in full.
    p_to: !preset && f.to ? localDay(f.to, true) : null,
    p_q: f.q.trim() || null,
  };
}

// Labels shared by the overview, request queue and search results.
export const nameOf = (member) =>
  member?.preferred_name || member?.full_name || member?.email || 'Former member';
export const dateOf = (value, options = {}) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...options })
    : 'Not set';
export function ageOf(value) {
  if (!value) return 'Not set';
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value)) / 36e5));
  return hours < 1
    ? 'Less than an hour ago'
    : hours < 24
      ? `${hours}h ago`
      : `${Math.floor(hours / 24)}d ago`;
}
export function requestConsequence(request) {
  return (
    {
      member_profile_update:
        'The approved fields replace the student record. A region change also changes which coordinator can access it.',
      member_deletion: 'The account is marked deleted and sign-in access is disabled.',
      member_blacklist: 'The account is blacklisted and sign-in access is disabled.',
      member_hard_delete: 'Personal data is erased permanently. This cannot be undone.',
      member_contact_change: 'The login email changes in Auth and the student record.',
      member_status_change: 'The account status changes. Sign-in access is updated after approval.',
      position_change:
        'The position changes after approval. Admin access follows the new assignment.',
      event_publish: 'The event is published for its audience across the house.',
      form_publish: 'The form is published and opens for its audience.',
      form_delete:
        'The form and every response are deleted forever. A linked event can then be set to No form.',
      region:
        'The student moves to the selected region. Coordinator access follows the new region.',
      certificate: 'The new certificate name is used for future certificates.',
      community_record_update: 'The approved fields replace the community registration.',
      community_record_deletion: 'The community registration is removed.',
      community_tag_removal:
        'The student loses this community tag. Members-only community content stops reaching them.',
    }[request.type] || 'The requested change is applied after approval.'
  );
}
export function requestDiff(request, lookups) {
  if (request.type === 'event_publish')
    return [{ field: 'Publication', before: 'Draft', after: 'Published for the house' }];
  if (request.type === 'form_publish')
    return [{ field: 'Publication', before: 'Draft', after: 'Published' }];
  if (request.type === 'form_delete')
    return [
      {
        field: 'Form',
        before: request.requested_change?.form_title || 'This form',
        after: 'Deleted forever',
      },
    ];
  if (request.type === 'community_tag_removal')
    return [
      {
        field: 'Community',
        before: request.requested_change?.community_name || 'Tagged',
        after: 'Removed',
      },
    ];
  const snapshot = request.target_snapshot ?? {};
  const before = snapshot.member ?? snapshot.event ?? snapshot.registration ?? snapshot;
  const labels = {
    full_name: 'Full name',
    preferred_name: 'Preferred name',
    phone: 'Phone',
    email: 'Login email',
    gender: 'Gender',
    region_id: 'Region',
    community_id: 'Community',
    position: 'Position',
    action: 'Action',
    event_name: 'Event',
    published_at: 'Published',
    certificate_name: 'Certificate name',
  };
  const display = (key, value) => {
    if (value == null || value === '') return 'Not set';
    if (key === 'region_id')
      return lookups.regions.find((r) => r.id === Number(value))?.name || String(value);
    if (key === 'community_id')
      return lookups.communities.find((r) => r.id === Number(value))?.name || String(value);
    return typeof value === 'object' ? JSON.stringify(value) : String(value).replaceAll('_', ' ');
  };
  return Object.entries(request.requested_change ?? {}).map(([key, value]) => ({
    field: labels[key] || key.replaceAll('_', ' '),
    before: snapshot.redacted
      ? 'Erased'
      : Object.hasOwn(before, key)
        ? display(key, before[key])
        : 'Not recorded',
    after: display(key, value),
  }));
}

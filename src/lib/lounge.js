// Member flows and organizer operations use the same database contracts. The database owns
// eligibility, publication, organizer scope and persistent state; browser hints grant no access.
let client;
const sb = async () => (client ??= (await import('./supabase.js')).supabase);
const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};
async function rpc(name, params) {
  return unwrap(await (await sb()).rpc(name, params));
}
export async function loadLounge() {
  const supabase = await sb();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const uid = data.session?.user?.id;
  if (!uid) throw new Error('Sign in to enter the Lounge.');
  const [profile, events, forms, notices, certificates, regionRequests] = await Promise.all([
    supabase
      .from('members')
      .select(
        'id,member_code,full_name,preferred_name,gender,email,phone,region_id,tour_seen_at,group_forms_hidden,certificate_name,certificate_name_confirmed_at,cohort,region:regions(code,name)'
      )
      .eq('id', uid)
      .single()
      .then(unwrap),
    listLoungeEvents(),
    listForms(),
    listNotices(),
    listCertificates(),
    listRegionRequests(),
  ]);
  return { uid, profile, events, forms, notices, certificates, regionRequests };
}
export const updateProfile = ({ preferred_name = null, phone = null }) =>
  rpc('update_my_profile', { p_preferred_name: preferred_name, p_phone: phone });
// Full name and gender, each only while empty; afterwards an admin corrects them.
export const completeProfile = ({ full_name = null, gender = null }) =>
  rpc('complete_my_profile', { p_full_name: full_name, p_gender: gender });
export const markTourSeen = (seen = true) => rpc('set_my_tour_seen', { p_seen: seen });
export const setGroupFormsHidden = (hidden) =>
  rpc('set_group_forms_hidden', { p_hidden: !!hidden });
export const selectInitialRegion = (regionId) =>
  rpc('select_my_initial_region', { p_region_id: regionId });
export const requestRegionChange = (regionId, reason) =>
  rpc('request_my_region_change', { p_region_id: regionId, p_reason: reason });
export async function listRegionRequests() {
  return unwrap(
    await (
      await sb()
    )
      .from('member_region_requests')
      .select(
        '*, member:members!member_region_requests_member_id_fkey(full_name, preferred_name, email, member_code)'
      )
      .order('requested_at', {
        ascending: false,
      })
  );
}
export const reviewRegionRequest = (id, approve, note = '') =>
  rpc('review_region_change', { p_request_id: id, p_approve: approve, p_note: note || null });
export const listLoungeEvents = () => rpc('list_lounge_events');
export const listPublicPastEvents = () => rpc('list_public_past_events');
// Archive + past + upcoming events marked Public (each with a stage). Falls back to the older
// past-only RPC while a database without list_public_events is still deployed.
export const listPublicEvents = () => rpc('list_public_events').catch(() => listPublicPastEvents());
export const getAvailableCohorts = () => rpc('get_available_cohorts');
export const listForms = () => rpc('list_lounge_forms');
export const saveForm = (form) => rpc('save_lounge_form', { p_form: form });
export const submitForm = (id, answers, savePhone = false) =>
  rpc('submit_lounge_form', { p_form_id: id, p_answers: answers, p_save_phone: savePhone });
export const getFormInvite = (id) => rpc('get_lounge_form_invite', { p_form_id: id });
export const groupFormsForMember = (forms, regionId) =>
  forms.filter(
    (form) =>
      form.form_kind === 'group' &&
      !form.archived_at &&
      !form.event_id &&
      (form.region_id == null || form.region_id === regionId)
  );
// The admin review of a student's response: 'pending' | 'approved' | 'rejected', or null when
// not submitted (or when the database predates review, which behaves as before).
export const reviewOf = (form) => form?.review_status ?? null;
// A response is final unless an admin rejected it; a rejected one can be sent again.
export const isLocked = (form) => !!form?.submitted && reviewOf(form) !== 'rejected';
// Whether the form takes responses right now (the backend's verdict, else the open flag).
export const canSubmitForm = (form) =>
  !!form && (form.accepting_responses ?? form.is_open ?? false);
// A rejected response the student can still fix: the form has to be taking responses.
export const isFixable = (form) =>
  !!form?.submitted && reviewOf(form) === 'rejected' && canSubmitForm(form);
export function formUnavailableMessage(form, regionId, cohort) {
  if (!form) {
    return 'This form is unavailable to your account. It may be unpublished or restricted to another region or cohort.';
  }
  if (form.archived_at) return 'This form is archived.';
  if (!form.published_at) return 'This form is not published.';
  if (!form.is_open) return 'The organizer has closed this form.';
  const now = Date.now();
  if (Date.parse(form.published_at) > now) return 'This form is not published yet.';
  if (form.opens_at && Date.parse(form.opens_at) > now) return 'This form is not open yet.';
  if (form.closes_at && Date.parse(form.closes_at) <= now) {
    return 'This form’s response window has ended.';
  }
  if (form.region_id != null && form.region_id !== regionId) {
    return 'This form is for another region and is available only to members assigned to that region.';
  }
  const cohorts = Array.isArray(form.audience_cohorts) ? form.audience_cohorts : [];
  if (cohorts.length && !cohorts.includes(cohort)) {
    return 'This form is only available to members in its listed cohort.';
  }
  if (form.event_id) return 'This event form is not currently available to your account.';
  return 'This form is not accepting responses right now.';
}

export async function listGroups(forms = null, regionId = null) {
  // Approved forms leave the Lounge: the student is in, nothing is left to do.
  const submitted = groupFormsForMember(forms ?? (await listForms()), regionId).filter(
    (form) => form.submitted && reviewOf(form) !== 'approved'
  );
  return Promise.all(
    submitted.map(async (form) => {
      const review = { review_status: reviewOf(form), review_reason: form.review_reason ?? null };
      // A rejected response has no invite to show: the student fills the form again.
      if (review.review_status === 'rejected') {
        return {
          id: form.id,
          name: form.group_label || form.title,
          purpose: form.group_purpose || '',
          invite_url: '',
          applied: true,
          region_id: form.region_id,
          community_id: form.community_id,
          fixable: canSubmitForm(form),
          ...review,
        };
      }
      try {
        const invite = await getFormInvite(form.id);
        return {
          id: form.id,
          name: form.group_label || form.title,
          purpose: form.group_purpose || '',
          invite_url: invite || '',
          invite_unavailable: !invite,
          applied: true,
          region_id: form.region_id,
          community_id: form.community_id,
          ...review,
        };
      } catch (error) {
        return {
          id: form.id,
          name: form.group_label || form.title,
          purpose: form.group_purpose || '',
          invite_url: '',
          invite_error: error?.message || 'Invite link is not available yet.',
          applied: true,
          region_id: form.region_id,
          community_id: form.community_id,
          ...review,
        };
      }
    })
  );
}
export const listNotices = () => rpc('list_my_notices');
export const setNoticeState = (id, { read = true, dismiss = false } = {}) =>
  rpc('set_my_notice_state', { p_announcement_id: id, p_read: read, p_dismiss: dismiss });
export const deleteNotice = (id) => rpc('delete_announcement', { p_announcement_id: id });
export const saveNotice = (notice) => rpc('save_announcement', { p_announcement: notice });
export const setNoticePublished = (id, published) =>
  rpc('set_announcement_published', { p_announcement_id: id, p_published: published });
export const listCertificates = () => rpc('list_my_certificates');
export const confirmCertificateName = (name) =>
  rpc('confirm_my_certificate_name', { p_name: name });
export const requestCertificateNameChange = (name, reason) =>
  rpc('request_certificate_name_change', { p_name: name, p_reason: reason });
export async function listCertificateNameRequests() {
  return unwrap(
    await (
      await sb()
    )
      .from('certificate_name_requests')
      .select(
        '*, member:members!certificate_name_requests_member_id_fkey(full_name, preferred_name, email, member_code)'
      )
      .order('requested_at', {
        ascending: false,
      })
  );
}
export const reviewCertificateNameRequest = (id, approve, note = '') =>
  rpc('review_certificate_name_change', {
    p_request_id: id,
    p_approve: approve,
    p_note: note || null,
  });
export const verifyCertificate = (id) => rpc('verify_issued_certificate', { p_id: id });
export const importAttendance = (eventId, rows, options = {}) =>
  rpc('import_event_attendance', {
    p_event_id: eventId,
    p_rows: rows,
    p_mode: options.mode ?? 'merge',
    p_source_id: options.sourceId ?? 'default',
  });
export async function listAttendance(eventId) {
  return unwrap(
    await (
      await sb()
    )
      .from('event_attendance')
      .select(
        'event_id,row_key,import_source,import_sources,email,member_id,duration_seconds,reviewed_eligible,category,imported_at'
      )
      .eq('event_id', eventId)
      .order('category')
      .order('email')
  );
}
export const releaseCertificates = (eventId) =>
  rpc('release_event_certificates', { p_event_id: eventId });
export const exportFormResponses = (formId) => rpc('export_form_responses', { p_form_id: formId });
export const exportEventRecords = (eventId) => rpc('export_event_records', { p_event_id: eventId });
export async function uploadCertificateTemplate(eventId, file) {
  const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
  const extension = extensions[file.type];
  if (!extension || file.size > 10 * 1024 * 1024)
    throw new Error('Choose a PNG, JPEG or WebP signed template under 10 MB.');
  const supabase = await sb();
  const path = `${eventId}/${crypto.randomUUID()}.${extension}`;
  unwrap(
    await supabase.storage.from('certificate-templates').upload(path, file, {
      contentType: file.type,
      upsert: false,
    })
  );
  return supabase.storage.from('certificate-templates').getPublicUrl(path).data.publicUrl;
}

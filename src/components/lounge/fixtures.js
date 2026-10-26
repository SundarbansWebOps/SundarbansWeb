// The signed-in member's own row, filled by session.hydrateLounge(). No sample data lives here.
import { reactive } from 'vue';

export const member = reactive({
  id: '',
  full_name: '',
  preferred_name: '',
  gender: '',
  email: '',
  phone: '',
  roll: '',
  cohort: '',
  region_id: null,
  region: { code: '', name: '' },
  coordinator: { name: 'Your Regional Coordinator', role: 'Regional Coordinator' },
  communities: [],
  certificate_name: '',
  tour_seen_at: null,
  group_forms_hidden: false,
});

-- The public PAN BS pop-up shows the form's banner (spec 008), so its form read returns it too.
create or replace function public.get_panbs_form(p_event_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', f.id, 'title', f.title, 'description', f.description,
                            'fields', f.fields, 'closes_at', f.closes_at, 'houses', to_jsonb(private.iitm_houses()),
                            'banner_url', f.banner_url, 'banner_alt', f.banner_alt)
  from public.lounge_forms f
  where f.event_id = p_event_id and private.panbs_form_open(f.id)
  order by f.created_at desc limit 1;
$$;
revoke execute on function public.get_panbs_form(uuid) from public;
grant execute on function public.get_panbs_form(uuid) to anon, authenticated, service_role;

-- A Head/Co-Head/RC asks a Super Admin to remove a form. The value must exist before
-- 20261026150100_form_delete uses it in constraints and indexes.
alter type public.request_type add value if not exists 'form_delete';

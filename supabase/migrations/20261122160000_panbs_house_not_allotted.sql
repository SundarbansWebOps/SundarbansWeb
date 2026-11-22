-- PAN BS registration: students not yet allotted a house can say so. "Not allotted yet" is stored
-- as the guest's house, so the admin guest house filter lists it like any other house.
create or replace function private.iitm_houses() returns text[]
language sql immutable set search_path = '' as $$
  select array['Bandipur','Corbett','Gir','Kanha','Kaziranga','Namdapha','Nallamala','Nilgiri',
               'Pichavaram','Saranda','Sundarbans','Wayanad','Not allotted yet'];
$$;

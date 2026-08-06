-- Keep the older app-admin flag and the newer user_roles admin gate in sync
-- for the Side Huddle owner account used by /OUTREACH.
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where lower(email) = lower('tbaileyxi@gmail.com')
on conflict (user_id) do update
set role = 'admin'::public.app_role;

insert into public.user_roles (user_id, role)
select user_id, 'admin'::public.app_role
from public.profiles
where coalesce(is_app_admin, false) = true
on conflict (user_id) do update
set role = 'admin'::public.app_role;

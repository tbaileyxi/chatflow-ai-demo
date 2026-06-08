-- Grant app admin to Ty's account so they can flip huddles Official for testing.
-- Matches by email through auth.users. Safe to re-run.
update public.profiles
   set is_app_admin = true
 where user_id in (
   select id from auth.users where email = 'tbaileyxi@gmail.com'
 );

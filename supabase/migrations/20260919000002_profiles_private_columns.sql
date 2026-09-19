-- PROFILES WERE READABLE BY ANYONE HOLDING THE APP'S PUBLIC KEY.
--
-- The key ships in every copy of the app and the website, so "anon can read
-- profiles" means the whole table is public: phone numbers, push tokens,
-- Stripe customer ids, login history, ban reasons. The rows have to stay
-- readable — rosters, search and public profiles are built on them — but the
-- private columns do not.
--
-- Row-level security cannot do columns, so this is column privileges: SELECT
-- is granted on the public columns only. Writing is untouched, so a person
-- still saves their own phone number and the app still stores a push token;
-- they simply cannot read those columns back off anybody's row, including
-- their own. The two places that legitimately need them — your own profile
-- screen and the admin directory — go through the functions below.

revoke select on public.profiles from anon, authenticated;

grant select (
  id, user_id, display_name, username, avatar_url, bio, status,
  created_at, updated_at, onboarding_completed, is_app_admin,
  is_founding_member, founding_tier, founding_spot_number, founding_purchased_at,
  has_lifetime_verified_huddle_code, verified_huddle_promo_code,
  is_premium, premium_since, premium_expires_at,
  game_pings_enabled, share_at_venue,
  x_handle, verified_creator
) on public.profiles to anon, authenticated;

-- Your own private fields, for the screen where you edit them.
create or replace function public.my_private_profile()
returns table (phone_number text, last_login_at timestamptz, signup_method text)
language sql security definer set search_path = public stable as $$
  select p.phone_number, p.last_login_at, p.signup_method
    from public.profiles p
   where p.user_id = auth.uid();
$$;
grant execute on function public.my_private_profile() to authenticated;

-- The admin user directory: the same columns the admin screens always showed,
-- now behind the admin check instead of behind nothing.
create or replace function public.admin_user_directory(p_search text default null, p_limit int default 200)
returns table (
  user_id uuid, display_name text, username text, avatar_url text, status text,
  phone_number text, last_login_at timestamptz, signup_method text,
  banned_reason text, banned_at timestamptz, blocked_at timestamptz,
  created_at timestamptz, onboarding_completed boolean, bio text
)
language plpgsql security definer set search_path = public stable as $$
begin
  if public.get_current_user_role() is distinct from 'admin' then
    raise exception 'admin only';
  end if;
  return query
    select p.user_id, p.display_name, p.username, p.avatar_url, p.status,
           p.phone_number, p.last_login_at, p.signup_method,
           p.banned_reason, p.banned_at, p.blocked_at,
           p.created_at, p.onboarding_completed, p.bio
      from public.profiles p
     where coalesce(trim(p_search), '') = ''
        or p.display_name ilike '%' || trim(p_search) || '%'
        or p.username ilike '%' || trim(p_search) || '%'
        or p.phone_number ilike '%' || trim(p_search) || '%'
     order by p.created_at desc
     limit greatest(1, least(coalesce(p_limit, 200), 1000));
end $$;
grant execute on function public.admin_user_directory(text, int) to authenticated;

-- Build 9 server-side prep: sponsor schema + RevenueCat subscription tracking.
-- Both ship live without an app rebuild.  Mobile reads them when B9 lands.

-- ============================================================
-- 1. team_sponsors
--    One active sponsor per team at a time (enforced by unique partial index).
--    Insert rows manually when you close a deal:
--      INSERT INTO team_sponsors (team_id, brand_name, logo_url, link_url, start_date)
--      VALUES ('<knicks-uuid>', 'Crown Royal', 'https://...', 'https://crownroyal.com/knicks', now());
-- ============================================================
create table if not exists public.team_sponsors (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  brand_name text not null,
  logo_url text,
  link_url text not null,
  tier int not null default 1 check (tier in (1, 2, 3)),
  start_date timestamptz not null default now(),
  end_date timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Only one ACTIVE sponsor per team at a time (immutable predicate).
-- Calendar-based expiry is handled in queries, not in this index.
create unique index if not exists team_sponsors_active_unique
  on public.team_sponsors (team_id)
  where is_active = true;

-- Public read so the mobile app + hosted sponsor page can render.
alter table public.team_sponsors enable row level security;

drop policy if exists "Anyone can read active sponsors" on public.team_sponsors;
create policy "Anyone can read active sponsors"
  on public.team_sponsors for select
  using (is_active = true);
-- Calendar-based expiry: clients filter by end_date in queries; trust is_active flag.

-- ============================================================
-- 2. sponsor_impressions — counts taps on the "Presented by" line.
--    Used for reporting CTR back to sponsors monthly.
-- ============================================================
create table if not exists public.sponsor_impressions (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.team_sponsors(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  huddle_id uuid references public.huddles(id) on delete set null,
  kind text not null default 'tap' check (kind in ('view', 'tap')),
  created_at timestamptz not null default now()
);

create index if not exists sponsor_impressions_sponsor_day
  on public.sponsor_impressions (sponsor_id, created_at desc);

alter table public.sponsor_impressions enable row level security;

-- Logged-in users can insert their own impressions only.
drop policy if exists "Users can log their own sponsor taps" on public.sponsor_impressions;
create policy "Users can log their own sponsor taps"
  on public.sponsor_impressions for insert
  with check (user_id = auth.uid() or user_id is null);

-- ============================================================
-- 3. subscriptions — RevenueCat-driven, one row per active sub
-- ============================================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rc_app_user_id text,                         -- RevenueCat's user identifier
  product_id text not null,                    -- e.g. 'official_huddle_monthly'
  entitlement_id text not null,                -- e.g. 'official_huddle_access'
  store text not null default 'app_store'      -- app_store | play_store | stripe
    check (store in ('app_store', 'play_store', 'stripe')),
  original_transaction_id text,
  status text not null default 'active'
    check (status in ('active', 'expired', 'in_grace', 'cancelled', 'paused')),
  period_start timestamptz not null,
  period_end timestamptz,
  auto_renews boolean not null default true,
  -- The huddle this sub is attached to (Official Huddle = per-huddle sub).
  huddle_id uuid references public.huddles(id) on delete set null,
  raw_event jsonb,                             -- last raw RC payload for debugging
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_active
  on public.subscriptions (user_id) where status = 'active';
create index if not exists subscriptions_huddle_active
  on public.subscriptions (huddle_id) where status = 'active';
create unique index if not exists subscriptions_original_txn_unique
  on public.subscriptions (original_transaction_id)
  where original_transaction_id is not null;

alter table public.subscriptions enable row level security;

drop policy if exists "Users see their own subscriptions" on public.subscriptions;
create policy "Users see their own subscriptions"
  on public.subscriptions for select
  using (user_id = auth.uid());

-- Only the service role (webhook) writes; no client INSERT/UPDATE policy.

-- ============================================================
-- 4. RPC: activate_official_huddle(huddle_id)
--    Called by the mobile client after a successful RevenueCat purchase.
--    Verifies the caller has an ACTIVE official_huddle_access entitlement
--    in the subscriptions table; if so, flips the huddle Official AND
--    attaches the subscription row to that huddle.
-- ============================================================
create or replace function public.activate_official_huddle(
  p_huddle_id uuid,
  p_entitlement_id text default 'official_huddle_access'
)
returns table(huddle_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sub_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Must own the huddle.
  if not exists (
    select 1 from public.huddles where id = p_huddle_id and owner_id = v_user_id
  ) then
    raise exception 'not the huddle owner' using errcode = '42501';
  end if;

  -- Must have an active subscription with the matching entitlement that is
  -- either already attached to this huddle OR unattached (free to claim).
  select id into v_sub_id
    from public.subscriptions
   where user_id = v_user_id
     and entitlement_id = p_entitlement_id
     and status = 'active'
     and (huddle_id is null or huddle_id = p_huddle_id)
   order by created_at desc
   limit 1;

  if v_sub_id is null then
    raise exception 'no active entitlement' using errcode = '42501';
  end if;

  -- Attach sub to this huddle and flip official.
  update public.subscriptions
     set huddle_id = p_huddle_id, updated_at = now()
   where id = v_sub_id;

  update public.huddles
     set official_status = 'active'
   where id = p_huddle_id;

  huddle_id := p_huddle_id;
  status := 'active';
  return next;
end;
$$;

grant execute on function public.activate_official_huddle(uuid, text) to authenticated;

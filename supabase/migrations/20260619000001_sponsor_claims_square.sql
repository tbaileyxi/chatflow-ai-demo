-- Founding-sponsor claim board (Square reserve flow).
--
-- Board-native: the /sponsors team grid uses static team keys ("LEAGUE|City|Name"),
-- not rows in public.teams, so this table keys on that text key directly. One row per
-- team key, created when a sponsor starts checkout and flipped to reserved/claimed by
-- the Square webhook. Contact info is private (admin-only); the board reads status via
-- a public view.

create table if not exists public.sponsor_claims (
  id uuid primary key default gen_random_uuid(),
  team_key text not null unique,                 -- "NFL|Chicago|Bears"
  team_name text not null,                        -- "Chicago Bears"
  league text not null,                           -- "NFL"
  status text not null default 'open'
    check (status in ('open', 'reserved', 'claimed')),
  plan text check (plan in ('reserve', 'full')),  -- $200 hold vs $750 paid-in-full
  business_name text,
  sponsor_email text,
  sponsor_phone text,
  amount_paid_cents integer not null default 0,
  balance_due_cents integer not null default 0,   -- $550 remaining for reserve plan
  balance_due_date date default '2026-08-29',
  square_checkout_id text,
  square_order_id text,
  square_payment_id text,
  reserved_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sponsor_claims_status_idx on public.sponsor_claims(status);
create unique index if not exists sponsor_claims_order_idx
  on public.sponsor_claims(square_order_id) where square_order_id is not null;

alter table public.sponsor_claims enable row level security;

-- No anon access to the base table (it holds sponsor contact info).
-- Admins (via has_role) get full read/write from the admin page.
drop policy if exists "Admins manage sponsor claims" on public.sponsor_claims;
create policy "Admins manage sponsor claims"
  on public.sponsor_claims for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Public board status: team_key -> status only. The view runs with the
-- definer's rights and so bypasses the base-table RLS, exposing nothing
-- beyond which teams are taken.
create or replace view public.sponsor_claim_status as
  select team_key, status
  from public.sponsor_claims
  where status in ('reserved', 'claimed');

grant select on public.sponsor_claim_status to anon, authenticated;

-- updated_at touch
create or replace function public.touch_sponsor_claims_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sponsor_claims_touch on public.sponsor_claims;
create trigger sponsor_claims_touch
  before update on public.sponsor_claims
  for each row execute function public.touch_sponsor_claims_updated_at();

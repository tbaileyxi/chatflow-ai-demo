-- Mark existing Side Huddle demo teams as unavailable on the public sponsor board.

insert into public.sponsor_claims (
  team_key,
  team_name,
  league,
  status,
  plan,
  business_name,
  sponsor_email,
  amount_paid_cents,
  balance_due_cents,
  reserved_at,
  claimed_at
) values
  (
    'NFL|Chicago|Bears',
    'Chicago Bears',
    'NFL',
    'claimed',
    'full',
    'Side Huddle Demo',
    'ty@sidehuddlesports.com',
    0,
    0,
    now(),
    now()
  ),
  (
    'NFL|Buffalo|Bills',
    'Buffalo Bills',
    'NFL',
    'reserved',
    'reserve',
    'Side Huddle Demo',
    'ty@sidehuddlesports.com',
    0,
    0,
    now(),
    null
  ),
  (
    'NBA|Chicago|Bulls',
    'Chicago Bulls',
    'NBA',
    'reserved',
    'reserve',
    'Side Huddle Demo',
    'ty@sidehuddlesports.com',
    0,
    0,
    now(),
    null
  )
on conflict (team_key) do update set
  status = excluded.status,
  plan = excluded.plan,
  business_name = excluded.business_name,
  sponsor_email = excluded.sponsor_email,
  reserved_at = coalesce(public.sponsor_claims.reserved_at, excluded.reserved_at),
  claimed_at = case
    when excluded.status = 'claimed' then coalesce(public.sponsor_claims.claimed_at, excluded.claimed_at)
    else public.sponsor_claims.claimed_at
  end;

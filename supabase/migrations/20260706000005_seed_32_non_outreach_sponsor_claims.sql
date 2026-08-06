-- Make the public sponsor board feel active without blocking the outreach schools.
-- College teams here intentionally exclude the school-partner outreach list.

with rows(team_key, team_name, league, status) as (
  values
    ('NFL|Chicago|Bears', 'Chicago Bears', 'NFL', 'claimed'),
    ('NFL|Buffalo|Bills', 'Buffalo Bills', 'NFL', 'reserved'),
    ('NFL|Dallas|Cowboys', 'Dallas Cowboys', 'NFL', 'claimed'),
    ('NFL|Kansas City|Chiefs', 'Kansas City Chiefs', 'NFL', 'reserved'),
    ('NFL|Philadelphia|Eagles', 'Philadelphia Eagles', 'NFL', 'reserved'),
    ('NFL|San Francisco|49ers', 'San Francisco 49ers', 'NFL', 'claimed'),
    ('NFL|Detroit|Lions', 'Detroit Lions', 'NFL', 'reserved'),
    ('NFL|Miami|Dolphins', 'Miami Dolphins', 'NFL', 'reserved'),
    ('NBA|Chicago|Bulls', 'Chicago Bulls', 'NBA', 'reserved'),
    ('NBA|Los Angeles|Lakers', 'Los Angeles Lakers', 'NBA', 'claimed'),
    ('NBA|Boston|Celtics', 'Boston Celtics', 'NBA', 'reserved'),
    ('NBA|Golden State|Warriors', 'Golden State Warriors', 'NBA', 'claimed'),
    ('NBA|New York|Knicks', 'New York Knicks', 'NBA', 'reserved'),
    ('NBA|Dallas|Mavericks', 'Dallas Mavericks', 'NBA', 'reserved'),
    ('MLB|Chicago|Cubs', 'Chicago Cubs', 'MLB', 'reserved'),
    ('MLB|New York|Yankees', 'New York Yankees', 'MLB', 'claimed'),
    ('MLB|Los Angeles|Dodgers', 'Los Angeles Dodgers', 'MLB', 'claimed'),
    ('MLB|Boston|Red Sox', 'Boston Red Sox', 'MLB', 'reserved'),
    ('MLB|St. Louis|Cardinals', 'St. Louis Cardinals', 'MLB', 'reserved'),
    ('MLB|Seattle|Mariners', 'Seattle Mariners', 'MLB', 'reserved'),
    ('NHL|Chicago|Blackhawks', 'Chicago Blackhawks', 'NHL', 'reserved'),
    ('NHL|New York|Rangers', 'New York Rangers', 'NHL', 'claimed'),
    ('NHL|Toronto|Maple Leafs', 'Toronto Maple Leafs', 'NHL', 'reserved'),
    ('NHL|Vegas|Golden Knights', 'Vegas Golden Knights', 'NHL', 'reserved'),
    ('NCAA|USC|Trojans', 'USC Trojans', 'NCAA', 'claimed'),
    ('NCAA|Utah|Utes', 'Utah Utes', 'NCAA', 'reserved'),
    ('NCAA|Wisconsin|Badgers', 'Wisconsin Badgers', 'NCAA', 'reserved'),
    ('NCAA|Miami|Hurricanes', 'Miami Hurricanes', 'NCAA', 'reserved'),
    ('NCAA|North Carolina|Tar Heels', 'North Carolina Tar Heels', 'NCAA', 'reserved'),
    ('NCAA|Arkansas|Razorbacks', 'Arkansas Razorbacks', 'NCAA', 'reserved'),
    ('NCAA|Colorado|Buffaloes', 'Colorado Buffaloes', 'NCAA', 'reserved'),
    ('NCAA|Iowa|Hawkeyes', 'Iowa Hawkeyes', 'NCAA', 'reserved')
)
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
)
select
  team_key,
  team_name,
  league,
  status,
  case when status = 'claimed' then 'full' else 'reserve' end,
  'Side Huddle Demo',
  'ty@sidehuddlesports.com',
  0,
  0,
  now(),
  case when status = 'claimed' then now() else null end
from rows
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

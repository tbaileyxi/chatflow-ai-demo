-- Batch 2 school-partner outreach plus availability repair.
--
-- Any outreach school should be purchasable on /sponsors unless a real customer
-- has claimed it. Remove only Side Huddle Demo scarcity rows, then add replacement
-- non-outreach demo scarcity schools.

with outreach_team_keys(team_key) as (
  values
    ('NCAA|Alabama|Crimson Tide'),
    ('NCAA|Arkansas|Razorbacks'),
    ('NCAA|Auburn|Tigers'),
    ('NCAA|Baylor|Bears'),
    ('NCAA|BYU|Cougars'),
    ('NCAA|Clemson|Tigers'),
    ('NCAA|Florida|Gators'),
    ('NCAA|Florida State|Seminoles'),
    ('NCAA|Georgia|Bulldogs'),
    ('NCAA|Iowa|Hawkeyes'),
    ('NCAA|Kansas|Jayhawks'),
    ('NCAA|Kansas State|Wildcats'),
    ('NCAA|Kentucky|Wildcats'),
    ('NCAA|LSU|Tigers'),
    ('NCAA|Miami|Hurricanes'),
    ('NCAA|Michigan|Wolverines'),
    ('NCAA|Michigan State|Spartans'),
    ('NCAA|Mississippi St|Bulldogs'),
    ('NCAA|Missouri|Tigers'),
    ('NCAA|NC State|Wolfpack'),
    ('NCAA|Nebraska|Cornhuskers'),
    ('NCAA|North Carolina|Tar Heels'),
    ('NCAA|Notre Dame|Fighting Irish'),
    ('NCAA|Ohio State|Buckeyes'),
    ('NCAA|Oklahoma|Sooners'),
    ('NCAA|Oklahoma State|Cowboys'),
    ('NCAA|Ole Miss|Rebels'),
    ('NCAA|Oregon|Ducks'),
    ('NCAA|Penn State|Nittany Lions'),
    ('NCAA|South Carolina|Gamecocks'),
    ('NCAA|Tennessee|Volunteers'),
    ('NCAA|Texas|Longhorns'),
    ('NCAA|Texas A&M|Aggies'),
    ('NCAA|Texas Tech|Red Raiders'),
    ('NCAA|Utah|Utes'),
    ('NCAA|Virginia|Cavaliers'),
    ('NCAA|Virginia Tech|Hokies'),
    ('NCAA|Washington|Huskies'),
    ('NCAA|West Virginia|Mountaineers'),
    ('NCAA|Wisconsin|Badgers')
)
delete from public.sponsor_claims sc
using outreach_team_keys ok
where sc.team_key = ok.team_key
  and (
    sc.business_name = 'Side Huddle Demo'
    or sc.sponsor_email = 'ty@sidehuddlesports.com'
  );

with rows(team_key, team_name, league, status) as (
  values
    ('NCAA|Boston College|Eagles', 'Boston College Eagles', 'NCAA', 'reserved'),
    ('NCAA|Duke|Blue Devils', 'Duke Blue Devils', 'NCAA', 'reserved'),
    ('NCAA|Georgia Tech|Yellow Jackets', 'Georgia Tech Yellow Jackets', 'NCAA', 'reserved'),
    ('NCAA|Iowa State|Cyclones', 'Iowa State Cyclones', 'NCAA', 'reserved'),
    ('NCAA|Louisville|Cardinals', 'Louisville Cardinals', 'NCAA', 'reserved'),
    ('NCAA|Pittsburgh|Panthers', 'Pittsburgh Panthers', 'NCAA', 'reserved'),
    ('NCAA|Purdue|Boilermakers', 'Purdue Boilermakers', 'NCAA', 'reserved'),
    ('NCAA|Syracuse|Orange', 'Syracuse Orange', 'NCAA', 'reserved'),
    ('NCAA|Vanderbilt|Commodores', 'Vanderbilt Commodores', 'NCAA', 'reserved'),
    ('NCAA|Wake Forest|Demon Deacons', 'Wake Forest Demon Deacons', 'NCAA', 'reserved')
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
  'reserve',
  'Side Huddle Demo',
  'ty@sidehuddlesports.com',
  0,
  0,
  now(),
  null
from rows
on conflict (team_key) do update set
  status = excluded.status,
  plan = excluded.plan,
  business_name = excluded.business_name,
  sponsor_email = excluded.sponsor_email,
  reserved_at = coalesce(public.sponsor_claims.reserved_at, excluded.reserved_at);

with rows(school, organization, contact_name, contact_title, contact_email, fit, notes) as (
  values
    ('Arkansas', 'Razorback Foundation', 'Ryan White', 'Executive Director', 'rwhite@razorbackfoundation.com', 'Strong statewide identity and a standalone booster brand.', 'school partner batch2'),
    ('North Carolina', 'The Rams Club', 'Matt Terrell', 'Chief Strategy & Communications Officer', 'matt@ramsclub.com', 'A communications, visibility, and membership-growth channel for Carolina supporters.', 'school partner batch2'),
    ('NC State', 'Wolfpack Club', 'Donnell Priest', 'Director of Premium Seating & Advertising', 'donnell.priest@wolfpackclub.com', 'Directly oversees advertising and sales inventory.', 'school partner batch2'),
    ('Iowa', 'I-Club / Iowa Athletics Development', 'Scott Brickman', 'Associate AD for NIL Strategy & Revenue Generation', 'Scott-Brickman@uiowa.edu', 'NIL, strategy, and revenue-generation owner.', 'school partner batch2'),
    ('Missouri', 'Mizzou Athletics Fund', 'Blair DeBord', 'Executive Athletics Director and Chief Revenue Officer', 'bdebord@missouri.edu', 'Oversees philanthropy, sponsorships, NIL, premium seating, fan engagement, and new business development.', 'school partner batch2'),
    ('Mississippi State', 'Bulldog Club', 'KK Seago', 'Director of Business Partnerships', 'kseago@athletics.msstate.edu', 'Responsible for third-party NIL and business-development opportunities.', 'school partner batch2'),
    ('Wisconsin', 'Wisconsin Athletic Development', 'Zachary Epstein', 'Director of Annual Giving', 'ZAE@athletics.wisc.edu', 'Annual-giving leaders care about adding younger supporters and repeated fan touchpoints.', 'school partner batch2'),
    ('Kansas', 'Williams Education Fund', 'Natalie Terwilliger', 'Assistant Director of Annual Giving', 'Natalie.T@ku.edu', 'A reasonable first contact for a $250 experiment tied to acquiring and engaging Jayhawk supporters.', 'school partner batch2'),
    ('Kansas State', 'Ahearn Fund', 'Rob Heil', 'Senior Associate AD for Development', 'rheil@kstatesports.com', 'Leads K-State fundraising and has a directly published email.', 'school partner batch2'),
    ('Oklahoma State', 'POSSE / OSU NIL Alliance', 'Brakston Brock', 'Senior Associate AD for NIL Strategy & Revenue Generation', 'brakston.brock@okstate.edu', 'Sits across both POSSE and the NIL operation.', 'school partner batch2'),
    ('Texas Tech', 'Red Raider Club', 'Andrea Tirey', 'Senior Associate AD for Development', 'andrea.tirey@ttu.edu', 'Fundraising operator who can see the value of an exclusive Red Raider position.', 'school partner batch2'),
    ('Baylor', 'Bear Foundation', 'Chris Lynn', 'Executive Director', 'Chris_Lynn@baylor.edu', 'Runs the Bear Foundation day-to-day operation and annual fund.', 'school partner batch2'),
    ('Virginia Tech', 'Hokie Club', 'Brad Wurthman', 'Executive Associate AD and Chief Revenue Officer', 'wurthman@vt.edu', 'Revenue owner who should understand a low-cost exclusive fan-engagement asset.', 'school partner batch2'),
    ('Virginia', 'Virginia Athletics Foundation', 'Erin Wissing', 'Deputy Executive Director', 'erin.wissing@virginia.edu', 'Marketing, communications, events, stewardship, and organizational strategy fit.', 'school partner batch2'),
    ('West Virginia', 'Mountaineer Athletic Club', 'Matt Waggoner', 'Director of Development - Annual Giving', 'mwaggoner@wvuf.org', 'Intense statewide fan identity and direct annual-giving/supporter acquisition remit.', 'school partner batch2'),
    ('Miami', 'Hurricane Club', 'Kayla Blake Grimes', 'Assistant VP, Hurricane Club & Premium Sales', 'athleticdevelopment@miami.edu', 'Manages the Hurricane Club annual fund and premium sales. Attn: Kayla Blake Grimes.', 'school partner batch2; route through shared athletic development inbox'),
    ('Michigan State', 'Spartan Fund', 'Jacob Kirkham', 'Executive Director, Athletics Constituency Programs', 'kirkham@ath.msu.edu', 'Leads athletics advancement constituency and is senior enough to approve a branded test.', 'school partner batch2'),
    ('Washington', 'Tyee Club', 'Troy Welin', 'Director of the Annual Fund', 'welint@uw.edu', 'Uses broad supporter participation, making the huddle-growth angle relevant.', 'school partner batch2'),
    ('BYU', 'Cougar Club', 'Randall Hild', 'Associate AD for Development', 'randall_hild@byu.edu', 'Oversees Cougar Club activities, renewals, events, and membership growth strategies.', 'school partner batch2'),
    ('Utah', 'Crimson Club', 'JT Tumanuvao', 'Director of Annual Giving', 'jtumanuvao@huntsman.utah.edu', 'Owns annual giving and is a strong entry point for a $250 exclusive test.', 'school partner batch2')
)
insert into public.sponsor_leads (
  company,
  vertical,
  region,
  market,
  school,
  domain,
  contact_name,
  contact_title,
  contact_email,
  email_confidence,
  priority,
  sponsor_signal,
  sponsor_score,
  best_package,
  best_angle,
  status,
  notes
)
select
  organization,
  'school partner',
  'College athletics batch 2',
  school,
  school,
  split_part(contact_email, '@', 2),
  contact_name,
  contact_title,
  contact_email,
  'high',
  'TIER1',
  fit,
  20,
  '$250/month',
  'Official Side Huddle Partner for ' || school,
  'Drafted',
  notes
from rows
on conflict (contact_email) do update set
  company = excluded.company,
  vertical = excluded.vertical,
  region = excluded.region,
  market = excluded.market,
  school = excluded.school,
  domain = excluded.domain,
  contact_name = excluded.contact_name,
  contact_title = excluded.contact_title,
  email_confidence = excluded.email_confidence,
  priority = excluded.priority,
  sponsor_signal = excluded.sponsor_signal,
  sponsor_score = excluded.sponsor_score,
  best_package = excluded.best_package,
  best_angle = excluded.best_angle,
  status = excluded.status,
  notes = excluded.notes;

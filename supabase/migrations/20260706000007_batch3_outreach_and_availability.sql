-- Batch 3 school-partner outreach plus availability repair.
--
-- Outreach targets must remain purchasable on /sponsors unless a real customer
-- claimed them. Remove only Side Huddle Demo scarcity rows for outreach schools,
-- then use pro teams as replacement demo scarcity.

with outreach_team_keys(team_key) as (
  values
    ('NCAA|Alabama|Crimson Tide'),
    ('NCAA|Arkansas|Razorbacks'),
    ('NCAA|Auburn|Tigers'),
    ('NCAA|Arizona|Wildcats'),
    ('NCAA|Arizona State|Sun Devils'),
    ('NCAA|Baylor|Bears'),
    ('NCAA|Boise State|Broncos'),
    ('NCAA|Boston College|Eagles'),
    ('NCAA|BYU|Cougars'),
    ('NCAA|Cincinnati|Bearcats'),
    ('NCAA|Clemson|Tigers'),
    ('NCAA|Colorado|Buffaloes'),
    ('NCAA|Duke|Blue Devils'),
    ('NCAA|Florida|Gators'),
    ('NCAA|Florida State|Seminoles'),
    ('NCAA|Georgia|Bulldogs'),
    ('NCAA|Georgia Tech|Yellow Jackets'),
    ('NCAA|Houston|Cougars'),
    ('NCAA|Illinois|Fighting Illini'),
    ('NCAA|Indiana|Hoosiers'),
    ('NCAA|Iowa|Hawkeyes'),
    ('NCAA|Iowa State|Cyclones'),
    ('NCAA|Kansas|Jayhawks'),
    ('NCAA|Kansas State|Wildcats'),
    ('NCAA|Kentucky|Wildcats'),
    ('NCAA|Louisville|Cardinals'),
    ('NCAA|LSU|Tigers'),
    ('NCAA|Memphis|Tigers'),
    ('NCAA|Miami|Hurricanes'),
    ('NCAA|Michigan|Wolverines'),
    ('NCAA|Michigan State|Spartans'),
    ('NCAA|Mississippi State|Bulldogs'),
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
    ('NCAA|Pittsburgh|Panthers'),
    ('NCAA|Purdue|Boilermakers'),
    ('NCAA|SMU|Mustangs'),
    ('NCAA|South Carolina|Gamecocks'),
    ('NCAA|Syracuse|Orange'),
    ('NCAA|TCU|Horned Frogs'),
    ('NCAA|Tennessee|Volunteers'),
    ('NCAA|Texas|Longhorns'),
    ('NCAA|Texas A&M|Aggies'),
    ('NCAA|Texas Tech|Red Raiders'),
    ('NCAA|Tulane|Green Wave'),
    ('NCAA|UCF|Knights'),
    ('NCAA|USC|Trojans'),
    ('NCAA|Utah|Utes'),
    ('NCAA|Vanderbilt|Commodores'),
    ('NCAA|Virginia|Cavaliers'),
    ('NCAA|Virginia Tech|Hokies'),
    ('NCAA|Wake Forest|Demon Deacons'),
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
    ('NFL|Arizona|Cardinals', 'Arizona Cardinals', 'NFL', 'reserved'),
    ('NFL|Baltimore|Ravens', 'Baltimore Ravens', 'NFL', 'claimed'),
    ('NBA|Brooklyn|Nets', 'Brooklyn Nets', 'NBA', 'reserved'),
    ('MLB|Atlanta|Braves', 'Atlanta Braves', 'MLB', 'claimed'),
    ('NHL|Boston|Bruins', 'Boston Bruins', 'NHL', 'claimed')
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
  reserved_at = coalesce(public.sponsor_claims.reserved_at, excluded.reserved_at)
where public.sponsor_claims.business_name = 'Side Huddle Demo'
   or public.sponsor_claims.sponsor_email = 'ty@sidehuddlesports.com';

with rows(school, organization, contact_name, contact_title, contact_email, fit, notes) as (
  values
    ('SMU', 'Mustang Club', 'Kirsten Brown', 'Assistant AD for Development', 'kirstenbrown@smu.edu', 'A clear booster-club fit for owning the Mustang fan position before growth opens publicly.', 'school partner batch3'),
    ('TCU', 'Frog Club', 'Nick Parsons', 'Associate AD, Loyalty Giving', 'nick.parsons@tcu.edu', 'Loyalty giving maps directly to repeat fan touchpoints and membership energy.', 'school partner batch3'),
    ('Indiana', 'Varsity Club', 'Kevin Van Rooy', 'Senior Associate AD/Director', 'kvanrooy@iu.edu', 'Senior annual giving leader for a passionate statewide alumni base.', 'school partner batch3'),
    ('UCF', 'ChargeOn Fund', 'Latoya Jackson', 'Associate AD, Annual Giving', 'ljackson@athletics.ucf.edu', 'Annual giving owner for a fast-growing fan and alumni base.', 'school partner batch3'),
    ('Arizona', 'Wildcat Club', 'Trevor Wilkey', 'Annual Giving & Development Operations', 'trevorwilkey@arizona.edu', 'Annual giving and development operations can test a low-cost exclusive fan position.', 'school partner batch3'),
    ('Arizona State', 'Sun Devil Club', 'Scott Nelson', 'VP of Enterprise Development', 'Scott.D.Nelson@asu.edu', 'Enterprise development owner with a natural fit for a new fan-engagement channel.', 'school partner batch3'),
    ('Houston', 'Cougar Pride', 'Alvin Franklin', 'Chief Revenue Officer', 'arfrank4@central.uh.edu', 'Revenue leadership can evaluate an exclusive position attached to Cougar fan rooms.', 'school partner batch3'),
    ('Boise State', 'Bronco Athletic Association', 'Austin Mullen', 'Associate AD, Development', 'austinmullen@boisestate.edu', 'Strong regional identity and direct development ownership.', 'school partner batch3'),
    ('Cincinnati', 'UCATS', 'Niki Cianciola', 'Director, UCATS', 'nikol.cianciola@foundation.uc.edu', 'UCATS is the branded supporter arm for an audience that can understand exclusivity.', 'school partner batch3'),
    ('Illinois', 'I FUND', 'Brian Russell', 'Chief Commercial Officer', 'brussui@illinois.edu', 'Commercial leadership should understand a reserved fan-engagement asset.', 'school partner batch3'),
    ('Tulane', 'Green Wave Club', 'Mike Miller', 'Associate AD, Revenue Generation', 'mmiller12@tulane.edu', 'Revenue generation remit fits a direct $250/month founding partnership test.', 'school partner batch3'),
    ('Memphis', 'Memphis Athletics Fund', 'Chris Condit', 'Associate AD, Revenue & Analytics', 'chris.condit@memphis.edu', 'Revenue and analytics owner can evaluate early traction and supporter growth.', 'school partner batch3'),
    ('Boston College', 'Flynn Fund', 'Joey McIntyre', 'Assistant AD, Annual Giving', 'Joseph.McIntyre@bc.edu', 'Annual giving owner for a branded athletics fund with alumni and regional reach.', 'school partner batch3'),
    ('Colorado', 'Buff Club', 'Adrian Pina', 'Assistant AD, Annual Giving & Premium Seating', 'Adrian.Pina@colorado.edu', 'Annual giving and premium seating remit connects to fan access and recurring engagement.', 'school partner batch3'),
    ('Duke', 'Iron Dukes', 'Jennifer Hughes', 'Director, Annual Fund', 'jennifer.hughes@duke.edu', 'Annual fund leader for a high-affinity donor and alumni audience.', 'school partner batch3'),
    ('Georgia Tech', 'Alexander-Tharpe Fund', 'Robby Poteat', 'Executive Director of Development', 'rpoteat@athletics.gatech.edu', 'Development executive with a clear path to test a new supporter visibility product.', 'school partner batch3'),
    ('Iowa State', 'Cyclone Club', 'Blair Danner', 'Associate Director, Annual Giving', 'bdanner@iastate.edu', 'Annual giving and Cyclone Club supporter identity align with the pitch.', 'school partner batch3'),
    ('Louisville', 'Cardinal Athletic Fund', 'Ryan Tuttle', 'Associate Director, Annual Fund', 'ryant@gocards.com', 'Annual fund owner for a recognizable athletics supporter organization.', 'school partner batch3'),
    ('Pittsburgh', 'Panther Club/NIL', 'Pat Bostick', 'NIL Business Development & Strategic Partnerships', 'pbostick@athletics.pitt.edu', 'NIL and strategic partnerships remit fits exclusive fan-room visibility.', 'school partner batch3'),
    ('Purdue', 'John Purdue Club', 'Meghan King', 'Revenue Generation & Development', 'king556@purdue.edu', 'Revenue generation and development owner for a branded supporter club.', 'school partner batch3'),
    ('Syracuse', '''Cuse Athletics Fund', 'Antonio Barbosa', 'Assistant AD, Annual Fund', 'ambarbos@syr.edu', 'Annual fund owner with a clear supporter-growth remit.', 'school partner batch3'),
    ('USC', 'Trojan Athletic Fund', 'Michael Rorabaugh', 'Chief Development Officer', 'rorabaug@usc.edu', 'Chief development owner for a national alumni brand.', 'school partner batch3'),
    ('Vanderbilt', 'National Commodore Club', 'Mark Carter', 'Senior Executive Director', 'ncc@vanderbilt.edu', 'National Commodore Club is the supporter brand.', 'school partner batch3; Attn: Mark Carter'),
    ('Wake Forest', 'Deacon Club', 'Barry Faircloth', 'Executive Associate AD, Development & Sales', 'fairclbw@wfu.edu', 'Development and sales leader with a direct path to test a founding partnership.', 'school partner batch3')
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
  'College athletics batch 3',
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

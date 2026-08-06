-- Seed the initial booster/NIL school-partner outreach batch.

with rows(school, organization, contact_name, contact_title, contact_email, fit) as (
  values
    ('Clemson', 'IPTAY', 'Travis Furbee', 'CEO', 'tfurbee@clemson.edu', 'IPTAY is practically its own consumer brand, not merely a donation office.'),
    ('Alabama', 'Yea Alabama', 'Doug Killough', 'Director of Marketing & Membership', 'doug@yea-alabama.com', 'Official fan-experience and membership community fit.'),
    ('South Carolina', 'Gamecock Club', 'Wayne Hiott', 'CEO', 'wayne@sc.edu', 'Exclusive content and fan experiences already support membership growth.'),
    ('Georgia', 'Georgia Bulldog Club', 'Ford Williams', 'Executive Director', 'fwilliams@sports.uga.edu', 'Huge donor culture, strong status value, and a clearly branded fundraising organization.'),
    ('Tennessee', 'Tennessee Fund', 'Brady Hart', 'Deputy AD and Chief Revenue Officer', 'bhart8@utk.edu', 'Revenue owner with a direct fit for a new fan-engagement position.'),
    ('Florida', 'Gator Boosters', 'Paul Vosilla', 'Assistant Executive Director, Stewardship', 'paulv@gators.ufl.edu', 'Membership, stewardship, and external partner relationship remit.'),
    ('Auburn', 'Tigers Unlimited', 'Tim Jackson', 'Deputy AD, Tigers Unlimited', 'tj@auburn.edu', 'Powerful branded booster identity with an audience that understands exclusivity.'),
    ('LSU', 'Tiger Athletic Foundation', 'Matt Borman', 'President and CEO', 'info@lsutaf.org', 'TAF works across donor and NIL-adjacent angles.'),
    ('Texas A&M', '12th Man Foundation', 'Travis Dabney', 'President and CEO', 'travis@12thmanfoundation.com', '12th Man is one of the strongest donor/fan identities in college sports.'),
    ('Ohio State', 'Buckeye Club', 'Ben Waite', 'Director of Annual Giving', 'waite.51@osu.edu', 'Huge national fanbase with a specific annual-membership organization.'),
    ('Penn State', 'Nittany Lion Club', 'Alyssa Francona', 'Senior Associate AD for Advancement', 'alyssa.francona@psu.edu', 'Strong club identity, enormous alumni network, and organized regional chapters.'),
    ('Michigan', 'Michigan Athletic Development', 'Brian Kegler', 'Executive Associate AD for Development', 'bkegler@umich.edu', 'Huge alumni reach and strong demand for officially associated status.'),
    ('Nebraska', 'Huskers Athletic Fund', 'Tyler Kai', 'Deputy AD for Revenue Generation', 'tkai@huskers.com', 'Concentrated statewide fan identity; direct revenue-generation owner.'),
    ('Oklahoma', 'Sooner Club', 'Matt Schaeperkoetter', 'Senior Associate AD for Athletics Advancement', 'schaeperkoetter@ou.edu', 'Sooner Club fundraising plus donor and alumni engagement.'),
    ('Notre Dame', 'Monogram Club / Rockne Athletics Fund', 'Matt Weldy', 'Monogram Club Executive Director', 'mweldy@nd.edu', 'Prestige, access, former-athlete credibility, and a national audience.'),
    ('Oregon', 'Duck Athletic Fund', 'Justin Fisher', 'Executive Associate AD for Development', 'jjfisher@uoregon.edu', 'Strong national brand, digital sophistication, and willingness to experiment.'),
    ('Florida State', 'Seminole Boosters', 'Stephen Ponder', 'President and CEO', 'stephen.ponder@fsu.edu', 'Distinct booster brand with a clear executive decision-maker.'),
    ('Ole Miss', 'Ole Miss Athletics Foundation', 'Drew Ingraham', 'Senior Associate AD for External Engagement', 'ingraham@olemiss.edu', 'External engagement is the internal category this pitch belongs under.'),
    ('Kentucky', 'K Fund', 'Candice Chaffin', 'Senior Associate AD for Development', 'candice.chaffin@uky.edu', 'Organized fundraising and donor-engagement arm for Kentucky Athletics.')
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
  status
)
select
  organization,
  'school partner',
  'College athletics',
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
  'Drafted'
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
  status = excluded.status;

insert into public.sponsor_leads (
  company,
  vertical,
  region,
  market,
  school,
  contact_name,
  contact_title,
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
  'Longhorn Foundation',
  'school partner',
  'College athletics',
  'Texas',
  'Texas',
  'Carly Northup',
  'Executive Senior Associate AD',
  'manual',
  'TIER1',
  'Massive alumni base and a strong status-and-access culture; route through contact page.',
  20,
  '$250/month',
  'Official Side Huddle Partner for Texas',
  'Drafted',
  'No direct public email listed; route through the Longhorn Foundation contact page.'
where not exists (
  select 1
  from public.sponsor_leads
  where vertical = 'school partner'
    and company = 'Longhorn Foundation'
    and school = 'Texas'
);

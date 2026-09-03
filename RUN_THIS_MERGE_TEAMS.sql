-- One name per team.
--
-- The same team is filed under two names depending on which tool created the
-- row, so its chapters and its businesses sit in different rows of the sidebar
-- and never appear together. South Carolina has 50 chapters under "South
-- Carolina" and 40 businesses under "University of South Carolina" — which is
-- why it looked like it had no fan clubs.
--
-- Keeps the short name, which is what the scraper and the app already use.

create temporary table team_alias (bad text primary key, good text) on commit drop;
insert into team_alias values
  ('University of South Carolina',      'South Carolina'),
  ('Texas Longhorns',                   'Texas'),
  ('UGA',                               'Georgia'),
  ('Arkansas Razorbacks',               'Arkansas'),
  ('University of Colordo at. Boulder', 'Colorado'),
  ('University of Colorado at Boulder', 'Colorado'),
  ('University of Colorado Boulder',    'Colorado');

update public.sponsor_leads s set school = a.good
from team_alias a where s.school = a.bad;

update public.chapter_leads c set org = a.good
from team_alias a where c.org = a.bad;

-- Progress rows move too, and the duplicates collapse.
delete from public.team_progress p using team_alias a where p.team = a.bad;
delete from public.outreach_teams t using team_alias a where t.team = a.bad;

-- Rebuild the ticks now that the names are merged.
insert into public.team_progress (team, kind, found)
select org, 'chapters', count(*) from public.chapter_leads
where coalesce(org,'') <> '' group by org
on conflict (team, kind) do update set found = excluded.found, searched_at = now();

insert into public.team_progress (team, kind, found)
select school, 'business', count(*) from public.sponsor_leads
where coalesce(school,'') <> '' and lower(coalesce(vertical,'')) <> 'school partner'
group by school
on conflict (team, kind) do update set found = excluded.found, searched_at = now();

insert into public.team_progress (team, kind, found)
select school, 'partner', count(*) from public.sponsor_leads
where coalesce(school,'') <> '' and lower(coalesce(vertical,'')) = 'school partner'
group by school
on conflict (team, kind) do update set found = excluded.found, searched_at = now();

select team, kind, found from public.team_progress
where team in ('South Carolina','Texas','Georgia','Arkansas','Colorado')
order by team, kind;

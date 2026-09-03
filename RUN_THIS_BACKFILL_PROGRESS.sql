-- Fill in the board from what is already known.
--
-- With sixty-odd teams, "has this been searched?" cannot be answered by
-- remembering. But most of it is already recorded: a team with chapters in
-- chapter_leads was scraped, and a team with businesses in sponsor_leads was
-- researched. Only the gaps need a human.
--
-- Marks every team that has evidence, so what is left unticked is genuinely
-- untouched rather than merely unrecorded.

-- 1. Chapters: any team with rows was scraped.
insert into public.team_progress (team, kind, found)
select org, 'chapters', count(*)
from public.chapter_leads
where coalesce(org, '') <> ''
group by org
on conflict (team, kind) do update
  set found = excluded.found, searched_at = now();

-- 2. Local businesses: any team with a non-partner sponsor lead was researched.
insert into public.team_progress (team, kind, found)
select school, 'business', count(*)
from public.sponsor_leads
where coalesce(school, '') <> ''
  and lower(coalesce(vertical, '')) <> 'school partner'
group by school
on conflict (team, kind) do update
  set found = excluded.found, searched_at = now();

-- 3. School partner: any team with one on file.
insert into public.team_progress (team, kind, found)
select school, 'partner', count(*)
from public.sponsor_leads
where coalesce(school, '') <> ''
  and lower(coalesce(vertical, '')) = 'school partner'
group by school
on conflict (team, kind) do update
  set found = excluded.found, searched_at = now();

-- Every team, and which of the three searches is still missing.
select t.team,
       coalesce(c.found, 0)  as chapters,
       coalesce(p.found, 0)  as partners,
       coalesce(b.found, 0)  as businesses,
       concat_ws(', ',
         case when c.team is null then 'chapters' end,
         case when p.team is null then 'partner'  end,
         case when b.team is null then 'business' end
       ) as never_searched
from (
  select team from public.team_progress
  union select team from public.outreach_teams
) t
left join public.team_progress c on c.team = t.team and c.kind = 'chapters'
left join public.team_progress p on p.team = t.team and p.kind = 'partner'
left join public.team_progress b on b.team = t.team and b.kind = 'business'
order by coalesce(c.found,0) + coalesce(p.found,0) + coalesce(b.found,0) desc;

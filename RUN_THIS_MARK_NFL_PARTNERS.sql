-- Close the tick that can never be filled.
--
-- Booster clubs and NIL collectives are a college thing. The Browns, Bills,
-- Packers, Steelers, Cowboys and Seahawks will never have one, so "partner:
-- never searched" is a permanent false gap on every professional team — an
-- outstanding job that cannot be done.
--
-- Marked searched with nothing found, which is the truth.

insert into public.team_progress (team, kind, found)
select distinct concat_ws(' ', t.city, t.name), 'partner', 0
from public.teams t
where t.league in ('NFL', 'NBA', 'MLB', 'NHL')
  and concat_ws(' ', t.city, t.name) in (
    select team from public.team_progress
    union select team from public.outreach_teams
  )
on conflict (team, kind) do nothing;

-- Anything left genuinely needs a person.
select t.team,
       coalesce(c.found, 0) as chapters,
       coalesce(p.found, 0) as partners,
       coalesce(b.found, 0) as businesses,
       concat_ws(', ',
         case when c.team is null then 'chapters' end,
         case when p.team is null then 'partner'  end,
         case when b.team is null then 'business' end
       ) as still_to_search
from (select team from public.team_progress
      union select team from public.outreach_teams) t
left join public.team_progress c on c.team = t.team and c.kind = 'chapters'
left join public.team_progress p on p.team = t.team and p.kind = 'partner'
left join public.team_progress b on b.team = t.team and b.kind = 'business'
where c.team is null or p.team is null or b.team is null
order by coalesce(c.found,0) desc;

-- Turn on the 12 NFL teams still flagged coming_soon.
--
-- The room-creation picker filters teams on status = 'active', so these never
-- appeared: you could not create a Jets room because the Jets were not on the
-- list. Bears, Bengals, Broncos, Cardinals, Colts, Commanders, Eagles, Jets,
-- Panthers, Ravens, Saints and Titans — twelve of the thirty-two.
--
-- Nothing is missing on them. All twelve already have a logo, an official team
-- huddle and game rows, exactly like the twenty that were visible. The flag is
-- a leftover from a staged rollout, not a description of readiness. NFL was the
-- only league affected — NHL, NBA, MLB and all 71 NCAA teams are fully active.

-- ===== STEP 1: LOOK. Changes nothing. =====
select league, status, count(*) as teams
from teams
group by league, status
order by league, status;

-- ===== STEP 2: ACTIVATE. =====
update teams
set status = 'active'
where league = 'NFL'
  and status = 'coming_soon';

-- Should return 32 for NFL, and no coming_soon rows anywhere.
select league, status, count(*) as teams
from teams
group by league, status
order by league, status;

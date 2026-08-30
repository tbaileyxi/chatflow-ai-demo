-- Texas A&M did not lose to Florida State. New Mexico State did.
--
-- Both are the Aggies. On 2026-08-25 the odds feed matched the nickname alone,
-- and New Mexico State was not in the teams table at all, so the only Aggies we
-- had took the game: a 34-17 loss, a recap, and a hit to the season record, all
-- landing in a Texas A&M room for a game the team did not play.
--
-- Verified against ESPN for that date: the only Aggies fixture was "New Mexico
-- State Aggies at Florida State Seminoles". Texas A&M did not play.
--
-- The matcher is keyed on school and league now, not nickname, so this cannot
-- happen again — every one of these rows was written on 2026-08-25. This is
-- cleanup.
--
-- Run in the Supabase SQL editor. Safe to run twice.

-- ── 1. give the game back to New Mexico State ────────────────────────────────
-- The game itself is real and its score is right. Only the team was wrong, so
-- repoint it rather than delete it.
update public.games g
set away_team_id = (
      select id from public.teams
      where city = 'New Mexico State' and league = 'NCAA'
      order by (status = 'active') desc
      limit 1
    )
where g.odds_game_id = '9bbc04340f2b3f77756a22bc44e1a4a4'
  and exists (select 1 from public.teams
              where city = 'New Mexico State' and league = 'NCAA')
  and g.away_team_id = (select id from public.teams
                        where city = 'Texas A&M' and league = 'NCAA' limit 1);


-- ── 2. take the false messages out of the A&M rooms ──────────────────────────
-- The scoreboard is fixed by step 1, but the room still reads "Final: Aggies
-- 17, Seminoles 34" and narrates plays from a game these fans did not watch.
--
-- Scoped hard: bot messages only, in rooms for Texas A&M only, only the two
-- types this game produced, and only inside its window. Nothing a person wrote
-- is touched.
delete from public.huddle_messages m
where m.is_bot_message = true
  and m.message_type in ('live_play', 'postgame')
  and m.created_at >= '2026-08-29 23:00:00+00'
  and m.created_at <  '2026-08-30 04:00:00+00'
  and m.huddle_id in (
    select h.id from public.huddles h
    join public.teams t on t.id = h.team_id
    where t.city = 'Texas A&M' and t.league = 'NCAA'
  );


-- ── 3. what else came out of that batch ──────────────────────────────────────
-- Every wrong-team row found so far was written on 2026-08-25. Finals are the
-- ones that do damage — they post recaps and move records — so list them and
-- check the pairings look real before trusting any of them.
select
  g.start_time::date            as played,
  aw.city || ' ' || aw.name     as away,
  hm.city || ' ' || hm.name     as home,
  g.away_score || '-' || g.home_score as score
from public.games g
join public.teams hm on hm.id = g.home_team_id
join public.teams aw on aw.id = g.away_team_id
where g.created_at::date = date '2026-08-25'
  and g.status = 'final'
order by g.start_time desc;

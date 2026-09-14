-- Games worth watching: rank them, and stop listing the same one twice.
--
-- TWO PROBLEMS, one file.
--
-- 1. DUPLICATES. 52 fixtures since 1 September exist twice, and every row has
--    its OWN odds_game_id — the feed hands us the same game under two keys, so
--    nothing keyed on that id could ever have caught it. The pair is identical
--    in teams AND kickoff, which is what makes it safe to collapse: a real
--    doubleheader shares the teams and the date but never the minute.
--
-- 2. NOTHING TO RANK ON. games has no broadcaster and teams has no poll
--    ranking, so "the games most people are watching" was not expressible.
--    ESPN publishes both, free and unkeyed, and sync-espn-context writes them
--    here.

-- ── new columns ──────────────────────────────────────────────────────────────
alter table public.games add column if not exists broadcast text;      -- "ESPN", "FOX", "ESPN, ABC"
alter table public.games add column if not exists home_rank smallint;  -- AP poll, null when unranked
alter table public.games add column if not exists away_rank smallint;

create index if not exists games_broadcast_idx on public.games (broadcast)
  where broadcast is not null;


-- ── collapse the duplicates ──────────────────────────────────────────────────
-- Keeper = the oldest row of each identical group. Anything pointing at a
-- loser is REPOINTED at the keeper before the loser goes, so no pick, fade,
-- RSVP or notification is orphaned by this.
with ranked as (
  select id,
         first_value(id) over (
           partition by home_team_id, away_team_id, start_time
           order by created_at, id
         ) as keeper
    from public.games
   where home_team_id is not null and away_team_id is not null
),
losers as (
  select id, keeper from ranked where id <> keeper
)
select count(*) as duplicates_to_remove from losers;

with ranked as (
  select id,
         first_value(id) over (
           partition by home_team_id, away_team_id, start_time
           order by created_at, id
         ) as keeper
    from public.games
   where home_team_id is not null and away_team_id is not null
),
losers as (
  select id, keeper from ranked where id <> keeper
)
update public.fades f set game_id = l.keeper from losers l where f.game_id = l.id;

with ranked as (
  select id, first_value(id) over (partition by home_team_id, away_team_id, start_time order by created_at, id) as keeper
    from public.games where home_team_id is not null and away_team_id is not null
), losers as (select id, keeper from ranked where id <> keeper)
update public.game_states g set game_id = l.keeper from losers l where g.game_id = l.id;

with ranked as (
  select id, first_value(id) over (partition by home_team_id, away_team_id, start_time order by created_at, id) as keeper
    from public.games where home_team_id is not null and away_team_id is not null
), losers as (select id, keeper from ranked where id <> keeper)
update public.huddle_game_rsvps r set game_id = l.keeper from losers l where r.game_id = l.id;

with ranked as (
  select id, first_value(id) over (partition by home_team_id, away_team_id, start_time order by created_at, id) as keeper
    from public.games where home_team_id is not null and away_team_id is not null
), losers as (select id, keeper from ranked where id <> keeper)
update public.pickem_instance_games p set game_id = l.keeper from losers l where p.game_id = l.id;

with ranked as (
  select id, first_value(id) over (partition by home_team_id, away_team_id, start_time order by created_at, id) as keeper
    from public.games where home_team_id is not null and away_team_id is not null
), losers as (select id, keeper from ranked where id <> keeper)
update public.pickem_picks p set game_id = l.keeper from losers l where p.game_id = l.id;

with ranked as (
  select id, first_value(id) over (partition by home_team_id, away_team_id, start_time order by created_at, id) as keeper
    from public.games where home_team_id is not null and away_team_id is not null
), losers as (select id, keeper from ranked where id <> keeper)
update public.huddles h set game_id = l.keeper from losers l where h.game_id = l.id;

-- Now the losers are unreferenced.
with ranked as (
  select id, first_value(id) over (partition by home_team_id, away_team_id, start_time order by created_at, id) as keeper
    from public.games where home_team_id is not null and away_team_id is not null
), losers as (select id, keeper from ranked where id <> keeper)
delete from public.games g using losers l where g.id = l.id;


-- ── and stop it happening again ──────────────────────────────────────────────
-- On the exact kickoff, so a genuine doubleheader (same teams, same day,
-- different first pitch) is still two games.
create unique index if not exists games_one_row_per_fixture
  on public.games (home_team_id, away_team_id, start_time)
  where home_team_id is not null and away_team_id is not null;


select
  (select count(*) from public.games) as games_total,
  (select count(*) from public.games where broadcast is not null) as with_tv;  -- 0 until the sync runs

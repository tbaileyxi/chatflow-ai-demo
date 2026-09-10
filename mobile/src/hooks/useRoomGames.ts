import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * The game a room is about, for every room in a list.
 *
 * A huddle carries a team_id and nothing else about what's on TV, so the game
 * has to be resolved from the team. That makes this the thing standing between
 * the room list and any live score on it.
 *
 * ONE query for every room, not one per room. useUserHuddles already learned
 * this lesson the expensive way with per-huddle message lookups; a home screen
 * with nine rooms should not fire nine game queries.
 */

export type RoomGameStatus = "live" | "upcoming";

export type RoomGame = {
  gameId: string;
  status: RoomGameStatus;
  startTime: string;
  /** Period/inning and clock, live games only. */
  period: string | null;
  clock: string | null;
  /** Always ordered as the room's team first, then the opponent. */
  us: { teamId: string; name: string; score: number | null };
  them: { teamId: string; name: string; score: number | null };
  /** True when the room's team is the home side — for "vs" versus "at". */
  isHome: boolean;
};

// games.status is normalised by a trigger and only ever holds three values in
// production: scheduled, in_progress, final. The bot engine also references
// "live" and "halftime", so both are accepted defensively — an unrecognised
// status simply doesn't match and the room shows no game, which is the safe
// failure.
const LIVE_STATUSES = ["in_progress", "live", "halftime"];

// A team row spans every sport its club plays: the Buckeyes who play football
// are the same row as the Buckeyes who play basketball, separated only by
// games.sport_key. For the four pro leagues the team's own league pins the
// sport exactly. NCAA cannot be pinned — the league column says "NCAA" with no
// sport in it — so college teams accept any sport and rely on time ordering
// instead: a live game, or the next one scheduled. That is safe here because
// this hook never looks backwards. (The February-basketball-score-in-a-football-
// room bug came from picking a past game, which this cannot do.)
const LEAGUE_SPORTS: Record<string, string[]> = {
  NFL: ["americanfootball_nfl"],
  MLB: ["baseball_mlb"],
  NBA: ["basketball_nba"],
  NHL: ["icehockey_nhl"],
};

type GameRow = {
  id: string;
  sport_key: string | null;
  status: string;
  start_time: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  period: string | null;
  clock: string | null;
};

export function useRoomGames(teamIds: (string | null | undefined)[]) {
  // Sorted and de-duplicated so the query key is stable across renders that
  // produce the same set of rooms in a different order.
  const ids = [...new Set(teamIds.filter(Boolean) as string[])].sort();

  return useQuery({
    queryKey: ["room-games", ids.join(",")],
    enabled: ids.length > 0,
    // Live scores go stale fast; a room list left open should catch up without
    // a manual pull.
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Map<string, RoomGame>> => {
      const result = new Map<string, RoomGame>();
      if (ids.length === 0) return result;

      const list = ids.join(",");

      // Anything that kicked off in the last six hours is still potentially
      // live — a long baseball game or an overrun football one. Older than
      // that and a game still marked in_progress is stale data, not a game.
      const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

      const [gamesRes, teamsRes] = await Promise.all([
        supabase
          .from("games")
          .select(
            "id, sport_key, status, start_time, home_team_id, away_team_id, home_score, away_score, period, clock",
          )
          .or(`home_team_id.in.(${list}),away_team_id.in.(${list})`)
          .in("status", [...LIVE_STATUSES, "scheduled"])
          .gte("start_time", since)
          .order("start_time", { ascending: true })
          .limit(400),
        supabase.from("teams").select("id, name, city, league"),
      ]);

      const games = (gamesRes.data ?? []) as GameRow[];
      const teams = teamsRes.data ?? [];

      const teamById = new Map(teams.map((t: any) => [t.id, t]));
      const nameFor = (id: string | null) => {
        if (!id) return "TBD";
        const t = teamById.get(id) as any;
        if (!t) return "TBD";
        return (t.city || t.name || "TBD").toString();
      };

      for (const teamId of ids) {
        const team = teamById.get(teamId) as any;
        const allowedSports = team?.league ? LEAGUE_SPORTS[team.league] : undefined;

        const mine = games.filter((g) => {
          if (g.home_team_id !== teamId && g.away_team_id !== teamId) return false;
          // undefined = college, where any sport is allowed and ordering decides.
          if (allowedSports && g.sport_key && !allowedSports.includes(g.sport_key)) {
            return false;
          }
          return true;
        });
        if (mine.length === 0) continue;

        // A live game always wins over a scheduled one, however close kickoff
        // is. Otherwise the earliest upcoming, which the query already ordered.
        const live = mine.find((g) => LIVE_STATUSES.includes(g.status));
        const game = live ?? mine[0];

        const isHome = game.home_team_id === teamId;
        const themId = isHome ? game.away_team_id : game.home_team_id;

        result.set(teamId, {
          gameId: game.id,
          status: live ? "live" : "upcoming",
          startTime: game.start_time,
          period: live ? game.period : null,
          clock: live ? game.clock : null,
          us: {
            teamId,
            name: nameFor(teamId),
            score: live ? (isHome ? game.home_score : game.away_score) : null,
          },
          them: {
            teamId: themId ?? "",
            name: nameFor(themId),
            score: live ? (isHome ? game.away_score : game.home_score) : null,
          },
          isHome,
        });
      }

      return result;
    },
  });
}

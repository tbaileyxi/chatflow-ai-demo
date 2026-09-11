import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { gameStatusLabel } from "@/hooks/useRoomGames";

export type SlateGame = {
  gameId: string;
  sportKey: string;
  league: string;
  status: "live" | "upcoming" | "final";
  startTime: string;
  statusLabel: string;
  home: { teamId: string | null; name: string; logoUrl: string | null; score: number | null };
  away: { teamId: string | null; name: string; logoUrl: string | null; score: number | null };
  /** True when one of your teams is in it. Decides ordering, not filtering. */
  yours: boolean;
};

const LIVE = ["in_progress", "live", "halftime"];

/**
 * Which league a sport_key belongs to, for the filter chips.
 *
 * sport_key is the odds provider's vocabulary and it is not something to show
 * anybody — "americanfootball_ncaaf" is not a word. This is also the only place
 * that mapping should exist; see the vocabulary note in useRoomGames.
 */
const LEAGUE_OF: Record<string, string> = {
  americanfootball_nfl: "NFL",
  americanfootball_ncaaf: "NCAAF",
  basketball_nba: "NBA",
  basketball_ncaab: "NCAAB",
  baseball_mlb: "MLB",
  icehockey_nhl: "NHL",
};

/**
 * The whole slate, not just yours.
 *
 * This is the tab that replaces Teams. Teams showed your own rooms grouped by
 * team, which Home already does — the one thing that made it distinct was other
 * people's rooms for your team, and those were cut. Games carries something
 * that exists nowhere else in the app: every game on, whether or not it is
 * yours.
 *
 * Which matters because the whole product started from a real complaint —
 * there are games on that aren't your team's, and there was nowhere to go.
 *
 * ORDERING, NOT FILTERING. A game with one of your teams in it floats up, but
 * nothing is hidden. A filter would recreate the problem: you came here
 * precisely to look at a game that isn't yours.
 */
export function useAllGames(followedTeamIds: string[]) {
  const key = [...followedTeamIds].sort().join(",");

  return useQuery({
    queryKey: ["all-games", key],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<SlateGame[]> => {
      // A day either side. A 147-game college Saturday is the load case, and
      // pulling a week would be most of a season by the NBA's standards.
      const from = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const to = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();

      const [gamesRes, teamsRes] = await Promise.all([
        supabase
          .from("games")
          .select(
            "id, sport_key, status, start_time, clock, period, home_team_id, away_team_id, home_score, away_score",
          )
          .gte("start_time", from)
          .lte("start_time", to)
          .order("start_time", { ascending: true })
          .limit(300),
        supabase.from("teams").select("id, name, city, logo_url, league"),
      ]);

      const teams = new Map(
        (teamsRes.data ?? []).map((t: any) => [t.id, t]),
      );
      const mine = new Set(followedTeamIds);

      const side = (id: string | null, score: number | null) => {
        const t = id ? (teams.get(id) as any) : null;
        return {
          teamId: id,
          // Nickname over city: "Los Angeles" is six teams, and there is no
          // logo big enough here to tell them apart.
          name: (t?.name || t?.city || "TBD").toString(),
          logoUrl: t?.logo_url ?? null,
          score,
        };
      };

      return (gamesRes.data ?? []).map((g: any) => {
        const live = LIVE.includes(g.status);
        const final = g.status === "final";

        return {
          gameId: g.id,
          sportKey: g.sport_key,
          league: LEAGUE_OF[g.sport_key] ?? "OTHER",
          status: live ? "live" : final ? "final" : "upcoming",
          startTime: g.start_time,
          statusLabel: live
            ? gameStatusLabel(g.sport_key, g.period, g.clock)
            : final
              ? "FINAL"
              : new Date(g.start_time).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                }),
          home: side(g.home_team_id, live || final ? g.home_score : null),
          away: side(g.away_team_id, live || final ? g.away_score : null),
          yours:
            (!!g.home_team_id && mine.has(g.home_team_id)) ||
            (!!g.away_team_id && mine.has(g.away_team_id)),
        } satisfies SlateGame;
      });
    },
  });
}

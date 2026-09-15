import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { gameStatusLabel } from "@/hooks/useRoomGames";
import { makeTeamNamer } from "@/lib/teamName";

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
  /** Networks carrying it, ESPN's order — "ESPN, ABC". Null if nobody is. */
  broadcast: string | null;
  /** Best AP position in the game, 1-25. Null when neither side is ranked. */
  bestRank: number | null;
};

/**
 * WHAT MOST PEOPLE ARE WATCHING, which is not the same as what is on next.
 *
 * The old order was chronological, so on a Monday in September the top of the
 * list was forty-six baseball games and Monday Night Football was somewhere
 * underneath them. Time is the least interesting thing about a slate.
 *
 * League leads, and NFL leads the leagues — that is not a preference, it is
 * what the audience is. College sits behind it but ONLY when it is a game
 * anybody outside the two schools would put on, which is what the poll is for.
 * Baseball is a hundred-and-sixty-two-game season and it goes last.
 */
const LEAGUE_RANK: Record<string, number> = {
  NFL: 0,
  NCAAF: 1,
  NBA: 2,
  NCAAB: 3,
  NHL: 4,
  MLB: 5,
};

/**
 * NATIONAL networks only.
 *
 * ESPN lists every carrier, and for baseball that is five regional ones on
 * every single game — "MLB.TV, SportsNet LA, Gray Media, WXIX FOX19, Reds.TV".
 * Treating the presence of a broadcaster as a signal therefore scored a
 * Tuesday-night Reds game exactly like Monday Night Football on ABC, which is
 * the opposite of the question being asked. A regional feed tells you the game
 * exists; a national one tells you somebody chose it.
 */
const NATIONAL = [
  "ESPN", "ESPN2", "ABC", "FOX", "FS1", "NBC", "CBS", "TNT", "TBS",
  "Netflix", "Prime Video", "Peacock", "Paramount+", "Apple TV",
  "NFL Net", "NFL Network", "MLB Net", "NBA TV", "truTV",
  "BTN", "SEC Network", "ACC Network", "ESPNU", "CBSSN",
];

/** The national network carrying it, or null. Used for ranking AND display. */
export function nationalNetwork(broadcast: string | null): string | null {
  if (!broadcast) return null;
  const parts = broadcast.split(",").map((p) => p.trim());
  // ESPN's order is meaningful — the lead broadcaster comes first — so the
  // first national hit wins rather than the first in our list.
  for (const p of parts) {
    if (NATIONAL.some((n) => p.toLowerCase() === n.toLowerCase())) return p;
  }
  return null;
}

/**
 * Sort key. Lower is higher up.
 *
 * Live first regardless of sport — a game in progress beats a better game that
 * has not started, because you can actually watch it.
 */
export function slateOrder(g: SlateGame): number[] {
  return [
    g.status === "live" ? 0 : g.status === "upcoming" ? 1 : 2,
    LEAGUE_RANK[g.league] ?? 9,
    // NATIONALLY on TV beats not, inside the same league. Regional carriage
    // is not a signal — see nationalNetwork.
    nationalNetwork(g.broadcast) ? 0 : 1,
    // Then the ranked game, best poll position first.
    g.bestRank ?? 99,
    new Date(g.startTime).getTime(),
  ];
}

export function compareSlate(a: SlateGame, b: SlateGame): number {
  const x = slateOrder(a);
  const y = slateOrder(b);
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return 0;
}

/**
 * College is the one league that needs filtering rather than ranking.
 *
 * There are 134 FBS teams and a Saturday runs to 147 games, almost all of them
 * watched by two campuses. An unranked college game on a national list is
 * noise; a top-25 game is the reason somebody turned the television on. This
 * is the only place the app hides a game, and it hides it from the SLATE, not
 * from search or from a team's own room.
 */
export function isWorthTheSlate(g: SlateGame): boolean {
  if (g.yours) return true;
  if (g.league !== "NCAAF" && g.league !== "NCAAB") return true;
  return g.bestRank !== null || !!nationalNetwork(g.broadcast);
}

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
    // 90s, not 60. Every refetch is a round trip on a database whose floor is
    // currently a second or two, and a scoreboard that is 90 seconds stale is
    // not a product problem.
    refetchInterval: 90_000,
    queryFn: async (): Promise<SlateGame[]> => {
      // A day either side. A 147-game college Saturday is the load case, and
      // pulling a week would be most of a season by the NBA's standards.
      const from = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const to = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();

      // CORE is what a scoreboard cannot be drawn without. EXTRA is the
      // television and poll data, which only exists once RUN_THIS_GAMES_ON_TV
      // has been run. PostgREST fails the WHOLE select on one unknown column,
      // so asking for both in one go would empty the Games tab on any
      // environment where that migration is outstanding — which has happened
      // here twice before, and is a blank screen with nothing in the logs.
      const CORE =
        "id, sport_key, status, start_time, clock, period, home_team_id, away_team_id, home_score, away_score";
      const EXTRA = "broadcast, home_rank, away_rank";

      const gamesQuery = (cols: string) =>
        (supabase as any)
          .from("games")
          .select(cols)
          .gte("start_time", from)
          .lte("start_time", to)
          .order("start_time", { ascending: true })
          .limit(300);

      let gamesRes = await gamesQuery(`${CORE}, ${EXTRA}`);
      if (gamesRes.error) {
        console.warn("[all-games] no tv/rank columns yet:", gamesRes.error.message);
        gamesRes = await gamesQuery(CORE);
      }
      // ONLY THE TEAMS THAT ARE PLAYING.
      //
      // This used to pull all 396 rows — 74KB, and between 2 and 13 SECONDS
      // against this database — to learn the names of the handful of teams in
      // today's games. Worse, the slate was gated on it, so the Games tab sat
      // on its empty state for the whole of that, telling people no football
      // was on during a game.
      //
      // The games already name their teams. In tonight's window that is 32
      // teams and 5KB. Fetched AFTER the games, so nothing blocks on it.
      const wanted = [
        ...new Set(
          ((gamesRes.data ?? []) as any[])
            .flatMap((g) => [g.home_team_id, g.away_team_id])
            .filter(Boolean),
        ),
      ] as string[];

      const teamsRes = wanted.length
        ? await supabase
            .from("teams")
            .select("id, name, city, logo_url, league")
            .in("id", wanted)
        : { data: [] as any[] };

      const teams = new Map(
        (teamsRes.data ?? []).map((t: any) => [t.id, t]),
      );
      const mine = new Set(followedTeamIds);

      const nameFor = makeTeamNamer((teamsRes.data ?? []) as any);

      const side = (id: string | null, score: number | null) => {
        const t = id ? (teams.get(id) as any) : null;
        return {
          teamId: id,
          // Place, not mascot: OSU · MICH, the way a scorebug does it.
          name: nameFor(id),
          logoUrl: t?.logo_url ?? null,
          score,
        };
      };

      /**
       * One row per fixture.
       *
       * The games table carries duplicates — the same fixture arriving twice
       * from the sync, which is why RUN_THIS_DEDUPE_GAMES.sql and
       * RUN_THIS_FIX_DUPES.sql both exist. Cleaning the table is the real fix,
       * but the slate must not show a doubled scoreboard while that is
       * outstanding, and a second copy of a game is the most obviously broken
       * thing a sports app can render.
       *
       * Keyed on the two teams and the calendar day, so a genuine
       * doubleheader still shows twice. Live wins over scheduled when both
       * copies exist — the one with a score on it is the one that is real.
       */
      const byFixture = new Map<string, any>();
      for (const g of (gamesRes.data ?? []) as any[]) {
        const pair = [g.home_team_id, g.away_team_id].sort().join("|");
        const day = (g.start_time ?? "").slice(0, 10);
        const key = `${pair}@${day}`;

        const existing = byFixture.get(key);
        if (!existing) {
          byFixture.set(key, g);
          continue;
        }
        const rank = (x: any) =>
          LIVE.includes(x.status) ? 2 : x.status === "final" ? 1 : 0;
        if (rank(g) > rank(existing)) byFixture.set(key, g);
      }

      return [...byFixture.values()].map((g: any) => {
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
          broadcast: g.broadcast ?? null,
          bestRank:
            [g.home_rank, g.away_rank].filter(
              (r: number | null) => typeof r === "number",
            ).length > 0
              ? Math.min(
                  ...[g.home_rank, g.away_rank].filter(
                    (r: number | null) => typeof r === "number",
                  ),
                )
              : null,
        } satisfies SlateGame;
      });
    },
  });
}

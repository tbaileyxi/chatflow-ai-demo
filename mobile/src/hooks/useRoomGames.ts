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
  /** Which sport, so callers can label the state correctly. */
  sportKey: string | null;
  /**
   * Ready-to-render state line: "Q2 0:32", "8th", "LIVE", "7:05 PM".
   * Every surface must use this rather than joining period and clock itself —
   * see gameStatusLabel for why baseball breaks that.
   */
  statusLabel: string;
  /** Always ordered as the room's team first, then the opponent. */
  us: { teamId: string; name: string; logoUrl: string | null; score: number | null };
  them: { teamId: string; name: string; logoUrl: string | null; score: number | null };
  /** True when the room's team is the home side — for "vs" versus "at". */
  isHome: boolean;
};

// games.status is normalised by a trigger and only ever holds three values in
// production: scheduled, in_progress, final. The bot engine also references
// "live" and "halftime", so both are accepted defensively — an unrecognised
// status simply doesn't match and the room shows no game, which is the safe
// failure.
const LIVE_STATUSES = ["in_progress", "live", "halftime"];

/**
 * How a live game's state reads, per sport.
 *
 * BASEBALL HAS NO CLOCK. The feed still sends one — "0:00" — and joining
 * period and clock blindly rendered "8 0:00" on a room row, which looks like a
 * football game that has run out of time in the eighth quarter. Innings are
 * ordinals and stand alone.
 *
 * Anything unrecognised falls back to period-then-clock, which is right for
 * every clock sport we carry.
 */
export function gameStatusLabel(
  sportKey: string | null,
  period: string | null,
  clock: string | null,
): string {
  const p = (period ?? "").trim();
  const c = (clock ?? "").trim();

  if (sportKey === "baseball_mlb") {
    if (!p) return "LIVE";
    const n = Number(p);
    if (!Number.isFinite(n)) return p.toUpperCase();
    const suffix =
      n % 100 >= 11 && n % 100 <= 13
        ? "th"
        : n % 10 === 1
          ? "st"
          : n % 10 === 2
            ? "nd"
            : n % 10 === 3
              ? "rd"
              : "th";
    return `${n}${suffix}`;
  }

  // A zeroed clock means the period has ended, not that there is 0:00 left to
  // play in it — showing "0:00" reads as a game about to end at any score.
  const useful = c && c !== "0:00" && c !== "00:00" ? c : "";
  return [p, useful].filter(Boolean).join(" ") || "LIVE";
}

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
        supabase.from("teams").select("id, name, city, league, logo_url"),
      ]);

      const games = (gamesRes.data ?? []) as GameRow[];
      const teams = teamsRes.data ?? [];

      const teamById = new Map(teams.map((t: any) => [t.id, t]));
      /**
       * Nickname, not city.
       *
       * City reads fine on a broadcast because a logo sits next to it. Here
       * there is no logo, and "Los Angeles" is the Angels, the Dodgers, the
       * Rams, the Chargers, the Lakers or the Clippers — a scoreline nobody
       * can resolve. Nicknames are unique inside a single game, which is the
       * only place two of these ever appear together.
       */
      const nameFor = (id: string | null) => {
        if (!id) return "TBD";
        const t = teamById.get(id) as any;
        if (!t) return "TBD";
        return (t.name || t.city || "TBD").toString();
      };

      // The crest. A scoreline with two logos on it reads as sport; the same
      // line as two grey words reads as a spreadsheet.
      const logoFor = (id: string | null) =>
        (id ? ((teamById.get(id) as any)?.logo_url ?? null) : null) as string | null;

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
        //
        // This also absorbs the duplicate rows in the games table — picking one
        // of two identical copies is the same operation as picking the live one
        // of two different games.
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
          sportKey: game.sport_key,
          statusLabel: live
            ? gameStatusLabel(game.sport_key, game.period, game.clock)
            : new Date(game.start_time).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              }),
          us: {
            teamId,
            name: nameFor(teamId),
            logoUrl: logoFor(teamId),
            score: live ? (isHome ? game.home_score : game.away_score) : null,
          },
          them: {
            teamId: themId ?? "",
            name: nameFor(themId),
            logoUrl: logoFor(themId),
            score: live ? (isHome ? game.away_score : game.home_score) : null,
          },
          isHome,
        });
      }

      return result;
    },
  });
}

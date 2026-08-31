import { useQuery } from "@tanstack/react-query";
import { getDevTeamById, type DevTeam } from "@/config/devData";
import { supabase } from "@/integrations/supabase/client";

export type GameContext = {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  clock: string | null;
  period: string | null;
  status: string; // "scheduled" | "in_progress" | "final" etc.
  startTime: string;
  sportKey: string;
  // True only when this game lives in the `games` table — i.e. the fade-settle
  // cron can grade it from a final score. Games sourced from live_events or the
  // ESPN fallback are NOT settleable, so fades must never be posted on them
  // (they'd lock chips into a prop the cron can never grade). See FadeStrip.
  settleable: boolean;
  // Resolved team names
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeTeamCity: string | null;
  awayTeamCity: string | null;
};

export type GameState = "pregame" | "live" | "postgame" | "none";

export function getGameState(game: GameContext | null): GameState {
  if (!game) return "none";
  const status = game.status.toLowerCase();
  if (status === "in_progress" || status === "live") return "live";
  if (status === "final" || status === "completed" || status === "closed")
    return "postgame";
  return "pregame";
}

export function formatGameClock(game: GameContext): string {
  const state = getGameState(game);

  if (state === "live") {
    const parts: string[] = [];
    if (game.period) parts.push(game.period);
    if (game.clock) parts.push(game.clock);
    return parts.length > 0 ? parts.join(" - ") : "Live";
  }

  if (state === "postgame") return "Final";

  // Pregame — show countdown
  const start = new Date(game.startTime);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();

  if (diffMs <= 0) return "Starting soon";

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHours >= 24) {
    const days = Math.floor(diffHours / 24);
    return `${days}d ${diffHours % 24}h`;
  }
  if (diffHours > 0) return `${diffHours}h ${diffMins}m`;
  return `${diffMins}m`;
}

/** Returns the right polling interval based on game state */
function getRefetchInterval(data: GameContext | null | undefined): number | false {
  if (!data) return 5 * 60 * 1000; // 5 min when no game found (check for new games)
  const state = getGameState(data);
  if (state === "live") return 60 * 1000; // 60s during live games
  if (state === "pregame") {
    // Faster polling as game approaches
    const msUntilStart = new Date(data.startTime).getTime() - Date.now();
    if (msUntilStart < 30 * 60 * 1000) return 60 * 1000; // <30min: every 60s
    if (msUntilStart < 2 * 60 * 60 * 1000) return 2 * 60 * 1000; // <2h: every 2min
    return 5 * 60 * 1000; // >2h: every 5min
  }
  // postgame — keep checking every 15 min so the header rolls over to
  // TODAY's game instead of freezing on last night's final. (Previously this
  // returned false and the header stopped updating until an app restart.)
  return 15 * 60 * 1000;
}

export function useLiveGameContext(teamId: string | undefined) {
  return useQuery({
    queryKey: ["live-game-context", teamId],
    enabled: !!teamId,
    refetchInterval: (query) => getRefetchInterval(query.state.data),
    queryFn: async (): Promise<GameContext | null> => {
      if (!teamId) return null;

      // Look for in-progress game first
      const { data: liveGame } = await supabase
        .from("games")
        .select("*")
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq("status", "in_progress")
        // A live game cannot have started yesterday. Without this bound, one
        // row that never got flipped to 'final' outranks every real fixture
        // from then on — a Mets room sat on "Padres 1 — Mets 4, 9 · 0:00",
        // blinking, against a team they had not played in weeks, while the
        // actual Astros game waited behind it in the scheduled branch.
        //
        // Nine hours covers a long baseball game plus sync lag. The database
        // side also closes these out hourly (close_stale_live_games), but the
        // app should not depend on that having run.
        .gte(
          "start_time",
          new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
        )
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (liveGame) return await resolveGame(liveGame);

      // Look for upcoming game. Keep this wide so offseason/next scheduled
      // games can still appear in room headers.
      const now = new Date().toISOString();
      const oneYearOut = new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data: upcomingGame } = await supabase
        .from("games")
        .select("*")
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq("status", "scheduled")
        .gte("start_time", now)
        .lte("start_time", oneYearOut)
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (upcomingGame) return await resolveGame(upcomingGame);

      // Look for most recent completed game (last 24 hours)
      const oneDayAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data: recentGame } = await supabase
        .from("games")
        .select("*")
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .in("status", ["final", "completed", "closed"])
        .gte("start_time", oneDayAgo)
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentGame) return await resolveGame(recentGame);

      // Also check live_events as fallback
      const { data: liveEvent } = await supabase
        .from("live_events")
        .select("*")
        .or(
          `team1_id.eq.${teamId},team2_id.eq.${teamId}`,
        )
        .in("status", ["scheduled", "live", "in_progress"])
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (liveEvent) {
        // Resolve team names from live_events
        const teamIds = [liveEvent.team1_id, liveEvent.team2_id].filter(
          Boolean,
        ) as string[];
        const { data: teams } = await supabase
          .from("teams")
          .select("id, name, city")
          .in("id", teamIds);
        const teamMap = new Map(
          (teams ?? []).map((t) => [t.id, t]),
        );
        const t1 = liveEvent.team1_id
          ? teamMap.get(liveEvent.team1_id)
          : null;
        const t2 = liveEvent.team2_id
          ? teamMap.get(liveEvent.team2_id)
          : null;

        return {
          id: liveEvent.id,
          homeTeamId: liveEvent.team1_id,
          awayTeamId: liveEvent.team2_id,
          homeScore: liveEvent.score_team1,
          awayScore: liveEvent.score_team2,
          clock: null,
          period: null,
          status: liveEvent.status,
          startTime: liveEvent.start_time,
          sportKey: "",
          settleable: false, // live_events isn't graded by fade-settle
          homeTeamName: t1?.name ?? null,
          awayTeamName: t2?.name ?? null,
          homeTeamCity: t1?.city ?? null,
          awayTeamCity: t2?.city ?? null,
        };
      }

      return await resolveExternalGameForTeamId(teamId);
    },
  });
}

type TeamLookup = {
  id: string;
  name: string;
  city: string;
  league: string | null;
};

const ESPN_SCOREBOARD_BY_LEAGUE: Record<string, string> = {
  NFL: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  NBA: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  MLB: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  NHL: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  NCAAF:
    "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard",
  NCAA:
    "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard",
};

async function resolveTeamLookup(teamId: string): Promise<TeamLookup | null> {
  const devTeam = getDevTeamById(teamId);
  if (devTeam) {
    return {
      id: devTeam.id,
      name: devTeam.name,
      city: devTeam.city,
      league: devTeam.league,
    };
  }

  const { data } = await supabase
    .from("teams")
    .select("id, name, city, league")
    .eq("id", teamId)
    .maybeSingle();

  return data ?? null;
}

function normalizeTeamText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamMatchesEspnCompetitor(team: TeamLookup, competitor: any) {
  const targetFull = normalizeTeamText(`${team.city} ${team.name}`);
  const targetName = normalizeTeamText(team.name);
  const values = [
    competitor?.team?.displayName,
    competitor?.team?.shortDisplayName,
    competitor?.team?.name,
    competitor?.team?.abbreviation,
  ].map(normalizeTeamText);

  return values.some((value) => {
    if (!value) return false;
    return (
      value === targetFull ||
      value === targetName ||
      value.includes(targetName)
    );
  });
}

function mapEspnStatus(status: any) {
  const state = String(status?.type?.state ?? "").toLowerCase();
  const name = String(status?.type?.name ?? "").toLowerCase();
  if (state === "in" || name.includes("progress")) return "in_progress";
  if (state === "post" || name.includes("final")) return "final";
  return "scheduled";
}

function mapEspnCompetitor(competitor: any, teamId: string | null) {
  return {
    id: teamId,
    name: competitor?.team?.name ?? null,
    city: competitor?.team?.location ?? null,
    score:
      competitor?.score === undefined || competitor?.score === ""
        ? null
        : Number(competitor.score),
  };
}

export async function resolveExternalGameForTeam(
  team: TeamLookup | DevTeam | null,
): Promise<GameContext | null> {
  if (!team?.league) return null;
  const endpoint = ESPN_SCOREBOARD_BY_LEAGUE[team.league.toUpperCase()];
  if (!endpoint) return null;

  // Hard timeout — this runs on a 60s poll loop during games; a hung ESPN
  // request must never stack behind the next tick.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) return null;
    const payload = await response.json();
    const events = Array.isArray(payload?.events) ? payload.events : [];

    for (const event of events) {
      const competition = event?.competitions?.[0];
      const competitors = competition?.competitors ?? [];
      const match = competitors.find((c: any) =>
        teamMatchesEspnCompetitor(team, c),
      );
      if (!match) continue;

      const homeRaw = competitors.find((c: any) => c.homeAway === "home");
      const awayRaw = competitors.find((c: any) => c.homeAway === "away");
      const home = mapEspnCompetitor(
        homeRaw,
        teamMatchesEspnCompetitor(team, homeRaw) ? team.id : null,
      );
      const away = mapEspnCompetitor(
        awayRaw,
        teamMatchesEspnCompetitor(team, awayRaw) ? team.id : null,
      );

      return {
        id: `espn-${event.id}`,
        homeTeamId: home.id,
        awayTeamId: away.id,
        homeScore: home.score,
        awayScore: away.score,
        clock: competition?.status?.displayClock ?? null,
        period: competition?.status?.period
          ? `P${competition.status.period}`
          : null,
        status: mapEspnStatus(competition?.status),
        startTime: event.date,
        sportKey: team.league,
        settleable: false, // ESPN fallback id (espn-…) isn't in `games`
        homeTeamName: home.name,
        awayTeamName: away.name,
        homeTeamCity: home.city,
        awayTeamCity: away.city,
      };
    }
  } catch (error) {
    console.warn("Failed to resolve ESPN game context:", error);
  } finally {
    clearTimeout(timeout);
  }

  return null;
}

export async function resolveExternalGameForTeamId(
  teamId: string,
): Promise<GameContext | null> {
  return resolveExternalGameForTeam(await resolveTeamLookup(teamId));
}

async function resolveGame(game: any): Promise<GameContext> {
  const teamIds = [game.home_team_id, game.away_team_id].filter(
    Boolean,
  ) as string[];

  let teamMap = new Map<string, { name: string; city: string }>();
  if (teamIds.length > 0) {
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name, city")
      .in("id", teamIds);
    teamMap = new Map((teams ?? []).map((t) => [t.id, t]));
  }

  const home = game.home_team_id ? teamMap.get(game.home_team_id) : null;
  const away = game.away_team_id ? teamMap.get(game.away_team_id) : null;

  return {
    id: game.id,
    homeTeamId: game.home_team_id,
    awayTeamId: game.away_team_id,
    homeScore: game.home_score,
    awayScore: game.away_score,
    clock: game.clock,
    period: game.period,
    status: game.status,
    startTime: game.start_time,
    sportKey: game.sport_key ?? "",
    settleable: true, // from the `games` table → fade-settle can grade it
    homeTeamName: home?.name ?? null,
    awayTeamName: away?.name ?? null,
    homeTeamCity: home?.city ?? null,
    awayTeamCity: away?.city ?? null,
  };
}

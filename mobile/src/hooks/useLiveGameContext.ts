import { useQuery } from "@tanstack/react-query";
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

export function useLiveGameContext(teamId: string | undefined) {
  return useQuery({
    queryKey: ["live-game-context", teamId],
    enabled: !!teamId,
    refetchInterval: 30000, // Poll every 30s for live updates
    queryFn: async (): Promise<GameContext | null> => {
      if (!teamId) return null;

      // Look for in-progress game first
      const { data: liveGame } = await supabase
        .from("games")
        .select("*")
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq("status", "in_progress")
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (liveGame) return await resolveGame(liveGame);

      // Look for upcoming game (next 48 hours)
      const now = new Date().toISOString();
      const twoDaysOut = new Date(
        Date.now() + 48 * 60 * 60 * 1000,
      ).toISOString();

      const { data: upcomingGame } = await supabase
        .from("games")
        .select("*")
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq("status", "scheduled")
        .gte("start_time", now)
        .lte("start_time", twoDaysOut)
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
          homeTeamName: t1?.name ?? null,
          awayTeamName: t2?.name ?? null,
          homeTeamCity: t1?.city ?? null,
          awayTeamCity: t2?.city ?? null,
        };
      }

      return null;
    },
  });
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
    homeTeamName: home?.name ?? null,
    awayTeamName: away?.name ?? null,
    homeTeamCity: home?.city ?? null,
    awayTeamCity: away?.city ?? null,
  };
}

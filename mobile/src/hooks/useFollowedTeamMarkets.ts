import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TeamMarketGroup = {
  teamId: string;
  teamName: string;
  teamCity: string;
  teamLogoUrl: string | null;
  huddleId: string | null;
  markets: TeamMarket[];
};

export type TeamMarket = {
  id: string;
  question: string;
  current_yes_price: number;
  market_type: string;
  event_start_time: string;
  is_resolved: boolean;
  resolution: string | null;
  kalshi_ticker: string;
};

// No moneyline. In a Browns room everybody picks the Browns, so "will they
// win?" is not a debate — spreads and totals are where a partisan room splits.
const GAME_MARKET_TYPES = ["spread", "total", "player_prop"];

export function useFollowedTeamMarkets() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["followed-team-markets", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TeamMarketGroup[]> => {
      if (!user) return [];

      // Your teams are the teams whose ROOMS you are in. There is no separate
      // follow list any more: picking a team when you create a huddle already
      // said "I care about this team", and maintaining a second list of the
      // same fact meant a board that could be empty while you sat in five
      // rooms. One concept, derived from where you actually are.
      const { data: memberships } = await supabase
        .from("huddle_members")
        .select("huddle_id")
        .eq("user_id", user.id);

      const huddleIds = (memberships ?? []).map((m) => m.huddle_id);
      if (huddleIds.length === 0) return [];

      const { data: myHuddles } = await supabase
        .from("huddles")
        .select("id, team_id")
        .in("id", huddleIds)
        .not("team_id", "is", null);

      const teamIds = [...new Set((myHuddles ?? []).map((h) => h.team_id as string))];
      if (teamIds.length === 0) return [];

      const { data: teams } = await supabase
        .from("teams")
        .select("id, name, city, logo_url")
        .in("id", teamIds);

      // Bets are placed against a room. Prefer the room you are actually in
      // over the invisible Community relic for that team.
      const huddleMap = new Map<string, string>();
      for (const h of myHuddles ?? []) {
        if (h.team_id && !huddleMap.has(h.team_id)) huddleMap.set(h.team_id, h.id);
      }

      // Date-specific: only markets for games inside the next 48h. Kalshi
      // doesn't list most per-game markets earlier than that anyway, and a
      // card for a game 4 days out is noise.
      const now = new Date();
      const cutoff48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const { data: markets } = await supabase
        .from("kalshi_markets")
        .select(
          "id, question, current_yes_price, market_type, event_start_time, is_resolved, resolution, kalshi_ticker, team_id",
        )
        .in("team_id", teamIds)
        .eq("is_resolved", false)
        .in("market_type", GAME_MARKET_TYPES)
        .gte("event_start_time", now.toISOString())
        .lte("event_start_time", cutoff48h.toISOString())
        .order("event_start_time", { ascending: true });

      if (!markets || !teams) return [];

      // Group by team
      const teamMap = new Map(
        teams.map((t) => [t.id, t]),
      );

      const grouped = new Map<string, TeamMarket[]>();
      for (const m of markets) {
        if (!m.team_id) continue;
        const list = grouped.get(m.team_id) ?? [];
        list.push({
          id: m.id,
          question: m.question ?? "",
          current_yes_price: m.current_yes_price ?? 50,
          market_type: m.market_type ?? "other",
          event_start_time: m.event_start_time ?? "",
          is_resolved: m.is_resolved ?? false,
          resolution: m.resolution ?? null,
          kalshi_ticker: m.kalshi_ticker ?? "",
        });
        grouped.set(m.team_id, list);
      }

      // ONE line per game per type, closest to a coin flip. Kalshi publishes a
      // ladder — Over 4.5, 5.5, 7.5, 8.5 — and showing all of it turned the
      // board into the same wall of near-identical cards the chat had. The
      // interesting line is the contested one; an 87c/13c card is nobody's bet.
      for (const [teamId, list] of grouped.entries()) {
        const best = new Map<string, TeamMarket>();
        for (const m of list) {
          const key = `${m.event_start_time}|${m.market_type}`;
          const prev = best.get(key);
          const dist = (x: TeamMarket) => Math.abs((x.current_yes_price ?? 50) - 50);
          if (!prev || dist(m) < dist(prev)) best.set(key, m);
        }
        grouped.set(teamId, [...best.values()]);
      }

      const result: TeamMarketGroup[] = [];
      for (const [teamId, teamMarkets] of grouped.entries()) {
        const team = teamMap.get(teamId);
        if (!team) continue;
        result.push({
          teamId,
          teamName: team.name,
          teamCity: team.city,
          teamLogoUrl: team.logo_url ?? null,
          huddleId: huddleMap.get(teamId) ?? null,
          markets: teamMarkets.slice(0, 8), // Cap at 8 per team
        });
      }

      // Sort by number of markets (most active teams first)
      result.sort((a, b) => b.markets.length - a.markets.length);

      return result;
    },
  });
}

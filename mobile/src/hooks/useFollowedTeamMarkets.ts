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

export function useFollowedTeamMarkets() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["followed-team-markets", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TeamMarketGroup[]> => {
      if (!user) return [];

      // Get followed team IDs
      const { data: follows } = await supabase
        .from("user_follows")
        .select("team_id")
        .eq("user_id", user.id);

      if (!follows || follows.length === 0) return [];

      const teamIds = follows.map((f) => f.team_id);

      // Fetch teams info
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name, city, logo_url")
        .in("id", teamIds);

      // Fetch official huddles for these teams (needed for placing bets)
      const { data: huddles } = await supabase
        .from("huddles")
        .select("id, team_id")
        .in("team_id", teamIds)
        .eq("is_official_team_huddle", true);

      const huddleMap = new Map(
        (huddles ?? []).map((h) => [h.team_id, h.id]),
      );

      // Fetch unresolved markets for followed teams
      const { data: markets } = await supabase
        .from("kalshi_markets")
        .select(
          "id, question, current_yes_price, market_type, event_start_time, is_resolved, resolution, kalshi_ticker, team_id",
        )
        .in("team_id", teamIds)
        .eq("is_resolved", false)
        .gte("event_start_time", new Date().toISOString())
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

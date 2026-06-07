import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

function mapMarket(m: any): TeamMarket {
  return {
    id: m.id,
    question: m.question ?? "",
    current_yes_price: m.current_yes_price ?? 50,
    market_type: m.market_type ?? "other",
    event_start_time: m.event_start_time ?? "",
    is_resolved: m.is_resolved ?? false,
    resolution: m.resolution ?? null,
    kalshi_ticker: m.kalshi_ticker ?? "",
  };
}

const GAME_MARKET_TYPES = ["spread", "total", "winner", "player_prop", "other"];

/**
 * Fetch active Kalshi markets for a specific team.
 * Game-window only: no futures/championship fallback.
 */
export function useTeamMarkets(teamId: string | undefined) {
  return useQuery({
    queryKey: ["team-markets", teamId],
    enabled: !!teamId,
    refetchInterval: 60000, // refresh every minute
    queryFn: async (): Promise<TeamMarket[]> => {
      if (!teamId) return [];

      // Game props only: keep the window tight so futures do not leak in.
      const now = new Date();
      const cutoff48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from("kalshi_markets")
        .select(
          "id, question, current_yes_price, market_type, event_start_time, is_resolved, resolution, kalshi_ticker",
        )
        .eq("team_id", teamId)
        .eq("is_resolved", false)
        .in("market_type", GAME_MARKET_TYPES)
        .gte("event_start_time", now.toISOString())
        .lte("event_start_time", cutoff48h.toISOString())
        .order("event_start_time", { ascending: true })
        .limit(10);

      if (error || !data) return [];
      return data.map(mapMarket);
    },
  });
}

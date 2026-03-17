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

/**
 * Fetch active Kalshi markets for a specific team.
 * Prefers game-day markets (next 48h), falls back to any active market (futures).
 */
export function useTeamMarkets(teamId: string | undefined) {
  return useQuery({
    queryKey: ["team-markets", teamId],
    enabled: !!teamId,
    refetchInterval: 60000, // refresh every minute
    queryFn: async (): Promise<TeamMarket[]> => {
      if (!teamId) return [];

      // First try game-day markets (next 7 days), then fall back to any active market
      const now = new Date();
      const cutoff7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { data: gameDayData } = await supabase
        .from("kalshi_markets")
        .select(
          "id, question, current_yes_price, market_type, event_start_time, is_resolved, resolution, kalshi_ticker",
        )
        .eq("team_id", teamId)
        .eq("is_resolved", false)
        .gte("event_start_time", now.toISOString())
        .lte("event_start_time", cutoff7d.toISOString())
        .order("event_start_time", { ascending: true })
        .limit(10);

      // If we have game-day markets, use those
      if (gameDayData && gameDayData.length > 0) {
        return gameDayData.map(mapMarket);
      }

      // Fall back to any unresolved market for this team (futures, championship, etc.)
      const { data, error } = await supabase
        .from("kalshi_markets")
        .select(
          "id, question, current_yes_price, market_type, event_start_time, is_resolved, resolution, kalshi_ticker",
        )
        .eq("team_id", teamId)
        .eq("is_resolved", false)
        .order("event_start_time", { ascending: true })
        .limit(5);

      if (error || !data) return [];
      return data.map(mapMarket);
    },
  });
}

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ShadowBet = {
  id: string;
  marketId: string;
  position: string;
  chipsRisked: number;
  chipsWon: number | null;
  isSettled: boolean;
  won: boolean | null;
  placedAt: string;
  // Joined market data
  question: string;
  eventStartTime: string | null;
  isResolved: boolean;
  resolution: string | null;
};

export function useShadowBets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["shadow-bets", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ShadowBet[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("shadow_bets")
        .select(
          `
          id, market_id, position, chips_risked, chips_won,
          is_settled, won, placed_at,
          kalshi_markets (question, event_start_time, is_resolved, resolution)
        `,
        )
        .eq("user_id", user.id)
        .order("placed_at", { ascending: false });

      if (error || !data) return [];

      return data.map((b) => {
        const market = (b as any).kalshi_markets;
        return {
          id: b.id,
          marketId: b.market_id,
          position: b.position,
          chipsRisked: b.chips_risked,
          chipsWon: b.chips_won,
          isSettled: b.is_settled ?? false,
          won: b.won,
          placedAt: b.placed_at ?? new Date().toISOString(),
          question: market?.question ?? "Unknown market",
          eventStartTime: market?.event_start_time ?? null,
          isResolved: market?.is_resolved ?? false,
          resolution: market?.resolution ?? null,
        };
      });
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`bets-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shadow_bets",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["shadow-bets", user.id],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
}

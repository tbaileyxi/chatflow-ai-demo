import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Portfolio = {
  totalChips: number;
  totalBets: number;
  totalWins: number;
  totalLosses: number;
  isPremium: boolean;
  profitLoss: number;
  winRate: number;
};

export function usePortfolio() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["portfolio", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Portfolio> => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("user_portfolios")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Create default portfolio
        const { data: created } = await supabase
          .from("user_portfolios")
          .insert({ user_id: user.id, total_chips: 1000, starting_chips: 1000 })
          .select()
          .single();

        return {
          totalChips: created?.total_chips ?? 1000,
          totalBets: 0,
          totalWins: 0,
          totalLosses: 0,
          isPremium: false,
          profitLoss: 0,
          winRate: 0,
        };
      }

      const startingChips = data.starting_chips ?? 1000;
      const totalBets = data.total_bets ?? 0;
      const totalWins = data.total_wins ?? 0;

      return {
        totalChips: data.total_chips ?? 0,
        totalBets,
        totalWins,
        totalLosses: data.total_losses ?? 0,
        isPremium: data.is_premium ?? false,
        profitLoss: (data.total_chips ?? 0) - startingChips,
        winRate: totalBets > 0 ? (totalWins / totalBets) * 100 : 0,
      };
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`portfolio-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_portfolios",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["portfolio", user.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
}

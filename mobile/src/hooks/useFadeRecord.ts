// The current user's fade record — overall W/L + net chips, and a head-to-head
// breakdown per opponent, aggregated across all their huddles. Reads the
// server-maintained fade_season_stats + fade_ledgers tables.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type FadeH2H = {
  opponentId: string;
  name: string;
  wins: number;
  losses: number;
  net: number;
};

export type FadeRecord = {
  wins: number;
  losses: number;
  net: number;
  h2h: FadeH2H[];
};

export function useFadeRecord() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["fade-record", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<FadeRecord | null> => {
      if (!user) return null;
      const uid = user.id;

      // Overall totals across huddles.
      const { data: stats } = await supabase
        .from("fade_season_stats")
        .select("total_points, total_wins, total_losses")
        .eq("user_id", uid);
      const wins = (stats ?? []).reduce((a, s: any) => a + (s.total_wins ?? 0), 0);
      const losses = (stats ?? []).reduce((a, s: any) => a + (s.total_losses ?? 0), 0);
      const net = (stats ?? []).reduce((a, s: any) => a + (s.total_points ?? 0), 0);

      // Per-opponent head-to-head, from my perspective.
      const { data: ledgers } = await supabase
        .from("fade_ledgers")
        .select("user_a_id, user_b_id, net_points, user_a_wins, user_b_wins")
        .or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`);

      const map = new Map<string, FadeH2H>();
      (ledgers ?? []).forEach((l: any) => {
        const isA = l.user_a_id === uid;
        const opp = isA ? l.user_b_id : l.user_a_id;
        const cur = map.get(opp) ?? { opponentId: opp, name: "A member", wins: 0, losses: 0, net: 0 };
        cur.wins += isA ? l.user_a_wins : l.user_b_wins;
        cur.losses += isA ? l.user_b_wins : l.user_a_wins;
        cur.net += isA ? l.net_points : -l.net_points;
        map.set(opp, cur);
      });

      const oppIds = [...map.keys()];
      if (oppIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, username")
          .in("user_id", oppIds);
        (profs ?? []).forEach((p: any) => {
          const h = map.get(p.user_id);
          if (h) h.name = p.display_name || p.username || "A member";
        });
      }

      return {
        wins,
        losses,
        net,
        h2h: [...map.values()].sort((a, b) => b.net - a.net),
      };
    },
  });
}

// Your settled fades — who you played, what the line was, and what it cost or
// paid. The Picks "History" section used to list settled shadow_bets, which
// only ever get created by the retired yes/no prediction cards; with those gone
// that list drains to empty and never refills. This is the replacement.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type FadeHistoryItem = {
  id: string;
  line: string;
  side: "over" | "under";
  lineValue: number;
  stake: number;
  opponentName: string;
  huddleName: string;
  matchup: string;
  won: boolean;
  delta: number; // chips gained or lost
  at: string;
};

export function useFadeHistory() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["fade-history", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<FadeHistoryItem[]> => {
      if (!user) return [];
      const uid = user.id;

      const { data } = await supabase
        .from("fades")
        .select("*")
        .eq("status", "settled")
        .or(`poster_id.eq.${uid},accepter_id.eq.${uid}`)
        .order("created_at", { ascending: false })
        .limit(30);

      const rows = (data ?? []) as any[];
      if (rows.length === 0) return [];

      const otherIds = [
        ...new Set(
          rows
            .map((f) => (f.poster_id === uid ? f.accepter_id : f.poster_id))
            .filter(Boolean),
        ),
      ];
      const huddleIds = [...new Set(rows.map((f) => f.huddle_id))];

      const [{ data: profs }, { data: huddles }] = await Promise.all([
        otherIds.length
          ? supabase
              .from("profiles")
              .select("user_id, display_name, username")
              .in("user_id", otherIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("huddles").select("id, name").in("id", huddleIds),
      ]);

      const nameOf = new Map(
        (profs ?? []).map((p: any) => [
          p.user_id,
          p.display_name || p.username || "A member",
        ]),
      );
      const roomOf = new Map((huddles ?? []).map((h: any) => [h.id, h.name]));

      return rows.map((f) => {
        const iAmPoster = f.poster_id === uid;
        const opp = iAmPoster ? f.accepter_id : f.poster_id;
        const won = f.winner_id === uid;
        return {
          id: f.id,
          line: f.line_description,
          // Your side, not the poster's — if you faded, you took the opposite.
          side: iAmPoster
            ? f.fade_type
            : f.fade_type === "over"
              ? "under"
              : "over",
          lineValue: f.line_value,
          stake: f.stake,
          opponentName: nameOf.get(opp) ?? "A member",
          huddleName: roomOf.get(f.huddle_id) ?? "A room",
          matchup: `${f.away_team} @ ${f.home_team}`,
          won,
          delta: won ? f.stake : -f.stake,
          at: f.created_at,
        };
      });
    },
  });
}

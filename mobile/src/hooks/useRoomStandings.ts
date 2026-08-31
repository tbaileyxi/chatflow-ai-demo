// Season fade standings for one room.
//
// `fade_season_stats` has been written by settle_fade since the fade tables
// shipped, keyed by (huddle_id, user_id, season_year) — a per-room leaderboard
// that nothing in the app has ever rendered. This reads it.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RoomStanding = {
  userId: string;
  name: string;
  wins: number;
  losses: number;
  points: number;
  streak: number;
};

export function useRoomStandings(huddleId: string | undefined) {
  return useQuery({
    queryKey: ["room-standings", huddleId],
    enabled: !!huddleId,
    staleTime: 60_000,
    queryFn: async (): Promise<RoomStanding[]> => {
      if (!huddleId) return [];

      const { data: stats } = await supabase
        .from("fade_season_stats")
        .select("user_id, total_points, total_wins, total_losses, current_streak")
        .eq("huddle_id", huddleId)
        .order("total_points", { ascending: false })
        .limit(25);

      const rows = stats ?? [];
      if (rows.length === 0) return [];

      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", rows.map((r: any) => r.user_id));

      const nameOf = new Map(
        (profs ?? []).map((p: any) => [
          p.user_id,
          p.display_name || p.username || "A member",
        ]),
      );

      return rows.map((r: any) => ({
        userId: r.user_id,
        name: nameOf.get(r.user_id) ?? "A member",
        wins: r.total_wins ?? 0,
        losses: r.total_losses ?? 0,
        points: r.total_points ?? 0,
        streak: r.current_streak ?? 0,
      }));
    },
  });
}

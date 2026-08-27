// Fade standings for every room you're in that has any fade activity.
//
// useRoomStandings covers ONE room and only fires when Picks is opened from a
// room (route param huddleId). Opened from the tab bar there was no huddleId,
// so the leaderboard — the whole point of the section — simply never rendered.
// This backs the tab-bar case.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { RoomStanding } from "@/hooks/useRoomStandings";

export type RoomBoard = {
  huddleId: string;
  huddleName: string;
  rows: RoomStanding[];
};

export function useMyRoomStandings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-room-standings", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<RoomBoard[]> => {
      if (!user) return [];

      // Rooms you belong to.
      const { data: mem } = await supabase
        .from("huddle_members")
        .select("huddle_id")
        .eq("user_id", user.id);
      const myHuddles = [...new Set((mem ?? []).map((m: any) => m.huddle_id))];
      if (myHuddles.length === 0) return [];

      // Every standings row in those rooms, in one query rather than per room.
      const { data: stats } = await supabase
        .from("fade_season_stats")
        .select("huddle_id, user_id, total_points, total_wins, total_losses, current_streak")
        .in("huddle_id", myHuddles)
        .order("total_points", { ascending: false });

      const rows = stats ?? [];
      if (rows.length === 0) return [];

      const [{ data: profs }, { data: huddles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name, username")
          .in("user_id", [...new Set(rows.map((r: any) => r.user_id))]),
        supabase
          .from("huddles")
          .select("id, name")
          .in("id", [...new Set(rows.map((r: any) => r.huddle_id))]),
      ]);

      const nameOf = new Map(
        (profs ?? []).map((p: any) => [
          p.user_id,
          p.display_name || p.username || "A member",
        ]),
      );
      const roomOf = new Map((huddles ?? []).map((h: any) => [h.id, h.name]));

      const boards = new Map<string, RoomBoard>();
      for (const r of rows as any[]) {
        let b = boards.get(r.huddle_id);
        if (!b) {
          b = {
            huddleId: r.huddle_id,
            huddleName: roomOf.get(r.huddle_id) ?? "A room",
            rows: [],
          };
          boards.set(r.huddle_id, b);
        }
        b.rows.push({
          userId: r.user_id,
          name: nameOf.get(r.user_id) ?? "A member",
          wins: r.total_wins ?? 0,
          losses: r.total_losses ?? 0,
          points: r.total_points ?? 0,
          streak: r.current_streak ?? 0,
        });
      }

      // Rooms where you actually play first, then biggest boards.
      return [...boards.values()].sort((a, b) => {
        const aMe = a.rows.some((r) => r.userId === user.id) ? 1 : 0;
        const bMe = b.rows.some((r) => r.userId === user.id) ? 1 : 0;
        return bMe - aMe || b.rows.length - a.rows.length;
      });
    },
  });
}

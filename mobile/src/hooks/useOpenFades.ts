// Open fades across every room you're in — the props still waiting on someone
// to take the other side.
//
// This is the hole that kept the whole mechanic invisible. A fade only ever
// existed as a chat message, so it scrolled out of the room within minutes of
// being posted and there was no surface anywhere that answered "is there
// anything to take right now?". RLS already scopes `fades` to huddles you
// belong to, so no huddle filter is needed here.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Fade } from "@/hooks/useFades";

export type OpenFade = Fade & {
  posterName: string;
  huddleName: string;
};

export function useOpenFades() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["open-fades", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<OpenFade[]> => {
      if (!user) return [];

      const { data: fades } = await supabase
        .from("fades")
        .select("*")
        .eq("status", "open")
        .neq("poster_id", user.id)
        .gt("game_commence_time", new Date().toISOString())
        .order("game_commence_time", { ascending: true })
        .limit(20);

      const rows = ((fades ?? []) as unknown) as Fade[];
      if (rows.length === 0) return [];

      // Names in one round trip each, rather than per card.
      const posterIds = [...new Set(rows.map((f) => f.poster_id))];
      const huddleIds = [...new Set(rows.map((f) => f.huddle_id))];

      const [{ data: profs }, { data: huddles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name, username")
          .in("user_id", posterIds),
        supabase.from("huddles").select("id, name").in("id", huddleIds),
      ]);

      const nameOf = new Map(
        (profs ?? []).map((p: any) => [
          p.user_id,
          p.display_name || p.username || "A member",
        ]),
      );
      const roomOf = new Map((huddles ?? []).map((h: any) => [h.id, h.name]));

      return rows.map((f) => ({
        ...f,
        posterName: nameOf.get(f.poster_id) ?? "A member",
        huddleName: roomOf.get(f.huddle_id) ?? "A room",
      }));
    },
  });
}

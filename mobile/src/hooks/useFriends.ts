// useFriends — the people you share a room with, as a Set of their user ids.
//
// Side Huddle is "friend rooms only": the rooms you're in ARE your friend graph.
// This used to read `friend_connections`, but that table is only written on the
// invite-link accept path and in practice stays empty, so "Friends Now" was
// always blank even when a roommate was online. Deriving from shared
// huddle_members is what actually matches how people get into rooms together.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useFriends() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["friends", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const uid = user!.id;

      // Rooms I'm in.
      const { data: mine, error: e1 } = await supabase
        .from("huddle_members")
        .select("huddle_id")
        .eq("user_id", uid);
      if (e1) {
        console.warn("[friends] my rooms load failed", e1);
        return new Set();
      }
      const huddleIds = (mine ?? []).map((m: any) => m.huddle_id);
      if (huddleIds.length === 0) return new Set();

      // Everyone else in those rooms.
      const { data: others, error: e2 } = await supabase
        .from("huddle_members")
        .select("user_id")
        .in("huddle_id", huddleIds)
        .neq("user_id", uid);
      if (e2) {
        console.warn("[friends] co-members load failed", e2);
        return new Set();
      }

      const ids = new Set<string>();
      for (const row of others ?? []) {
        if (row.user_id) ids.add(row.user_id as string);
      }
      return ids;
    },
  });
}

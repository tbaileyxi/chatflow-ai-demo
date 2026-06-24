// useFriends — the caller's accepted friend graph, as a Set of the *other*
// user's id for each connection. Friends are created on invite-accept
// (accept_room_invite → friend_connections, source 'invite_link') and via other
// social paths. We only need the id set here: display name + avatar for anyone
// currently online come from their own global-presence payload, so this hook
// stays independent of profile read policies.

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
      const { data, error } = await supabase
        .from("friend_connections")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);

      if (error) {
        console.warn("[friends] load failed", error);
        return new Set();
      }

      const ids = new Set<string>();
      for (const row of data ?? []) {
        const other =
          row.requester_id === uid ? row.addressee_id : row.requester_id;
        if (other && other !== uid) ids.add(other);
      }
      return ids;
    },
  });
}

// useFriends / useKnownPeople — the people you know, from the real graph.
//
// This used to derive "friends" from shared huddle_members: your friends were
// whoever happened to be in a room with you right now. That made the graph a
// lagging indicator — people vanished from it when a room emptied, and someone
// who just joined the app was invisible to everyone including the people who
// invited them.
//
// It now reads friend_connections through known_people(), which persists.
// The migration seeded it from existing co-membership, so nobody lost anyone.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type KnownPerson = {
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  source: string | null;
  connectedAt: string | null;
};

export function useKnownPeople() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["known-people", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<KnownPerson[]> => {
      const { data, error } = await (supabase.rpc as any)("known_people");
      if (error) {
        console.warn("[friends] known_people failed", error);
        return [];
      }
      return ((data ?? []) as any[]).map((r) => ({
        userId: r.user_id,
        displayName: r.display_name ?? null,
        username: r.username ?? null,
        avatarUrl: r.avatar_url ?? null,
        source: r.source ?? null,
        connectedAt: r.connected_at ?? null,
      }));
    },
  });
}

// Set of user ids, for callers that only need a membership test.
export function useFriends() {
  const { data, ...rest } = useKnownPeople();
  return {
    ...rest,
    data: data ? new Set(data.map((p) => p.userId)) : undefined,
  } as const;
}

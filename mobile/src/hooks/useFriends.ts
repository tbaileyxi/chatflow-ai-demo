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

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useContactNames } from "@/lib/personName";

export type KnownPerson = {
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  source: string | null;
  connectedAt: string | null;
  // What YOU have them saved as, from this device's cache. Null for anyone who
  // is not in your address book — someone you met through an invite link has
  // only ever had their Side Huddle name.
  contactName: string | null;
};

export function useKnownPeople() {
  const { user } = useAuth();
  const contactNames = useContactNames();

  const query = useQuery({
    queryKey: ["known-people", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<KnownPerson[]> => {
      const { data, error } = await (supabase.rpc as any)("known_people");
      if (error) {
        console.warn("[friends] known_people failed", error);
        return [];
      }
      const rows = (data ?? []) as any[];
      if (rows.length === 0) return [];

      // known_people() cannot tell a person from an abandoned signup: the
      // trigger that creates a profile names it "User", and onboarding renames
      // it at the end. Someone who quit halfway is a row in the table and
      // nobody in the app — showing them gives you a friend called "User" that
      // you cannot identify because there is nothing there to identify.
      const { data: live } = await supabase
        .from("profiles")
        .select("user_id, onboarding_completed")
        .in("user_id", rows.map((r) => r.user_id));
      const finished = new Set(
        (live ?? []).filter((p: any) => p.onboarding_completed).map((p: any) => p.user_id),
      );

      return rows
        .filter((r) => finished.has(r.user_id))
        .map((r) => ({
          userId: r.user_id,
          displayName: r.display_name ?? null,
          username: r.username ?? null,
          avatarUrl: r.avatar_url ?? null,
          source: r.source ?? null,
          connectedAt: r.connected_at ?? null,
          contactName: null as string | null,
        }));
    },
  });

  // Names are stitched on HERE rather than in the query, because they come
  // from this device and the query comes from the server. Keeping them apart
  // means a contact scan relabels the list without refetching it.
  //
  // The onboarding_completed filter above does NOT catch everyone called
  // "User": that flag is true on accounts that finished without ever setting a
  // name. personName() handles them by name instead of by flag.
  const data = useMemo(
    () =>
      query.data?.map((p) => ({
        ...p,
        contactName: contactNames.get(p.userId) ?? null,
      })),
    [query.data, contactNames],
  );

  return { ...query, data } as typeof query;
}

// Set of user ids, for callers that only need a membership test.
export function useFriends() {
  const { data, ...rest } = useKnownPeople();
  return {
    ...rest,
    data: data ? new Set(data.map((p) => p.userId)) : undefined,
  } as const;
}

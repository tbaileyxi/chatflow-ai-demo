// Who a DM is WITH.
//
// A DM is a huddle with two people in it, and a huddle has one name column. It
// was filled in with the other person's name at the moment of creation — which
// is right for whoever opened it and exactly backwards for the person on the
// other end, who saw a conversation named after themselves.
//
// One stored string cannot be correct for both sides, so it is resolved per
// viewer instead: look up the member who is not you, and use their name. The
// stored name stays as a fallback for a DM whose other member has gone.

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useContactNames } from "@/lib/personName";

export type Counterpart = {
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  contactName: string | null;
};

export function useDmCounterparts(huddleIds: string[]) {
  const { user } = useAuth();
  const contactNames = useContactNames();
  const key = [...huddleIds].sort().join(",");

  const query = useQuery({
    queryKey: ["dm-counterparts", user?.id, key],
    enabled: !!user?.id && huddleIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<string, Omit<Counterpart, "contactName">>> => {
      const { data: members, error } = await supabase
        .from("huddle_members")
        .select("huddle_id, user_id")
        .in("huddle_id", huddleIds)
        .neq("user_id", user!.id);
      if (error) {
        console.warn("[dm] could not resolve the other person", error);
        return new Map();
      }

      const otherIds = [...new Set((members ?? []).map((m: any) => m.user_id))];
      if (otherIds.length === 0) return new Map();

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", otherIds);
      const byUser = new Map(
        (profiles ?? []).map((p: any) => [p.user_id, p]),
      );

      const out = new Map<string, Omit<Counterpart, "contactName">>();
      for (const m of (members ?? []) as any[]) {
        const p = byUser.get(m.user_id);
        out.set(m.huddle_id, {
          userId: m.user_id,
          displayName: p?.display_name ?? null,
          username: p?.username ?? null,
          avatarUrl: p?.avatar_url ?? null,
        });
      }
      return out;
    },
  });

  // Contact names come from this device, so they are stitched on here rather
  // than fetched — same split as useKnownPeople.
  return useMemo(() => {
    const out = new Map<string, Counterpart>();
    for (const [huddleId, p] of query.data ?? new Map()) {
      out.set(huddleId, { ...p, contactName: contactNames.get(p.userId) ?? null });
    }
    return out;
  }, [query.data, contactNames]);
}

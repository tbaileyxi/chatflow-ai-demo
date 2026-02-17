import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HuddleMember = {
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  isOwner: boolean;
};

export function useHuddleMembers(huddleId: string, ownerId: string) {
  return useQuery({
    queryKey: ["huddle-members", huddleId],
    queryFn: async (): Promise<HuddleMember[]> => {
      const { data: members, error } = await supabase
        .from("huddle_members")
        .select("user_id, joined_at")
        .eq("huddle_id", huddleId)
        .order("joined_at", { ascending: true });

      if (error || !members) return [];

      const userIds = members.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.user_id, p]),
      );

      return members.map((m) => {
        const profile = profileMap.get(m.user_id);
        return {
          userId: m.user_id,
          displayName: profile?.display_name ?? null,
          username: profile?.username ?? null,
          avatarUrl: profile?.avatar_url ?? null,
          joinedAt: m.joined_at,
          isOwner: m.user_id === ownerId,
        };
      });
    },
  });
}

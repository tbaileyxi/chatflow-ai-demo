import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PostReactionSummary = {
  reactionType: string;
  count: number;
  hasReacted: boolean;
};

export type PostReactions = Map<string, PostReactionSummary[]>;

export function usePostReactions(postIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["post-reactions", postIds.length],
    enabled: postIds.length > 0,
    queryFn: async (): Promise<PostReactions> => {
      if (postIds.length === 0) return new Map();

      const { data, error } = await supabase
        .from("post_reactions")
        .select("post_id, reaction_type, user_id")
        .in("post_id", postIds);

      if (error || !data) return new Map();

      const map = new Map<string, PostReactionSummary[]>();
      const grouped = new Map<string, Map<string, { count: number; userReacted: boolean }>>();

      for (const r of data) {
        if (!grouped.has(r.post_id)) grouped.set(r.post_id, new Map());
        const typeMap = grouped.get(r.post_id)!;
        if (!typeMap.has(r.reaction_type)) typeMap.set(r.reaction_type, { count: 0, userReacted: false });
        const entry = typeMap.get(r.reaction_type)!;
        entry.count++;
        if (r.user_id === user?.id) entry.userReacted = true;
      }

      for (const [postId, typeMap] of grouped) {
        map.set(
          postId,
          [...typeMap.entries()].map(([reactionType, { count, userReacted }]) => ({
            reactionType,
            count,
            hasReacted: userReacted,
          })),
        );
      }

      return map;
    },
  });
}

export function useTogglePostReaction() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return async (postId: string, reactionType: string) => {
    if (!user) return;

    const { data: existing } = await supabase
      .from("post_reactions")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .eq("reaction_type", reactionType)
      .maybeSingle();

    if (existing) {
      await supabase.from("post_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("post_reactions").insert({
        post_id: postId,
        user_id: user.id,
        reaction_type: reactionType,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["post-reactions"] });
  };
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ReactionSummary = {
  emoji: string;
  count: number;
  hasReacted: boolean;
};

export type MessageReactions = Map<string, ReactionSummary[]>;

export function useMessageReactions(huddleId: string, messageIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["message-reactions", huddleId, messageIds.length],
    enabled: messageIds.length > 0,
    queryFn: async (): Promise<MessageReactions> => {
      if (messageIds.length === 0) return new Map();

      const { data, error } = await supabase
        .from("huddle_message_reactions")
        .select("message_id, emoji, user_id")
        .in("message_id", messageIds);

      if (error || !data) return new Map();

      const map = new Map<string, ReactionSummary[]>();

      // Group by message_id then emoji
      const grouped = new Map<string, Map<string, { count: number; userReacted: boolean }>>();
      for (const r of data) {
        if (!grouped.has(r.message_id)) grouped.set(r.message_id, new Map());
        const emojiMap = grouped.get(r.message_id)!;
        if (!emojiMap.has(r.emoji)) emojiMap.set(r.emoji, { count: 0, userReacted: false });
        const entry = emojiMap.get(r.emoji)!;
        entry.count++;
        if (r.user_id === user?.id) entry.userReacted = true;
      }

      for (const [msgId, emojiMap] of grouped) {
        map.set(
          msgId,
          [...emojiMap.entries()].map(([emoji, { count, userReacted }]) => ({
            emoji,
            count,
            hasReacted: userReacted,
          })),
        );
      }

      return map;
    },
  });
}

export function useToggleReaction() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return async (messageId: string, emoji: string, huddleId: string) => {
    if (!user) return;

    // Check if user already reacted with this emoji
    const { data: existing } = await supabase
      .from("huddle_message_reactions")
      .select("id")
      .eq("message_id", messageId)
      .eq("user_id", user.id)
      .eq("emoji", emoji)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("huddle_message_reactions")
        .delete()
        .eq("id", existing.id);
    } else {
      await supabase.from("huddle_message_reactions").insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["message-reactions", huddleId] });
  };
}

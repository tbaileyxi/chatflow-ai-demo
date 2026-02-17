import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HuddleMessage = {
  id: string;
  huddleId: string;
  userId: string;
  content: string;
  createdAt: string;
  mediaUrl: string | null;
  mediaType: string | null;
  isBotMessage: boolean;
  isTeamAgent: boolean;
  replyToId: string | null;
  // Joined profile data
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

const MESSAGE_LIMIT = 100;

async function fetchMessages(huddleId: string): Promise<HuddleMessage[]> {
  const { data, error } = await supabase
    .from("huddle_messages")
    .select("*")
    .eq("huddle_id", huddleId)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_LIMIT);

  if (error || !data) return [];

  // Batch fetch profiles for all unique user_ids
  const userIds = [...new Set(data.map((m) => m.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, username, avatar_url")
    .in("user_id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, p]),
  );

  return data.map((m) => {
    const profile = profileMap.get(m.user_id);
    return {
      id: m.id,
      huddleId: m.huddle_id,
      userId: m.user_id,
      content: m.content,
      createdAt: m.created_at,
      mediaUrl: m.media_url,
      mediaType: m.media_type,
      isBotMessage: m.is_bot_message ?? false,
      isTeamAgent: m.is_team_agent_message ?? false,
      replyToId: m.reply_to_id,
      displayName: profile?.display_name ?? null,
      username: profile?.username ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    };
  });
}

export function useHuddleMessages(huddleId: string) {
  const queryClient = useQueryClient();
  const [realtimeMessage, setRealtimeMessage] = useState<HuddleMessage | null>(
    null,
  );

  const query = useQuery({
    queryKey: ["huddle-messages", huddleId],
    queryFn: () => fetchMessages(huddleId),
    enabled: !!huddleId,
  });

  // Realtime subscription for new messages
  useEffect(() => {
    if (!huddleId) return;

    const channel = supabase
      .channel(`chat-${huddleId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "huddle_messages",
          filter: `huddle_id=eq.${huddleId}`,
        },
        async (payload) => {
          const msg = payload.new as any;

          // Fetch profile for new message author
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id, display_name, username, avatar_url")
            .eq("user_id", msg.user_id)
            .maybeSingle();

          const newMessage: HuddleMessage = {
            id: msg.id,
            huddleId: msg.huddle_id,
            userId: msg.user_id,
            content: msg.content,
            createdAt: msg.created_at,
            mediaUrl: msg.media_url,
            mediaType: msg.media_type,
            isBotMessage: msg.is_bot_message ?? false,
            isTeamAgent: msg.is_team_agent_message ?? false,
            replyToId: msg.reply_to_id,
            displayName: profile?.display_name ?? null,
            username: profile?.username ?? null,
            avatarUrl: profile?.avatar_url ?? null,
          };

          // Prepend to cache
          queryClient.setQueryData<HuddleMessage[]>(
            ["huddle-messages", huddleId],
            (old) => (old ? [newMessage, ...old] : [newMessage]),
          );

          setRealtimeMessage(newMessage);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [huddleId, queryClient]);

  const sendMessage = useCallback(
    async (content: string, userId: string) => {
      const { error } = await supabase.from("huddle_messages").insert({
        huddle_id: huddleId,
        user_id: userId,
        content,
      });
      return { error };
    },
    [huddleId],
  );

  return {
    ...query,
    sendMessage,
    realtimeMessage,
  };
}

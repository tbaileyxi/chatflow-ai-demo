import { useEffect, useState, useCallback, useRef } from "react";
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
  messageType: string | null;
  isBotMessage: boolean;
  isTeamAgent: boolean;
  replyToId: string | null;
  // Pulse / social embed fields
  embedCode: string | null;
  isPulseMoment: boolean;
  pulseSource: string | null;
  pulseExpiresAt: string | null;
  // Joined profile data
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

const PAGE_SIZE = 50;
const INITIAL_DAYS = 10;

function getDateCutoff(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

type RawRow = Record<string, any>;

function mapRow(m: RawRow, profileMap: Map<string, any>): HuddleMessage {
  const profile = profileMap.get(m.user_id);
  return {
    id: m.id,
    huddleId: m.huddle_id,
    userId: m.user_id,
    content: m.content,
    createdAt: m.created_at,
    mediaUrl: m.media_url,
    mediaType: m.media_type,
    messageType: m.message_type ?? null,
    isBotMessage: m.is_bot_message ?? false,
    isTeamAgent: m.is_team_agent_message ?? false,
    replyToId: m.reply_to_id,
    embedCode: m.embed_code ?? null,
    isPulseMoment: m.is_pulse_moment ?? false,
    pulseSource: m.pulse_source ?? null,
    pulseExpiresAt: m.pulse_expires_at ?? null,
    displayName: profile?.display_name ?? null,
    username: profile?.username ?? null,
    avatarUrl: profile?.avatar_url ?? null,
  };
}

async function fetchProfiles(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, any>();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, username, avatar_url")
    .in("user_id", userIds);
  return new Map((profiles ?? []).map((p) => [p.user_id, p]));
}

// Fetch newest messages first (descending), with date cutoff for initial load
async function fetchMessages(
  huddleId: string,
  cutoff: string,
): Promise<{ messages: HuddleMessage[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from("huddle_messages")
    .select("*")
    .eq("huddle_id", huddleId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (error || !data) return { messages: [], hasMore: false };

  const hasMore = data.length > PAGE_SIZE;
  const rows = hasMore ? data.slice(0, PAGE_SIZE) : data;

  const userIds = [...new Set(rows.map((m) => m.user_id))];
  const profileMap = await fetchProfiles(userIds);

  // Return in newest-first order
  return {
    messages: rows.map((m) => mapRow(m, profileMap)),
    hasMore,
  };
}

// Fetch older messages before the oldest currently loaded message
async function fetchOlderMessages(
  huddleId: string,
  beforeDate: string,
): Promise<{ messages: HuddleMessage[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from("huddle_messages")
    .select("*")
    .eq("huddle_id", huddleId)
    .lt("created_at", beforeDate)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (error || !data) return { messages: [], hasMore: false };

  const hasMore = data.length > PAGE_SIZE;
  const rows = hasMore ? data.slice(0, PAGE_SIZE) : data;

  const userIds = [...new Set(rows.map((m) => m.user_id))];
  const profileMap = await fetchProfiles(userIds);

  return {
    messages: rows.map((m) => mapRow(m, profileMap)),
    hasMore,
  };
}

export function useHuddleMessages(huddleId: string) {
  const queryClient = useQueryClient();
  const [realtimeMessage, setRealtimeMessage] = useState<HuddleMessage | null>(
    null,
  );
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const cutoff = useRef(getDateCutoff(INITIAL_DAYS));

  const query = useQuery({
    queryKey: ["huddle-messages", huddleId],
    queryFn: async () => {
      const result = await fetchMessages(huddleId, cutoff.current);
      setHasMore(result.hasMore);
      return result.messages;
    },
    enabled: !!huddleId,
  });

  // Load older messages (append to end of list since list is newest-first)
  const loadMore = useCallback(async () => {
    if (loadingMore || !query.data || query.data.length === 0) return;
    setLoadingMore(true);

    // Oldest loaded message is at the end of the array (newest-first order)
    const oldestDate = query.data[query.data.length - 1].createdAt;
    const result = await fetchOlderMessages(huddleId, oldestDate);

    if (result.messages.length > 0) {
      queryClient.setQueryData<HuddleMessage[]>(
        ["huddle-messages", huddleId],
        (old) => (old ? [...old, ...result.messages] : result.messages),
      );
    }

    setHasMore(result.hasMore);
    setLoadingMore(false);
  }, [huddleId, loadingMore, query.data, queryClient]);

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

          const profileMap = await fetchProfiles([msg.user_id]);
          const newMessage = mapRow(msg, profileMap);

          // Prepend to cache (newest first). Guard against duplicates —
          // channel rejoins can replay an INSERT, and a concurrent refetch
          // may have already landed the row.
          queryClient.setQueryData<HuddleMessage[]>(
            ["huddle-messages", huddleId],
            (old) => {
              if (!old) return [newMessage];
              if (old.some((m) => m.id === newMessage.id)) return old;
              return [newMessage, ...old];
            },
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
    async (
      content: string,
      userId: string,
      replyToId?: string,
      media?: { uri: string; type: "image" | "audio" },
      notifContext?: { senderName: string; huddleName: string },
    ) => {
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      // Upload media to Supabase storage if provided
      if (media) {
        try {
          const ext = media.type === "audio" ? "m4a" : "jpg";
          const fileName = `${huddleId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const response = await fetch(media.uri);
          const blob = await response.blob();

          const { error: uploadError } = await supabase.storage
            .from("huddle-media")
            .upload(fileName, blob, {
              contentType: media.type === "audio" ? "audio/m4a" : "image/jpeg",
              upsert: false,
            });

          if (uploadError) {
            console.error("Upload error:", uploadError);
            return { error: uploadError };
          }

          const { data: urlData } = supabase.storage
            .from("huddle-media")
            .getPublicUrl(fileName);

          mediaUrl = urlData.publicUrl;
          mediaType = media.type;
        } catch (err) {
          console.error("Media upload failed:", err);
          return { error: err };
        }
      }

      const { error } = await supabase.from("huddle_messages").insert({
        huddle_id: huddleId,
        user_id: userId,
        content,
        ...(replyToId ? { reply_to_id: replyToId } : {}),
        ...(mediaUrl ? { media_url: mediaUrl, media_type: mediaType } : {}),
      });

      // Fire push notification (edge function handles 30-min throttle)
      if (!error && notifContext) {
        supabase.functions
          .invoke("send-push-notification", {
            body: {
              type: "new_message",
              huddleId,
              senderId: userId,
              senderName: notifContext.senderName,
              content: content.slice(0, 100),
              huddleName: notifContext.huddleName,
            },
          })
          .catch(() => {});
      }

      return { error };
    },
    [huddleId],
  );

  return {
    ...query,
    sendMessage,
    realtimeMessage,
    hasMore,
    loadMore,
    loadingMore,
  };
}

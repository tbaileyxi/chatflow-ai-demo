import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useHuddleDetails } from "@/hooks/useHuddleDetails";
import { useHuddleMessages, type HuddleMessage } from "@/hooks/useHuddleMessages";
import { useMessageReactions, useToggleReaction } from "@/hooks/useMessageReactions";
import { useHuddlePresence } from "@/hooks/useHuddlePresence";
import { HuddleHeader } from "@/components/huddle/HuddleHeader";
import { PresenceBar } from "@/components/huddle/PresenceBar";
import { ChatMessage } from "@/components/huddle/ChatMessage";
import { MessageInput } from "@/components/huddle/MessageInput";
import { PredictionCard } from "@/components/predictions/PredictionCard";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useTeamMarkets } from "@/hooks/useTeamMarkets";
import {
  useLiveGameContext,
  getGameState,
} from "@/hooks/useLiveGameContext";
import { supabase } from "@/integrations/supabase/client";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/types";

type Route = RouteProp<RootStackParamList, "Huddle">;

type ListItem =
  | { type: "message"; data: HuddleMessage }
  | { type: "separator"; label: string; key: string }
  | { type: "load-more"; key: string };

function formatDaySeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - messageDay.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Find the root message ID for any reply chain (single-level threading)
function findRootId(
  msgId: string,
  msgMap: Map<string, HuddleMessage>,
  visited = new Set<string>(),
): string {
  if (visited.has(msgId)) return msgId; // cycle guard
  visited.add(msgId);
  const msg = msgMap.get(msgId);
  if (!msg || !msg.replyToId) return msgId;
  const parent = msgMap.get(msg.replyToId);
  if (!parent) return msgId; // parent not loaded
  return findRootId(parent.id, msgMap, visited);
}

// Build threaded list: root messages newest-first, replies grouped below each root
function buildListItems(
  messages: HuddleMessage[],
  hasMore: boolean,
): ListItem[] {
  const msgMap = new Map<string, HuddleMessage>();
  for (const m of messages) msgMap.set(m.id, m);

  // Group replies by root message ID
  const rootReplies = new Map<string, HuddleMessage[]>();
  const rootMessages: HuddleMessage[] = [];

  for (const msg of messages) {
    if (!msg.replyToId || !msgMap.has(msg.replyToId)) {
      // This is a root message (or its parent isn't loaded)
      rootMessages.push(msg);
    } else {
      const rootId = findRootId(msg.id, msgMap);
      if (rootId === msg.id) {
        // Couldn't find parent chain, treat as root
        rootMessages.push(msg);
      } else {
        const replies = rootReplies.get(rootId) ?? [];
        replies.push(msg);
        rootReplies.set(rootId, replies);
      }
    }
  }

  // Sort root messages newest-first (they should already be, but ensure)
  rootMessages.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Build final list with day separators
  const items: ListItem[] = [];
  let lastDay = "";

  for (const root of rootMessages) {
    const rootDate = new Date(root.createdAt);
    const dayKey = `${rootDate.getFullYear()}-${rootDate.getMonth()}-${rootDate.getDate()}`;

    if (dayKey !== lastDay) {
      items.push({
        type: "separator",
        label: formatDaySeparator(root.createdAt),
        key: `sep-${dayKey}`,
      });
      lastDay = dayKey;
    }

    // Root message
    items.push({ type: "message", data: root });

    // Replies sorted chronologically (oldest first within thread)
    const replies = rootReplies.get(root.id);
    if (replies) {
      replies.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      for (const reply of replies) {
        items.push({ type: "message", data: reply });
      }
    }
  }

  if (hasMore) {
    items.push({ type: "load-more", key: "load-more" });
  }

  return items;
}

export function HuddleScreen() {
  const route = useRoute<Route>();
  const { huddleId } = route.params;
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: huddle, isLoading: huddleLoading } = useHuddleDetails(huddleId);
  const {
    data: messages,
    isLoading: messagesLoading,
    sendMessage,
    hasMore,
    loadMore,
    loadingMore,
  } = useHuddleMessages(huddleId);
  const flatListRef = useRef<FlatList<ListItem>>(null);
  const { presentUsers, entryBanner } = useHuddlePresence(huddleId);

  // Kalshi markets for this huddle's team
  const teamId = huddle?.teamId;
  const { data: teamMarkets } = useTeamMarkets(teamId);
  const { data: game } = useLiveGameContext(teamId);
  const gameState = getGameState(game ?? null);

  // Reply state
  const [replyTo, setReplyTo] = useState<{
    id: string;
    displayName: string;
    content: string;
  } | null>(null);

  // Reactions
  const messageIds = useMemo(
    () => messages?.map((m) => m.id) ?? [],
    [messages],
  );
  const { data: reactionsMap } = useMessageReactions(huddleId, messageIds);
  const toggleReaction = useToggleReaction();

  // Build a map of message id -> message for reply lookups
  const messageMap = useMemo(() => {
    const map = new Map<string, HuddleMessage>();
    if (messages) {
      for (const m of messages) {
        map.set(m.id, m);
      }
    }
    return map;
  }, [messages]);

  // Build list items with day separators (newest first)
  const listItems = useMemo(
    () => (messages ? buildListItems(messages, hasMore) : []),
    [messages, hasMore],
  );

  // Update last_read_at on mount and when new messages arrive
  useEffect(() => {
    if (!user || !huddleId) return;
    supabase
      .from("huddle_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("huddle_id", huddleId)
      .eq("user_id", user.id)
      .then(() => {});
  }, [user, huddleId, messages?.length]);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const handleReply = useCallback(
    (msg: HuddleMessage) => {
      setReplyTo({
        id: msg.id,
        displayName: msg.displayName ?? msg.username ?? "User",
        content: msg.content,
      });
      const index = listItems.findIndex(
        (item) => item.type === "message" && item.data.id === msg.id,
      );
      if (index >= 0) {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5,
        });
      }
    },
    [listItems],
  );

  if (huddleLoading || !huddle) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingSpinner className="flex-1" />
      </SafeAreaView>
    );
  }

  const handleSend = async (
    content: string,
    replyToId?: string,
    media?: { uri: string; type: "image" | "audio" },
  ) => {
    if (!user) return { error: new Error("Not authenticated") };
    const senderName = profile?.displayName ?? profile?.username ?? "Someone";
    const huddleName = huddle?.name ?? "";
    const result = await sendMessage(content, user.id, replyToId, media, {
      senderName,
      huddleName,
    });
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 300);
    return result;
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <HuddleHeader huddle={huddle} />
        <PresenceBar users={presentUsers} entryBanner={entryBanner} />

        {messagesLoading ? (
          <LoadingSpinner className="flex-1" />
        ) : (
          <FlatList
            ref={flatListRef}
            data={listItems}
            keyExtractor={(item) =>
              item.type === "separator" || item.type === "load-more"
                ? item.key
                : item.data.id
            }
            renderItem={({ item }) => {
              if (item.type === "separator") {
                return (
                  <View className="my-4 flex-row items-center gap-3 px-6">
                    <View className="h-px flex-1 bg-border" />
                    <Text className="text-sm font-medium text-muted-foreground">
                      {item.label}
                    </Text>
                    <View className="h-px flex-1 bg-border" />
                  </View>
                );
              }

              if (item.type === "load-more") {
                return (
                  <Pressable
                    className="my-4 items-center py-3"
                    onPress={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Text className="text-sm font-semibold text-primary">
                        Load older messages
                      </Text>
                    )}
                  </Pressable>
                );
              }

              const msg = item.data;
              const parentMsg = msg.replyToId ? messageMap.get(msg.replyToId) : undefined;
              const isReply = !!parentMsg;

              return (
                <ChatMessage
                  message={msg}
                  isOwnMessage={msg.userId === user?.id}
                  huddleId={huddleId}
                  huddleName={huddle.name}
                  reactions={reactionsMap?.get(msg.id)}
                  onReact={(emoji) =>
                    toggleReaction(msg.id, emoji, huddleId)
                  }
                  onReply={() => handleReply(msg)}
                  isReply={isReply}
                  replyTo={
                    parentMsg
                      ? {
                          displayName:
                            parentMsg.displayName ?? parentMsg.username ?? "User",
                          content: parentMsg.content,
                        }
                      : null
                  }
                />
              );
            }}
            ListHeaderComponent={
              teamMarkets && teamMarkets.length > 0 ? (
                <View className="gap-2 px-4 py-3 border-b border-border bg-muted/20">
                  <Text className="text-xs font-bold uppercase tracking-wider text-primary">
                    {gameState === "live"
                      ? "Live Predictions"
                      : gameState === "postgame"
                        ? "Game Predictions"
                        : "Predictions"}
                  </Text>
                  {teamMarkets.slice(0, 3).map((market) => (
                    <PredictionCard
                      key={market.id}
                      market={market}
                      huddleId={huddleId}
                    />
                  ))}
                </View>
              ) : null
            }
            contentContainerStyle={{ paddingVertical: 8 }}
            keyboardShouldPersistTaps="handled"
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: true,
                  viewPosition: 0.5,
                });
              }, 500);
            }}
          />
        )}

        {user && huddle.isMember && (
          <MessageInput
            onSend={handleSend}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onFocus={scrollToBottom}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

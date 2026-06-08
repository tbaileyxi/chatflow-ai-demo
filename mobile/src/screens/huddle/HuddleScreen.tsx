import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
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
import { DEV_ROOMS_STORAGE_KEY, getDevTeamById } from "@/config/devData";
import { LogOut, MoreVertical, Pin, UserPlus, User } from "lucide-react-native";
import { useTeamMarkets } from "@/hooks/useTeamMarkets";
import {
  useLiveGameContext,
  formatGameClock,
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

  if (huddleId.startsWith("dev-room-")) {
    return <DevHuddleRoom huddleId={huddleId} />;
  }

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
  const { presentUsers, typingUsers, entryBanner, sendTyping } =
    useHuddlePresence(huddleId);

  // Prediction markets for this huddle's team
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
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-4 py-12">
                <Text className="text-sm text-muted-foreground">
                  Say something to start the room.
                </Text>
              </View>
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
          <>
            {typingUsers.length > 0 && (
              <Text className="border-t border-border bg-background px-4 pt-2 text-xs italic text-muted-foreground">
                {typingUsers.map((typingUser) => typingUser.displayName).join(", ")}
                {typingUsers.length === 1 ? " is" : " are"} typing...
              </Text>
            )}
          <MessageInput
            onSend={handleSend}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onFocus={scrollToBottom}
            onTypingChange={sendTyping}
          />
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type DevRoomMessage = {
  id: string;
  author: string;
  content: string;
  isOwn?: boolean;
  isBot?: boolean;
  isSystem?: boolean;
  botType?: "news" | "prediction";
  mediaUri?: string;
  mediaType?: "image" | "audio";
  replies?: { id: string; author: string; content: string; isOwn?: boolean }[];
  time?: string;
};

type DevRoomPerson = {
  id: string;
  name: string;
  status: "watching" | "online" | "away";
};

type DevStoredRoom = {
  id: string;
  name: string;
  teamId?: string | null;
  teamName?: string | null;
  teamCity?: string | null;
  teamLogoUrl?: string | null;
  relationship?: "owner" | "joined";
  accessMode?: "link" | "private";
  memberCount?: number;
  createdAt?: string;
};

const DEV_ROOM_MESSAGES_STORAGE_PREFIX = "side-huddle-dev-room-v5-messages";

const DEV_TEAM_VISUALS: Record<
  string,
  { abbr: string; color: string; ink: string }
> = {
  "10000000-0000-4000-8000-000000000001": {
    abbr: "CHI",
    color: "#0B162A",
    ink: "#C83803",
  },
  "10000000-0000-4000-8000-000000000002": {
    abbr: "CHI",
    color: "#1A1A1E",
    ink: "#CE1141",
  },
  "10000000-0000-4000-8000-000000000009": {
    abbr: "NYK",
    color: "#0B2240",
    ink: "#F58426",
  },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase();
}

function personColors(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 360;
  return {
    bg: `hsl(${h}, 26%, 19%)`,
    fg: `hsl(${h}, 48%, 74%)`,
    line: `hsl(${h}, 24%, 30%)`,
  };
}

function getDevTeamVisual(teamId?: string, fallbackName = "Team") {
  const configured = teamId ? DEV_TEAM_VISUALS[teamId] : undefined;
  if (configured) return configured;
  return {
    abbr: fallbackName
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 3)
      .toUpperCase() || "SH",
    color: "#171A21",
    ink: colors.primary,
  };
}

function getBotName(teamLabel: string) {
  const parts = teamLabel.split(/\s+/).filter(Boolean);
  const name = parts[parts.length - 1] ?? "Team";
  return name.toLowerCase() === "team" ? "Room Bot" : `${name} Bot`;
}

function DevAvatar({ name, size = 34 }: { name: string; size?: number }) {
  const p = personColors(name);
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: p.bg,
        borderColor: p.line,
        borderWidth: 1,
      }}
    >
      <Text style={{ color: p.fg, fontSize: size * 0.35, fontWeight: "800" }}>
        {initials(name)}
      </Text>
    </View>
  );
}

function TeamTile({
  visual,
  size = 34,
}: {
  visual: { abbr: string; color: string; ink: string };
  size?: number;
}) {
  return (
    <View
      className="items-center justify-center overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(8, size * 0.28),
        backgroundColor: visual.color,
        borderColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
      }}
    >
      <View
        className="absolute bottom-0 left-0 top-0"
        style={{ width: 3, backgroundColor: visual.ink }}
      />
      <Text className="font-black text-white" style={{ fontSize: size * 0.29 }}>
        {visual.abbr}
      </Text>
    </View>
  );
}

function AvatarStack({
  names,
  size = 22,
}: {
  names: string[];
  size?: number;
}) {
  return (
    <View className="flex-row items-center">
      {names.slice(0, 4).map((name, index) => (
        <View
          key={`${name}-${index}`}
          className="rounded-full"
          style={{
            marginLeft: index > 0 ? -size * 0.35 : 0,
            borderWidth: 2,
            borderColor: colors.card,
          }}
        >
          <DevAvatar name={name} size={size} />
        </View>
      ))}
    </View>
  );
}

function renderMentionText(text: string, className: string) {
  return text.split(/(@\w+)/g).map((part, index) => (
    <Text
      key={`${part}-${index}`}
      className={/^@\w+/.test(part) ? "font-black text-primary" : className}
    >
      {part}
    </Text>
  ));
}

function titleFromDevRoomId(huddleId: string) {
  return huddleId
    .replace(/^dev-room-/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function DevRoomMessageRow({
  item,
  teamVisual,
  onReply,
  onImagePress,
}: {
  item: DevRoomMessage;
  teamVisual: { abbr: string; color: string; ink: string };
  onReply: (item: DevRoomMessage) => void;
  onImagePress: (uri: string) => void;
}) {
  if (item.isSystem) {
    return (
      <View className="items-center px-4 py-3">
        <Text className="text-xs font-semibold text-muted-foreground">
          {item.content}
        </Text>
      </View>
    );
  }

  if (item.isBot) {
    return (
      <View className="mb-4 px-1">
        <View className="mb-2 flex-row items-center gap-2">
          <TeamTile visual={teamVisual} size={23} />
          <Text className="ml-auto text-xs text-muted-foreground">
            {item.time ?? "now"}
          </Text>
        </View>

        {item.botType === "prediction" ? (
          <View className="rounded-xl border border-border bg-card">
            <View className="flex-row items-center gap-2 border-b border-border px-4 py-2.5">
              <Text className="rounded border border-info/40 bg-info/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-info">
                Market
              </Text>
              <Text className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Prediction Market
              </Text>
              <Text className="ml-auto text-xs font-black text-success">+4%</Text>
            </View>
            <View className="p-4">
              <Text className="text-base font-black leading-6 text-foreground">
                {item.content}
              </Text>
              <View className="mt-4 h-1.5 flex-row overflow-hidden rounded-full bg-destructive/45">
                <View className="h-full bg-success" style={{ width: "54%" }} />
              </View>
              <View className="mt-3 flex-row gap-2">
                <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-success/50 bg-success/15 py-3 active:opacity-80">
                  <Text className="font-black text-success">Yes</Text>
                  <Text className="font-black text-success">54c</Text>
                </Pressable>
                <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-muted py-3 active:opacity-80">
                  <Text className="font-black text-foreground">No</Text>
                  <Text className="font-black text-muted-foreground">46c</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View className="rounded-xl border border-border bg-muted p-4">
            <Text className="text-base font-semibold leading-6 text-foreground">
              {item.content}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="mb-4 px-1">
      <View className={item.isOwn ? "flex-row-reverse gap-2" : "flex-row gap-2"}>
        {item.isOwn ? (
          <View className="w-8" />
        ) : (
          <View className="pt-5">
            <DevAvatar name={item.author} size={30} />
          </View>
        )}
        <View className={item.isOwn ? "flex-1 items-end" : "flex-1 items-start"}>
          {!item.isOwn ? (
            <View className="mb-1 flex-row items-baseline gap-2 pl-1">
              <Text className="text-xs font-black text-foreground">{item.author}</Text>
              <Text className="text-[11px] text-muted-foreground">
                {item.time ?? "now"}
              </Text>
            </View>
          ) : null}

          <View
            className={
              item.isOwn
                ? "max-w-[82%] rounded-2xl bg-primary px-4 py-3"
                : "max-w-[82%] rounded-2xl border border-border bg-muted px-4 py-3"
            }
            style={{
              borderTopRightRadius: item.isOwn ? 5 : 16,
              borderTopLeftRadius: item.isOwn ? 16 : 5,
            }}
          >
            <Text
              className={
                item.isOwn
                  ? "text-base font-semibold leading-6 text-primary-foreground"
                  : "text-base leading-6 text-foreground"
              }
            >
              {renderMentionText(
                item.content,
                item.isOwn ? "text-primary-foreground" : "text-foreground",
              )}
            </Text>
            {item.mediaUri && item.mediaType === "image" ? (
              <Pressable onPress={() => onImagePress(item.mediaUri!)} className="mt-3">
                <Image
                  source={{ uri: item.mediaUri }}
                  className="h-48 w-64 rounded-xl"
                  resizeMode="cover"
                />
              </Pressable>
            ) : null}
            {item.mediaUri && item.mediaType === "audio" ? (
              <Text
                className={
                  item.isOwn
                    ? "mt-2 text-sm font-semibold text-primary-foreground"
                    : "mt-2 text-sm font-semibold text-muted-foreground"
                }
              >
                Voice message attached
              </Text>
            ) : null}
          </View>

          {item.replies?.length ? (
            <View
              className={
                item.isOwn
                  ? "mr-3 mt-2 gap-2 border-r-2 border-border pr-3"
                  : "ml-3 mt-2 gap-2 border-l-2 border-border pl-3"
              }
            >
              {item.replies.map((reply) => (
                <View
                  key={reply.id}
                  className={
                    item.isOwn
                      ? "flex-row-reverse items-start gap-2"
                      : "flex-row items-start gap-2"
                  }
                >
                  <DevAvatar name={reply.author} size={21} />
                  <Text
                    className={
                      item.isOwn
                        ? "max-w-[220px] text-right text-xs leading-5 text-muted-foreground"
                        : "max-w-[220px] text-xs leading-5 text-muted-foreground"
                    }
                  >
                    <Text className="font-black text-foreground">{reply.author} </Text>
                    {reply.content}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable onPress={() => onReply(item)} hitSlop={8}>
            <Text className="mt-1.5 text-[11px] font-semibold text-muted-foreground">
              Reply
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function DevHuddleRoom({ huddleId }: { huddleId: string }) {
  const navigation = useNavigation();
  const [roomTitle, setRoomTitle] = useState(
    titleFromDevRoomId(huddleId) || "Game Room",
  );
  const [showPeople, setShowPeople] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [roomRelationship, setRoomRelationship] = useState<"owner" | "joined">(
    huddleId.includes("my-room") ? "owner" : "joined",
  );
  const [roomAccessMode, setRoomAccessMode] = useState<"link" | "private">("link");
  const [expandedImageUri, setExpandedImageUri] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{
    id: string;
    displayName: string;
    content: string;
  } | null>(null);
  const [roomTeamId, setRoomTeamId] = useState<string | undefined>(undefined);
  const [availableRooms, setAvailableRooms] = useState<DevStoredRoom[]>([]);
  const flatListRef = useRef<FlatList<DevRoomMessage>>(null);
  const roomTeam = roomTeamId ? getDevTeamById(roomTeamId) : undefined;
  const { data: game } = useLiveGameContext(roomTeam?.id);
  const gameState = getGameState(game ?? null);
  const teamLabel = roomTeam
    ? `${roomTeam.city} ${roomTeam.name}`
    : roomTitle;
  const present = useMemo<DevRoomPerson[]>(
    () => [{ id: "you", name: "You", status: "watching" }],
    [],
  );
  const teamVisual = getDevTeamVisual(roomTeamId, teamLabel);
  const botName = roomTeam ? getBotName(teamLabel) : "Room Bot";
  const isOwnerRoom = roomRelationship === "owner";
  const [pinnedMessage, setPinnedMessage] = useState("");
  // Rooms start empty. The real bot fills in content; no fake seed messages.
  const buildSeedMessages = useCallback((): DevRoomMessage[] => [], []);
  const [messages, setMessages] = useState<DevRoomMessage[]>(() => buildSeedMessages());

  useEffect(() => {
    const loadDevRoom = async () => {
      const storedRooms = await AsyncStorage.getItem(DEV_ROOMS_STORAGE_KEY);
      const rooms = storedRooms ? (JSON.parse(storedRooms) as DevStoredRoom[]) : [];
      const room = rooms.find((item: any) => item.id === huddleId);
      setAvailableRooms(rooms.filter((item) => item.id !== huddleId));
      if (room?.name) {
        setRoomTitle(room.name);
        setRoomRelationship(room.relationship === "joined" ? "joined" : "owner");
        setRoomAccessMode(room.accessMode === "private" ? "private" : "link");
        setRoomTeamId(room.teamId ?? undefined);
      } else {
        setRoomTitle(titleFromDevRoomId(huddleId) || "Game Room");
        setRoomRelationship("owner");
        setRoomAccessMode("link");
        setRoomTeamId(undefined);
      }
      setShowMenu(false);
      setShowPeople(false);
      setReplyTo(null);
      setPinnedMessage("");

      const storedMessages = await AsyncStorage.getItem(
        `${DEV_ROOM_MESSAGES_STORAGE_PREFIX}-${huddleId}`,
      );
      const savedMessages = storedMessages
        ? (JSON.parse(storedMessages) as DevRoomMessage[])
        : [];
      setMessages(savedMessages);
    };

    loadDevRoom();
  }, [buildSeedMessages, huddleId]);

  useEffect(() => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  const handleSend = async (
    content: string,
    replyToId?: string,
    media?: { uri: string; type: "image" | "audio" },
  ) => {
    const nextMessage = {
      id: `own-${Date.now()}`,
      author: "You",
      content,
      isOwn: true,
      mediaUri: media?.uri,
      mediaType: media?.type,
      time: "now",
    } satisfies DevRoomMessage;

    if (replyToId) {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === replyToId
            ? {
                ...message,
                replies: [
                  ...(message.replies ?? []),
                  {
                    id: `reply-${Date.now()}`,
                    author: "You",
                    content,
                    isOwn: true,
                  },
                ],
              }
            : message,
        ),
      );
    } else {
      setMessages((prev) => [...prev, nextMessage]);
    }
    setReplyTo(null);
    Keyboard.dismiss();

    const storageKey = `${DEV_ROOM_MESSAGES_STORAGE_PREFIX}-${huddleId}`;
    const storedMessages = await AsyncStorage.getItem(storageKey);
    const existing = storedMessages
      ? (JSON.parse(storedMessages) as DevRoomMessage[])
      : [];
    if (!replyToId) {
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify([...existing, nextMessage]),
      );
    }
    return { error: null };
  };

  const handleReply = (message: DevRoomMessage) => {
    if (message.isBot || message.isSystem) return;
    setReplyTo({
      id: message.id,
      displayName: message.author,
      content: message.content,
    });
  };

  const handleShareRoom = () => {
    Share.share({
      message: `Jump into ${roomTitle} on Side Huddle.`,
    });
  };

  const handlePin = () => {
    if (pinnedMessage) {
      setPinnedMessage("");
      return;
    }
    // iOS supports Alert.prompt; Android falls back to a fixed default.
    if (Platform.OS === "ios" && (Alert as any).prompt) {
      (Alert as any).prompt(
        "Pin a message",
        "Pin a short note to the top of this room.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Pin",
            onPress: (value?: string) => {
              const text = (value ?? "").trim();
              if (text) setPinnedMessage(text);
            },
          },
        ],
        "plain-text",
      );
    } else {
      setPinnedMessage("Room is open. Check in while you watch.");
    }
  };

  const handleCloseRoom = () => {
    Alert.alert(
      isOwnerRoom ? "Close room?" : "Leave room?",
      isOwnerRoom
        ? "This will remove the room from your device. People you invited will lose access."
        : "You can rejoin later from your invite link.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isOwnerRoom ? "Close" : "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              const stored = await AsyncStorage.getItem(DEV_ROOMS_STORAGE_KEY);
              if (stored) {
                const rooms = JSON.parse(stored) as DevStoredRoom[];
                const next = rooms.filter((r) => r.id !== huddleId);
                await AsyncStorage.setItem(DEV_ROOMS_STORAGE_KEY, JSON.stringify(next));
              }
              await AsyncStorage.removeItem(`${DEV_ROOM_MESSAGES_STORAGE_PREFIX}-${huddleId}`);
            } finally {
              navigation.goBack();
            }
          },
        },
      ],
    );
  };

  const opponentLabel =
    game?.homeTeamName || game?.awayTeamName
      ? `${game.awayTeamCity ?? ""} ${game.awayTeamName ?? "Away"} at ${game.homeTeamCity ?? ""} ${game.homeTeamName ?? "Home"}`
      : "No live game found";
  const scoreLabel = game
    ? `${game.awayScore ?? "-"}-${game.homeScore ?? "-"}`
    : "No score";
  const gameLabel =
    gameState === "live"
      ? "Live"
      : gameState === "pregame"
        ? "Next"
        : gameState === "postgame"
          ? "Final"
          : "Game";
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          className="border-b border-border px-3 pb-2 pt-2"
          style={{ backgroundColor: colors.card }}
        >
          <View
            className="absolute left-0 right-0 top-0 h-0.5"
            style={{ backgroundColor: teamVisual.ink }}
          />
          <View className="flex-row items-center gap-2.5">
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Text className="px-1 text-3xl text-primary">‹</Text>
            </Pressable>
            <TeamTile visual={teamVisual} size={36} />
            <Pressable className="flex-1" onPress={() => setShowPeople(true)}>
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 text-lg font-black text-foreground" numberOfLines={1}>
                  {roomTitle}
                </Text>
              </View>
              <View className="mt-1 flex-row items-center gap-2">
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  Members · {present.length} in room
                </Text>
              </View>
            </Pressable>
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
              onPress={() => setShowMenu(true)}
              hitSlop={8}
            >
              <MoreVertical color={colors.mutedForeground} size={20} />
            </Pressable>
          </View>

          {game && gameState !== "none" ? (
            <View className="mt-2 rounded-lg border border-border bg-muted px-3 py-1.5">
              <View className="flex-row items-center gap-1.5">
                {gameState === "live" ? (
                  <View className="h-1.5 w-1.5 rounded-full bg-destructive" />
                ) : null}
                <Text
                  className={
                    gameState === "live"
                      ? "text-[10px] font-black uppercase tracking-wider text-destructive"
                      : "text-[10px] font-black uppercase tracking-wider text-primary"
                  }
                >
                  {gameLabel}
                </Text>
                <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
                  {game ? formatGameClock(game) : ""}
                </Text>
              </View>
              <Text className="mt-0.5 text-sm font-bold text-foreground" numberOfLines={1}>
                <Text>{game?.awayTeamName ?? "Away"} </Text>
                <Text className="font-black">{game?.awayScore ?? "-"}</Text>
                <Text className="text-muted-foreground"> · </Text>
                <Text>{game?.homeTeamName ?? "Home"} </Text>
                <Text className="font-black">{game?.homeScore ?? "-"}</Text>
              </Text>
            </View>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: "center", gap: 8, paddingTop: 10 }}
          >
            <Text className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Jump
            </Text>
            {availableRooms.length === 0 ? (
              <Text className="text-xs font-bold text-muted-foreground">
                No other rooms yet
              </Text>
            ) : null}
            {availableRooms.map((room) => {
              const active = room.id === huddleId;
              const avatarCount = Math.min(3, Math.max(1, room.memberCount ?? 1));
              return (
                <Pressable
                  key={room.id}
                  className={
                    active
                      ? "flex-row items-center gap-2 rounded-full border border-primary/40 bg-primary/15 py-1.5 pl-1.5 pr-3"
                      : "flex-row items-center gap-2 rounded-full border border-border bg-muted py-1.5 pl-1.5 pr-3"
                  }
                  onPress={() => {
                    if (!active) {
                      (navigation as any).navigate("Huddle", {
                        huddleId: room.id,
                      });
                    }
                  }}
                >
                  {/* Up to 3 overlapping avatar placeholders */}
                  <View className="flex-row" style={{ paddingRight: (avatarCount - 1) * 6 }}>
                    {Array.from({ length: avatarCount }).map((_, i) => (
                      <View
                        key={i}
                        className="h-5 w-5 items-center justify-center rounded-full border border-card bg-muted-foreground/40"
                        style={{ marginLeft: i === 0 ? 0 : -6 }}
                      >
                        <User color={colors.background} size={10} />
                      </View>
                    ))}
                  </View>
                  <Text
                    className={
                      active
                        ? "text-xs font-black text-primary"
                        : "text-xs font-bold text-muted-foreground"
                    }
                  >
                    {room.name}
                  </Text>
                  {!active ? <View className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {pinnedMessage ? (
          <View className="flex-row items-center gap-2 border-b border-border bg-primary/10 px-4 py-2">
            <Pin color={colors.primary} size={13} />
            <Text className="text-[10px] font-black uppercase tracking-widest text-primary">
              Pinned
            </Text>
            <Text className="flex-1 text-xs font-semibold text-foreground" numberOfLines={1}>
              {pinnedMessage}
            </Text>
          </View>
        ) : null}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end", padding: 12, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onScrollBeginDrag={Keyboard.dismiss}
          renderItem={({ item }) => (
            <DevRoomMessageRow
              item={item}
              teamVisual={teamVisual}
              onReply={handleReply}
              onImagePress={setExpandedImageUri}
            />
          )}
          ListFooterComponent={null}
        />

        <MessageInput
          onSend={handleSend}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onFocus={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      </KeyboardAvoidingView>

      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable className="flex-1 bg-black/20" onPress={() => setShowMenu(false)}>
          <View className="items-end px-3 pt-24">
            <Pressable className="w-60 overflow-hidden rounded-2xl border border-border bg-card">
              {isOwnerRoom ? (
                <Pressable
                  className="flex-row items-center gap-3 border-b border-border px-4 py-3"
                  onPress={() => {
                    setShowMenu(false);
                    handlePin();
                  }}
                >
                  <Pin color={colors.primary} size={18} />
                  <Text className="font-bold text-primary">
                    {pinnedMessage ? "Unpin message" : "Pin a message"}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                className="flex-row items-center gap-3 border-b border-border px-4 py-3"
                onPress={() => {
                  setShowMenu(false);
                  handleShareRoom();
                }}
              >
                <UserPlus color={colors.mutedForeground} size={18} />
                <Text className="font-bold text-foreground">Invite people</Text>
              </Pressable>
              <Pressable
                className="flex-row items-center gap-3 px-4 py-3"
                onPress={() => {
                  setShowMenu(false);
                  handleCloseRoom();
                }}
              >
                <LogOut color={colors.destructive} size={18} />
                <Text className="font-bold text-destructive">
                  {isOwnerRoom ? "Close room" : "Leave room"}
                </Text>
              </Pressable>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={!!expandedImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedImageUri(null)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/90 px-4"
          onPress={() => setExpandedImageUri(null)}
        >
          {expandedImageUri ? (
            <Image
              source={{ uri: expandedImageUri }}
              className="h-[72%] w-full rounded-2xl"
              resizeMode="contain"
            />
          ) : null}
          <Text className="mt-4 text-sm font-bold text-white">Tap anywhere to close</Text>
        </Pressable>
      </Modal>

      <Modal
        visible={showPeople}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPeople(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/60"
          onPress={() => setShowPeople(false)}
        >
          <Pressable className="rounded-t-3xl border border-border bg-card px-5 pb-8 pt-4">
            <View className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted-foreground/40" />
            <View className="flex-row items-start justify-between">
              <View>
                <Text className="text-xl font-black text-foreground">
                  Who’s in the room
                </Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  {present.length} online · watching together
                </Text>
              </View>
              <Pressable onPress={() => setShowPeople(false)} hitSlop={8}>
                <Text className="text-2xl text-muted-foreground">×</Text>
              </Pressable>
            </View>

            <View className="mt-5 gap-3">
              {present.map((friend) => (
                <View key={friend.id} className="flex-row items-center gap-3">
                  <DevAvatar name={friend.name} size={44} />
                  <View className="flex-1">
                    <Text className="font-bold text-foreground">{friend.name}</Text>
                    <Text className="text-sm text-muted-foreground">
                      {friend.status === "watching"
                        ? "Watching game"
                        : friend.status === "online"
                          ? "Online"
                          : "Away"}
                    </Text>
                  </View>
                  <View
                    className={
                      friend.status === "watching"
                        ? "h-2.5 w-2.5 rounded-full bg-destructive"
                        : "h-2.5 w-2.5 rounded-full bg-success"
                    }
                  />
                </View>
              ))}
            </View>
            <Pressable
              className="mt-6 rounded-full bg-primary px-4 py-3 active:opacity-80"
              onPress={handleShareRoom}
            >
              <Text className="text-center text-sm font-bold text-primary-foreground">
                Invite more friends
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

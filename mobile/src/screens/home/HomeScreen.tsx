import { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Image,
  FlatList,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Settings, Share2 } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserHuddles, type UserHuddle } from "@/hooks/useUserHuddles";
import {
  useSuperHuddleFeed,
  type SuperHuddlePost,
} from "@/hooks/useSuperHuddleFeed";
import {
  usePostReactions,
  useTogglePostReaction,
  type PostReactionSummary,
} from "@/hooks/usePostReactions";
import { HuddleCard } from "@/components/home/HuddleCard";
import { Skeleton } from "@/components/ui/skeleton";
import { colors } from "@/theme/colors";

type Tab = "super" | "side";

type ChatListItem =
  | { type: "post"; data: SuperHuddlePost }
  | { type: "separator"; label: string; key: string };

function formatDaySeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function buildChatItems(posts: SuperHuddlePost[]): ChatListItem[] {
  const items: ChatListItem[] = [];
  let lastDay = "";

  for (const post of posts) {
    const d = new Date(post.createdAt);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dayKey !== lastDay) {
      items.push({
        type: "separator",
        label: formatDaySeparator(post.createdAt),
        key: `sep-${dayKey}`,
      });
      lastDay = dayKey;
    }
    items.push({ type: "post", data: post });
  }

  return items;
}

export function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("super");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["super-huddle-feed"] });
    await queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
    setRefreshing(false);
  }, [queryClient]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="px-4 pb-2 pt-2">
        <Text className="text-2xl font-bold text-foreground">
          Side Huddle Sports
        </Text>
        <Text className="text-sm text-muted-foreground">
          Your team. Your huddle.
        </Text>
      </View>

      {/* Tab bar */}
      <View className="flex-row border-b border-border">
        <Pressable
          className="flex-1 items-center pb-2.5 pt-2"
          onPress={() => setActiveTab("super")}
        >
          <Text
            className={cn(
              "text-sm font-semibold",
              activeTab === "super"
                ? "text-primary"
                : "text-muted-foreground",
            )}
          >
            Super Huddle
          </Text>
          {activeTab === "super" && (
            <View className="absolute bottom-0 h-0.5 w-full bg-primary" />
          )}
        </Pressable>

        <Pressable
          className="flex-1 items-center pb-2.5 pt-2"
          onPress={() => setActiveTab("side")}
        >
          <Text
            className={cn(
              "text-sm font-semibold",
              activeTab === "side"
                ? "text-primary"
                : "text-muted-foreground",
            )}
          >
            Side Huddles
          </Text>
          {activeTab === "side" && (
            <View className="absolute bottom-0 h-0.5 w-full bg-primary" />
          )}
        </Pressable>
      </View>

      {/* Tab content */}
      {activeTab === "super" ? (
        <SuperHuddleTab refreshing={refreshing} onRefresh={onRefresh} />
      ) : (
        <SideHuddlesTab refreshing={refreshing} onRefresh={onRefresh} />
      )}

      {/* Floating + button on Side Huddles tab */}
      {activeTab === "side" && (
        <Pressable
          className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg active:opacity-80"
          onPress={() => navigation.navigate("CreateSideHuddle" as any)}
        >
          <Plus color={colors.primaryForeground} size={28} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const SUPER_HUDDLE_REACTIONS = ["W", "L", "🔥"] as const;

function SuperHuddleTab({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const navigation = useNavigation();
  const { data: posts, isLoading } = useSuperHuddleFeed();
  const postIds = useMemo(() => posts?.map((p) => p.id) ?? [], [posts]);
  const { data: reactionsMap } = usePostReactions(postIds);
  const toggleReaction = useTogglePostReaction();

  const chatItems = useMemo(
    () => (posts ? buildChatItems(posts) : []),
    [posts],
  );

  if (isLoading) {
    return (
      <View className="gap-3 px-4 pt-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </View>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <ScrollView
        contentContainerClassName="flex-1 items-center justify-center px-8"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Users color={colors.mutedForeground} size={48} />
        <Text className="mt-4 text-center text-lg font-semibold text-foreground">
          Build your Super Huddle
        </Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          Follow teams to see their posts here. Your Super Huddle is a unified
          feed from all the teams you follow.
        </Text>
        <Pressable
          className="mt-4 rounded-full bg-primary px-6 py-2.5"
          onPress={() => navigation.navigate("ManageTeams" as any)}
        >
          <Text className="text-sm font-semibold text-primary-foreground">
            Pick Teams
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  // Unique teams from feed for team icon strip
  const uniqueTeams = useMemo(() => {
    if (!posts) return [];
    const seen = new Set<string>();
    const teams: { id: string; name: string; logoUrl: string | null }[] = [];
    for (const p of posts) {
      if (!seen.has(p.teamId)) {
        seen.add(p.teamId);
        teams.push({
          id: p.teamId,
          name: p.teamName,
          logoUrl: p.teamLogoUrl,
        });
      }
    }
    return teams;
  }, [posts]);

  return (
    <View className="flex-1">
      {/* Team icon strip + Manage Teams */}
      <View className="flex-row items-center px-4 py-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 2 }}
          className="flex-1"
          style={{ flexGrow: 0 }}
        >
          {uniqueTeams.map((t, i) => (
            <View
              key={t.id}
              className="h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-muted"
              style={i > 0 ? { marginLeft: -4 } : undefined}
            >
              {t.logoUrl ? (
                <Image
                  source={{ uri: t.logoUrl }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-xs font-bold text-muted-foreground">
                  {t.name.charAt(0)}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
        <Pressable
          className="flex-row items-center gap-1.5 active:opacity-60 ml-2"
          onPress={() => navigation.navigate("ManageTeams" as any)}
        >
          <Settings color={colors.mutedForeground} size={18} />
          <Text className="text-sm font-medium text-muted-foreground">
            Manage Teams
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={chatItems}
        keyExtractor={(item) =>
          item.type === "separator" ? item.key : item.data.id
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

          return (
            <SuperHuddleChatBubble
              post={item.data}
              reactions={reactionsMap?.get(item.data.id)}
              onReact={(type) => toggleReaction(item.data.id, type)}
            />
          );
        }}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
}

function SuperHuddleChatBubble({
  post,
  reactions,
  onReact,
}: {
  post: SuperHuddlePost;
  reactions?: PostReactionSummary[];
  onReact?: (type: string) => void;
}) {
  const lastTapRef = useRef<number>(0);
  const [showPicker, setShowPicker] = useState(false);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onReact?.("W");
    }
    lastTapRef.current = now;
  };

  const handlePickReaction = (type: string) => {
    onReact?.(type);
    setShowPicker(false);
  };

  const handleShare = () => {
    Share.share({
      message: `${post.teamCity} ${post.teamName}: "${post.content}" — on Side Huddle Sports`,
      ...(post.mediaUrl ? { url: post.mediaUrl } : {}),
    });
    setShowPicker(false);
  };

  return (
    <>
      <Pressable
        onPress={handleDoubleTap}
        onLongPress={() => setShowPicker(true)}
      >
        <View className="gap-1 px-4 py-2">
          <View className="flex-row gap-2.5">
            {/* Team avatar */}
            <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-muted">
              {post.teamLogoUrl ? (
                <Image
                  source={{ uri: post.teamLogoUrl }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-sm font-bold text-muted-foreground">
                  {post.teamName.charAt(0)}
                </Text>
              )}
            </View>

            {/* Content */}
            <View className="max-w-[85%] gap-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-semibold text-secondary">
                  {post.teamCity} {post.teamName}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {formatTime(post.createdAt)}
                </Text>
              </View>

              <View className="rounded-2xl bg-secondary/10 px-4 py-2.5">
                <Text className="text-base text-foreground">
                  {post.content}
                </Text>
              </View>

              {post.mediaUrl && (
                <Image
                  source={{ uri: post.mediaUrl }}
                  className="mt-1 w-full rounded-lg"
                  style={{ height: 200 }}
                  resizeMode="cover"
                />
              )}

              {/* Reaction pills */}
              {reactions && reactions.length > 0 && (
                <View className="mt-0.5 flex-row gap-1">
                  {reactions.map((r) => (
                    <Pressable
                      key={r.reactionType}
                      className={cn(
                        "flex-row items-center gap-1 rounded-full border px-2 py-0.5",
                        r.hasReacted
                          ? "border-primary bg-primary/10"
                          : "border-border bg-muted",
                      )}
                      onPress={() => onReact?.(r.reactionType)}
                    >
                      <Text className="text-sm">{r.reactionType}</Text>
                      <Text className="text-sm text-muted-foreground">
                        {r.count}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Long-press picker — W / L / 🔥 + share, no reply */}
          {showPicker && (
            <View
              className="absolute left-14 top-0 z-50 flex-row items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 shadow-lg"
              style={{ elevation: 8 }}
            >
              {SUPER_HUDDLE_REACTIONS.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => handlePickReaction(type)}
                  className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
                >
                  <Text className="text-lg font-bold">{type}</Text>
                </Pressable>
              ))}
              <View className="mx-0.5 h-6 w-px bg-border" />
              <Pressable
                onPress={handleShare}
                className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
              >
                <Share2 color={colors.mutedForeground} size={20} />
              </Pressable>
            </View>
          )}
        </View>
      </Pressable>

      {/* Dismiss picker overlay */}
      {showPicker && (
        <Pressable
          className="absolute inset-0 z-40"
          onPress={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

function SideHuddlesTab({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const navigation = useNavigation();
  const { data: allHuddles, isLoading } = useUserHuddles();

  // Filter to only non-official huddles (Side Huddles = private friend groups)
  const sideHuddles = allHuddles?.filter((h) => !h.isOfficialTeam) ?? [];

  if (isLoading) {
    return (
      <View className="gap-3 px-4 pt-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </View>
    );
  }

  if (sideHuddles.length === 0) {
    return (
      <ScrollView
        contentContainerClassName="flex-1 items-center justify-center px-8"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Users color={colors.mutedForeground} size={48} />
        <Text className="mt-4 text-center text-lg font-semibold text-foreground">
          No Side Huddles yet
        </Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          Create a Side Huddle to chat with friends about your favorite teams.
          Tap the + button to get started.
        </Text>
      </ScrollView>
    );
  }

  const navigateToHuddle = (huddle: UserHuddle) => {
    navigation.navigate("Huddle", { huddleId: huddle.id });
  };

  return (
    <FlatList
      data={sideHuddles}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <HuddleCard huddle={item} onPress={() => navigateToHuddle(item)} />
      )}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80, gap: 12 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    />
  );
}

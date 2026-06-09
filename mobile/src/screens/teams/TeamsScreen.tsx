import { useMemo, useState, useCallback } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, Newspaper, Radio, Target, Zap } from "lucide-react-native";
import { TweetEmbed, parseTweetId } from "@/components/embeds/TweetEmbed";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useSuperHuddleFeed,
  type SuperHuddlePost,
} from "@/hooks/useSuperHuddleFeed";
import { colors } from "@/theme/colors";

function cardMeta(post: SuperHuddlePost) {
  if (post.cardType === "prediction") {
    return {
      label: "Prediction",
      title: "Prediction Market",
      icon: Target,
      color: colors.info,
    };
  }
  if (post.cardType === "x") {
    // News card: lead with the team name, not "@bot" or "@coach".
    return {
      label: "News",
      title: post.teamName ? `${post.teamName} News` : "News",
      icon: Zap,
      color: "#EAB308",
    };
  }
  return {
    label: "Score",
    title: post.teamName || "Bot",
    icon: Radio,
    color: colors.primary,
  };
}

function TeamPill({
  label,
  active,
  logoUrl,
  onPress,
}: {
  label: string;
  active: boolean;
  logoUrl?: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={cn(
        "flex-row items-center gap-2 rounded-full border px-3 py-2 active:opacity-80",
        active
          ? "border-primary bg-primary"
          : "border-border bg-card",
      )}
      onPress={onPress}
    >
      {logoUrl ? (
        <Image
          source={{ uri: logoUrl }}
          className="h-5 w-5 rounded-full"
          resizeMode="cover"
        />
      ) : null}
      <Text
        className={cn(
          "text-sm font-black",
          active ? "text-primary-foreground" : "text-foreground",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BotFeedCard({ post }: { post: SuperHuddlePost }) {
  const meta = cardMeta(post);
  const Icon = meta.icon;
  const tweetId = parseTweetId(post.embedUrl ?? "");

  return (
    <View className="rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-muted">
          {post.teamLogoUrl ? (
            <Image
              source={{ uri: post.teamLogoUrl }}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            <Text className="text-sm font-black text-muted-foreground">
              {post.teamName.slice(0, 2).toUpperCase()}
            </Text>
          )}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <View
              className="flex-row items-center gap-1 rounded-full px-2 py-1"
              style={{ backgroundColor: `${meta.color}22` }}
            >
              <Icon color={meta.color} size={12} />
              <Text
                className="text-[10px] font-black uppercase tracking-widest"
                style={{ color: meta.color }}
              >
                {meta.label}
              </Text>
            </View>
            <Text className="text-xs font-bold text-muted-foreground" numberOfLines={1}>
              {post.teamCity} {post.teamName}
            </Text>
          </View>
          <Text className="mt-1 text-sm font-black text-foreground">
            {meta.title}
          </Text>
        </View>
      </View>

      <Text className="mt-3 text-base leading-6 text-foreground">
        {post.content.replace(/https?:\/\/[^\s)]+/g, "").trim()}
      </Text>

      {tweetId ? (
        <View className="mt-3">
          <TweetEmbed tweetId={tweetId} />
        </View>
      ) : null}

      {post.mediaUrl ? (
        <Image
          source={{ uri: post.mediaUrl }}
          className="mt-3 h-44 w-full rounded-xl bg-muted"
          resizeMode="cover"
        />
      ) : null}
    </View>
  );
}

export function TeamsScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { data: posts, isLoading } = useSuperHuddleFeed();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const teams = useMemo(() => {
    const seen = new Set<string>();
    return (posts ?? []).flatMap((post) => {
      if (seen.has(post.teamId)) return [];
      seen.add(post.teamId);
      return [
        {
          id: post.teamId,
          name: `${post.teamCity} ${post.teamName}`.trim(),
          logoUrl: post.teamLogoUrl,
        },
      ];
    });
  }, [posts]);

  const filteredPosts = useMemo(
    () =>
      selectedTeamId
        ? (posts ?? []).filter((post) => post.teamId === selectedTeamId)
        : posts ?? [],
    [posts, selectedTeamId],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["super-huddle-feed"] });
    setRefreshing(false);
  }, [queryClient]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-4 pb-3 pt-2">
        <View className="flex-row items-center gap-2">
          <Newspaper color={colors.primary} size={20} />
          <Text className="text-3xl font-black text-foreground">Teams</Text>
        </View>
        <Text className="mt-1 text-sm text-muted-foreground">
          Scores, news, and prediction markets for your teams.
        </Text>
      </View>

      <View className="border-b border-border pb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        >
          <TeamPill
            label="All"
            active={selectedTeamId === null}
            onPress={() => setSelectedTeamId(null)}
          />
          {teams.map((team) => (
            <TeamPill
              key={team.id}
              label={team.name}
              logoUrl={team.logoUrl}
              active={selectedTeamId === team.id}
              onPress={() => setSelectedTeamId(team.id)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <>
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </>
        ) : filteredPosts.length > 0 ? (
          filteredPosts.map((post) => <BotFeedCard key={post.id} post={post} />)
        ) : (
          <View className="rounded-2xl border border-border bg-card p-5">
            <View className="flex-row items-center gap-2">
              <Activity color={colors.primary} size={18} />
              <Text className="text-lg font-black text-foreground">
                No team updates yet
              </Text>
            </View>
            <Text className="mt-2 text-sm leading-5 text-muted-foreground">
              Follow teams to see scores, news, and prediction markets here
              without opening a room.
            </Text>
            <Button
              className="mt-4 self-start"
              variant="outline"
              onPress={() => navigation.navigate("ManageTeams")}
            >
              Follow Teams
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

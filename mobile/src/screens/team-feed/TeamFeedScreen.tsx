import { useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  RefreshControl,
  Pressable,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Heart, MapPin, Twitter, ExternalLink, Zap } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/types";

type Route = RouteProp<RootStackParamList, "TeamFeed">;

type TeamInfo = {
  id: string;
  name: string;
  city: string;
  league: string | null;
  logoUrl: string | null;
  description: string | null;
};

type Post = {
  id: string;
  content: string;
  mediaUrl: string | null;
  createdAt: string;
};

type TrendingPost = {
  id: string;
  postId: string;
  embedUrl: string;
  content: string | null;
  authorUsername: string | null;
  likes: number;
  retweets: number;
  qualityScore: number | null;
  hasMedia: boolean;
  createdAt: string;
};

function useTeamFeed(teamId: string) {
  const { user } = useAuth();

  const teamQuery = useQuery({
    queryKey: ["team-info", teamId],
    queryFn: async (): Promise<TeamInfo | null> => {
      const { data } = await supabase
        .from("teams")
        .select("id, name, city, league, logo_url, description")
        .eq("id", teamId)
        .single();
      if (!data) return null;
      return {
        id: data.id,
        name: data.name,
        city: data.city,
        league: data.league,
        logoUrl: data.logo_url,
        description: data.description,
      };
    },
  });

  const postsQuery = useQuery({
    queryKey: ["team-posts", teamId],
    queryFn: async (): Promise<Post[]> => {
      const { data } = await supabase
        .from("posts")
        .select("id, content, media_url, created_at")
        .eq("team_id", teamId)
        .eq("delivery_status", "sent")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!data) return [];
      return data.map((p) => ({
        id: p.id,
        content: p.content ?? "",
        mediaUrl: p.media_url,
        createdAt: p.created_at,
      }));
    },
  });

  const followQuery = useQuery({
    queryKey: ["team-follow", teamId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_follows")
        .select("id")
        .eq("user_id", user.id)
        .eq("team_id", teamId)
        .maybeSingle();
      return !!data;
    },
  });

  const trendingQuery = useQuery({
    queryKey: ["team-trending", teamId],
    queryFn: async (): Promise<TrendingPost[]> => {
      const { data } = await supabase
        .from("team_trending")
        .select(
          "id, post_id, embed_url, content, author_username, likes, retweets, quality_score, has_media, created_at",
        )
        .eq("team_id", teamId)
        .in("status", ["approved", "broadcasted"])
        .order("created_at", { ascending: false })
        .limit(20);
      if (!data) return [];
      return data.map((t: any) => ({
        id: t.id,
        postId: t.post_id,
        embedUrl: t.embed_url,
        content: t.content,
        authorUsername: t.author_username,
        likes: t.likes ?? 0,
        retweets: t.retweets ?? 0,
        qualityScore: t.quality_score,
        hasMedia: t.has_media ?? false,
        createdAt: t.created_at,
      }));
    },
  });

  return { teamQuery, postsQuery, trendingQuery, followQuery };
}

export function TeamFeedScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { teamId } = route.params;
  const { teamQuery, postsQuery, trendingQuery, followQuery } = useTeamFeed(teamId);
  const [refreshing, setRefreshing] = useState(false);

  const team = teamQuery.data;
  const posts = postsQuery.data;
  const isFollowing = followQuery.data ?? false;

  const trending = trendingQuery.data;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["team-posts", teamId] }),
      queryClient.invalidateQueries({ queryKey: ["team-trending", teamId] }),
    ]);
    setRefreshing(false);
  }, [queryClient, teamId]);

  const toggleFollow = async () => {
    if (!user) return;
    if (isFollowing) {
      await supabase
        .from("user_follows")
        .delete()
        .eq("user_id", user.id)
        .eq("team_id", teamId);
    } else {
      await supabase
        .from("user_follows")
        .insert({ user_id: user.id, team_id: teamId });
    }
    queryClient.invalidateQueries({
      queryKey: ["team-follow", teamId, user.id],
    });
  };

  if (teamQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingSpinner className="flex-1" />
      </SafeAreaView>
    );
  }

  if (!team) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground">Team not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft color={colors.foreground} size={24} />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-foreground">
          Team Feed
        </Text>
      </View>

      <ScrollView
        contentContainerClassName="pb-8"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Team card */}
        <View className="items-center gap-3 px-4 pb-4">
          <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-muted">
            {team.logoUrl ? (
              <Image
                source={{ uri: team.logoUrl }}
                className="h-full w-full"
                resizeMode="cover"
              />
            ) : (
              <Text className="text-2xl font-bold text-muted-foreground">
                {team.name.charAt(0)}
              </Text>
            )}
          </View>
          <Text className="text-xl font-bold text-foreground">
            {team.city} {team.name}
          </Text>
          <View className="flex-row items-center gap-2">
            {team.league && <Badge variant="secondary">{team.league}</Badge>}
          </View>
          {team.description && (
            <Text className="text-center text-sm text-muted-foreground">
              {team.description}
            </Text>
          )}
          {user && (
            <Button
              variant={isFollowing ? "outline" : "default"}
              size="sm"
              onPress={toggleFollow}
            >
              <View className="flex-row items-center gap-1.5">
                <Heart
                  color={isFollowing ? colors.destructive : colors.primaryForeground}
                  size={14}
                  fill={isFollowing ? colors.destructive : "none"}
                />
                <Text
                  className={`text-sm font-medium ${isFollowing ? "text-foreground" : "text-primary-foreground"}`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Text>
              </View>
            </Button>
          )}
        </View>

        <Separator />

        {/* Trending from X */}
        {trending && trending.length > 0 && (
          <View className="gap-3 px-4 pt-4">
            <View className="flex-row items-center gap-2">
              <Zap color={"#EAB308"} size={16} fill={"#EAB308"} />
              <Text className="text-base font-bold text-foreground">Trending</Text>
            </View>
            {trending.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => Linking.openURL(t.embedUrl)}
              >
                <Card>
                  <CardContent className="gap-2 pt-3">
                    <View className="flex-row items-center gap-2">
                      <Twitter color={colors.mutedForeground} size={14} />
                      {t.authorUsername && (
                        <Text className="text-xs font-medium text-muted-foreground">
                          @{t.authorUsername}
                        </Text>
                      )}
                      {t.qualityScore != null && t.qualityScore >= 85 && (
                        <View className="ml-auto rounded-full bg-yellow-500/20 px-2 py-0.5">
                          <Text className="text-[10px] font-bold" style={{ color: "#EAB308" }}>
                            HIGHLIGHT
                          </Text>
                        </View>
                      )}
                    </View>
                    {t.content && (
                      <Text className="text-sm leading-5 text-foreground" numberOfLines={4}>
                        {t.content}
                      </Text>
                    )}
                    <View className="flex-row items-center gap-3">
                      {t.likes > 0 && (
                        <Text className="text-xs text-muted-foreground">
                          {t.likes.toLocaleString()} likes
                        </Text>
                      )}
                      {t.retweets > 0 && (
                        <Text className="text-xs text-muted-foreground">
                          {t.retweets.toLocaleString()} reposts
                        </Text>
                      )}
                      <View className="ml-auto flex-row items-center gap-1">
                        <ExternalLink color={colors.primary} size={12} />
                        <Text className="text-xs font-medium text-primary">View on X</Text>
                      </View>
                    </View>
                  </CardContent>
                </Card>
              </Pressable>
            ))}
            <Separator className="mt-1" />
          </View>
        )}

        {/* Posts */}
        <View className="gap-3 px-4 pt-4">
          {postsQuery.isLoading ? (
            <LoadingSpinner />
          ) : posts && posts.length > 0 ? (
            posts.map((post) => (
              <Card key={post.id}>
                <CardContent className="gap-2 pt-3">
                  <Text className="text-sm text-foreground">{post.content}</Text>
                  {post.mediaUrl && (
                    <Image
                      source={{ uri: post.mediaUrl }}
                      className="h-48 w-full rounded-lg"
                      resizeMode="cover"
                    />
                  )}
                  <Text className="text-xs text-muted-foreground">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </Text>
                </CardContent>
              </Card>
            ))
          ) : (
            <Text className="py-8 text-center text-muted-foreground">
              No posts yet
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

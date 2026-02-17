import { useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Heart, MapPin } from "lucide-react-native";
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

  return { teamQuery, postsQuery, followQuery };
}

export function TeamFeedScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { teamId } = route.params;
  const { teamQuery, postsQuery, followQuery } = useTeamFeed(teamId);
  const [refreshing, setRefreshing] = useState(false);

  const team = teamQuery.data;
  const posts = postsQuery.data;
  const isFollowing = followQuery.data ?? false;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["team-posts", teamId] });
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

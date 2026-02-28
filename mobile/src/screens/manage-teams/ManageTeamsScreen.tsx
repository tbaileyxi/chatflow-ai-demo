import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Check } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { colors } from "@/theme/colors";

type Team = {
  id: string;
  name: string;
  city: string;
  logoUrl: string | null;
  league: string;
};

const LEAGUES = ["NFL", "NBA", "NHL", "NCAAF", "MLB"] as const;

function useAllTeams() {
  return useQuery({
    queryKey: ["teams-list"],
    queryFn: async (): Promise<Team[]> => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, city, logo_url, league")
        .eq("status", "active")
        .in("league", [...LEAGUES])
        .order("name");
      if (error || !data) return [];
      return data.map((t) => ({
        id: t.id,
        name: t.name,
        city: t.city,
        logoUrl: t.logo_url,
        league: t.league ?? "",
      }));
    },
  });
}

function useFollowedTeamIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-follows", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<string[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_follows")
        .select("team_id")
        .eq("user_id", user.id);
      if (error || !data) return [];
      return data.map((f) => f.team_id);
    },
  });
}

export function ManageTeamsScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: teams, isLoading: teamsLoading } = useAllTeams();
  const { data: followedIds, isLoading: followsLoading } = useFollowedTeamIds();

  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [filterLeague, setFilterLeague] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialize selections from current follows
  useEffect(() => {
    if (followedIds) {
      setSelectedTeams(new Set(followedIds));
    }
  }, [followedIds]);

  const isLoading = teamsLoading || followsLoading;

  const filtered = filterLeague
    ? teams?.filter((t) => t.league.toUpperCase() === filterLeague)
    : teams;

  const toggleTeam = (id: string) => {
    setSelectedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    if (selectedTeams.size < 2) {
      Alert.alert("Minimum 2 teams", "Please select at least 2 teams to follow.");
      return;
    }

    setSaving(true);
    try {
      const currentFollows = new Set(followedIds ?? []);
      const toAdd = [...selectedTeams].filter((id) => !currentFollows.has(id));
      const toRemove = [...currentFollows].filter((id) => !selectedTeams.has(id));

      // Insert new follows
      if (toAdd.length > 0) {
        await supabase.from("user_follows").upsert(
          toAdd.map((teamId) => ({ user_id: user.id, team_id: teamId })),
          { onConflict: "user_id,team_id" },
        );
      }

      // Remove unfollowed teams
      if (toRemove.length > 0) {
        for (const teamId of toRemove) {
          await supabase
            .from("user_follows")
            .delete()
            .eq("user_id", user.id)
            .eq("team_id", teamId);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["user-follows"] });
      queryClient.invalidateQueries({ queryKey: ["super-huddle-feed"] });
      navigation.goBack();
    } catch {
      Alert.alert("Error", "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft color={colors.foreground} size={24} />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-foreground">
          Manage Teams
        </Text>
      </View>

      <View className="px-4 pb-2">
        <Text className="text-sm text-muted-foreground">
          Select teams to follow. Their posts appear in your Super Huddle.
        </Text>
        <Text className="mt-1 text-xs text-muted-foreground">
          {selectedTeams.size} selected
          {selectedTeams.size < 2 ? " (pick at least 2)" : ""}
        </Text>
      </View>

      {/* League filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        className="mb-3"
        style={{ flexGrow: 0 }}
      >
        <Pressable
          className={cn(
            "rounded-full px-4 py-2",
            !filterLeague
              ? "bg-primary"
              : "border border-border bg-transparent",
          )}
          onPress={() => setFilterLeague(null)}
        >
          <Text
            className={cn(
              "text-sm font-medium",
              !filterLeague
                ? "text-primary-foreground"
                : "text-muted-foreground",
            )}
          >
            All
          </Text>
        </Pressable>
        {LEAGUES.map((league) => (
          <Pressable
            key={league}
            className={cn(
              "rounded-full px-4 py-2",
              filterLeague === league
                ? "bg-primary"
                : "border border-border bg-transparent",
            )}
            onPress={() =>
              setFilterLeague(filterLeague === league ? null : league)
            }
          >
            <Text
              className={cn(
                "text-sm font-medium",
                filterLeague === league
                  ? "text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {league}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Team grid */}
      {isLoading ? (
        <View className="flex-row flex-wrap gap-3 px-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-20 rounded-xl" />
          ))}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            paddingHorizontal: 16,
            paddingBottom: 100,
          }}
        >
          {filtered?.map((team) => {
            const selected = selectedTeams.has(team.id);
            return (
              <Pressable
                key={team.id}
                className={cn(
                  "w-[22%] items-center gap-1.5 rounded-xl border p-2 active:opacity-80",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card",
                )}
                onPress={() => toggleTeam(team.id)}
              >
                <View className="relative">
                  <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {team.logoUrl ? (
                      <Image
                        source={{ uri: team.logoUrl }}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Text className="text-xs font-bold text-muted-foreground">
                        {team.name.slice(0, 2)}
                      </Text>
                    )}
                  </View>
                  {selected && (
                    <View className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <Check color={colors.primaryForeground} size={12} />
                    </View>
                  )}
                </View>
                <Text
                  className="text-center text-xs text-foreground"
                  numberOfLines={1}
                >
                  {team.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Bottom save button */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-6 pb-8 pt-4">
        <Button
          size="lg"
          onPress={handleSave}
          disabled={saving || selectedTeams.size < 2}
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </View>
    </SafeAreaView>
  );
}

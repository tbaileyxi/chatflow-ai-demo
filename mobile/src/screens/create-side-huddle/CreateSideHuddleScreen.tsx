import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  Image,
  ScrollView,
  Share,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Check, Lock, Search, Radio } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DEV_ROOMS_STORAGE_KEY,
  DEV_TEAMS,
  normalizeLeague,
} from "@/config/devData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/types";

type Route = RouteProp<RootStackParamList, "CreateSideHuddle">;

type Team = {
  id: string;
  name: string;
  city: string;
  logoUrl: string | null;
  league: string;
};

const LEAGUES = ["NFL", "NBA", "NHL", "NCAAF", "MLB"] as const;

function useTeamsList() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["teams-list", user?.app_metadata?.provider],
    queryFn: async (): Promise<Team[]> => {
      if (user?.app_metadata?.provider === "dev_test") {
        return DEV_TEAMS;
      }

      const { data, error } = await supabase
        .from("teams")
        .select("id, name, city, logo_url, league")
        .eq("status", "active")
        .order("name");
      if (error || !data || data.length === 0) return DEV_TEAMS;
      return data.map((t) => ({
        id: t.id,
        name: t.name,
        city: t.city,
        logoUrl: t.logo_url,
        league: normalizeLeague(t.league),
      }));
    },
  });
}

async function backfillTeamContent(newHuddleId: string, teamId: string) {
  try {
    // Find the official team huddle
    const { data: officialHuddle } = await supabase
      .from("huddles")
      .select("id")
      .eq("team_id", teamId)
      .eq("is_official_team_huddle", true)
      .maybeSingle();

    if (!officialHuddle) return;

    // Get last 24h of bot messages from official huddle
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: botMessages } = await supabase
      .from("huddle_messages")
      .select("user_id, content, media_url, media_type, message_type, is_bot_message, is_team_agent_message, created_at")
      .eq("huddle_id", officialHuddle.id)
      .eq("is_bot_message", true)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(20);

    if (!botMessages || botMessages.length === 0) return;

    // Copy messages into the new huddle
    const inserts = botMessages.map((m) => ({
      huddle_id: newHuddleId,
      user_id: m.user_id,
      content: m.content,
      media_url: m.media_url,
      media_type: m.media_type,
      message_type: m.message_type,
      is_bot_message: true,
      is_team_agent_message: m.is_team_agent_message ?? false,
      created_at: m.created_at,
    }));

    await supabase.from("huddle_messages").insert(inserts);
  } catch (err) {
    // Non-critical — don't block huddle creation if backfill fails
    console.warn("Backfill failed:", err);
  }
}

export function CreateSideHuddleScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: teams } = useTeamsList();
  const [name, setName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    route.params?.teamId ?? null,
  );
  const [filterLeague, setFilterLeague] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = teams?.filter((t) => {
    if (filterLeague && t.league.toUpperCase() !== filterLeague) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (
        !t.name.toLowerCase().includes(q) &&
        !t.city.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const handleCreate = async () => {
    if (!user || !name.trim() || !selectedTeamId) return;

    setCreating(true);
    try {
      if (user.app_metadata?.provider === "dev_test") {
        const selectedTeam = teams?.find((t) => t.id === selectedTeamId);
        const roomId = `dev-room-${Date.now()}`;
        const stored = await AsyncStorage.getItem(DEV_ROOMS_STORAGE_KEY);
        const existingRooms = stored ? JSON.parse(stored) : [];
        await AsyncStorage.setItem(
          DEV_ROOMS_STORAGE_KEY,
          JSON.stringify([
            {
              id: roomId,
              name: name.trim(),
              teamId: selectedTeamId,
              teamName: selectedTeam?.name ?? null,
              teamCity: selectedTeam?.city ?? null,
              teamLogoUrl: selectedTeam?.logoUrl ?? null,
              relationship: "owner",
              accessMode: "link",
              memberCount: 1,
              createdAt: new Date().toISOString(),
            },
            ...existingRooms,
          ]),
        );

        queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
        queryClient.invalidateQueries({ queryKey: ["game-night-communities"] });
        navigation.navigate("MainTabs" as any);
        return;
      }

      const { data, error } = await supabase
        .from("huddles")
        .insert({
          name: name.trim(),
          owner_id: user.id,
          team_id: selectedTeamId,
          is_private: false,
          is_official_team_huddle: false,
          is_verified: false,
          member_count: 1,
        })
        .select("id")
        .single();

      if (error) {
        Alert.alert("Error", "Failed to create crew room.");
        return;
      }

      // Add creator as member
      await supabase.from("huddle_members").insert({
        huddle_id: data.id,
        user_id: user.id,
      });

      // Backfill last 24h of bot content from the official team huddle
      await backfillTeamContent(data.id, selectedTeamId);

      queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
      queryClient.invalidateQueries({ queryKey: ["game-night-communities"] });

      // Offer to share invite link
      const inviteLink = `sidehuddle://join-huddle/${data.id}`;
      Alert.alert(
        "Crew Room Created!",
        "Invite your friends to join.",
        [
          {
            text: "Share Invite",
            onPress: () => {
              Share.share({
                message: `Join my crew room "${name.trim()}" on Side Huddle Sports! ${inviteLink}`,
                url: inviteLink,
              }).finally(() => {
                navigation.reset({
                  index: 1,
                  routes: [
                    { name: "MainTabs" as any },
                    { name: "Huddle" as any, params: { huddleId: data.id } },
                  ],
                });
              });
            },
          },
          {
            text: "Skip",
            style: "cancel",
            onPress: () => {
              navigation.reset({
                index: 1,
                routes: [
                  { name: "MainTabs" as any },
                  { name: "Huddle" as any, params: { huddleId: data.id } },
                ],
              });
            },
          },
        ],
      );
    } catch {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setCreating(false);
    }
  };

  const selectedTeam = teams?.find((t) => t.id === selectedTeamId);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft color={colors.foreground} size={24} />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-foreground">
          Start Crew Room
        </Text>
      </View>

      <View className="flex-1">
        <View className="px-4">
          {selectedTeam && (
            <View className="mb-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
              <View className="flex-row items-center gap-2">
                <Radio color={colors.primary} size={16} />
                <Text className="text-sm font-bold text-foreground">
                  {selectedTeam.city} {selectedTeam.name}
                </Text>
              </View>
              <Text className="mt-1 text-xs leading-5 text-muted-foreground">
                This room will stay attached to this team, so the team bot can
                bring game context, highlights, and prediction prompts when
                they play.
              </Text>
            </View>
          )}

          {/* Name input */}
          <Text className="text-sm font-medium text-foreground">
            Crew Room Name
          </Text>
          <View className="mt-2">
            <Input
              placeholder={
                selectedTeam
                  ? `e.g. ${selectedTeam.name} Game Crew`
                  : "e.g. Game Day Crew"
              }
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={50}
            />
          </View>
          <View className="mt-1 flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Lock color={colors.mutedForeground} size={12} />
              <Text className="text-xs text-muted-foreground">
                Hidden room. Anyone with your link can enter.
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              {name.length}/50
            </Text>
          </View>

          {/* Team picker */}
          <Text className="mt-5 text-sm font-medium text-foreground">
            Attach to a team
          </Text>
          <Text className="mt-1 text-xs text-muted-foreground">
            Your crew room will wake up when this team has a game.
            {selectedTeam
              ? ` Selected: ${selectedTeam.city} ${selectedTeam.name}`
              : ""}
          </Text>

          {/* Team search */}
          <View className="mt-3 flex-row items-center gap-2 rounded-lg border border-input bg-muted px-3">
            <Search color={colors.mutedForeground} size={16} />
            <Input
              placeholder="Search teams..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 border-0 bg-transparent px-0"
            />
          </View>
        </View>

        {/* League filter */}
        <View style={{ paddingVertical: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
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
            {LEAGUES.map((l) => (
              <Pressable
                key={l}
                className={cn(
                  "rounded-full px-4 py-2",
                  filterLeague === l
                    ? "bg-primary"
                    : "border border-border bg-transparent",
                )}
                onPress={() => setFilterLeague(filterLeague === l ? null : l)}
              >
                <Text
                  className={cn(
                    "text-sm font-medium",
                    filterLeague === l
                      ? "text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {l}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Team grid */}
        <ScrollView
          contentContainerStyle={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 120,
          }}
        >
          {filtered?.map((team) => {
            const selected = team.id === selectedTeamId;
            return (
              <Pressable
                key={team.id}
                className={cn(
                  "w-[22%] items-center gap-1 rounded-xl border p-2 active:opacity-80",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card",
                )}
                onPress={() => setSelectedTeamId(selected ? null : team.id)}
              >
                <View className="relative">
                  <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
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
                    <View className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-primary">
                      <Check color={colors.primaryForeground} size={10} />
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
      </View>

      {/* Bottom CTA */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-4 pb-8 pt-4">
        <Button
          size="lg"
          onPress={handleCreate}
          disabled={creating || !name.trim() || !selectedTeamId}
        >
          {creating ? "Creating..." : "Create Crew Room"}
        </Button>
      </View>
    </SafeAreaView>
  );
}

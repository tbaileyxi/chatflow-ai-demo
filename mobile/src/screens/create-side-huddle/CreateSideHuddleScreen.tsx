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
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Check, Lock, Search } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { colors } from "@/theme/colors";

type Team = {
  id: string;
  name: string;
  city: string;
  logoUrl: string | null;
  league: string;
};

const LEAGUES = ["NFL", "NBA", "NHL", "NCAAF", "MLB"] as const;

function useTeamsList() {
  return useQuery({
    queryKey: ["teams-list"],
    queryFn: async (): Promise<Team[]> => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, city, logo_url, league")
        .eq("status", "active")
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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: teams } = useTeamsList();
  const [name, setName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
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
      const { data, error } = await supabase
        .from("huddles")
        .insert({
          name: name.trim(),
          owner_id: user.id,
          team_id: selectedTeamId,
          is_private: true,
          is_official_team_huddle: false,
          is_verified: false,
          member_count: 1,
        })
        .select("id")
        .single();

      if (error) {
        Alert.alert("Error", "Failed to create Side Huddle.");
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

      // Offer to share invite link
      const inviteLink = `sidehuddle://join-huddle/${data.id}`;
      Alert.alert(
        "Side Huddle Created!",
        "Invite your friends to join.",
        [
          {
            text: "Share Invite Link",
            onPress: () => {
              Share.share({
                message: `Join my Side Huddle "${name.trim()}" on Side Huddle Sports! ${inviteLink}`,
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
          Create Side Huddle
        </Text>
      </View>

      <View className="flex-1">
        <View className="px-4">
          {/* Name input */}
          <Text className="text-sm font-medium text-foreground">
            Side Huddle Name
          </Text>
          <View className="mt-2">
            <Input
              placeholder="e.g. Game Day Crew"
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
                Side Huddles are private and invite-only
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              {name.length}/50
            </Text>
          </View>

          {/* Team picker */}
          <Text className="mt-5 text-sm font-medium text-foreground">
            Pick a team
          </Text>
          <Text className="mt-1 text-xs text-muted-foreground">
            Your Side Huddle will get content from this team.
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
          {creating ? "Creating..." : "Create Side Huddle"}
        </Button>
      </View>
    </SafeAreaView>
  );
}

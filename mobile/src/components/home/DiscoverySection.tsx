import { useState } from "react";
import { View, Text, Pressable, Image, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Compass } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { colors } from "@/theme/colors";
import {
  useActiveHuddles,
  useDiscoveryTeams,
  LEAGUES,
  type League,
} from "@/hooks/useDiscovery";

export function DiscoverySection() {
  const navigation = useNavigation();

  return (
    <View className="gap-6">
      <ActiveHuddlesBlock
        onPress={(id) => navigation.navigate("Huddle", { huddleId: id })}
      />
      <TeamsBlock
        onHuddlePress={(id) => navigation.navigate("Huddle", { huddleId: id })}
        // TeamFeed is gone. Tapping a team on Home now starts a room for it —
        // which is the only thing you could usefully do with a team anyway now
        // that a team's content lives in its room rather than a separate feed.
        onTeamPress={(id) =>
          navigation.navigate("CreateSideHuddle", { teamId: id })
        }
      />
    </View>
  );
}

function ActiveHuddlesBlock({ onPress }: { onPress: (id: string) => void }) {
  const { data: huddles, isLoading } = useActiveHuddles();

  if (isLoading) {
    return (
      <View className="gap-3">
        <Text className="text-lg font-bold text-foreground">
          Drop Into a Huddle
        </Text>
        <View className="flex-row gap-3">
          <Skeleton className="h-24 flex-1" />
          <Skeleton className="h-24 flex-1" />
        </View>
      </View>
    );
  }

  if (!huddles || huddles.length === 0) return null;

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <Compass color={colors.primary} size={20} />
        <Text className="text-lg font-bold text-foreground">
          Drop Into a Huddle
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-3">
        {huddles.map((h) => (
          <Pressable
            key={h.id}
            className="w-[48%] items-center gap-2 rounded-lg border border-border bg-card p-3 active:opacity-80"
            onPress={() => onPress(h.id)}
          >
            <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
              {h.teamLogoUrl ? (
                <Image
                  source={{ uri: h.teamLogoUrl }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-sm font-bold text-muted-foreground">
                  {(h.teamName ?? h.name).charAt(0)}
                </Text>
              )}
            </View>
            <Text
              className="text-center text-sm font-medium text-foreground"
              numberOfLines={1}
            >
              {h.teamName ?? h.name}
            </Text>
            <View className="flex-row items-center gap-1">
              <View className="h-2 w-2 rounded-full bg-success" />
              <Text className="text-xs text-muted-foreground">Active now</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TeamsBlock({
  onHuddlePress,
  onTeamPress,
}: {
  onHuddlePress: (id: string) => void;
  onTeamPress: (id: string) => void;
}) {
  const [selectedLeague, setSelectedLeague] = useState<League | "All">("All");
  const { data: teams, isLoading } = useDiscoveryTeams();

  const filtered =
    selectedLeague === "All"
      ? teams
      : teams?.filter(
          (t) => t.league.toUpperCase() === selectedLeague.toUpperCase(),
        );

  return (
    <View className="gap-3">
      <Text className="text-lg font-bold text-foreground">Follow a Team</Text>

      {/* League tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {(["All", ...LEAGUES] as const).map((league) => (
            <Pressable
              key={league}
              className={cn(
                "rounded-full px-4 py-1.5",
                selectedLeague === league
                  ? "bg-primary"
                  : "border border-border bg-transparent",
              )}
              onPress={() => setSelectedLeague(league)}
            >
              <Text
                className={cn(
                  "text-sm font-medium",
                  selectedLeague === league
                    ? "text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {league}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {isLoading ? (
        <View className="flex-row flex-wrap gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-16 rounded-full" />
          ))}
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-3">
          {filtered?.map((t) => (
            <Pressable
              key={t.id}
              className="items-center gap-1 active:opacity-80"
              onPress={() =>
                t.huddleId ? onHuddlePress(t.huddleId) : onTeamPress(t.id)
              }
            >
              <View
                className={cn(
                  "h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-muted",
                  t.isActive && "border-2 border-success",
                )}
              >
                {t.logoUrl ? (
                  <Image
                    source={{ uri: t.logoUrl }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Text className="text-xs font-bold text-muted-foreground">
                    {t.name.slice(0, 2)}
                  </Text>
                )}
              </View>
              <Text
                className="w-16 text-center text-xs text-muted-foreground"
                numberOfLines={1}
              >
                {t.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

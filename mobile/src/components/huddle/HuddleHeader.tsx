import { View, Text, Image, Pressable, Share } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft, Users, Lock, Settings, UserPlus } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";
import { useAuth } from "@/hooks/useAuth";
import {
  useLiveGameContext,
  getGameState,
  formatGameClock,
} from "@/hooks/useLiveGameContext";
import type { HuddleDetails } from "@/hooks/useHuddleDetails";

type Props = {
  huddle: HuddleDetails;
};

export function HuddleHeader({ huddle }: Props) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { data: game } = useLiveGameContext(huddle.teamId);

  const displayName = huddle.isOfficialTeam
    ? huddle.teamName ?? huddle.name
    : huddle.name;

  const gameState = getGameState(game ?? null);

  return (
    <View className="border-b border-border bg-background">
      {/* Main header row */}
      <View className="flex-row items-center gap-3 px-4 py-3">
        {/* Back */}
        <Pressable
          onPress={() => navigation.goBack()}
          className="active:opacity-60"
          hitSlop={8}
        >
          <ChevronLeft color={colors.foreground} size={24} />
        </Pressable>

        {/* Team logo */}
        <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-muted">
          {huddle.teamLogoUrl ? (
            <Image
              source={{ uri: huddle.teamLogoUrl }}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            <Text className="text-sm font-bold text-muted-foreground">
              {displayName.charAt(0)}
            </Text>
          )}
        </View>

        {/* Name + info */}
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
            {displayName}
          </Text>
          <View className="flex-row items-center gap-2">
            <Lock color={colors.mutedForeground} size={12} />
            <View className="flex-row items-center gap-1">
              <Users color={colors.mutedForeground} size={12} />
              <Text className="text-xs text-muted-foreground">
                {huddle.memberCount}
              </Text>
            </View>
          </View>
        </View>

        {/* Invite + Settings */}
        {user && huddle.isMember && (
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => {
                const inviteLink = `sidehuddle://join-huddle/${huddle.id}`;
                Share.share({
                  message: `Join my Side Huddle "${huddle.name}" on Side Huddle Sports! ${inviteLink}`,
                  url: inviteLink,
                });
              }}
              className="active:opacity-60"
              hitSlop={8}
            >
              <UserPlus color={colors.primary} size={20} />
            </Pressable>
            <Pressable
              onPress={() =>
                navigation.navigate("HuddleSettings", { huddleId: huddle.id })
              }
              className="active:opacity-60"
              hitSlop={8}
            >
              <Settings color={colors.mutedForeground} size={20} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Live game context bar */}
      {game && gameState !== "none" && (
        <View
          className={cn(
            "flex-row items-center justify-between px-4 py-2",
            gameState === "live"
              ? "bg-success/10"
              : gameState === "postgame"
                ? "bg-muted/50"
                : "bg-primary/5",
          )}
        >
          {/* Game state label */}
          <View className="flex-row items-center gap-1.5">
            {gameState === "live" && (
              <View className="h-2 w-2 rounded-full bg-success" />
            )}
            <Text
              className={cn(
                "text-xs font-bold uppercase",
                gameState === "live"
                  ? "text-success"
                  : gameState === "postgame"
                    ? "text-muted-foreground"
                    : "text-primary",
              )}
            >
              {gameState === "live"
                ? "Live"
                : gameState === "postgame"
                  ? "Final"
                  : "Pregame"}
            </Text>
          </View>

          {/* Matchup + score */}
          <View className="flex-1 flex-row items-center justify-center gap-2">
            <Text className="text-xs font-semibold text-foreground">
              {game.awayTeamName ?? "Away"}
            </Text>
            {(gameState === "live" || gameState === "postgame") &&
            game.awayScore != null &&
            game.homeScore != null ? (
              <Text className="text-sm font-bold text-foreground">
                {game.awayScore} - {game.homeScore}
              </Text>
            ) : (
              <Text className="text-xs text-muted-foreground">vs</Text>
            )}
            <Text className="text-xs font-semibold text-foreground">
              {game.homeTeamName ?? "Home"}
            </Text>
          </View>

          {/* Clock / countdown */}
          <Text className="text-xs text-muted-foreground">
            {formatGameClock(game)}
          </Text>
        </View>
      )}
    </View>
  );
}

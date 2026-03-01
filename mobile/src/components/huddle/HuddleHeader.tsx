import { useEffect, useRef } from "react";
import { View, Text, Image, Pressable, Share, Animated } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  ChevronLeft,
  Users,
  Lock,
  Settings,
  UserPlus,
  BookOpen,
} from "lucide-react-native";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";
import { useAuth } from "@/hooks/useAuth";
import {
  useLiveGameContext,
  getGameState,
  formatGameClock,
  type GameContext,
  type GameState,
} from "@/hooks/useLiveGameContext";
import { useTeamMarkets } from "@/hooks/useTeamMarkets";
import type { HuddleDetails } from "@/hooks/useHuddleDetails";

type Props = {
  huddle: HuddleDetails;
};

function PulsingDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" }}
    />
  );
}

function formatStartTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatNextGameDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const gameDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((gameDay.getTime() - today.getTime()) / 86400000);

  const time = formatStartTime(dateStr);
  if (diffDays === 0) return `Today at ${time}`;
  if (diffDays === 1) return `Tomorrow at ${time}`;
  const dayStr = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${dayStr} at ${time}`;
}

function GameBar({
  game,
  gameState,
  topOdds,
}: {
  game: GameContext;
  gameState: GameState;
  topOdds: string | null;
}) {
  if (gameState === "live") {
    return (
      <View className="bg-destructive/10 px-4 py-2.5">
        {/* LIVE label */}
        <View className="flex-row items-center gap-2 mb-1">
          <PulsingDot />
          <Text className="text-xs font-black uppercase tracking-widest text-destructive">
            LIVE
          </Text>
          <Text className="text-xs text-muted-foreground">
            {game.period ? `${game.period}` : ""}{game.clock ? ` — ${game.clock}` : ""}
          </Text>
        </View>
        {/* Score */}
        <View className="flex-row items-center justify-center gap-4">
          <View className="flex-1 items-end">
            <Text className="text-sm font-bold text-foreground">
              {game.awayTeamCity} {game.awayTeamName}
            </Text>
          </View>
          <Text className="text-xl font-black text-foreground">
            {game.awayScore ?? 0} — {game.homeScore ?? 0}
          </Text>
          <View className="flex-1 items-start">
            <Text className="text-sm font-bold text-foreground">
              {game.homeTeamCity} {game.homeTeamName}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (gameState === "postgame") {
    return (
      <View className="bg-muted/50 px-4 py-2.5">
        <View className="flex-row items-center gap-2 mb-1">
          <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            FINAL
          </Text>
        </View>
        <View className="flex-row items-center justify-center gap-4">
          <View className="flex-1 items-end">
            <Text className="text-sm font-bold text-foreground">
              {game.awayTeamCity} {game.awayTeamName}
            </Text>
          </View>
          <Text className="text-xl font-black text-foreground">
            {game.awayScore ?? 0} — {game.homeScore ?? 0}
          </Text>
          <View className="flex-1 items-start">
            <Text className="text-sm font-bold text-foreground">
              {game.homeTeamCity} {game.homeTeamName}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Pregame
  return (
    <View className="bg-primary/5 px-4 py-2.5">
      <View className="flex-row items-center gap-2 mb-1">
        <Text className="text-xs font-bold uppercase tracking-wider text-primary">
          PREGAME
        </Text>
        <Text className="text-xs text-muted-foreground">
          {formatNextGameDate(game.startTime)}
        </Text>
      </View>
      <View className="flex-row items-center justify-center gap-3">
        <Text className="text-sm font-semibold text-foreground">
          {game.awayTeamName ?? "Away"}
        </Text>
        <Text className="text-xs text-muted-foreground">@</Text>
        <Text className="text-sm font-semibold text-foreground">
          {game.homeTeamName ?? "Home"}
        </Text>
      </View>
      {topOdds && (
        <Text className="mt-1 text-center text-xs text-muted-foreground">
          {topOdds}
        </Text>
      )}
    </View>
  );
}

export function HuddleHeader({ huddle }: Props) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { data: game } = useLiveGameContext(huddle.teamId);
  const { data: markets } = useTeamMarkets(huddle.teamId);

  const displayName = huddle.isOfficialTeam
    ? huddle.teamName ?? huddle.name
    : huddle.name;

  const gameState = getGameState(game ?? null);

  // Top Kalshi odds for pregame display
  const topOdds =
    markets && markets.length > 0
      ? `${markets[0].question} — YES ${markets[0].current_yes_price}¢`
      : null;

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

        {/* Ledger + Invite + Settings */}
        {user && huddle.isMember && (
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => navigation.navigate("Ledger" as any)}
              className="active:opacity-60"
              hitSlop={8}
            >
              <BookOpen color={colors.primary} size={20} />
            </Pressable>
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

      {/* Game day bar */}
      {game && gameState !== "none" && (
        <GameBar game={game} gameState={gameState} topOdds={topOdds} />
      )}

      {/* No game — show next scheduled */}
      {!game && huddle.teamId && (
        <View className="bg-muted/30 px-4 py-2">
          <Text className="text-center text-xs text-muted-foreground">
            No game scheduled — check back on game day
          </Text>
        </View>
      )}
    </View>
  );
}

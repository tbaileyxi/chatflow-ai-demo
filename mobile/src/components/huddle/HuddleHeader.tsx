import { useEffect, useRef } from "react";
import { View, Text, Image, Pressable, Animated } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  ChevronLeft,
  Users,
  MoreVertical,
  ShieldCheck,
} from "lucide-react-native";
import { colors } from "@/theme/colors";
import {
  useLiveGameContext,
  getGameState,
  type GameContext,
  type GameState,
} from "@/hooks/useLiveGameContext";
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
}: {
  game: GameContext;
  gameState: GameState;
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
    </View>
  );
}

export function HuddleHeader({ huddle }: Props) {
  const navigation = useNavigation();
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
        <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-muted">
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
        <Pressable
          className="flex-1 gap-0.5"
          onPress={() =>
            navigation.navigate("HuddleSettings", { huddleId: huddle.id })
          }
        >
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-lg font-black text-foreground" numberOfLines={1}>
              {displayName}
            </Text>
            {huddle.isVerified ? (
              <ShieldCheck color={colors.primary} size={15} />
            ) : null}
          </View>
          <View className="flex-row items-center gap-1">
            <Users color={colors.mutedForeground} size={12} />
            <Text className="text-xs text-muted-foreground">
              {huddle.memberCount} member{huddle.memberCount === 1 ? "" : "s"}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() =>
            navigation.navigate("HuddleSettings", { huddleId: huddle.id })
          }
          className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
          hitSlop={8}
        >
          <MoreVertical color={colors.mutedForeground} size={22} />
        </Pressable>
      </View>

      {/* Game day bar */}
      {game && gameState !== "none" && (
        <GameBar game={game} gameState={gameState} />
      )}
    </View>
  );
}

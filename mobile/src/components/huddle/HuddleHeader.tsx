import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable, Animated, Linking } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  ChevronLeft,
  Users,
  MoreVertical,
  ShieldCheck,
  ExternalLink,
  UserPlus,
} from "lucide-react-native";
import { colors } from "@/theme/colors";
import {
  useLiveGameContext,
  getGameState,
  type GameContext,
  type GameState,
} from "@/hooks/useLiveGameContext";
import { useTeamSponsors, logSponsorTap } from "@/hooks/useTeamSponsor";
import { useAuth } from "@/hooks/useAuth";
import type { HuddleDetails } from "@/hooks/useHuddleDetails";

type Props = {
  huddle: HuddleDetails;
  onInvite?: () => void;
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

// One compact, centered strip for all game states — no full-row labels,
// no left-aligned score. Time/status rides as small text under the line.
function GameBar({
  game,
  gameState,
}: {
  game: GameContext;
  gameState: GameState;
}) {
  if (gameState === "live") {
    return (
      <View className="items-center bg-destructive/10 px-4 py-1.5">
        <View className="flex-row items-center gap-2">
          <PulsingDot />
          <Text className="text-sm font-bold text-foreground">
            {sides(game).away}{" "}
            <Text className="font-black">{game.awayScore ?? 0}</Text>
            <Text className="text-muted-foreground">  —  </Text>
            {sides(game).home}{" "}
            <Text className="font-black">{game.homeScore ?? 0}</Text>
          </Text>
        </View>
        <Text className="text-[11px] text-muted-foreground">
          {[game.period, game.clock].filter(Boolean).join(" · ") || "Live"}
        </Text>
      </View>
    );
  }

  if (gameState === "postgame") {
    return (
      <View className="items-center bg-muted/40 px-4 py-1.5">
        <Text className="text-sm font-bold text-foreground">
          {sides(game).away}{" "}
          <Text className="font-black">{game.awayScore ?? 0}</Text>
          <Text className="text-muted-foreground">  —  </Text>
          {sides(game).home}{" "}
          <Text className="font-black">{game.homeScore ?? 0}</Text>
        </Text>
        <Text className="text-[11px] text-muted-foreground">Final</Text>
      </View>
    );
  }

  // Pregame
  return (
    <View className="items-center bg-primary/5 px-4 py-1.5">
      <Text className="text-sm font-semibold text-foreground">
        {sides(game).away}
        <Text className="text-muted-foreground">  @  </Text>
        {sides(game).home}
      </Text>
      <Text className="text-[11px] text-muted-foreground">
        {formatNextGameDate(game.startTime)}
      </Text>
    </View>
  );
}


/**
 * "Tigers at Tigers" is a correct scoreboard and a broken-looking one.
 *
 * Clemson at LSU are both Tigers, Georgia and Mississippi State are both
 * Bulldogs, and a nickname alone stops identifying anybody the moment two of
 * them meet. The school disambiguates and is shorter, so it wins whenever the
 * two nicknames collide — otherwise the nickname stays, because "Bengals at
 * Browns" reads better than "Cincinnati at Cleveland".
 */
function sides(game: {
  awayTeamName: string | null; homeTeamName: string | null;
  awayTeamCity: string | null; homeTeamCity: string | null;
}): { away: string; home: string } {
  const an = game.awayTeamName ?? "";
  const hn = game.homeTeamName ?? "";
  const clash = !!an && an.toLowerCase() === hn.toLowerCase();
  return {
    away: (clash ? game.awayTeamCity : null) ?? an ?? "Away",
    home: (clash ? game.homeTeamCity : null) ?? hn ?? "Home",
  };
}

export function HuddleHeader({ huddle, onInvite }: Props) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { data: game } = useLiveGameContext(huddle.teamId);
  const { data: sponsors } = useTeamSponsors(huddle.teamId);

  // A stadium board does not sit there being read. It drops, holds, and goes
  // back up, and the drop is the moment anybody actually sees it.
  //
  // So: a thin permanent line, and every so often it swells down over the score
  // for three seconds with the sponsor's full line, then retracts. Over the
  // score deliberately — that is the one place on this screen guaranteed to
  // have the eye — but briefly, and never while a play is landing.
  const [slot, setSlot] = useState(0);
  const drop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!sponsors || sponsors.length === 0) return;

    let cancelled = false;
    const advances: ReturnType<typeof setTimeout>[] = [];

    const cycle = () => {
      if (cancelled) return;

      // Purely visual, and often driving nothing: the board is only mounted
      // when there is a game bar to drop over.
      Animated.sequence([
        Animated.timing(drop, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(drop, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start();

      // Advance on our own clock, NOT off the animation's completion callback.
      // Hanging it off the callback froze every gameless room on sponsor one —
      // no game means no mounted board, so nothing ever reported finished and
      // the slot never moved. Slots 2-6 were paid for and never named, in the
      // rooms that outnumber game days. Still timed to land while the board is
      // retracted, so the next name arrives fresh rather than swapping in
      // front of the reader.
      advances.push(
        setTimeout(() => {
          if (!cancelled) setSlot((n) => (n + 1) % sponsors.length);
        }, 3800),
      );
    };

    // Not immediately on open: the first thing in a room should be the room.
    const first = setTimeout(cycle, 8000);
    const every = setInterval(cycle, 45000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(every);
      advances.forEach(clearTimeout);
    };
  }, [sponsors?.length, drop]);

  const sponsor = sponsors?.[slot % Math.max(sponsors.length || 1, 1)] ?? null;

  const displayName = huddle.isOfficialTeam
    ? huddle.teamName ?? huddle.name
    : huddle.name;

  const gameState = getGameState(game ?? null);

  const handleSponsorTap = () => {
    if (!sponsor) return;
    logSponsorTap({
      sponsorId: sponsor.id,
      huddleId: huddle.id,
      userId: user?.id ?? null,
    });
    Linking.openURL(sponsor.linkUrl).catch(() => {});
  };

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
          {/* Member count sits INLINE with the name, not on its own line. A
              whole row of header height to say "1 member" is the least
              interesting fact in the room, and it pushed the game bar and the
              chat down on every screen. */}
          <View className="flex-row items-center gap-2">
            <Text className="shrink text-lg font-black text-foreground" numberOfLines={1}>
              {displayName}
            </Text>
            {huddle.isVerified ? (
              <ShieldCheck color={colors.primary} size={15} />
            ) : null}
            <View className="flex-row items-center gap-0.5">
              <Users color={colors.mutedForeground} size={11} />
              <Text className="text-xs text-muted-foreground">{huddle.memberCount}</Text>
            </View>
            {/* The Coach pill was here. Removed: it sat inside the Pressable
                that opens settings, so tapping the one thing that looked like
                a person opened a settings screen — and it ate enough width to
                truncate the room's own name. The Coach announces itself by
                answering; it does not need furniture that misfires. */}
          </View>
        </Pressable>

        {/* Invite — primary action, always one tap from the header. */}
        {onInvite ? (
          <Pressable
            onPress={onInvite}
            className="h-10 w-10 items-center justify-center rounded-full bg-primary active:opacity-80"
            hitSlop={8}
          >
            <UserPlus color={colors.primaryForeground} size={18} />
          </Pressable>
        ) : null}

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

      {/* Sponsor whisper line — only when a real sponsor is attached.
          No placeholder: empty slots stay invisible. */}
      {sponsor ? (
        <Pressable
          onPress={handleSponsorTap}
          className="flex-row items-center justify-center gap-2 border-t border-border bg-muted/40 px-4 py-1"
          hitSlop={4}
        >
          <Text className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {sponsor.brandName} supports this room
          </Text>
          <ExternalLink color={colors.mutedForeground} size={10} />
          {/* Which of the six is showing. Dots rather than "3 of 6" because the
              strip is furniture, not a control — and a sponsor who paid should
              see that others exist without it being announced. */}
          {sponsors && sponsors.length > 1 ? (
            <View className="ml-1 flex-row items-center gap-1">
              {sponsors.map((sp, i) => (
                <View
                  key={sp.id}
                  className={`h-1 w-1 rounded-full ${
                    i === slot % sponsors.length ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {/* Game day bar, with the sponsor board dropping over it. */}
      {game && gameState !== "none" && (
        <View className="overflow-hidden">
          <GameBar game={game} gameState={gameState} />
          {sponsor ? (
            <Animated.View
              pointerEvents="none"
              className="absolute inset-0 items-center justify-center bg-primary"
              style={{
                transform: [
                  {
                    translateY: drop.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-120, 0],
                    }),
                  },
                ],
              }}
            >
              {/* The line that says what this actually is. A local business is
                  not buying an advert next to a fanbase — it is backing the
                  people in the room, and that is the sentence that makes a bar
                  owner say yes. */}
              <Text className="text-sm font-black text-primary-foreground">
                {sponsor.brandName}
              </Text>
              <Text className="text-[11px] font-bold text-primary-foreground/80">
                supports {huddle.teamName ?? "these"} fans
              </Text>
            </Animated.View>
          ) : null}
        </View>
      )}
    </View>
  );
}

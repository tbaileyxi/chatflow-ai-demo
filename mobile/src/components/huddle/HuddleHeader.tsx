import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable, Animated, Linking } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  ChevronLeft,
  MoreVertical,
  ShieldCheck,
} from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/type";
import { teamAbbr } from "@/lib/teamName";
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
      style={{ opacity, width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" }}
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
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Tomorrow ${time}`;
  // Weekday alone past tomorrow, and the date only once it is more than a
  // week out. "Sun, Sep 20 4:25 PM" does not fit the header pill next to a
  // room name and clipped to "Sun, Se…", which reads as a bug rather than a
  // date. Inside a week, the weekday is the only part anybody uses.
  const dayStr =
    diffDays < 7
      ? date.toLocaleDateString("en-US", { weekday: "short" })
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${dayStr} ${time}`;
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

/**
 * The game, as ONE line under the room's name.
 *
 * It used to be a full-width bar of its own, stacked under a sponsor strip,
 * stacked under the header row — three bands of chrome before a single message.
 * The score matters, but it is context for the conversation, not the subject of
 * the screen, and it does not deserve its own storey.
 */
function ScoreLine({ game, gameState }: { game: GameContext; gameState: GameState }) {
  const { away, home } = sides(game);

  if (gameState === "live") {
    return (
      <View className="mt-0.5 flex-row items-center gap-1.5">
        <PulsingDot />
        <Type variant="data" numberOfLines={1} style={{ fontSize: 14, flexShrink: 1 }}>
          {teamAbbr(away)}{" "}
          <Type variant="data" style={{ fontSize: 19, fontFamily: fonts.monoMedium }}>
            {game.awayScore ?? 0}
          </Type>
          <Type variant="data" tone="tertiary" style={{ fontSize: 14 }}>{"  ·  "}</Type>
          {teamAbbr(home)}{" "}
          <Type variant="data" style={{ fontSize: 19, fontFamily: fonts.monoMedium }}>
            {game.homeScore ?? 0}
          </Type>
        </Type>
        <Type
          variant="data"
          tone="primary"
          numberOfLines={1}
          style={{ fontSize: 13, flexShrink: 0, marginLeft: "auto" }}
        >
          {[game.period, game.clock].filter(Boolean).join(" ") || "LIVE"}
        </Type>
      </View>
    );
  }

  if (gameState === "postgame") {
    return (
      <Type variant="caption" tone="muted" className="mt-0.5" numberOfLines={1}>
        {away} <Type variant="dataStrong">{game.awayScore ?? 0}</Type>
        {" · "}
        {home} <Type variant="dataStrong">{game.homeScore ?? 0}</Type>
        <Type variant="dataStrong" tone="success"> FINAL</Type>
      </Type>
    );
  }

  // Caption, not data. Live state is numbers and belongs in mono; this line is
  // two team names and a date, and mono made it wide enough to clip mid-date
  // in the header pill — "Sun, Se…".
  return (
    <Type variant="caption" tone="muted" className="mt-0.5" numberOfLines={1}>
      {away} at {home} · {formatNextGameDate(game.startTime)}
    </Type>
  );
}

export function HuddleHeader({ huddle, onInvite }: Props) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { data: game } = useLiveGameContext(huddle.teamId);
  const { data: sponsors } = useTeamSponsors(huddle.teamId);

  // A stadium board does not sit there being read. It drops, holds, and goes
  // back up, and the drop is the moment anybody actually sees it.
  const [slot, setSlot] = useState(0);
  const drop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!sponsors || sponsors.length === 0) return;

    let cancelled = false;
    const advances: ReturnType<typeof setTimeout>[] = [];

    const cycle = () => {
      if (cancelled) return;

      Animated.sequence([
        Animated.timing(drop, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(drop, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start();

      // Advance on our own clock, NOT off the animation's completion callback.
      // Hanging it off the callback froze every gameless room on sponsor one —
      // no game means no mounted board, so nothing ever reported finished and
      // the slot never moved. Slots 2-6 were paid for and never named, in the
      // rooms that outnumber game days.
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
  const hasGame = !!game && gameState !== "none";

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
    <View className="border-b border-border" style={{ backgroundColor: colors.huddleGroundAlt }}>
      <View className="flex-row items-center gap-3 px-4 py-2.5">
        <Pressable
          onPress={() => navigation.goBack()}
          className="active:opacity-60"
          hitSlop={8}
        >
          <ChevronLeft color={colors.foreground} size={24} />
        </Pressable>

        <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {huddle.teamLogoUrl ? (
            <Image
              source={{ uri: huddle.teamLogoUrl }}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            <Type variant="captionStrong" tone="muted">
              {displayName.charAt(0)}
            </Type>
          )}
        </View>

        {/* The room's NAME is the permanent first line and the score is the
            small one under it — never the other way round. You can swipe
            between rooms mid-game, and if the score took the top line then
            the one thing that changes when you arrive somewhere new would be
            a number, leaving you with no idea which room you landed in. */}
        <Pressable
          className="flex-1"
          onPress={() =>
            navigation.navigate("HuddleSettings", { huddleId: huddle.id })
          }
        >
          <View className="flex-row items-center gap-1.5">
            <Type variant="heading" className="shrink" numberOfLines={1}>
              {displayName}
            </Type>
            {huddle.isVerified ? (
              <ShieldCheck color={colors.primary} size={14} />
            ) : null}
            {/* WHICH KIND OF HUDDLE THIS IS. A public one full of strangers
                and a side huddle that ends at 2am both behave differently
                from your own, and neither says so anywhere else. */}
            {huddle.isGameRoom ? (
              <View
                className="rounded-full px-2 py-0.5"
                style={{ borderWidth: 1, borderColor: colors.border }}
              >
                <Type variant="eyebrow" tone="muted" style={{ fontSize: 10, letterSpacing: 1 }}>
                  Open
                </Type>
              </View>
            ) : huddle.expiresAt ? (
              <View
                className="rounded-full px-2 py-0.5"
                style={{ borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(245,197,24,0.55)" }}
              >
                <Type variant="eyebrow" tone="primary" style={{ fontSize: 10, letterSpacing: 1 }}>
                  ◷ 2am
                </Type>
              </View>
            ) : null}
          </View>

          <View className="overflow-hidden">
            {hasGame ? null : (
              <Type variant="data" tone="muted" className="mt-0.5">
                {huddle.memberCount}{" "}
                {huddle.memberCount === 1 ? "member" : "members"}
              </Type>
            )}

            {/* The sponsor board drops over this line rather than owning a
                strip of its own. Same three seconds, same paid moment, one
                fewer band of chrome the other ninety-five percent of the
                time. */}
            {sponsor ? (
              <Animated.View
                pointerEvents="none"
                className="absolute inset-0 justify-center"
                style={{
                  transform: [
                    {
                      translateY: drop.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-40, 0],
                      }),
                    },
                  ],
                }}
              >
                <Type variant="dataStrong" tone="primary"  numberOfLines={1}>
                  {sponsor.brandName}
                  <Type variant="bodyStrong" tone="muted">
                    {"  "}supports {huddle.teamName ?? "these"} fans
                  </Type>
                </Type>
              </Animated.View>
            ) : null}
          </View>
        </Pressable>

        {/* The invite button moved to the presence row, where the ＋ sits
            next to the faces it is about. It was costing ~44px of a header
            whose second line — the score and the opponent — was being clipped
            for want of exactly that. */}

        <Pressable
          onPress={() =>
            navigation.navigate("HuddleSettings", { huddleId: huddle.id })
          }
          className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
          hitSlop={8}
        >
          <MoreVertical color={colors.mutedForeground} size={20} />
        </Pressable>
      </View>

      {/* FULL WIDTH, ITS OWN LINE. Sharing the row above cost it the back
          chevron, the crest and the ⋯ before it drew a character. */}
      {hasGame ? (
        <Pressable
          className="px-4 pb-2"
          onPress={() => navigation.navigate("HuddleSettings", { huddleId: huddle.id })}
        >
          <ScoreLine game={game!} gameState={gameState} />
        </Pressable>
      ) : null}


      {/* Sponsors with no game to drop over still need to be seen, so a room
          that isn't on a game day keeps the quiet credit line. Tappable —
          the drop above is not, because it moves. */}
      {sponsor && !hasGame ? (
        <Pressable
          onPress={handleSponsorTap}
          className="items-center border-t border-border bg-muted/30 py-1"
          hitSlop={4}
        >
          <Type variant="eyebrow" tone="muted">
            {sponsor.brandName} supports this room
          </Type>
        </Pressable>
      ) : null}
    </View>
  );
}

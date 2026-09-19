import { useEffect, useRef, useState } from "react";
import { Alert, View, Text, Image, Pressable, Animated, Linking } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  BadgeCheck,
  ChevronLeft,
  MoreVertical,
  ShieldCheck,
} from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/type";
import { teamAbbr } from "@/lib/teamName";
import { kickoffLabel } from "@/lib/gameTime";
import {
  useLiveGameContext,
  getGameState,
  type GameContext,
  type GameState,
} from "@/hooks/useLiveGameContext";
import { useTeamSponsors, logSponsorTap } from "@/hooks/useTeamSponsor";
import { useAuth } from "@/hooks/useAuth";
import { gameStatusLabel } from "@/hooks/useRoomGames";
import { useDmCounterparts } from "@/hooks/useDmCounterpart";
import { personName } from "@/lib/personName";
import { blockUser, reportUser } from "@/lib/moderation";
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
  // PLACE, NOT MASCOT — the same rule the rest of the app follows, and the
  // one every scorebug on television uses.
  //
  // This returned the nickname and handed it to teamAbbr(), which is written
  // to take a place: "Broncos" became BRO and "Chiefs" became CHI. Nobody
  // abbreviates them that way. From the city they become DEN and KC.
  const an = game.awayTeamCity || game.awayTeamName || "";
  const hn = game.homeTeamCity || game.homeTeamName || "";
  // Two teams sharing a city — Mets and Yankees are both "New York" — are the
  // one case where the nickname is the only thing that tells them apart.
  const clash = !!an && an.toLowerCase() === hn.toLowerCase();
  // EMPTY WHEN UNKNOWN, never a placeholder word.
  //
  // The team lookup comes back empty often enough on this database, and the
  // fallbacks used to be the literal strings "Away" and "Home" — which
  // teamAbbr then rendered as AWA and HOM over a live score. A scoreline that
  // invents team names is worse than one that shows only the numbers.
  return {
    away: (clash ? game.awayTeamName : null) || an || "",
    home: (clash ? game.homeTeamName : null) || hn || "",
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
          {away ? `${teamAbbr(away)} ` : ""}
          <Type variant="data" style={{ fontSize: 19, fontFamily: fonts.monoMedium }}>
            {game.awayScore ?? 0}
          </Type>
          <Type variant="data" tone="tertiary" style={{ fontSize: 14 }}>{"  ·  "}</Type>
          {home ? `${teamAbbr(home)} ` : ""}
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
          {/* BASEBALL HAS NO CLOCK, and the feed sends "0:00" anyway. Joining
              period and clock blindly rendered "6 0:00" on a baseball game —
              the sixth inning with four minutes left in it. gameStatusLabel
              already knows every sport's shape and this header was the one
              surface still doing its own thing. */}
          {gameStatusLabel(game.sportKey ?? null, game.period, game.clock)}
        </Type>
      </View>
    );
  }

  if (gameState === "postgame") {
    return (
      <Type variant="caption" tone="muted" className="mt-0.5" numberOfLines={1}>
        {teamAbbr(away)} <Type variant="dataStrong">{game.awayScore ?? 0}</Type>
        {" · "}
        {teamAbbr(home)} <Type variant="dataStrong">{game.homeScore ?? 0}</Type>
        <Type variant="dataStrong" tone="success"> FINAL</Type>
      </Type>
    );
  }

  // THE TIME IS THE POINT OF THIS LINE, so it can never be the part that
  // gets cut. It was one string — "Mississippi State at South Carolina ·
  // Tomorrow 12:00 PM" — and the names ate the width until the time clipped
  // to "T…". Scorebug abbreviations, as the live line already uses, and the
  // time in its own piece that does not shrink.
  return (
    <View className="mt-0.5 flex-row items-center">
      <Type variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
        {teamAbbr(away)} at {teamAbbr(home)}
      </Type>
      <Type variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 0 }}>
        {" · "}{kickoffLabel(game.startTime)}
      </Type>
    </View>
  );
}

export function HuddleHeader({ huddle, onInvite }: Props) {
  const navigation = useNavigation();
  const { user } = useAuth();
  // Who this thread is WITH — resolved per viewer, because the stored huddle
  // name is the other person's name from the creator's side and is therefore
  // wrong for exactly half the people who see it.
  const dmOthers = useDmCounterparts(huddle.isDm ? [huddle.id] : []);
  const dmWith = huddle.isDm ? dmOthers.get(huddle.id) : undefined;
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

  const displayName = huddle.isDm
    // The person, as YOU have them saved — never the stored huddle name,
    // which is whoever the creator was talking to.
    ? (dmWith ? personName(dmWith) : huddle.name)
    : huddle.isOfficialTeam
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
            {/* A verified creator's own room. */}
            {huddle.creatorHandle ? (
              <BadgeCheck color={colors.verified.primary} size={18} accessibilityLabel="Verified creator" />
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
            {/* "◷ 2am" is a countdown with no stated consequence, and people
                read a deadline as "I am about to lose this". Say what actually
                happens once, under the name, only in the rooms it applies to. */}
            {huddle.expiresAt && !huddle.isGameRoom ? (
              <Type variant="data" tone="muted" className="mt-0.5" numberOfLines={1}>
                Closes at 2am — nothing is deleted. Keep it in Settings.
              </Type>
            ) : null}
            {hasGame || huddle.isDm ? null : (
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

        {/* IN A DM THE ⋯ IS BLOCK, not settings. Huddle settings — photo,
            bio, access, admins — describes nothing about a conversation
            between two people, and blocking somebody who messaged you used to
            mean leaving the thread, hunting their avatar down in the friends
            row and going to their profile. Longest possible route for the one
            case that is actually urgent. */}
        <Pressable
          onPress={() => {
            if (!huddle.isDm) {
              navigation.navigate("HuddleSettings", { huddleId: huddle.id });
              return;
            }
            if (!dmWith) return;
            const who = personName(dmWith);
            Alert.alert(who, undefined, [
              {
                text: "Report",
                onPress: () => {
                  void reportUser({ userId: dmWith.userId, reason: "harassment" });
                  Alert.alert("Reported", "Thanks — we'll take a look.");
                },
              },
              {
                text: `Block ${who.split(/\s+/)[0]}`,
                style: "destructive",
                onPress: () => {
                  Alert.alert(
                    `Block ${who}?`,
                    "They won't be able to message you, and you won't see their messages anywhere. You can undo it from their profile.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Block",
                        style: "destructive",
                        onPress: async () => {
                          const ok = await blockUser(dmWith.userId);
                          if (!ok) {
                            Alert.alert("Couldn't block", "Try again in a moment.");
                            return;
                          }
                          // Don't leave anyone standing in a thread with
                          // somebody they have just blocked.
                          (navigation as any).goBack();
                        },
                      },
                    ],
                  );
                },
              },
              { text: "Cancel", style: "cancel" },
            ]);
          }}
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

import { Pressable, View, Image } from "react-native";
import { Crown, Lock } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { fonts } from "@/theme/type";
import { personColor } from "@/lib/personColor";
import { colors } from "@/theme/colors";
import type { UserHuddle } from "@/hooks/useUserHuddles";
import type { RoomGame } from "@/hooks/useRoomGames";

type Props = {
  huddle: UserHuddle;
  onPress: () => void;
  /** The game this room's team is playing, if any. */
  game?: RoomGame;
  /** People in the room right now. */
  hereNow?: string[];
};

/**
 * A room row, built to "Who, What, Where".
 *
 * SIZES COME FROM THAT ARTIFACT, scaled ×1.136 — it draws a 354px screen, not
 * the 290px one the room study uses. Applying the room's ×1.386 here is what
 * made the last version of this card look inflated next to the design.
 *
 * THE ORDER IS THE ARGUMENT. Faces first: who is in there is the only reason
 * to tap, and a count is not a reason. Then the crest bar and the name. Then
 * two status facts that are independent of each other — people being in a room
 * and a game being on are different things, and a room whose team is playing
 * with nobody in it is the most interesting row on the screen rather than a
 * dead one.
 *
 * NAMES, NEVER COUNTS. "Mike, Sarah in", not "2 watching". The artifact is
 * explicit about this: naming is the part that makes you tap.
 */
export function HuddleCard({ huddle, onPress, game, hereNow }: Props) {
  const here = hereNow ?? [];
  const gameOn = game?.status === "live";
  const nobodyHome = here.length === 0;
  const hot = gameOn || here.length > 0;

  return (
    <Pressable
      onPress={onPress}
      className="mb-2 rounded-[16px] px-3 py-2.5 active:opacity-80"
      style={{
        backgroundColor: hot ? "#16171C" : colors.card,
        borderWidth: 1,
        borderColor: hot ? "#33404F" : colors.border,
      }}
    >
      <View className="mb-2 flex-row items-start gap-2.5">
        <FaceStack names={here} logoUrl={huddle.teamLogoUrl} dim={nobodyHome} />

        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            {/* A 4px bar of colour rather than a crest: at this size a logo is
                a smudge, and the bar reads instantly. */}
            <View
              style={{
                width: 4,
                height: 15,
                borderRadius: 2,
                backgroundColor: gameOn ? colors.primary : "#3A3A42",
              }}
            />
            <Type variant="heading" numberOfLines={1} style={{ flexShrink: 1, fontSize: 18 }}>
              {huddle.name}
            </Type>
            {huddle.roomRole === "owner" ? (
              <Crown color={colors.primary} size={12} />
            ) : null}
            {huddle.isPrivate ? (
              <Lock color={colors.mutedForeground} size={11} />
            ) : null}
          </View>

          {/* Two states, never one. Either can be true without the other. */}
          <View className="mt-1.5 flex-row flex-wrap items-center gap-x-2.5 gap-y-0.5">
            {here.length > 0 ? (
              <Type variant="data" tone="success" numberOfLines={1} style={{ fontSize: 10 }}>
                ● {here.slice(0, 2).join(", ")}
                {here.length > 2 ? ` +${here.length - 2}` : ""} in
              </Type>
            ) : (
              <Type variant="data" tone="tertiary" style={{ fontSize: 10 }}>
                ○ nobody in
              </Type>
            )}
            {gameOn ? (
              <Type variant="data" tone="primary" style={{ fontSize: 10 }}>
                ◆ game on
              </Type>
            ) : null}
          </View>
        </View>

        {huddle.lastMessageAt ? (
          <Type variant="data" tone="tertiary" style={{ fontSize: 10, paddingTop: 2 }}>
            {shortAgo(huddle.lastMessageAt)}
          </Type>
        ) : null}
      </View>

      {game ? <ScoreStrip game={game} live={gameOn} /> : null}

      {/* The best row on the screen: the team is playing and the room is
          empty. Not a gap — the one moment when going in first is worth
          something, and it says so exactly when it's true. */}
      {gameOn && nobodyHome ? (
        <View
          className="mt-2 rounded-lg px-2.5 py-2"
          style={{
            backgroundColor: "rgba(245,197,24,0.09)",
            borderWidth: 1,
            borderColor: "rgba(245,197,24,0.28)",
          }}
        >
          <Type variant="captionStrong" tone="primary" style={{ fontSize: 13 }}>
            ◆ Nobody's in and it's on — go first
          </Type>
        </View>
      ) : huddle.latestMessage ? (
        /* "Mike THAT'S A STOP" — the speaker in white, what they said in grey.
           Without the name it is a fragment with no author, which is how the
           liveliest line on the card ended up reading as boilerplate. */
        <Type variant="caption" tone="muted" numberOfLines={1} className="mt-2" style={{ fontSize: 14 }}>
          {huddle.latestMessageSender ? (
            <Type style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.foreground }}>
              {huddle.latestMessageSender}{" "}
            </Type>
          ) : null}
          {huddle.latestMessage}
        </Type>
      ) : null}
    </Pressable>
  );
}

/**
 * The faces, overlapping — 27px in the artifact, so 31 here, each cut into the
 * one before by 10. Falls back to the team crest when nobody is in: a row with
 * no image at all reads as broken rather than as quiet.
 */
function FaceStack({
  names,
  logoUrl,
  dim,
}: {
  names: string[];
  logoUrl: string | null;
  dim: boolean;
}) {
  if (names.length === 0) {
    return (
      <View
        className="h-[31px] w-[31px] items-center justify-center overflow-hidden rounded-full bg-muted"
        style={{ opacity: dim ? 0.5 : 1 }}
      >
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={{ width: 26, height: 26 }} resizeMode="contain" />
        ) : null}
      </View>
    );
  }

  const shown = names.slice(0, 3);
  const extra = names.length - shown.length;

  return (
    <View className="flex-row pt-0.5">
      {shown.map((n, i) => (
        <View
          key={`${n}-${i}`}
          className="h-[31px] w-[31px] items-center justify-center rounded-full"
          style={{
            backgroundColor: personColor(n),
            borderWidth: 2,
            borderColor: colors.card,
            marginLeft: i === 0 ? 0 : -10,
          }}
        >
          <Type variant="data" style={{ color: "#000", fontSize: 10 }}>
            {n.slice(0, 2).toUpperCase()}
          </Type>
        </View>
      ))}
      {extra > 0 ? (
        <View
          className="h-[31px] w-[31px] items-center justify-center rounded-full"
          style={{
            backgroundColor: "#2A3849",
            borderWidth: 2,
            borderColor: colors.card,
            marginLeft: -10,
          }}
        >
          <Type variant="data" style={{ fontSize: 10 }}>+{extra}</Type>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The scoreline, in its own inset panel — #0F1721 on #223040, the one place on
 * Home that gets a ground of its own, because digits are the only thing here
 * allowed to be loud and they need something to be loud against.
 *
 * Crest, abbreviation, score. Leading side bright, trailing side muted, so you
 * read who is winning without reading a number. Before first pitch the panel
 * is a dashed outline with no numbers in it: a score of nothing-to-nothing is
 * a lie about a game that hasn't started.
 */
function ScoreStrip({ game, live }: { game: RoomGame; live: boolean }) {
  const us = game.us.score ?? 0;
  const them = game.them.score ?? 0;

  return (
    <View
      className="flex-row items-center gap-1.5 rounded-[9px] px-2.5 py-2"
      style={
        live
          ? { backgroundColor: "#0F1721", borderWidth: 1, borderColor: "#223040" }
          : { borderWidth: 1, borderStyle: "dashed", borderColor: "#26384C" }
      }
    >
      <Crest url={game.us.logoUrl} />
      <Type variant="data" tone="muted" numberOfLines={1} style={{ fontSize: 11, flexShrink: 1 }}>
        {game.us.name}
      </Type>
      {live ? (
        <Type variant="score" tone={us >= them ? "default" : "muted"} style={{ fontSize: 18 }}>
          {us}
        </Type>
      ) : null}

      <View style={{ width: 4 }} />
      <Crest url={game.them.logoUrl} />
      <Type variant="data" tone="muted" numberOfLines={1} style={{ fontSize: 11, flexShrink: 1 }}>
        {live ? game.them.name : `${game.isHome ? "vs " : "at "}${game.them.name}`}
      </Type>
      {live ? (
        <Type variant="score" tone={them >= us ? "default" : "muted"} style={{ fontSize: 18 }}>
          {them}
        </Type>
      ) : null}

      <Type
        variant="data"
        tone={live ? "primary" : "tertiary"}
        style={{ marginLeft: "auto", fontSize: 10 }}
      >
        {game.statusLabel}
      </Type>
    </View>
  );
}

function Crest({ url }: { url: string | null }) {
  return (
    <View
      className="h-[17px] w-[17px] items-center justify-center overflow-hidden rounded-full"
      style={{ backgroundColor: "#1B1D23" }}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: 14, height: 14 }} resizeMode="contain" />
      ) : null}
    </View>
  );
}

/** "2m", "1h", "Thu" — the artifact's stamp, not a full timestamp. */
function shortAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) {
    return new Date(then).toLocaleDateString("en-US", { weekday: "short" });
  }
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

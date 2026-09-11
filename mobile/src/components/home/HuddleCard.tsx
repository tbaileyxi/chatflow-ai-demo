import { Pressable, View, Image } from "react-native";
import { Crown, Lock } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
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
 * A room, built to the Four Tabs rendering.
 *
 * THE ORDER IS THE ARGUMENT. Faces first, because who is in there is the only
 * reason to tap. Then the name. Then two status lines that are independent of
 * each other — people being in a room and a game being on are different facts,
 * and a room whose team is playing with nobody in it is the most interesting
 * row on the screen rather than a dead one.
 *
 * The scoreline gets its own inset panel because digits are the one thing here
 * allowed to be loud, and they need a ground of their own to be loud against.
 * The leading side stays bright and the trailing side drops to muted, so you
 * read who is winning without reading a number.
 *
 * Member count is gone. It was the least interesting fact about a room and it
 * sat where "who is in there right now" belongs.
 */
export function HuddleCard({ huddle, onPress, game, hereNow }: Props) {
  const here = hereNow ?? [];
  const gameOn = game?.status === "live";
  const nobodyHome = here.length === 0;

  return (
    <Pressable
      onPress={onPress}
      className="mb-2 rounded-[13px] p-2.5 active:opacity-80"
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: here.length > 0 || gameOn ? "#33404F" : colors.border,
      }}
    >
      <View className="mb-1.5 flex-row items-start gap-2">
        <FaceStack names={here} logoUrl={huddle.teamLogoUrl} dim={nobodyHome} />

        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            {/* A 3.5px bar of the team's colour rather than a logo: at this
                size a crest is a smudge, and the bar reads instantly. */}
            <View
              style={{
                width: 3.5,
                height: 12,
                borderRadius: 2,
                backgroundColor: gameOn ? colors.primary : "#3A3A42",
              }}
            />
            <Type variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
              {huddle.name}
            </Type>
            {huddle.roomRole === "owner" ? (
              <Crown color={colors.primary} size={11} />
            ) : null}
            {huddle.isPrivate ? (
              <Lock color={colors.mutedForeground} size={10} />
            ) : null}
          </View>

          {/* Two states, never one. Either can be true without the other. */}
          <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
            {here.length > 0 ? (
              <Type variant="data" tone="success" numberOfLines={1}>
                ● {here.slice(0, 2).join(", ")}
                {here.length > 2 ? ` +${here.length - 2}` : ""} in
              </Type>
            ) : (
              <Type variant="data" tone="tertiary">
                ○ nobody in
              </Type>
            )}
            {gameOn ? (
              <Type variant="data" tone="primary">
                ◆ game on
              </Type>
            ) : null}
          </View>
        </View>

        {huddle.lastMessageAt ? (
          <Type variant="data" tone="tertiary" style={{ paddingTop: 2 }}>
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
          className="mt-1.5 rounded-lg px-2 py-1.5"
          style={{
            backgroundColor: "rgba(245,197,24,0.09)",
            borderWidth: 1,
            borderColor: "rgba(245,197,24,0.28)",
          }}
        >
          <Type variant="captionStrong" tone="primary">
            ◆ Nobody's in and it's on — go first
          </Type>
        </View>
      ) : huddle.latestMessage ? (
        <Type variant="caption" tone="muted" numberOfLines={1} className="mt-1.5">
          {huddle.latestMessage}
        </Type>
      ) : null}
    </Pressable>
  );
}

/**
 * The faces, overlapping. Falls back to the team crest when nobody is in —
 * a row with no image at all reads as broken rather than as quiet.
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
        className="h-[25px] w-[25px] items-center justify-center overflow-hidden rounded-full bg-muted"
        style={{ opacity: dim ? 0.45 : 1 }}
      >
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} className="h-full w-full" resizeMode="cover" />
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
          className="h-[25px] w-[25px] items-center justify-center rounded-full"
          style={{
            backgroundColor: personColor(n),
            borderWidth: 2,
            borderColor: colors.card,
            marginLeft: i === 0 ? 0 : -8,
          }}
        >
          <Type variant="data" style={{ color: "#000", fontSize: 8.5 }}>
            {n.slice(0, 2).toUpperCase()}
          </Type>
        </View>
      ))}
      {extra > 0 ? (
        <View
          className="h-[25px] w-[25px] items-center justify-center rounded-full"
          style={{
            backgroundColor: "#2A3849",
            borderWidth: 2,
            borderColor: colors.card,
            marginLeft: -8,
          }}
        >
          <Type variant="data" style={{ fontSize: 8.5 }}>+{extra}</Type>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The scoreline, in its own inset panel.
 *
 * Leading side bright, trailing side muted. Before kickoff the panel is a
 * dashed outline with no numbers in it, because a score of nothing-to-nothing
 * is a lie about a game that hasn't started.
 */
function ScoreStrip({ game, live }: { game: RoomGame; live: boolean }) {
  const us = game.us.score ?? 0;
  const them = game.them.score ?? 0;

  return (
    <View
      className="flex-row items-center gap-1.5 rounded-lg px-2 py-1.5"
      style={
        live
          ? { backgroundColor: "#0F1721", borderWidth: 1, borderColor: "#223040" }
          : { borderWidth: 1, borderStyle: "dashed", borderColor: "#26384C" }
      }
    >
      <Type variant="data" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
        {game.us.name}
      </Type>
      {live ? (
        <Type variant="score" tone={us >= them ? "default" : "muted"}>
          {us}
        </Type>
      ) : null}

      <Type variant="data" tone="tertiary">
        {live ? "·" : game.isHome ? "vs" : "at"}
      </Type>

      <Type variant="data" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
        {game.them.name}
      </Type>
      {live ? (
        <Type variant="score" tone={them >= us ? "default" : "muted"}>
          {them}
        </Type>
      ) : null}

      <Type
        variant="data"
        tone={live ? "primary" : "tertiary"}
        style={{ marginLeft: "auto" }}
      >
        {game.statusLabel}
      </Type>
    </View>
  );
}

/** "2m", "1h", "Thu" — the rendering's stamp, not a full timestamp. */
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

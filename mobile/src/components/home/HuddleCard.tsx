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
 * A room card.
 *
 * WHY THIS LOOKS THE WAY IT DOES. The version before this had the right facts
 * in the right order and still read as a settings list, because every one of
 * them was grey text on a grey card. The renderings carry a room on four
 * pieces of colour and nothing else: the team crest at a size you can actually
 * see it, a red LIVE, a gold unread, and a gold way in. Take those away and no
 * amount of correct hierarchy makes it look designed.
 *
 * So: crest left at 46, name and state centre, gold right. Then a rule, then
 * who is in there and the way in.
 *
 * THE ORDER IS STILL THE ARGUMENT. Who is in there is the only reason to tap,
 * and it sits on the footer line where the eye lands last and stays. The two
 * status facts stay independent — people in a room and a game being on are
 * different things, and a room whose team is playing with nobody in it is the
 * most interesting row on the screen rather than a dead one.
 *
 * Member count is gone. It was the least interesting fact about a room.
 */
export function HuddleCard({ huddle, onPress, game, hereNow }: Props) {
  const here = hereNow ?? [];
  const gameOn = game?.status === "live";
  const nobodyHome = here.length === 0;
  const hot = gameOn || here.length > 0;

  return (
    <Pressable
      onPress={onPress}
      className="mb-2.5 overflow-hidden rounded-[16px] active:opacity-80"
      style={{
        backgroundColor: hot ? "#15161A" : colors.card,
        borderWidth: 1,
        borderColor: gameOn ? "rgba(245,197,24,0.30)" : hot ? "#333842" : colors.border,
      }}
    >
      {/* A live room gets a gold rule across the top edge. It is the cheapest
          possible signal and it survives being seen out of the corner of your
          eye while scrolling, which is how this screen is actually read. */}
      {gameOn ? (
        <View style={{ height: 2.5, backgroundColor: colors.primary }} />
      ) : null}

      <View className="px-3 pb-2.5 pt-3">
        <View className="flex-row items-center gap-3">
          <TeamTile logoUrl={huddle.teamLogoUrl} name={huddle.teamName} live={gameOn} />

          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-1.5">
              <Type variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
                {huddle.name}
              </Type>
              {huddle.roomRole === "owner" ? (
                <Crown color={colors.primary} size={13} />
              ) : null}
              {huddle.isPrivate ? (
                <Lock color={colors.mutedForeground} size={12} />
              ) : null}
              {gameOn ? <LivePill /> : null}
            </View>

            {/* Two states, never one. Either can be true without the other. */}
            <View className="mt-1 flex-row flex-wrap items-center gap-x-2.5 gap-y-0.5">
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
              {huddle.lastMessageAt ? (
                <Type variant="data" tone="tertiary">
                  {shortAgo(huddle.lastMessageAt)}
                </Type>
              ) : null}
            </View>
          </View>

          {huddle.hasUnread ? <UnreadDot /> : null}
        </View>

        {game ? (
          <View className="mt-2.5">
            <ScoreStrip game={game} live={gameOn} />
          </View>
        ) : null}

        {/* The best row on the screen: the team is playing and the room is
            empty. Not a gap — the one moment when going in first is worth
            something, and it says so exactly when it's true. */}
        {gameOn && nobodyHome ? (
          <View
            className="mt-2 rounded-[10px] px-2.5 py-2"
            style={{
              backgroundColor: "rgba(245,197,24,0.10)",
              borderWidth: 1,
              borderColor: "rgba(245,197,24,0.30)",
            }}
          >
            <Type variant="captionStrong" tone="primary">
              ◆ Nobody's in and it's on — go first
            </Type>
          </View>
        ) : huddle.latestMessage ? (
          <Type
            variant="caption"
            tone={huddle.hasUnread ? "default" : "muted"}
            numberOfLines={1}
            className="mt-2"
          >
            {huddle.latestMessage}
          </Type>
        ) : null}
      </View>

      {/* The footer rule, the faces, and the way in. Straight from the
          rendering, and the reason a card reads as a card rather than as a
          paragraph with a border round it. */}
      <View style={{ height: 1, backgroundColor: "#1E2027" }} />
      <View className="flex-row items-center gap-2 px-3 py-2">
        <FaceStack names={here} />
        <Type variant="data" tone={here.length ? "muted" : "tertiary"} numberOfLines={1} style={{ flexShrink: 1 }}>
          {here.length > 0
            ? `${here.slice(0, 2).join(", ")}${here.length > 2 ? ` +${here.length - 2}` : ""} here now`
            : "quiet"}
        </Type>
        <Type
          variant="captionStrong"
          tone="primary"
          style={{ marginLeft: "auto", fontFamily: fonts.extrabold }}
        >
          Open →
        </Type>
      </View>
    </Pressable>
  );
}

/**
 * The crest, at a size you can read it.
 *
 * 46px on its own tile, the way the renderings draw it. The version before
 * this put it at 25px behind the avatars, where an NFL logo is a smudge and
 * the card lost the one piece of real colour it had.
 */
function TeamTile({
  logoUrl,
  name,
  live,
}: {
  logoUrl: string | null;
  name: string | null;
  live: boolean;
}) {
  return (
    <View
      className="h-[46px] w-[46px] items-center justify-center overflow-hidden rounded-[12px]"
      style={{
        backgroundColor: "#1B1D23",
        borderWidth: 1,
        borderColor: live ? "rgba(245,197,24,0.35)" : "#2C2F37",
      }}
    >
      {logoUrl ? (
        <Image
          source={{ uri: logoUrl }}
          style={{ width: 34, height: 34 }}
          resizeMode="contain"
        />
      ) : (
        <Type variant="data" tone="muted" style={{ fontSize: 15 }}>
          {(name ?? "SH").slice(0, 2).toUpperCase()}
        </Type>
      )}
    </View>
  );
}

/** Red, small, and the only red on the screen. */
function LivePill() {
  return (
    <View
      className="flex-row items-center gap-1 rounded-full px-1.5 py-0.5"
      style={{
        backgroundColor: "rgba(255,91,77,0.14)",
        borderWidth: 1,
        borderColor: "rgba(255,91,77,0.34)",
      }}
    >
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#FF5B4D" }} />
      <Type variant="eyebrow" style={{ color: "#FF5B4D", fontSize: 11, letterSpacing: 1.2 }}>
        Live
      </Type>
    </View>
  );
}

/** Gold, and the reason your eye goes to the right room first. */
function UnreadDot() {
  return (
    <View
      style={{
        width: 11,
        height: 11,
        borderRadius: 6,
        backgroundColor: colors.primary,
        marginLeft: 4,
      }}
    />
  );
}

/**
 * The faces, overlapping. Empty when nobody is in — the word "quiet" next to
 * it carries that, and three grey circles pretending to be people do not.
 */
function FaceStack({ names }: { names: string[] }) {
  if (names.length === 0) return null;

  const shown = names.slice(0, 3);

  return (
    <View className="flex-row">
      {shown.map((n, i) => (
        <View
          key={`${n}-${i}`}
          className="h-[22px] w-[22px] items-center justify-center rounded-full"
          style={{
            backgroundColor: personColor(n),
            borderWidth: 2,
            borderColor: colors.card,
            marginLeft: i === 0 ? 0 : -7,
          }}
        >
          <Type variant="data" style={{ color: "#000", fontSize: 8.5 }}>
            {n.slice(0, 2).toUpperCase()}
          </Type>
        </View>
      ))}
    </View>
  );
}

/**
 * The scoreline, in its own inset panel.
 *
 * Leading side bright, trailing side muted. Before first pitch the panel is a
 * dashed outline with no numbers in it, because a score of nothing-to-nothing
 * is a lie about a game that hasn't started.
 */
function ScoreStrip({ game, live }: { game: RoomGame; live: boolean }) {
  const us = game.us.score ?? 0;
  const them = game.them.score ?? 0;

  return (
    <View
      className="flex-row items-center gap-1.5 rounded-[10px] px-2.5 py-2"
      style={
        live
          ? { backgroundColor: "#0E141C", borderWidth: 1, borderColor: "#243244" }
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

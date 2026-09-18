import { Pressable, View, Image } from "react-native";
import { Crown, Lock } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { fonts } from "@/theme/type";
import { personColor } from "@/lib/personColor";
import { colors } from "@/theme/colors";
import { cardStyle } from "@/theme/cardStyle";
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
  const settled = game?.status === "final";
  const nobodyHome = here.length === 0;
  const hot = gameOn || here.length > 0;

  return (
    <Pressable
      onPress={onPress}
      className="mb-3 rounded-[16px] px-3 py-3 active:opacity-80"
      // Solid gold when a game is on, dashed gold for a side huddle that ends
      // at 2am, a plain light stroke otherwise. See theme/cardStyle — the
      // old default was #232329, two shades off the card it drew around, so a
      // screen of these read as one grey column.
      style={cardStyle(huddle.expiresAt ? "side" : gameOn ? "live" : "quiet")}
    >
      <View className="mb-2.5 flex-row items-start gap-2.5">
        <FaceStack names={here} logoUrl={huddle.teamLogoUrl} dim={false} />

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

          {/* ONE LINE, and it does not lead with absence.
              This used to say "nobody in" here AND again in a gold banner
              below — the same fact twice, with the louder of the two
              announcing that the room was empty. A room being quiet is the
              least interesting thing about it. */}
          <View className="mt-1.5 flex-row flex-wrap items-center gap-x-2.5 gap-y-0.5">
            {here.length > 0 ? (
              <Type variant="data" tone="success" numberOfLines={1} style={{ fontSize: 11 }}>
                ● {here.slice(0, 2).join(", ")}
                {here.length > 2 ? ` +${here.length - 2}` : ""} in
              </Type>
            ) : null}
            {huddle.expiresAt ? (
              <Type variant="data" tone="primary" style={{ fontSize: 11 }}>
                ◷ until 2am
              </Type>
            ) : gameOn ? (
              <Type variant="data" tone="primary" style={{ fontSize: 11 }}>
                ◆ {nobodyHome ? "on now — go first" : "game on"}
              </Type>
            ) : settled ? (
              <Type variant="data" tone="success" style={{ fontSize: 11 }}>
                ✓ final
              </Type>
            ) : here.length === 0 ? (
              <Type variant="data" tone="tertiary" style={{ fontSize: 11 }}>
                quiet
              </Type>
            ) : null}
          </View>
        </View>

        {huddle.lastMessageAt ? (
          <Type variant="data" tone="tertiary" style={{ fontSize: 10, paddingTop: 3 }}>
            {shortAgo(huddle.lastMessageAt)}
          </Type>
        ) : null}
      </View>

      {game ? <ScoreStrip game={game} live={gameOn || settled} /> : null}

      {/* THE LAST MESSAGE IS THE POINT. It sat under a gold banner shouting
          that nobody was there, in muted grey, truncated. A new message is the
          single best reason to go into a room — so it reads at body weight,
          with the speaker named, and nothing above it competes. */}
      {huddle.latestMessage ? (
        <Type
          variant="caption"
          tone={huddle.hasUnread ? "default" : "muted"}
          numberOfLines={2}
          className="mt-2.5"
          style={{ fontSize: 15, lineHeight: 20 }}
        >
          {huddle.latestMessageSender ? (
            <Type style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.foreground }}>
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
        className="h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-full"
        style={{ backgroundColor: "#1E2029", opacity: dim ? 0.5 : 1 }}
      >
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={{ width: 32, height: 32 }} resizeMode="contain" />
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

      {/* "vs" / "at" is its OWN element, between the two sides.
          It used to be glued to the opponent's NAME string while the crest was
          rendered before that Type — so the badge landed on the wrong side of
          the word and the line read "New York [76ers] vs Philadelphia". The
          separator belongs between the teams, not inside one of them. */}
      <View style={{ width: 4 }} />
      {!live ? (
        <Type variant="data" tone="tertiary" style={{ fontSize: 11 }}>
          {game.isHome ? "vs" : "at"}
        </Type>
      ) : null}
      <Crest url={game.them.logoUrl} />
      <Type variant="data" tone="muted" numberOfLines={1} style={{ fontSize: 11, flexShrink: 1 }}>
        {game.them.name}
      </Type>
      {live ? (
        <Type variant="score" tone={them >= us ? "default" : "muted"} style={{ fontSize: 18 }}>
          {them}
        </Type>
      ) : null}

      <Type
        variant="data"
        tone={live ? "primary" : "tertiary"}
        numberOfLines={1}
        style={{ marginLeft: "auto", fontSize: 10, flexShrink: 0 }}
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

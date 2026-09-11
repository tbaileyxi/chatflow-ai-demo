import { Pressable, View, Text, Image } from "react-native";
import { Crown, Lock } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";
import type { UserHuddle } from "@/hooks/useUserHuddles";
import type { RoomGame } from "@/hooks/useRoomGames";

type Props = {
  huddle: UserHuddle;
  onPress: () => void;
  /** The game this room's team is playing, if any. */
  game?: RoomGame;
  /** First names of people in the room right now. */
  hereNow?: string[];
};

/**
 * A room, with enough on it to be worth tapping.
 *
 * This used to be a logo, a name and "3 people" — the same three facts for
 * every room, none of which say whether anything is happening. Six rooms
 * rendered six identical rows and the list couldn't tell you where to go.
 *
 * THE TWO KINDS OF LIVE ARE SEPARATE. People being in a room and a game being
 * on are independent: a family room with three people talking on a Tuesday is
 * live with no game, and a room whose team is playing with nobody in it is a
 * different thing again — and the most interesting row on the screen, because
 * it's the one where going first matters.
 *
 * Member count is gone. It's the least interesting fact about a room and it
 * was sitting where "who is in there right now" belongs.
 */
export function HuddleCard({ huddle, onPress, game, hereNow }: Props) {
  const here = hereNow ?? [];
  const gameOn = game?.status === "live";
  const nobodyHome = here.length === 0;

  return (
    <Pressable
      className={cn(
        "rounded-2xl border bg-card p-3 active:opacity-80",
        here.length > 0 || gameOn ? "border-[#33404F]" : "border-border",
      )}
      onPress={onPress}
    >
      <View className="flex-row items-center gap-3">
        <View
          className={cn(
            "h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-muted",
            huddle.hasUnread && "border-2 border-success",
          )}
        >
          {huddle.teamLogoUrl ? (
            <Image
              source={{ uri: huddle.teamLogoUrl }}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            <Text className="text-lg font-bold text-muted-foreground">
              {huddle.name.charAt(0)}
            </Text>
          )}
        </View>

        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Type
              variant={huddle.hasUnread ? "title" : "heading"}
              style={{ flexShrink: 1, fontSize: 17 }}
              numberOfLines={1}
            >
              {huddle.name}
            </Type>
            {huddle.roomRole === "owner" ? (
              <Crown color={colors.primary} size={12} />
            ) : null}
            {huddle.isPrivate ? (
              <Lock color={colors.mutedForeground} size={11} />
            ) : null}
          </View>

          {/* Two indicators, never one. Either can be true without the other. */}
          <View className="mt-1 flex-row flex-wrap items-center gap-x-3 gap-y-0.5">
            {here.length > 0 ? (
              <Type variant="data" tone="success" numberOfLines={1}>
                ● {here.slice(0, 2).join(", ")}
                {here.length > 2 ? ` +${here.length - 2}` : ""} in
              </Type>
            ) : (
              <Type variant="data" tone="tertiary">○ nobody in</Type>
            )}
            {gameOn ? (
              <Type variant="data" tone="primary">◆ game on</Type>
            ) : null}
          </View>
        </View>

        {huddle.hasUnread ? (
          <View className="ml-1 h-2.5 w-2.5 rounded-full bg-primary" />
        ) : null}
      </View>

      {/* The game, as one line. A score when it's on, the next one when it
          isn't — a room whose team plays Sunday should say so rather than
          look like a room with nothing to do. */}
      {game ? (
        <View
          className={cn(
            "mt-2.5 flex-row items-center gap-2 rounded-lg px-2.5 py-1.5",
            gameOn ? "bg-muted/60" : "border border-dashed border-border",
          )}
        >
          <Text
            className="shrink text-[11px] text-muted-foreground"
            numberOfLines={1}
          >
            {gameOn ? (
              <>
                <Text className="font-bold text-foreground">
                  {game.us.name} {game.us.score ?? 0}
                </Text>
                {" · "}
                <Text className="font-bold text-foreground">
                  {game.them.name} {game.them.score ?? 0}
                </Text>
              </>
            ) : (
              `${game.us.name} ${game.isHome ? "vs" : "at"} ${game.them.name}`
            )}
          </Text>
          <Type
            variant="dataStrong"
            tone={gameOn ? "primary" : "muted"}
            style={{ marginLeft: "auto" }}
          >
            {gameOn ? game.statusLabel : formatWhen(game.startTime)}
          </Type>
        </View>
      ) : null}

      {/* The best row on the screen: the team is playing and the room is
          empty. Not a gap — the one moment when going in first is worth
          something, and it says so at exactly the time it's true. */}
      {gameOn && nobodyHome ? (
        <View className="mt-2 rounded-lg bg-primary/10 px-2.5 py-1.5">
          <Type variant="captionStrong" tone="primary">
            ◆ Nobody's in here yet — go first
          </Type>
        </View>
      ) : huddle.latestMessage ? (
        <Type
          variant="caption"
          tone="muted"
          style={{ marginTop: 8 }}
          numberOfLines={1}
        >
          {huddle.latestMessage}
        </Type>
      ) : null}
    </Pressable>
  );
}

function formatWhen(startTime: string): string {
  const d = new Date(startTime);
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  if (mins < 0) return "";
  if (mins < 60) return `in ${mins}m`;
  const t = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const days = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date().setHours(0, 0, 0, 0)) /
      86400000,
  );
  if (days === 0) return t;
  if (days === 1) return `Tmrw ${t}`;
  return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${t}`;
}

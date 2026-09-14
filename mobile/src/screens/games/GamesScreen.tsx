import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { SectionLabel, Type } from "@/components/ui/Type";
import { useAllGames, type SlateGame } from "@/hooks/useAllGames";
import type { GamePresence } from "@/hooks/useGameHuddles";
import { useUserHuddles } from "@/hooks/useUserHuddles";
import { getFollowedTeamIds } from "@/lib/follows";
import { colors } from "@/theme/colors";
import { openGameRoom } from "@/lib/gameRoom";
import { useGameHuddles } from "@/hooks/useGameHuddles";
import { cardStyle } from "@/theme/cardStyle";
import { personColor } from "@/lib/personColor";

const CHIPS = ["ALL", "NFL", "NCAAF", "NBA", "NCAAB", "MLB", "NHL"] as const;

/**
 * Every game on, grouped by what it has to do with you.
 *
 * This tab replaces Teams. Teams listed your own rooms grouped by team, which
 * Home already does — the one thing that made it distinct was other people's
 * rooms for your team, and those were cut. This carries something that exists
 * nowhere else: the whole slate.
 *
 * It is also the answer to the complaint the product started from. There are
 * games on that aren't your team's, and until now there was nowhere to go with
 * that.
 *
 * GROUPS, NOT FILTERS. "Yours" floats to the top and everything else is still
 * there underneath. Hiding the rest would recreate the problem: you opened this
 * tab precisely to find a game that isn't yours.
 *
 * Tapping a game goes to your room for one of its teams, or to making one. It
 * deliberately does not open a public room full of strangers — that is the
 * empty-room problem, and it is why there is no game-room directory.
 */
export function GamesScreen() {
  const navigation = useNavigation<any>();
  const [league, setLeague] = useState<(typeof CHIPS)[number]>("ALL");

  const { data: followed } = useQuery({
    queryKey: ["followed-teams"],
    queryFn: getFollowedTeamIds,
    staleTime: 5 * 60_000,
  });
  const { data: huddles } = useUserHuddles();
  const { data: games, isLoading, refetch, isRefetching } = useAllGames(followed ?? []);
  // Who is in the huddle for each of these fixtures. A list of scores with
  // nothing about people is a scoreboard, not a reason to open anything.
  const presence = useGameHuddles((games ?? []).map((g) => g.gameId));

  const shown = useMemo(
    () => (games ?? []).filter((g) => league === "ALL" || g.league === league),
    [games, league],
  );

  const groups = useMemo(() => {
    const yours = shown.filter((g) => g.yours && g.status !== "final");
    const live = shown.filter((g) => !g.yours && g.status === "live");
    const later = shown.filter((g) => !g.yours && g.status === "upcoming");
    const done = shown.filter((g) => !g.yours && g.status === "final");
    return { yours, live, later, done };
  }, [shown]);

  /**
   * Tapping a game opens THAT GAME's huddle.
   *
   * It used to look for one of your own huddles for either team and, failing
   * that, send you to a naming form — so for a new user every tap on the
   * slate was a form. Your own huddle still wins when you have one; otherwise
   * you land in the public one for the fixture.
   */
  const openGame = async (g: SlateGame) => {
    // "YOURS" MUST NOT MEAN THE OFFICIAL COMMUNITY HUDDLE. You are a member
    // of "New York Giants Community" without ever having made or chosen it,
    // so tapping the Giants–Rams fixture matched it and took you to a lobby
    // instead of the game. Home already excludes official huddles from Your
    // Huddles; this used the same data with a different idea of "yours".
    const mine = (huddles ?? []).find(
      (h) => !h.isOfficialTeam &&
        (h.teamId === g.home.teamId || h.teamId === g.away.teamId),
    );
    if (mine) {
      navigation.navigate("Huddle", { huddleId: mine.id });
      return;
    }
    await openGameRoom(g.gameId, navigation);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center px-4 pb-2 pt-2">
        <Type variant="display" style={{ fontSize: 26 }}>
          Games
        </Type>
      </View>

      {/* League chips. A 147-game college Saturday is the load case, and
          scrolling all of it to find one NBA game is not a plan. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 5, paddingHorizontal: 16, paddingBottom: 8 }}
        style={{ flexGrow: 0 }}
      >
        {CHIPS.map((c) => {
          const on = c === league;
          return (
            <Pressable
              key={c}
              onPress={() => setLeague(c)}
              className="rounded-full px-2.5 py-1 active:opacity-70"
              style={{
                borderWidth: 1,
                borderColor: on ? colors.foreground : colors.border,
                backgroundColor: on ? colors.foreground : "transparent",
              }}
            >
              <Type variant="data" style={{ color: on ? "#000" : colors.mutedForeground }}>
                {c}
              </Type>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 11 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {isLoading ? (
          <View className="py-16">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : shown.length === 0 ? (
          <View className="mt-10 px-5">
            <Type center variant="heading">
              Nothing on
            </Type>
            <Type center variant="caption" tone="muted" className="mt-2">
              {league === "ALL"
                ? "No games in the next day or so. It happens in July."
                : `No ${league} games right now.`}
            </Type>
          </View>
        ) : (
          <>
            {groups.yours.length > 0 ? (
              <>
                <SectionLabel count={groups.yours.length}>Your teams</SectionLabel>
                {groups.yours.map((g) => (
                  <GameRow key={g.gameId} game={g} here={presence.get(g.gameId)} onPress={() => openGame(g)} />
                ))}
              </>
            ) : null}

            {groups.live.length > 0 ? (
              <>
                <SectionLabel count={groups.live.length}>On now</SectionLabel>
                {groups.live.map((g) => (
                  <GameRow key={g.gameId} game={g} here={presence.get(g.gameId)} onPress={() => openGame(g)} />
                ))}
              </>
            ) : null}

            {groups.later.length > 0 ? (
              <>
                <SectionLabel count={groups.later.length}>Later</SectionLabel>
                {groups.later.map((g) => (
                  <GameRow key={g.gameId} game={g} here={presence.get(g.gameId)} onPress={() => openGame(g)} />
                ))}
              </>
            ) : null}

            {groups.done.length > 0 ? (
              <>
                <SectionLabel count={groups.done.length}>Final</SectionLabel>
                {groups.done.map((g) => (
                  <GameRow key={g.gameId} game={g} here={presence.get(g.gameId)} onPress={() => openGame(g)} />
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function GameRow({
  game,
  here,
  onPress,
}: {
  game: SlateGame;
  here?: GamePresence;
  onPress: () => void;
}) {
  const live = game.status === "live";
  const a = game.away.score ?? 0;
  const h = game.home.score ?? 0;
  const scored = live || game.status === "final";
  const friends = here?.friends ?? [];

  return (
    <Pressable
      onPress={onPress}
      className="mb-2.5 rounded-[15px] px-3 py-3 active:opacity-80"
      // Solid gold live, dashed gold when a friend is in a side huddle off it,
      // a plain light stroke otherwise. See theme/cardStyle.
      style={cardStyle(here?.inSideHuddle ? "side" : live ? "live" : "quiet")}
    >
      <Side side={game.away} score={scored ? a : null} leading={a >= h} />
      <Side side={game.home} score={scored ? h : null} leading={h >= a} />

      <Type
        variant="data"
        tone={live ? "primary" : game.status === "final" ? "success" : "info"}
        className="mt-1.5"
        style={{ fontSize: 12 }}
      >
        {live ? `◆ ${game.statusLabel}` : game.statusLabel}
      </Type>

      {/* NAMES, THEN A NUMBER. "Mike, Sarah in" is why you tap; "43 here" is
          why you tap when you know nobody. Neither was on this card. */}
      <View
        className="mt-2.5 flex-row items-center gap-2 pt-2.5"
        style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)", minHeight: 26 }}
      >
        {friends.length > 0 ? (
          <>
            <View className="flex-row">
              {friends.slice(0, 3).map((n, i) => (
                <View
                  key={`${n}-${i}`}
                  className="h-[19px] w-[19px] items-center justify-center rounded-full"
                  style={{
                    backgroundColor: personColor(n),
                    borderWidth: 1.5,
                    borderColor: colors.card,
                    marginLeft: i === 0 ? 0 : -6,
                  }}
                >
                  <Type variant="data" style={{ color: "#000", fontSize: 8 }}>
                    {n.slice(0, 1).toUpperCase()}
                  </Type>
                </View>
              ))}
            </View>
            <Type variant="data" tone="success" numberOfLines={1} style={{ fontSize: 11.5, flexShrink: 1 }}>
              {friends.slice(0, 2).join(", ")}
              {friends.length > 2 ? ` +${friends.length - 2}` : ""}
              {here?.inSideHuddle ? " · side huddle" : " in"}
            </Type>
          </>
        ) : (
          <Type variant="data" tone="tertiary" style={{ fontSize: 11.5 }}>
            nobody you know
          </Type>
        )}
        {here && here.total > 0 ? (
          <Type variant="data" tone="muted" style={{ marginLeft: "auto", fontSize: 11.5 }}>
            {here.total} here
          </Type>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * One team's line. Leading side bright, trailing muted — you read who is
 * winning without reading a number.
 */
function Side({
  side,
  score,
  leading,
}: {
  side: SlateGame["home"];
  score: number | null;
  leading: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-4 w-4 items-center justify-center overflow-hidden rounded-full bg-muted">
        {side.logoUrl ? (
          <Image source={{ uri: side.logoUrl }} className="h-full w-full" resizeMode="cover" />
        ) : null}
      </View>
      <Type variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
        {side.name}
      </Type>
      {score != null ? (
        <Type
          variant="score"
          tone={leading ? "default" : "muted"}
          style={{ marginLeft: "auto", fontSize: 15 }}
        >
          {score}
        </Type>
      ) : null}
    </View>
  );
}

export default GamesScreen;

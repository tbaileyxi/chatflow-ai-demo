import { useMemo } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { type RoomGame } from "@/hooks/useRoomGames";
import {
  useAllGames,
  compareSlate,
  isWorthTheSlate,
  nationalNetwork,
} from "@/hooks/useAllGames";
import { useNavigation } from "@react-navigation/native";
import { useUserHuddles } from "@/hooks/useUserHuddles";
import { useGlobalPresence } from "@/contexts/GlobalPresenceContext";
import { getFollowedTeamIds } from "@/lib/follows";
import { SectionLabel, Type } from "@/components/ui/Type";
import { personColor } from "@/lib/personColor";
import { cardStyle } from "@/theme/cardStyle";
import { colors } from "@/theme/colors";

/**
 * What's on, in one row.
 *
 * NOT a schedule, and NOT just your teams.
 *
 * It used to ask only for the games of teams you follow or have a room about,
 * which meant Monday Night Football could not appear on Home unless you
 * happened to follow one of the two sides. That is backwards: the reason this
 * strip exists is the games going on OUTSIDE your own rooms.
 *
 * It takes the whole slate now and ranks it the way a person picks what to put
 * on — NFL, then a ranked college game, then basketball, with baseball's
 * hundred-and-sixty-two-game season last, and anything on television above
 * anything that is not. Yours floats up inside that, and live beats all of it.
 * See slateOrder in useAllGames.
 *
 * And it disappears entirely when nothing is on. A strip that's always there
 * stops meaning anything; in July there should be no strip, and Home should
 * just be your rooms.
 *
 * "Where your friends are" would rank above all of this, but it belongs on the
 * room rows — those already say who's in them, and a game row repeating it
 * would be two answers to one question.
 */
export function GamesStrip({
  onPickGame,
}: {
  onPickGame?: (game: RoomGame) => void;
}) {
  const navigation = useNavigation<any>();
  const { data: huddles } = useUserHuddles();
  const { presentUsers } = useGlobalPresence();

  const { data: followed } = useQuery({
    queryKey: ["followed-teams"],
    queryFn: getFollowedTeamIds,
    staleTime: 5 * 60_000,
  });

  const teamIds = useMemo(() => {
    const roomTeams = (huddles ?? []).map((h) => h.teamId).filter(Boolean) as string[];
    return [...new Set([...(followed ?? []), ...roomTeams])];
  }, [followed, huddles]);

  const { data: slate } = useAllGames(teamIds);

  const { games, more } = useMemo(() => {
    if (!slate) return { games: [] as (RoomGame & { broadcast: string | null })[], more: 0 };

    const ranked = slate.filter(isWorthTheSlate).sort(compareSlate);

    // Adapted to the row shape this strip already draws. "us" is YOUR team
    // when one of them is yours, and otherwise the away side — which is how a
    // scorebug reads a game you have no stake in.
    const rows = ranked
      .filter((g) => g.home.teamId && g.away.teamId)
      .map((g) => {
        const mineIsHome = g.yours && !!g.home.teamId && teamIds.includes(g.home.teamId);
        const us = mineIsHome ? g.home : g.away;
        const them = mineIsHome ? g.away : g.home;
        return {
          gameId: g.gameId,
          status: g.status,
          startTime: g.startTime,
          period: null,
          clock: null,
          sportKey: g.sportKey,
          statusLabel: g.statusLabel,
          us: { ...us, teamId: us.teamId! },
          them: { ...them, teamId: them.teamId! },
          isHome: mineIsHome,
          broadcast: nationalNetwork(g.broadcast),
        };
      });

    return { games: rows.slice(0, 6), more: Math.max(0, rows.length - 6) };
  }, [slate, teamIds]);

  /**
   * Who you know, per game.
   *
   * A room is attached to a team, and presence says who is in which room, so
   * the people in a room for either side of a fixture are the people watching
   * it. This is the row the artifact cares most about — "Mike, Sarah" is the
   * reason to tap a card, and a score is not.
   */
  const watchersByGame = useMemo(() => {
    const inRoom = new Map<string, string[]>();
    for (const u of presentUsers) {
      if (!u.huddleId) continue;
      const first = (u.displayName ?? "Someone").split(/\s+/)[0];
      inRoom.set(u.huddleId, [...(inRoom.get(u.huddleId) ?? []), first]);
    }
    const byGame = new Map<string, string[]>();
    for (const g of games) {
      const names = new Set<string>();
      for (const h of huddles ?? []) {
        if (h.teamId !== g.us.teamId && h.teamId !== g.them.teamId) continue;
        for (const n of inRoom.get(h.id) ?? []) names.add(n);
      }
      byGame.set(g.gameId, [...names]);
    }
    return byGame;
  }, [games, huddles, presentUsers]);

  // Nothing on: no strip, no empty state, no "no games" label. Home is your
  // rooms and this row simply isn't part of it right now.
  if (games.length === 0) return null;

  // GAME HUDDLES, because that is what a card opens — the public room for
  // that fixture, not a schedule entry.
  //
  // The heading used to read "On now" whenever ANY game was live, while the
  // number beside it was the count of CARDS. Four live games and six cards
  // rendered as "ON NOW 6", which is a claim about the world that was simply
  // untrue. The label is now fixed and the number says what it counts.
  const label = "Game huddles";
  const liveCount = games.filter((g) => g.status === "live").length;
  const count = liveCount > 0 ? `${liveCount} live ›` : `${games.length} ›`;

  return (
    <View className="mb-5">
      <View className="mb-2.5 flex-row items-center justify-between px-4">
        <SectionLabel
          icon={
            <Type variant="dataStrong" tone="primary" style={{ fontSize: 13 }}>
              ◆
            </Type>
          }
          count={count}
        >
          {label}
        </SectionLabel>

      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      >
        {games.map((g) => {
          const live = g.status === "live";
          const settled = g.status === "final";
          const us = g.us.score ?? 0;
          const them = g.them.score ?? 0;
          const watchers = watchersByGame.get(g.gameId) ?? [];
          return (
            <Pressable
              key={g.gameId}
              onPress={() => onPickGame?.(g)}
              className="w-[150px] rounded-[13px] px-2.5 py-2 active:opacity-80"
              style={cardStyle(live ? "live" : "quiet")}
            >
              <Row side={g.us} score={live || settled ? us : null} leading={us >= them} />
              <Row side={g.them} score={live || settled ? them : null} leading={them >= us} />

              <Type
                variant="data"
                tone={live ? "primary" : settled ? "success" : "info"}
                style={{ fontSize: 10, marginTop: 5 }}
                numberOfLines={1}
              >
                {live ? `◆ ${g.statusLabel}` : g.statusLabel}
              </Type>

              {/* WHERE IT IS ON. "8:15 PM" tells you when; the network is what
                  tells you this is the game rather than one of forty. */}
              {g.broadcast ? (
                <Type
                  variant="data"
                  tone="tertiary"
                  style={{ fontSize: 10, marginTop: 1 }}
                  numberOfLines={1}
                >
                  {g.broadcast}
                </Type>
              ) : null}

              {/* NAMES, NEVER COUNTS. The artifact is explicit: "Mike, Sarah"
                  is what makes you tap a card, and when there is nobody it
                  says so plainly rather than leaving the row empty. */}
              <View
                className="mt-1.5 flex-row items-center gap-1.5 pt-1.5"
                style={{ borderTopWidth: 1, borderTopColor: "#223040", minHeight: 22 }}
              >
                {watchers.length > 0 ? (
                  <>
                    <View className="flex-row">
                      {watchers.slice(0, 2).map((w: string, i: number) => (
                        <View
                          key={`${w}-${i}`}
                          className="h-[16px] w-[16px] items-center justify-center rounded-full"
                          style={{
                            backgroundColor: personColor(w),
                            borderWidth: 1.5,
                            borderColor: colors.card,
                            marginLeft: i === 0 ? 0 : -5,
                          }}
                        >
                          <Type variant="data" style={{ color: "#000", fontSize: 7 }}>
                            {w.slice(0, 1).toUpperCase()}
                          </Type>
                        </View>
                      ))}
                    </View>
                    <Type variant="data" tone="success" numberOfLines={1} style={{ fontSize: 9, flexShrink: 1 }}>
                      {watchers.slice(0, 2).join(", ")}
                    </Type>
                  </>
                ) : (
                  <Type variant="data" tone="primary" style={{ fontSize: 9 }}>
                    be first in →
                  </Type>
                )}
              </View>
            </Pressable>
          );
        })}

        {/* Six is what fits before a horizontal list stops being scannable.
            The rest are a tab away rather than gone. */}
        {more > 0 ? (
          <Pressable
            onPress={() => navigation.navigate("MainTabs", { screen: "Games" })}
            className="w-[110px] items-center justify-center rounded-[13px] px-2.5 py-2 active:opacity-70"
            style={cardStyle("quiet")}
          >
            <Type variant="captionStrong" tone="primary">See all</Type>
            <Type variant="data" tone="tertiary" style={{ fontSize: 10, marginTop: 2 }}>
              {more} more
            </Type>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * One team's line: crest, nickname, score.
 *
 * The leading side stays bright and the trailing side drops to muted, so the
 * card answers "who's winning" before you read a digit.
 */
function Row({
  side,
  score,
  leading,
}: {
  side: RoomGame["us"];
  score: number | null;
  leading: boolean;
}) {
  return (
    <View className="flex-row items-center gap-1.5" style={{ marginBottom: 3 }}>
      <View
        className="h-[17px] w-[17px] items-center justify-center overflow-hidden rounded-full"
        style={{ backgroundColor: "#1B2430" }}
      >
        {side.logoUrl ? (
          <Image source={{ uri: side.logoUrl }} style={{ width: 14, height: 14 }} resizeMode="contain" />
        ) : null}
      </View>
      <Type
        variant="data"
        tone={score == null || leading ? "default" : "muted"}
        numberOfLines={1}
        style={{ fontSize: 11, flexShrink: 1 }}
      >
        {side.name}
      </Type>
      {score != null ? (
        <Type
          variant="score"
          tone={leading ? "default" : "muted"}
          style={{ marginLeft: "auto", fontSize: 16 }}
        >
          {score}
        </Type>
      ) : null}
    </View>
  );
}

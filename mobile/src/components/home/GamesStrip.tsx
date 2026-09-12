import { useMemo } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRoomGames, type RoomGame } from "@/hooks/useRoomGames";
import { useUserHuddles } from "@/hooks/useUserHuddles";
import { useGlobalPresence } from "@/contexts/GlobalPresenceContext";
import { getFollowedTeamIds } from "@/lib/follows";
import { SectionLabel, Type } from "@/components/ui/Type";
import { personColor } from "@/lib/personColor";

/**
 * What's on, in one row.
 *
 * NOT a schedule. On a college Saturday there are 147 games and nobody scrolls
 * a list of them — so this shows at most six, ordered by the only things that
 * make a game yours:
 *
 *   1. a team you follow is playing
 *   2. a team one of your rooms is about is playing
 *   3. it's live and close
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

  const { data: byTeam } = useRoomGames(teamIds);

  const games = useMemo(() => {
    if (!byTeam) return [];
    // One game can belong to two of your teams — a rivalry where you follow
    // both sides shouldn't show up twice.
    const seen = new Set<string>();
    const list: RoomGame[] = [];
    for (const g of byTeam.values()) {
      if (seen.has(g.gameId)) continue;
      seen.add(g.gameId);
      list.push(g);
    }

    const soon = Date.now() + 8 * 24 * 60 * 60 * 1000;
    return list
      .filter(
        (g) => g.status === "live" || new Date(g.startTime).getTime() < soon,
      )
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "live" ? -1 : 1;
        return (
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
      })
      .slice(0, 6);
  }, [byTeam]);

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

  const anyLive = games.some((g) => g.status === "live");
  const tonight = games.some(
    (g) => new Date(g.startTime).getTime() < Date.now() + 12 * 60 * 60 * 1000,
  );

  return (
    <View className="mb-5">
      <View className="mb-2.5 flex-row items-center justify-between px-4">
        <SectionLabel
          icon={
            <Type variant="dataStrong" tone="primary" style={{ fontSize: 13 }}>
              ◆
            </Type>
          }
          count={`${games.length} ›`}
        >
          {anyLive ? "On now" : tonight ? "Tonight" : "Coming up"}
        </SectionLabel>

      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      >
        {games.map((g) => {
          const live = g.status === "live";
          const us = g.us.score ?? 0;
          const them = g.them.score ?? 0;
          const watchers = watchersByGame.get(g.gameId) ?? [];
          return (
            <Pressable
              key={g.gameId}
              onPress={() => onPickGame?.(g)}
              className="w-[150px] rounded-[13px] px-2.5 py-2 active:opacity-80"
              style={{
                backgroundColor: live ? "#1A2431" : "#151E2A",
                borderWidth: 1,
                borderColor: live ? "#3B4A5C" : "#1E2937",
              }}
            >
              <Row side={g.us} score={live ? us : null} leading={us >= them} />
              <Row side={g.them} score={live ? them : null} leading={them >= us} />

              <Type
                variant="data"
                tone={live ? "primary" : "info"}
                style={{ fontSize: 10, marginTop: 5 }}
                numberOfLines={1}
              >
                {live ? `◆ ${g.statusLabel}` : g.statusLabel}
              </Type>

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
                            borderColor: "#151E2A",
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
                  <Type variant="data" tone="tertiary" style={{ fontSize: 9 }}>
                    nobody you know
                  </Type>
                )}
              </View>
            </Pressable>
          );
        })}
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

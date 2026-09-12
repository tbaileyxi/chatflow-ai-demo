import { useMemo } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRoomGames, type RoomGame } from "@/hooks/useRoomGames";
import { useUserHuddles } from "@/hooks/useUserHuddles";
import { getFollowedTeamIds } from "@/lib/follows";
import { SectionLabel, Type } from "@/components/ui/Type";

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

    const soon = Date.now() + 12 * 60 * 60 * 1000;
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

  // Nothing on today: no strip, no empty state, no "no games" label. Home is
  // your rooms and this row simply isn't part of it right now.
  if (games.length === 0) return null;

  const anyLive = games.some((g) => g.status === "live");

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
          {anyLive ? "On now" : "Tonight"}
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
          return (
            <Pressable
              key={g.gameId}
              onPress={() => onPickGame?.(g)}
              className="w-[178px] overflow-hidden rounded-[14px] active:opacity-80"
              style={{
                backgroundColor: live ? "#15161A" : "#111113",
                borderWidth: 1,
                borderColor: live ? "rgba(255,91,77,0.30)" : "#2A2A2F",
              }}
            >
              {live ? (
                <View style={{ height: 2.5, backgroundColor: "#FF5B4D" }} />
              ) : null}

              <View className="gap-1.5 px-2.5 py-2.5">
                <Row side={g.us} score={live ? us : null} leading={us >= them} />
                <Row side={g.them} score={live ? them : null} leading={them >= us} />
              </View>

              <View style={{ height: 1, backgroundColor: "#1E2027" }} />
              <View className="flex-row items-center gap-1.5 px-2.5 py-1.5">
                {live ? (
                  <View
                    style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#FF5B4D" }}
                  />
                ) : null}
                <Type variant="data" tone={live ? "default" : "tertiary"} numberOfLines={1}>
                  {g.statusLabel}
                </Type>
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
    <View className="flex-row items-center gap-2">
      <View className="h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-md"
        style={{ backgroundColor: "#1B1D23" }}>
        {side.logoUrl ? (
          <Image source={{ uri: side.logoUrl }} style={{ width: 17, height: 17 }} resizeMode="contain" />
        ) : null}
      </View>
      <Type
        variant="captionStrong"
        tone={score == null || leading ? "default" : "muted"}
        numberOfLines={1}
        style={{ flexShrink: 1 }}
      >
        {side.name}
      </Type>
      {score != null ? (
        <Type variant="score" tone={leading ? "default" : "muted"} style={{ marginLeft: "auto" }}>
          {score}
        </Type>
      ) : null}
    </View>
  );
}

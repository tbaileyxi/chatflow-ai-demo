import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRoomGames, type RoomGame } from "@/hooks/useRoomGames";
import { useUserHuddles } from "@/hooks/useUserHuddles";
import { getFollowedTeamIds } from "@/lib/follows";
import { Eyebrow, Type } from "@/components/ui/Type";
import { cn } from "@/lib/utils";

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
        <Eyebrow tone="default">{anyLive ? "On now" : "Tonight"}</Eyebrow>
        <Type variant="data" tone="muted">
          {games.length} {games.length === 1 ? "game" : "games"}
        </Type>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {games.map((g) => (
          <Pressable
            key={g.gameId}
            onPress={() => onPickGame?.(g)}
            className={cn(
              "w-[142px] rounded-xl border p-2.5 active:opacity-80",
              g.status === "live"
                ? "border-[#3A3A24] bg-card"
                : "border-border bg-card",
            )}
          >
            <Row name={g.us.name} score={g.us.score} live={g.status === "live"} />
            <Row
              name={g.them.name}
              score={g.them.score}
              live={g.status === "live"}
            />
            <Text
              className={cn(
                "mt-2 text-[10px] font-bold",
                g.status === "live" ? "text-primary" : "text-muted-foreground",
              )}
              numberOfLines={1}
            >
              {g.statusLabel}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Row({
  name,
  score,
  live,
}: {
  name: string;
  score: number | null;
  live: boolean;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Type variant="data" tone="muted" className="shrink"
        
        numberOfLines={1}>
        {name}
      </Type>
      {live ? (
        <Type variant="captionStrong" className="ml-auto">
          {score ?? 0}
        </Type>
      ) : null}
    </View>
  );
}

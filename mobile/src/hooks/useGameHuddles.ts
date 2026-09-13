import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalPresence } from "@/contexts/GlobalPresenceContext";
import { useKnownPeople } from "@/hooks/useFriends";

export type GamePresence = {
  /** The public huddle for this fixture, once somebody has opened it. */
  huddleId: string | null;
  /** First names of people you know who are in it, or in a side huddle off it. */
  friends: string[];
  /** Everybody in it, friends included. */
  total: number;
  /** True when a friend is in a SIDE huddle off this game rather than in the
   *  public one — they get the dashed treatment. */
  inSideHuddle: boolean;
};

/**
 * Who is in the huddles attached to these games.
 *
 * THE GAMES TAB WAS A LIST OF FIXTURES. It said nothing about whether a game
 * already had people in it, which is the only thing that makes one game worth
 * opening over another — and it is the thing the design put on every card.
 *
 * One query for every game on screen, not one per game. Presence itself comes
 * from the channel the app already runs, so this only has to map huddles back
 * to their fixtures.
 */
export function useGameHuddles(gameIds: string[]) {
  const key = [...new Set(gameIds)].sort().join(",");
  const { presentUsers } = useGlobalPresence();
  const { data: knownPeople } = useKnownPeople();

  const { data: huddles } = useQuery({
    queryKey: ["game-huddles", key],
    enabled: gameIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("huddles")
        .select("id, game_id, is_game_room, expires_at")
        .in("game_id", [...new Set(gameIds)]);
      // A build that predates the migration has no game_id column. That is
      // not an error worth surfacing — it just means no game has a huddle.
      if (error) return [];
      return (data ?? []) as {
        id: string;
        game_id: string;
        is_game_room: boolean;
        expires_at: string | null;
      }[];
    },
  });

  return useMemo(() => {
    const out = new Map<string, GamePresence>();
    if (!huddles?.length) return out;

    const known = new Set((knownPeople ?? []).map((p: any) => p.userId));
    const byHuddle = new Map<string, { name: string; known: boolean }[]>();
    for (const u of presentUsers) {
      if (!u.huddleId) continue;
      const list = byHuddle.get(u.huddleId) ?? [];
      list.push({
        name: (u.displayName ?? "Someone").split(/\s+/)[0],
        known: known.has(u.userId),
      });
      byHuddle.set(u.huddleId, list);
    }

    for (const h of huddles) {
      if (!h.game_id) continue;
      const here = byHuddle.get(h.id) ?? [];
      const prev = out.get(h.game_id) ?? {
        huddleId: null,
        friends: [],
        total: 0,
        inSideHuddle: false,
      };
      out.set(h.game_id, {
        // Only the public one is a destination; a side huddle you are not in
        // is not somewhere you can be sent.
        huddleId: h.is_game_room ? h.id : prev.huddleId,
        friends: [...prev.friends, ...here.filter((p) => p.known).map((p) => p.name)],
        total: prev.total + here.length,
        inSideHuddle:
          prev.inSideHuddle || (!h.is_game_room && here.some((p) => p.known)),
      });
    }
    return out;
  }, [huddles, presentUsers, knownPeople]);
}

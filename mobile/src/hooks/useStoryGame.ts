// The game this room just watched — which is not the game it is watching.
//
// useLiveGameContext answers "what is on now, or next": in-progress, then
// kicked-off-but-not-yet-flagged, then the next fixture. It has no branch for
// a game that has just ended, so the instant a game goes final it returns
// NEXT week's, which is correct for a header counting down and wrong for
// everything about the game that finished.
//
// The story cared about exactly that gap. Built on the live context it worked
// during a game and vanished at full time, taking the fifteen-minute wait
// with it — the delay could never elapse, because by the time it had, the
// hook was pointing a week into the future.
//
// So the story resolves its own game: the last one this team actually
// played. Kept out of useLiveGameContext deliberately — the header, the ping
// and the fade cards all read that hook, and teaching it to return finished
// games would change all of them to answer a question only this feature is
// asking.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GameContext } from "@/hooks/useLiveGameContext";

/**
 * How far back a finished game still counts as "the one we just watched".
 *
 * Nine hours, the same bound useLiveGameContext uses for a live game, so a
 * long afternoon plus sync lag is covered and yesterday's game never is.
 */
const RECENT_MS = 9 * 60 * 60 * 1000;

const FINAL = ["final", "completed", "closed"];

/**
 * The finished game to build a story from, or null.
 *
 * Null is the normal answer most of the time — mid-game, and any day a team
 * did not play. Callers fall back to the live game so an admin checking the
 * feature mid-match still sees something.
 */
export function useStoryGame(teamId: string | null | undefined) {
  return useQuery({
    queryKey: ["story-game", teamId],
    enabled: !!teamId,
    // A finished game does not change. Re-asking every focus is wasted.
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<GameContext | null> => {
      if (!teamId) return null;

      const { data } = await supabase
        .from("games")
        .select("*")
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .in("status", FINAL)
        .gte("start_time", new Date(Date.now() - RECENT_MS).toISOString())
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return null;

      const g = data as any;
      const ids = [g.home_team_id, g.away_team_id].filter(Boolean);
      const names = new Map<string, { name: string; city: string | null }>();
      if (ids.length) {
        const { data: teams } = await supabase
          .from("teams")
          .select("id, name, city")
          .in("id", ids);
        for (const t of teams ?? []) {
          names.set((t as any).id, { name: (t as any).name, city: (t as any).city });
        }
      }
      const home = g.home_team_id ? names.get(g.home_team_id) : undefined;
      const away = g.away_team_id ? names.get(g.away_team_id) : undefined;

      return {
        id: g.id,
        homeTeamId: g.home_team_id,
        awayTeamId: g.away_team_id,
        homeScore: g.home_score,
        awayScore: g.away_score,
        clock: g.clock,
        period: g.period,
        status: g.status,
        startTime: g.start_time,
        wentFinalAt: g.went_final_at ?? null,
        sportKey: g.sport_key ?? "",
        settleable: true,
        homeTeamName: home?.name ?? null,
        awayTeamName: away?.name ?? null,
        homeTeamCity: home?.city ?? null,
        awayTeamCity: away?.city ?? null,
      };
    },
  });
}

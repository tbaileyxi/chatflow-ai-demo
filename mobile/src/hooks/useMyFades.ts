// YOUR fades that haven't settled — the ones you have chips sitting on.
//
// This was the hole. Picks showed `useOpenFades` (everyone ELSE's open props,
// yours deliberately excluded — you cannot take your own side) and
// `useFadeHistory` (settled only). A fade you posted yourself, still waiting on
// a taker or locked in and playing, appeared on neither. So the chips came out
// of your balance at post time and the pick existed nowhere you could see it,
// which reads exactly like the app losing your bet.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MyFade = {
  id: string;
  line: string;
  side: "over" | "under";
  stake: number;
  matchup: string;
  huddleName: string;
  /** open = nobody has taken the other side; locked = matched, game to come. */
  status: "open" | "locked";
  commenceTime: string;
  /** Whether it can still be taken — a game that has started never will be. */
  stillTakeable: boolean;
};

export function useMyFades() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-fades", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<MyFade[]> => {
      if (!user) return [];

      const { data: fades } = await supabase
        .from("fades")
        .select("*")
        .in("status", ["open", "locked"])
        .or(`poster_id.eq.${user.id},accepter_id.eq.${user.id}`)
        .order("game_commence_time", { ascending: true })
        .limit(50);

      const rows = (fades ?? []) as any[];
      if (rows.length === 0) return [];

      // Room names in one round trip rather than per card.
      const huddleIds = [...new Set(rows.map((f) => f.huddle_id))];
      const { data: huddles } = await supabase
        .from("huddles")
        .select("id, name")
        .in("id", huddleIds);
      const roomOf = new Map((huddles ?? []).map((h: any) => [h.id, h.name]));

      const now = Date.now();
      return rows.map((f) => {
        // On a fade you ACCEPTED you hold the opposite side of the one posted.
        const mine: "over" | "under" =
          f.accepter_id === user.id
            ? f.fade_type === "over"
              ? "under"
              : "over"
            : f.fade_type;
        return {
          id: f.id,
          line: f.line_description ?? "",
          side: mine,
          stake: f.stake,
          matchup: `${f.away_team} @ ${f.home_team}`,
          huddleName: roomOf.get(f.huddle_id) ?? "A room",
          status: f.status,
          commenceTime: f.game_commence_time,
          stillTakeable:
            f.status === "open" && new Date(f.game_commence_time).getTime() > now,
        };
      });
    },
  });
}

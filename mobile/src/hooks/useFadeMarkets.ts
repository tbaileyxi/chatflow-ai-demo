import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GameContext } from "@/hooks/useLiveGameContext";

// Real, per-game fade props sourced from the same SportsGameOdds markets that
// power predictions (`kalshi_markets`, synced by odds-sync-markets). Replaces
// the old hardcoded per-sport constants, which handed every game an identical
// line. A fade always points at one of these markets, so odds-settle can grade
// it and the ledger can pay the winner.

export type FadeMarket = {
  marketId: string;
  marketType: string; // "total" | "spread" | "winner" | player prop
  label: string; // short chip text, e.g. "Total 8.5"
  line: number | null; // the real number (null for moneyline)
  overLabel: string; // what the poster's side means, e.g. "Over 8.5"
  underLabel: string; // what the fader's side means, e.g. "Under 8.5"
  description: string; // full question, stored on the fade + shown in chat
  startTime: string;
};

// Markets we let people fade head-to-head, best-first. Player props carry a real
// line ("over 1.5 hits") and are naturally two-sided, so they're the primary
// fade; totals and spreads join automatically once odds-sync-markets writes them.
// No "winner". This is the THIRD place markets get filtered — the poller has
// its own FADEABLE, the Picks board has its own type list, and this drives the
// Fade sheet. Moneyline was removed from the other two and survived here, so
// the sheet kept offering "Will the Giants win?" in a Giants room, where
// everyone picks the Giants and there is no argument to be had.
const FADEABLE = ["player_prop", "total", "spread"];

function toFadeMarket(m: any): FadeMarket | null {
  const meta = (m.metadata ?? {}) as Record<string, any>;
  const type = m.market_type ?? "other";
  const line = meta.line ?? meta.spread ?? null;
  const q: string = m.question ?? "";

  if (type === "total" && line != null) {
    return {
      marketId: m.id,
      marketType: type,
      label: `Total ${line}`,
      line: Number(line),
      overLabel: `Over ${line}`,
      underLabel: `Under ${line}`,
      description: q,
      startTime: m.event_start_time,
    };
  }
  if (type === "spread" && line != null) {
    const signed = Number(line) > 0 ? `+${line}` : `${line}`;
    return {
      marketId: m.id,
      marketType: type,
      label: `Spread ${signed}`,
      line: Number(line),
      overLabel: `Covers ${signed}`,
      underLabel: `Doesn't cover ${signed}`,
      description: q,
      startTime: m.event_start_time,
    };
  }
  // Player prop — the real workhorse. `question` reads "Nick Gonzales over 1.5
  // hits?", so strip the "over N" tail to name the side cleanly on both chips.
  if (type === "player_prop" && line != null) {
    const who = meta.player ?? q.replace(/\s+over\s+[\d.]+.*$/i, "").trim();
    const stat = String(meta.stat ?? "")
      .replace(/^batting_|^pitching_/, "")
      .replace(/_/g, " ");
    const unit = stat || q.match(/over\s+[\d.]+\s+(.+?)\?/i)?.[1] || "";
    return {
      marketId: m.id,
      marketType: type,
      label: `${who} ${line} ${unit}`.trim(),
      line: Number(line),
      overLabel: `Over ${line}`,
      underLabel: `Under ${line}`,
      description: q,
      startTime: m.event_start_time,
    };
  }
  if (type === "winner") {
    return {
      marketId: m.id,
      marketType: type,
      label: "Moneyline",
      line: null,
      overLabel: q.replace(/\?$/, ""),
      underLabel: "The other side",
      description: q,
      startTime: m.event_start_time,
    };
  }
  return null;
}

export function useFadeMarkets(game: GameContext | null) {
  const teamIds = [game?.homeTeamId, game?.awayTeamId].filter(Boolean) as string[];

  return useQuery({
    queryKey: ["fade-markets", game?.id, teamIds.join(",")],
    enabled: !!game && teamIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<FadeMarket[]> => {
      // Window the query to this game's start so we don't pull a team's next
      // series instead of the game the room is actually watching.
      const start = new Date(game!.startTime);
      const from = new Date(start.getTime() - 6 * 60 * 60 * 1000).toISOString();
      const to = new Date(start.getTime() + 6 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("kalshi_markets")
        .select("id, question, market_type, event_start_time, metadata, is_resolved")
        .in("team_id", teamIds)
        .eq("is_resolved", false)
        .in("market_type", FADEABLE)
        .gte("event_start_time", from)
        .lte("event_start_time", to)
        .order("event_start_time", { ascending: true });

      if (error) throw error;

      // A short slate — three or four props, the way the room actually talks
      // about a game: the game line first, then a few player props. Never the
      // whole book; too many choices and nobody takes any.
      const seen = new Set<string>();
      const gameLines: FadeMarket[] = [];
      const playerProps: FadeMarket[] = [];

      for (const row of data ?? []) {
        const fm = toFadeMarket(row);
        if (!fm || seen.has(fm.label)) continue;
        seen.add(fm.label);
        if (fm.marketType === "player_prop") playerProps.push(fm);
        else if (gameLines.every((g) => g.marketType !== fm.marketType)) gameLines.push(fm);
      }

      return [...gameLines, ...playerProps].slice(0, 4);
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { marketSides } from "@/lib/marketSides";
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

// Every market for one game shares the middle segment of its Kalshi ticker
// (KXMLBTOTAL-26AUG251905HOUNYY-9 -> 26AUG251905HOUNYY). That shared key is how
// a TOTAL finds its teams: totals arrive with team_id NULL, because a total
// belongs to both sides and there is no single team to hang it on. Filtering
// markets with .in("team_id", ...) therefore dropped every total, leaving the
// sheet offering only spreads — "Rays win by over 1.5", the one shape a room
// full of Rays fans will not argue about. Season futures (KXMLB-26-MIL) have a
// numeric middle segment and are rejected so they cannot pose as a game.
const GAME_KEY = /^\d{2}[A-Z]{3}\d/;

// Kalshi tickers (KXMLBTOTAL-26AUG251905HOUNYY-9) key the game in their middle
// segment; SGO tickers (sgo:{eventID}:{oddID}) key it in kalshi_event_ticker.
// Splitting an SGO ticker on "-" yields a player name, so one rule would drop
// every SGO market — all of college football and the NFL.
function gameKey(m: {
  kalshi_ticker?: string | null;
  kalshi_event_ticker?: string | null;
}): string | null {
  const ticker = m.kalshi_ticker ?? "";
  if (ticker.startsWith("sgo:")) return m.kalshi_event_ticker || null;
  const parts = ticker.split("-");
  if (parts.length < 2) return null;
  return GAME_KEY.test(parts[1]) ? parts[1] : null;
}

// The wording is not decided here. `marketSides` owns it, so the Fade sheet,
// the Picks board and the bot's own fade cards all say the same sentence about
// the same game — they used to say three different ones.
function toFadeMarket(m: any, teams: (string | null | undefined)[]): FadeMarket | null {
  const meta = (m.metadata ?? {}) as Record<string, any>;
  const type = m.market_type ?? "other";
  const line = meta.line ?? meta.spread ?? null;
  if (line == null) return null; // no real number = nothing to argue about

  const sides = marketSides(m, teams);
  return {
    marketId: m.id,
    marketType: type,
    label: sides.headline,
    line: Number(line),
    overLabel: sides.yesLabel,
    underLabel: sides.noLabel,
    description: m.question ?? "",
    startTime: m.event_start_time,
  };
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
        .select(
          "id, question, market_type, event_start_time, metadata, is_resolved, team_id, kalshi_ticker, kalshi_event_ticker",
        )
        .eq("is_resolved", false)
        .gte("event_start_time", from)
        .lte("event_start_time", to)
        .order("event_start_time", { ascending: true });

      if (error) throw error;

      // Group the window by game, then let each group's teams stand in for the
      // members that have none, so a total is matched by the spread and winner
      // markets sitting on the same ticker. Only groups touching THIS game's
      // teams survive — the same narrowing the team_id filter used to do, minus
      // the part that threw the totals away.
      const groups = new Map<string, { teams: Set<string>; rows: any[] }>();
      for (const row of data ?? []) {
        // One source, matching the bot. See fade-post-props: Kalshi and SGO
        // carry different lines for the same game, so a sheet that mixed them
        // would offer a number the room's card never showed.
        if (!String(row.kalshi_ticker ?? "").startsWith("sgo:")) continue;
        const key = gameKey(row);
        if (!key) continue;
        let g = groups.get(key);
        if (!g) {
          g = { teams: new Set<string>(), rows: [] };
          groups.set(key, g);
        }
        if (row.team_id) g.teams.add(row.team_id);
        if (FADEABLE.includes(String(row.market_type))) g.rows.push(row);
      }

      const rows: any[] = [];
      for (const g of groups.values()) {
        if (teamIds.some((t) => g.teams.has(t))) rows.push(...g.rows);
      }

      // A short slate — three or four props, the way the room actually talks
      // about a game: the game line first, then a few player props. Never the
      // whole book; too many choices and nobody takes any.
      const seen = new Set<string>();
      const gameLines: FadeMarket[] = [];
      const playerProps: FadeMarket[] = [];

      for (const row of rows) {
        const fm = toFadeMarket(row, [game?.homeTeamName, game?.awayTeamName]);
        if (!fm || seen.has(fm.label)) continue;
        seen.add(fm.label);
        if (fm.marketType === "player_prop") playerProps.push(fm);
        else if (gameLines.every((g) => g.marketType !== fm.marketType)) gameLines.push(fm);
      }

      return [...gameLines, ...playerProps].slice(0, 4);
    },
  });
}

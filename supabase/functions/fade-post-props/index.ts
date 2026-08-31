import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { marketSides } from "../_shared/markets/sides.ts";

// Drops a short slate of UNCLAIMED fade props into every room watching a game,
// the way the original gameday flow worked: 3–4 props with a real line pop up in
// chat, someone takes a side, someone takes the other. This function only posts
// the cards — the claim (which stakes chips) happens client-side under the
// tapping user's own auth via post_fade, so nothing here needs a poster.
//
// Only games that live in the `games` table are eligible, because that is what
// fade-settle grades from a final score. Markets come from the same
// SportsGameOdds feed as predictions (kalshi_markets) — never invented numbers.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FADEABLE = ["player_prop", "total", "spread"];

// ONE market source. kalshi_markets is fed by two syncs — kalshi-sync-markets
// (KX* tickers) and odds-sync-markets (sgo: tickers) — and they disagree: they
// carry different lines for the same game, Kalshi's college slate is FCS
// schools we have no rooms for, and the series we subscribe to on Kalshi have
// no player props at all. Mixing them meant one game could produce two cards
// quoting two different numbers. SGO alone covers MLB, NFL and college with
// spreads, totals AND props, so it is the standard. Flip with FADE_SOURCE=any
// if SGO is ever down and Kalshi has to carry a night.
const FADE_SOURCE = Deno.env.get("FADE_SOURCE") || "sgo";
const isSourceAllowed = (ticker: string | null | undefined) =>
  FADE_SOURCE === "any" || String(ticker ?? "").startsWith("sgo:");
// TWO cards per game, not four: one spread, one total. Moneyline is
// deliberately absent from FADEABLE — in a Browns room everybody picks the
// Browns, so "will they win?" is not a debate. Spreads and totals are where a
// partisan room actually splits.
const MAX_PROPS_PER_GAME = Number(Deno.env.get("FADE_MAX_PER_GAME") || 2);

// Every market for one game shares the middle segment of its Kalshi ticker:
//   KXMLBTOTAL-26AUG251905HOUNYY-9    -> 26AUG251905HOUNYY
//   KXMLBSPREAD-26AUG251905HOUNYY-NYY -> 26AUG251905HOUNYY
//   KXMLBGAME-26AUG251905HOUNYY-HOU   -> 26AUG251905HOUNYY
// That shared key is what lets a TOTAL find the teams it belongs to. Totals
// arrive from the feed with team_id NULL — a total belongs to both sides, so
// there is no single team to hang it on — and the old code filtered markets
// with .in("team_id", ...), which NULL never matches. Result: every total was
// silently dropped and only spreads ("Rays win by over 1.5") ever posted, the
// one shape a partisan room will not argue about. Grouping by ticker fixes it.
//
// Season futures (KXMLB-26-MIL, KXNBA-26-DEN) also have three segments but a
// purely numeric middle. Left in, they would collapse every league's futures
// into one bogus "game" keyed "26", so they are rejected here.
const GAME_KEY = /^\d{2}[A-Z]{3}\d/;

// Two market sources, two ticker shapes:
//   Kalshi  KXMLBTOTAL-26AUG251905HOUNYY-9      -> middle segment is the game
//   SGO     sgo:{eventID}:{oddID}               -> eventID, held in
//                                                  kalshi_event_ticker
// Splitting an SGO ticker on "-" yields a player name, so a single rule would
// silently exclude every SGO market — which is all of college football and the
// NFL. Kalshi's own kalshi_event_ticker cannot be used instead: it carries the
// series prefix (KXMLBTOTAL- vs KXMLBSPREAD-) and so differs per market type
// for the same game, which is the very thing being grouped away.
function gameKey(m: { kalshi_ticker?: string | null; kalshi_event_ticker?: string | null }): string | null {
  const ticker = m.kalshi_ticker ?? "";
  if (ticker.startsWith("sgo:")) return m.kalshi_event_ticker || null;
  const parts = ticker.split("-");
  if (parts.length < 2) return null;
  const key = parts[1];
  return GAME_KEY.test(key) ? key : null;
}

// Turn a kalshi_markets row into the card's display fields. The wording comes
// from the shared derivation, so a bot card, a player-posted card and the Picks
// board all say the same sentence about the same line.
function marketCard(m: any, teams: string[]): {
  label: string;
  line: number | null;
  over: string;
  under: string;
  description: string;
} | null {
  const meta = (m.metadata ?? {}) as Record<string, any>;
  const line = meta.line ?? meta.spread ?? null;
  if (line == null) return null; // no real number = nothing to argue about

  const sides = marketSides(m, teams);
  return {
    label: sides.headline,
    line: Number(line),
    over: sides.yesLabel,
    under: sides.noLabel,
    description: m.question ?? "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 1) Upcoming, settleable games (in `games`, not yet started, within 24h).
    const { data: games } = await supabase
      .from("games")
      .select("id, home_team_id, away_team_id, start_time, sport_key, status")
      .gt("start_time", now.toISOString())
      .lt("start_time", windowEnd.toISOString())
      .not("status", "in", "(final,cancelled,postponed)");

    if (!games || games.length === 0) {
      return new Response(JSON.stringify({ posted: 0, reason: "no upcoming settleable games" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const teamIds = [
      ...new Set(games.flatMap((g) => [g.home_team_id, g.away_team_id]).filter(Boolean)),
    ] as string[];

    // 2) Team names and fadeable markets for those teams.
    const [{ data: teams }, { data: markets }] = await Promise.all([
      supabase.from("teams").select("id, name").in("id", teamIds),
      supabase
        .from("kalshi_markets")
        .select(
          "id, question, market_type, team_id, event_start_time, metadata, is_resolved, kalshi_ticker, kalshi_event_ticker, current_yes_price",
        )
        .eq("is_resolved", false)
        .gt("event_start_time", new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString())
        .lt("event_start_time", new Date(windowEnd.getTime() + 6 * 60 * 60 * 1000).toISOString())
        // Dropping the team filter widens this to every league in the window.
        // PostgREST caps an unbounded select at 1000 rows and says nothing when
        // it truncates, which on a full slate would quietly starve whichever
        // games sorted last. Ask for more than a day can hold.
        .limit(5000),
    ]);
    const teamName = new Map((teams ?? []).map((t: any) => [t.id, t.name]));

    // 2b) Group every market by its game, then let the group's teams stand in
    // for the members that have none. A total inherits the teams named by the
    // spread and winner markets sitting on the same ticker, so it can finally
    // be matched to a game — and to the rooms watching it.
    const groups = new Map<string, { teams: Set<string>; markets: any[] }>();
    for (const m of markets ?? []) {
      if (!isSourceAllowed(m.kalshi_ticker)) continue;
      const key = gameKey(m);
      if (!key) continue;
      let g = groups.get(key);
      if (!g) {
        g = { teams: new Set<string>(), markets: [] };
        groups.set(key, g);
      }
      if (m.team_id) g.teams.add(m.team_id);
      if (FADEABLE.includes(String(m.market_type))) g.markets.push(m);
    }

    // 3) The system (bot) user that authors the cards.
    const { data: systemUserId } = await supabase.rpc("get_or_create_system_user");
    if (!systemUserId) throw new Error("Failed to get system user");

    let posted = 0;

    for (const game of games) {
      const gTeams = [game.home_team_id, game.away_team_id].filter(Boolean) as string[];
      const start = new Date(game.start_time).getTime();

      // Groups whose teams overlap this game and whose markets sit close to
      // its start (so a team's next series doesn't bleed into tonight's card).
      const inWindow: any[] = [];
      for (const g of groups.values()) {
        if (!gTeams.some((t) => g.teams.has(t))) continue;
        for (const m of g.markets) {
          if (Math.abs(new Date(m.event_start_time).getTime() - start) < 6 * 60 * 60 * 1000) {
            inWindow.push(m);
          }
        }
      }

      // ONE card per market TYPE. Previously this took the first four rows,
      // which on a busy game meant four totals at different strikes stacked in
      // the room — the same clutter the ladder fix removed upstream, arriving
      // by a different door. Prefer the line closest to a coin flip: that is
      // the one worth arguing about.
      const byType = new Map<string, any>();
      for (const m of inWindow) {
        const t = String(m.market_type);
        const prev = byType.get(t);
        const dist = (x: any) => Math.abs((x.current_yes_price ?? 50) - 50);
        if (!prev || dist(m) < dist(prev)) byType.set(t, m);
      }
      const gameMarkets = [...byType.values()].slice(0, MAX_PROPS_PER_GAME);

      if (gameMarkets.length === 0) continue;

      // Rooms watching either team.
      const { data: huddles } = await supabase
        .from("huddles")
        .select("id")
        .in("team_id", gTeams);
      if (!huddles || huddles.length === 0) continue;

      const home = game.home_team_id ? teamName.get(game.home_team_id) ?? "Home" : "Home";
      const away = game.away_team_id ? teamName.get(game.away_team_id) ?? "Away" : "Away";
      const gamePayload = {
        id: String(game.id),
        start_time: game.start_time,
        home,
        away,
        sport: game.sport_key ?? "",
      };

      for (const h of huddles) {
        // Skip markets already dropped in this room recently, so a re-run
        // doesn't stack duplicate cards.
        const { data: recent } = await supabase
          .from("huddle_messages")
          .select("content")
          .eq("huddle_id", h.id)
          .eq("message_type", "fade_prop")
          .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
        const already = new Set<string>();
        (recent ?? []).forEach((r: any) => {
          try {
            const p = JSON.parse(r.content);
            if (p.market_id) already.add(p.market_id);
          } catch {
            /* ignore non-JSON */
          }
        });

        const rows = gameMarkets
          .filter((m: any) => !already.has(m.id))
          .map((m: any) => {
            const card = marketCard(m, [home, away]);
            if (!card) return null;
            return {
              huddle_id: h.id,
              user_id: systemUserId,
              is_bot_message: true,
              message_type: "fade_prop",
              content: JSON.stringify({
                // No fade_id: this is unclaimed. The first tap claims a side and
                // links a fade back via origin_message_id.
                market_id: m.id,
                label: card.label,
                description: card.description,
                over_label: card.over,
                under_label: card.under,
                line: card.line,
                game: gamePayload,
              }),
            };
          })
          .filter(Boolean);

        if (rows.length > 0) {
          const { error } = await supabase.from("huddle_messages").insert(rows as any[]);
          if (!error) posted += rows.length;
        }
      }
    }

    return new Response(JSON.stringify({ posted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("fade-post-props error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

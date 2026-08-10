// odds-settle — resolves the SGO markets odds-sync-markets created, once their
// game is final. SGO carries the result itself, so there's no ESPN/box-score
// dependency: each finished over/under odd has a `score` (the realized stat),
// and team finals are in results.game.{home,away,all}.points. We compute YES/NO
// and hand it to the existing settle_shadow_bets RPC.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SGO_BASE = "https://api.sportsgameodds.com/v2";
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000; // settle within SGO's prop-retention window
const MAX_PAGES = 8;

interface FinalEvent {
  odds: Record<string, any>;
  game: any; // results.game: { home:{points}, away:{points}, all:{points}, [playerID]:{...} }
}

function resolve(meta: any, ev: FinalEvent): "YES" | "NO" | null {
  const game = ev.game || {};
  const betType = meta?.bet_type;

  if (betType === "ml") {
    const h = Number(game.home?.points), a = Number(game.away?.points);
    if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
    const teamScore = meta.side === "home" ? h : a;
    const oppScore = meta.side === "home" ? a : h;
    return teamScore > oppScore ? "YES" : "NO";
  }

  if (betType === "sp") {
    const h = Number(game.home?.points), a = Number(game.away?.points);
    const spread = Number(meta.spread);
    if (!Number.isFinite(h) || !Number.isFinite(a) || !Number.isFinite(spread)) return null;
    const teamScore = meta.side === "home" ? h : a;
    const oppScore = meta.side === "home" ? a : h;
    return teamScore + spread > oppScore ? "YES" : "NO"; // YES = team covers
  }

  if (betType === "ou") {
    const line = Number(meta.line);
    if (!Number.isFinite(line)) return null;
    // Prefer the odd's own settled score (works for props AND team totals).
    const odd = ev.odds[meta.odd_id];
    let score: number | undefined;
    if (odd && odd.ended && odd.score != null) score = Number(odd.score);
    else if (meta.stat === "points" && game.all?.points != null) score = Number(game.all.points);
    if (!Number.isFinite(score as number)) return null; // not graded yet → retry
    return (score as number) > line ? "YES" : "NO"; // YES = Over
  }

  return null;
}

// Post one "Post-Game Recap" per game per huddle, naming the top predictor and
// biggest winner by DISPLAY NAME. Self-guards: only recaps a game once ALL its
// markets are resolved, and a fully-resolved game won't be revisited next run.
async function postRecaps(
  supabase: ReturnType<typeof createClient>,
  games: Set<string>,
): Promise<number> {
  if (games.size === 0) return 0;
  const { data: sysUser } = await supabase.rpc("get_or_create_system_user");
  if (!sysUser) return 0;
  let posted = 0;

  for (const eventId of games) {
    // Whole game must be settled before we recap it (props can land a run later).
    const { data: gm } = await supabase
      .from("kalshi_markets")
      .select("id, is_resolved, metadata")
      .like("kalshi_ticker", `sgo:${eventId}:%`);
    if (!gm || gm.length === 0 || (gm as any[]).some((m) => !m.is_resolved)) continue;

    const marketIds = (gm as any[]).map((m) => m.id);
    const meta0: any = (gm as any[])[0].metadata || {};
    const matchup = meta0.away && meta0.home ? `${meta0.away} @ ${meta0.home}` : "the game";

    const { data: bets } = await supabase
      .from("shadow_bets")
      .select("user_id, huddle_id, won, chips_won, chips_risked, market:kalshi_markets(question, resolution)")
      .in("market_id", marketIds)
      .eq("is_settled", true);
    if (!bets || bets.length === 0) continue;

    // Display names for everyone who picked (no FK embed → query separately).
    const ids = [...new Set((bets as any[]).map((b) => b.user_id))];
    const { data: profs } = await supabase
      .from("profiles").select("user_id, display_name, username").in("user_id", ids);
    const nameOf = new Map<string, string>();
    for (const p of profs || []) nameOf.set(p.user_id, p.display_name || p.username || "A fan");

    const byHuddle = new Map<string, any[]>();
    for (const b of bets as any[]) {
      const arr = byHuddle.get(b.huddle_id) || [];
      arr.push(b);
      byHuddle.set(b.huddle_id, arr);
    }

    for (const [huddleId, hbets] of byHuddle.entries()) {
      const stats = new Map<string, { wins: number; profit: number }>();
      let biggest: { user: string; profit: number } | null = null;
      for (const b of hbets) {
        const s = stats.get(b.user_id) || { wins: 0, profit: 0 };
        if (b.won) {
          const p = (b.chips_won || 100) - b.chips_risked;
          s.wins++; s.profit += p;
          if (!biggest || p > biggest.profit) biggest = { user: b.user_id, profit: p };
        } else {
          s.profit -= b.chips_risked;
        }
        stats.set(b.user_id, s);
      }
      let top: { user: string; wins: number; profit: number } | null = null;
      for (const [uid, s] of stats.entries()) {
        if (!top || s.wins > top.wins || (s.wins === top.wins && s.profit > top.profit)) {
          top = { user: uid, wins: s.wins, profit: s.profit };
        }
      }

      const total = hbets.length;
      const correct = hbets.filter((b: any) => b.won).length;
      const accuracy = total ? Math.round((correct / total) * 100) : 0;

      // Distinct markets this huddle actually picked, with the result.
      const seen = new Set<string>();
      const lines: string[] = [];
      for (const b of hbets as any[]) {
        const q = b.market?.question;
        if (!q || seen.has(q)) continue;
        seen.add(q);
        lines.push(`${b.market.resolution === "YES" ? "✅" : "❌"} ${q} → ${b.market.resolution}`);
      }

      let summary = `⚾ **Post-Game Recap — ${matchup}**\n\n${lines.join("\n")}\n\n`;
      summary += `**Huddle:** ${correct}/${total} picks hit (${accuracy}%)\n`;
      if (top && top.wins > 0) {
        summary += `• 🏆 Top predictor: ${nameOf.get(top.user) ?? "A fan"} (${top.wins} ${top.wins === 1 ? "win" : "wins"}, ${top.profit >= 0 ? "+" : ""}${top.profit}¢)\n`;
      }
      if (biggest) {
        summary += `• 💰 Biggest win: ${nameOf.get(biggest.user) ?? "A fan"} (+${biggest.profit}¢)`;
      }

      const { error } = await supabase.from("huddle_messages").insert({
        huddle_id: huddleId, user_id: sysUser, content: summary,
        is_bot_message: true, message_type: "game_summary",
      });
      if (!error) posted++;
    }
  }
  return posted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SGO_KEY = Deno.env.get("SPORTSGAMEODDS_API_KEY");
    if (!SGO_KEY) {
      return new Response(JSON.stringify({ error: "SPORTSGAMEODDS_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Our SGO markets whose game should be over by now.
    const { data: markets } = await supabase
      .from("kalshi_markets")
      .select("id, market_type, event_start_time, metadata")
      .eq("is_resolved", false)
      .like("kalshi_ticker", "sgo:%")
      .lt("event_start_time", new Date().toISOString())
      .limit(1000);

    if (!markets || markets.length === 0) {
      return new Response(JSON.stringify({ settled_markets: 0, settled_bets: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch ONLY the leagues that actually have a market waiting to be graded.
    // Fetching all configured leagues every run would cost MAX_PAGES x leagues
    // x 48 runs/day (~1,150 SGO calls) and re-create the June overrun. A market
    // whose league is never fetched can never grade and its chips stay locked,
    // so this set must be derived from the pending markets themselves — never
    // from a static list.
    // Markets written before `league` was added to metadata are MLB.
    const SETTLE_LEAGUES = [...new Set(
      (markets as any[]).map((m) => String(m.metadata?.league ?? "MLB").toUpperCase()),
    )];

    const startsAfter = new Date(Date.now() - LOOKBACK_MS).toISOString();
    const finals = new Map<string, FinalEvent>();
    for (const league of SETTLE_LEAGUES) {
      let cursor = "";
      for (let page = 0; page < MAX_PAGES; page++) {
        const url =
          `${SGO_BASE}/events/?leagueID=${league}&finalized=true&startsAfter=${startsAfter}` +
          `&expandResults=true&limit=10${cursor ? `&cursor=${cursor}` : ""}&apiKey=${SGO_KEY}`;
        const res = await fetch(url);
        if (!res.ok) break;   // this league only; keep settling the others
        const json = await res.json();
        for (const ev of json.data ?? []) {
          finals.set(ev.eventID, { odds: ev.odds ?? {}, game: ev.results?.game ?? {} });
        }
        cursor = json.nextCursor || "";
        if (!cursor) break;
      }
    }

    let settledMarkets = 0;
    let settledBets = 0;
    let waitingFinal = 0;
    const gamesTouched = new Set<string>();

    for (const m of markets as any[]) {
      const ev = finals.get(m.metadata?.sgo_event_id);
      if (!ev) { waitingFinal++; continue; } // not final yet

      const resolution = resolve(m.metadata, ev);
      if (!resolution) { waitingFinal++; continue; } // not graded yet

      const { data: count, error } = await supabase.rpc("settle_shadow_bets", {
        p_market_id: m.id,
        p_resolution: resolution,
      });
      if (error) { console.error(`settle ${m.id}:`, error.message); continue; }
      settledMarkets++;
      settledBets += Number(count) || 0;
      if (m.metadata?.sgo_event_id) gamesTouched.add(m.metadata.sgo_event_id);
    }

    // Drop a one-time "who won" recap per game, once ALL its markets are settled.
    const recapsPosted = await postRecaps(supabase, gamesTouched);

    return new Response(JSON.stringify({
      success: true,
      candidates: markets.length,
      finalized_events: finals.size,
      settled_markets: settledMarkets,
      settled_bets: settledBets,
      waiting_on_final: waitingFinal,
      recaps_posted: recapsPosted,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

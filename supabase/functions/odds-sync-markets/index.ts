// odds-sync-markets — MLB markets from SportsGameOdds (SGO), written into
// kalshi_markets as YES/NO contracts the existing chips economy understands.
//
// SGO is one source for everything: a single /events call returns each game's
// teams, a players map (playerID -> teamID, for routing), and all odds. So this
// one function covers BOTH team markets and player props — no per-event calls,
// no ESPN roster/probable scraping.
//
//   Team:   moneyline (ml), run line (sp, half-pt only), total (ou)
//   Props:  pitcher strikeouts, batter home runs, batter hits  (ou, half-pt)
//
// Each market stores its SGO eventID + oddID in metadata so odds-settle can read
// the result straight from SGO (the odd's `score` / results.game).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SGO_BASE = "https://api.sportsgameodds.com/v2";
// Budget note: SGO bills per request, and the old settings (48h window, 6 pages,
// every 30 min) burned ~288 calls/day — enough to exhaust the plan in two days,
// which is exactly what happened on 2026-06-26 and froze every line in the app.
// A 24h window at 2 pages covers a full MLB slate (~15 games) and, paired with
// the 4-hourly cron, costs ~12 calls/day.
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_PAGES = 2;

// Player-prop statIDs we surface, with a card noun and carousel weight.
const PROP_SPEC: Record<string, { noun: string; weight: number }> = {
  batting_homeRuns:    { noun: "home runs",  weight: 7 },
  batting_hits:        { noun: "hits",       weight: 6 },
  pitching_strikeouts: { noun: "strikeouts", weight: 5 },
};

interface TeamRecord { id: string; name: string; city: string }

function impliedPct(american: string | number): number {
  const a = typeof american === "number" ? american : parseInt(String(american), 10);
  if (!Number.isFinite(a) || a === 0) return 50;
  const p = a > 0 ? 100 / (a + 100) : -a / (-a + 100);
  return Math.max(1, Math.min(99, Math.round(p * 100)));
}

function isHalf(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n % 1) === 0.5;
}

function slug(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
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

    // MLB teams indexed by full name ("Tampa Bay Rays") to match SGO names.long.
    const { data: teams } = await supabase
      .from("teams").select("id, name, city").eq("league", "MLB").eq("status", "active");
    const byFullName = new Map<string, TeamRecord>();
    for (const t of (teams ?? []) as TeamRecord[]) {
      byFullName.set(`${t.city} ${t.name}`.toLowerCase(), t);
    }

    // Upcoming MLB events with odds, paginated.
    const now = Date.now();
    const startsAfter = new Date(now).toISOString();
    const startsBefore = new Date(now + WINDOW_MS).toISOString();
    const events: any[] = [];
    let cursor = "";
    for (let page = 0; page < MAX_PAGES; page++) {
      const url =
        `${SGO_BASE}/events/?leagueID=MLB&oddsAvailable=true&startsAfter=${startsAfter}` +
        `&startsBefore=${startsBefore}&limit=10${cursor ? `&cursor=${cursor}` : ""}&apiKey=${SGO_KEY}`;
      const res = await fetch(url);
      if (!res.ok) {
        if (page === 0) {
          const txt = await res.text();
          return new Response(JSON.stringify({ error: `SGO ${res.status}: ${txt.slice(0, 200)}` }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;
      }
      const json = await res.json();
      events.push(...(json.data ?? []));
      cursor = json.nextCursor || "";
      if (!cursor) break;
    }

    const rows: any[] = [];
    let skippedNoTeam = 0;

    for (const ev of events) {
      const startsAt = ev.status?.startsAt;
      if (!startsAt || Date.parse(startsAt) <= now) continue;

      const home = ev.teams?.home, away = ev.teams?.away;
      const ourHome = home?.names?.long ? byFullName.get(String(home.names.long).toLowerCase()) : undefined;
      const ourAway = away?.names?.long ? byFullName.get(String(away.names.long).toLowerCase()) : undefined;
      if (!ourHome && !ourAway) { skippedNoTeam++; continue; }

      // SGO teamID -> our team (for routing props via players[pid].teamID).
      const sgoTeamToOur = new Map<string, TeamRecord>();
      if (home?.teamID && ourHome) sgoTeamToOur.set(home.teamID, ourHome);
      if (away?.teamID && ourAway) sgoTeamToOur.set(away.teamID, ourAway);
      const sideTeam = (side: string) => (side === "home" ? ourHome : ourAway);
      const players: Record<string, any> = ev.players ?? {};

      const base = (oddID: string, extra: Record<string, unknown>) => ({
        kalshi_event_ticker: ev.eventID,
        event_start_time: startsAt,
        metadata: {
          source: "sgo", sgo_event_id: ev.eventID, odd_id: oddID,
          // Matchup for the card's game line, e.g. "Chicago Cubs @ New York Mets".
          away: away?.names?.long, home: home?.names?.long, ...extra,
        },
      });

      for (const odd of Object.values(ev.odds ?? {}) as any[]) {
        // Full game only — SGO also lists per-inning / first-5 / half markets.
        if (odd.periodID !== "game") continue;
        const american = odd.fairOdds ?? odd.bookOdds;
        if (american == null) continue;
        const price = impliedPct(american);

        // — Team moneyline — YES = this team wins.
        if (odd.statID === "points" && odd.betTypeID === "ml" &&
            (odd.sideID === "home" || odd.sideID === "away")) {
          const team = sideTeam(odd.sideID);
          if (!team) continue;
          rows.push({
            ...base(odd.oddID, { bet_type: "ml", side: odd.sideID, sort_weight: 1 }),
            kalshi_ticker: `sgo:${ev.eventID}:${odd.oddID}`,
            team_id: team.id,
            question: `${team.name} to win tonight?`,
            current_yes_price: price,
            market_type: "winner",
          });
          continue;
        }

        // — Run line (spread) — half-point only (no push). YES = team covers.
        if (odd.statID === "points" && odd.betTypeID === "sp" &&
            (odd.sideID === "home" || odd.sideID === "away")) {
          const team = sideTeam(odd.sideID);
          const spread = parseFloat(odd.fairSpread ?? odd.bookSpread);
          if (!team || !isHalf(spread)) continue;
          rows.push({
            ...base(odd.oddID, { bet_type: "sp", side: odd.sideID, spread, sort_weight: 3 }),
            kalshi_ticker: `sgo:${ev.eventID}:${odd.oddID}`,
            team_id: team.id,
            question: `${team.name} to cover ${signed(spread)}?`,
            current_yes_price: price,
            market_type: "spread",
          });
          continue;
        }

        // — Total (over/under) — YES = Over. Posted to each tracked room.
        if (odd.statID === "points" && odd.betTypeID === "ou" &&
            odd.statEntityID === "all" && odd.sideID === "over") {
          const line = parseFloat(odd.fairOverUnder ?? odd.bookOverUnder);
          if (!isHalf(line)) continue;
          for (const [side, team] of [["home", ourHome], ["away", ourAway]] as const) {
            if (!team) continue;
            rows.push({
              ...base(odd.oddID, { bet_type: "ou", stat: "points", line, side: "over", sort_weight: 2 }),
              kalshi_ticker: `sgo:${ev.eventID}:${odd.oddID}:${side}`,
              team_id: team.id,
              question: `Over ${line} runs — ${away?.names?.long} @ ${home?.names?.long}?`,
              current_yes_price: price,
              market_type: "total",
            });
          }
          continue;
        }

        // — Player props — YES = Over the line.
        const spec = PROP_SPEC[odd.statID];
        if (spec && odd.betTypeID === "ou" && odd.sideID === "over" && odd.playerID) {
          const line = parseFloat(odd.fairOverUnder ?? odd.bookOverUnder);
          if (!isHalf(line)) continue;
          // Route by SGO's per-game player teamID (constrained to this game's two
          // teams via sgoTeamToOur). The /players roster endpoint is incomplete,
          // so do NOT validate against it — that wrongly dropped real players.
          const sgoTeamId = players[odd.playerID]?.teamID;
          const team = sgoTeamId ? sgoTeamToOur.get(sgoTeamId) : undefined;
          if (!team) { skippedNoTeam++; continue; }
          const name = players[odd.playerID]?.name || odd.playerID;
          rows.push({
            ...base(odd.oddID, {
              bet_type: "ou", stat: odd.statID, line, side: "over",
              player: name, sort_weight: spec.weight,
            }),
            kalshi_ticker: `sgo:${ev.eventID}:${odd.oddID}`,
            team_id: team.id,
            question: `${name} over ${line} ${spec.noun}?`,
            current_yes_price: price,
            market_type: "player_prop",
          });
        }
      }
    }

    let inserted = 0;
    if (rows.length > 0) {
      // ignoreDuplicates: first price is immutable so a line move can't re-line
      // a pick someone already made.
      const { error, count } = await supabase
        .from("kalshi_markets")
        .upsert(rows, { onConflict: "kalshi_ticker", ignoreDuplicates: true, count: "exact" });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      inserted = count ?? 0;
    }

    return new Response(JSON.stringify({
      success: true,
      events_seen: events.length,
      markets_built: rows.length,
      markets_inserted: inserted,
      skipped_no_tracked_team: skippedNoTeam,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

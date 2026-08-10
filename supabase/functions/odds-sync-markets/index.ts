// odds-sync-markets — MLB, NFL and college football markets from
// SportsGameOdds (SGO), written into kalshi_markets as YES/NO contracts the
// existing chips economy understands.
//
// SGO is one source for everything: a single /events call returns each game's
// teams, a players map (playerID -> teamID, for routing), and all odds. So this
// one function covers BOTH team markets and player props — no per-event calls,
// no ESPN roster/probable scraping.
//
//   Team:   moneyline (ml), spread (sp, half-pt only), total (ou)
//   Props:  per-league, see LEAGUE_SPEC — MLB uses HR/hits/Ks, football uses
//           passing/rushing/receiving yards, receptions and passing TDs.
//
// NOTE: the football prop statIDs are written from SGO's documented naming
// convention but have NOT been confirmed against a live football response —
// the account was rate-limited when this was built. Any statID we don't
// recognise is counted into `unknown_prop_stats` in the response rather than
// dropped, so the first successful football run reveals the real vocabulary.
// Team and total markets do not depend on that and should work immediately.
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

// Leagues to sync. Env-overridable so the slate can be widened or cut back
// without a deploy — useful because SGO bills per request and college football
// Saturdays are far bigger than an MLB night.
const LEAGUES = (Deno.env.get("ODDS_LEAGUES") || "MLB,NFL,NCAAF")
  .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

// Per-league config. `pages` is the real cost knob: each page is one billed
// request. MLB runs ~15 games a night, the NFL ~16 a week, but a college
// Saturday is 60+, and we only care about the ~70 schools in our teams table,
// so college needs to page deeper to find them.
const LEAGUE_SPEC: Record<string, {
  dbLeague: string;
  scoreNoun: string;                                   // "runs" / "points"
  pages: number;
  props: Record<string, { noun: string; weight: number }>;
}> = {
  MLB: {
    dbLeague: "MLB", scoreNoun: "runs", pages: 2,
    props: {
      batting_homeRuns:    { noun: "home runs",  weight: 7 },
      batting_hits:        { noun: "hits",       weight: 6 },
      pitching_strikeouts: { noun: "strikeouts", weight: 5 },
    },
  },
  NFL: {
    dbLeague: "NFL", scoreNoun: "points", pages: 2,
    props: {
      passing_yards:        { noun: "passing yards",   weight: 7 },
      rushing_yards:        { noun: "rushing yards",   weight: 6 },
      receiving_yards:      { noun: "receiving yards", weight: 6 },
      receiving_receptions: { noun: "receptions",      weight: 5 },
      passing_touchdowns:   { noun: "passing TDs",     weight: 5 },
    },
  },
  NCAAF: {
    dbLeague: "NCAA", scoreNoun: "points",
    pages: Number(Deno.env.get("ODDS_NCAAF_PAGES") || 4),
    props: {
      passing_yards:        { noun: "passing yards",   weight: 7 },
      rushing_yards:        { noun: "rushing yards",   weight: 6 },
      receiving_yards:      { noun: "receiving yards", weight: 6 },
      receiving_receptions: { noun: "receptions",      weight: 5 },
      passing_touchdowns:   { noun: "passing TDs",     weight: 5 },
    },
  },
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

    // Teams for every league we sync, indexed per DB league by full name
    // ("Tampa Bay Rays", "Ohio State Buckeyes") to match SGO's names.long.
    // Indexing per league matters: nicknames collide across sports, and an
    // NCAAF event must never resolve to the NFL row of the same name.
    const dbLeagues = [...new Set(LEAGUES.map((l) => LEAGUE_SPEC[l]?.dbLeague).filter(Boolean))];
    const { data: teams } = await supabase
      .from("teams").select("id, name, city, league")
      .in("league", dbLeagues).eq("status", "active");
    const byLeague = new Map<string, Map<string, TeamRecord>>();
    for (const t of (teams ?? []) as (TeamRecord & { league: string })[]) {
      if (!byLeague.has(t.league)) byLeague.set(t.league, new Map());
      byLeague.get(t.league)!.set(`${t.city} ${t.name}`.toLowerCase(), t);
    }

    const now = Date.now();
    const startsAfter = new Date(now).toISOString();
    const startsBefore = new Date(now + WINDOW_MS).toISOString();

    const rows: any[] = [];
    let skippedNoTeam = 0;
    let apiCalls = 0;
    const leagueErrors: string[] = [];
    const perLeague: Record<string, { events: number; rows: number }> = {};
    // statIDs SGO returned that we have no card noun for. Reported rather than
    // silently dropped — this is how we learn football's real prop vocabulary
    // without guessing, since the MLB names tell us nothing about it.
    const unknownProps = new Map<string, number>();

    for (const league of LEAGUES) {
      const spec = LEAGUE_SPEC[league];
      if (!spec) { leagueErrors.push(`${league}: no spec`); continue; }
      const byFullName = byLeague.get(spec.dbLeague) ?? new Map<string, TeamRecord>();
      if (byFullName.size === 0) { leagueErrors.push(`${league}: no teams in DB`); continue; }

      const events: any[] = [];
      let cursor = "";
      for (let page = 0; page < spec.pages; page++) {
        const url =
          `${SGO_BASE}/events/?leagueID=${league}&oddsAvailable=true&startsAfter=${startsAfter}` +
          `&startsBefore=${startsBefore}&limit=10${cursor ? `&cursor=${cursor}` : ""}&apiKey=${SGO_KEY}`;
        const res = await fetch(url);
        apiCalls++;
        if (!res.ok) {
          // One league failing (rate limit, out of season) must not abort the
          // others — MLB should still sync if college football 429s.
          const txt = await res.text();
          leagueErrors.push(`${league}: SGO ${res.status} ${txt.slice(0, 120)}`);
          break;
        }
        const json = await res.json();
        events.push(...(json.data ?? []));
        cursor = json.nextCursor || "";
        if (!cursor) break;
      }
      perLeague[league] = { events: events.length, rows: 0 };
      const rowsBefore = rows.length;

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
          // `league` lets odds-settle fetch ONLY the leagues that actually have
          // pending markets instead of all of them every run. At 8 pages and a
          // 30-minute cron, blindly fetching three leagues would cost ~1,150
          // SGO calls/day — the same overrun that froze every line in June.
          source: "sgo", league, sgo_event_id: ev.eventID, odd_id: oddID,
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
            question: `${team.name} to win?`,
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
              question: `Over ${line} ${spec.scoreNoun} — ${away?.names?.long} @ ${home?.names?.long}?`,
              current_yes_price: price,
              market_type: "total",
            });
          }
          continue;
        }

        // — Player props — YES = Over the line.
        const propSpec = spec.props[odd.statID];
        // Record anything player-shaped we don't have a noun for, so the real
        // football statIDs surface in the response instead of vanishing.
        if (!propSpec && odd.playerID && odd.betTypeID === "ou" && odd.sideID === "over") {
          unknownProps.set(odd.statID, (unknownProps.get(odd.statID) ?? 0) + 1);
        }
        if (propSpec && odd.betTypeID === "ou" && odd.sideID === "over" && odd.playerID) {
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
              player: name, sort_weight: propSpec.weight,
            }),
            kalshi_ticker: `sgo:${ev.eventID}:${odd.oddID}`,
            team_id: team.id,
            question: `${name} over ${line} ${propSpec.noun}?`,
            current_yes_price: price,
            market_type: "player_prop",
          });
        }
      }
    }
      perLeague[league].rows = rows.length - rowsBefore;
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
      leagues: LEAGUES,
      per_league: perLeague,
      api_calls: apiCalls,
      markets_built: rows.length,
      markets_inserted: inserted,
      skipped_no_tracked_team: skippedNoTeam,
      league_errors: leagueErrors,
      // Player statIDs SGO offered that we have no noun for. Empty for MLB;
      // for football this is the list to fold into LEAGUE_SPEC.props once seen.
      unknown_prop_stats: Object.fromEntries(
        [...unknownProps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25),
      ),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

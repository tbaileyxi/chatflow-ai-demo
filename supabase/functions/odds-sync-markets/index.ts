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

// ...but football is a WEEKLY sport, and a 24h window means a college game on
// Saturday has no line until Friday. Fans argue about Saturday's spread on
// Tuesday, and fade cards can only be built from lines that exist, so football
// gets a longer look-ahead. This costs nothing extra on quiet days: `pages` is
// a maximum and the paging loop breaks as soon as SGO stops returning a cursor,
// so a league with no games in the window still costs exactly one call.
const LEAGUE_WINDOW_MS: Record<string, number> = {
  MLB: WINDOW_MS,                        // daily sport, big slate — keep it tight
  NFL: 7 * 24 * 60 * 60 * 1000,          // one slate a week
  NCAAF: 7 * 24 * 60 * 60 * 1000,        // Saturdays
};

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

    // SGO names PRO teams "Tampa Bay Rays" but COLLEGE teams by school alone:
    // "North Carolina", "TCU", "Virginia". Matching only on `city + name`
    // ("north carolina tar heels") therefore missed every single college event
    // — 8 events in, 0 rows out, including UNC@TCU and NC State@Virginia, both
    // of which have rooms. So each team is also indexed under its school/city
    // on its own.
    //
    // That short key is only safe where it is UNAMBIGUOUS. All 71 college
    // cities are distinct, but the pro leagues are not: "new york" is two NFL
    // teams and two MLB teams, "chicago" two MLB teams. A key that would
    // resolve to more than one team in its league is poisoned rather than left
    // pointing at whichever row happened to load first — a wrong team is worse
    // than no team, because it silently posts a card into the wrong room.
    const poisoned = new Map<string, Set<string>>();
    const shortByLeague = new Map<string, Map<string, TeamRecord>>();

    // Fold accents and punctuation so "San José State" and "Hawai'i" compare
    // as their plain-ASCII spellings.
    const norm = (v: string) =>
      v.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

    for (const t of (teams ?? []) as (TeamRecord & { league: string })[]) {
      if (!byLeague.has(t.league)) byLeague.set(t.league, new Map());
      byLeague.get(t.league)!.set(norm(`${t.city} ${t.name}`), t);

      if (!shortByLeague.has(t.league)) shortByLeague.set(t.league, new Map());
      if (!poisoned.has(t.league)) poisoned.set(t.league, new Set());
      const shortMap = shortByLeague.get(t.league)!;
      const bad = poisoned.get(t.league)!;
      const key = norm(t.city ?? "");
      if (!key) continue;
      if (bad.has(key)) continue;
      if (shortMap.has(key)) { shortMap.delete(key); bad.add(key); continue; }
      shortMap.set(key, t);
    }

    const now = Date.now();
    const startsAfter = new Date(now).toISOString();

    const rows: any[] = [];
    const unmatched: string[] = [];
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
      const byShortName = shortByLeague.get(spec.dbLeague) ?? new Map<string, TeamRecord>();
      if (byFullName.size === 0) { leagueErrors.push(`${league}: no teams in DB`); continue; }
      // Full name first so a pro "New York Yankees" can never fall through to
      // an ambiguous short key.
      const lookup = (n: unknown): TeamRecord | undefined => {
        if (!n) return undefined;
        const k = norm(String(n));
        return byFullName.get(k) ?? byShortName.get(k);
      };

      const startsBefore = new Date(
        now + (LEAGUE_WINDOW_MS[league] ?? WINDOW_MS),
      ).toISOString();

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
      const ourHome = lookup(home?.names?.long);
      const ourAway = lookup(away?.names?.long);
      if (!ourHome && !ourAway) {
        skippedNoTeam++;
        // Knowing the COUNT of unmatched events tells you nothing actionable —
        // "8 events, 0 rows" could be a name-format mismatch or simply a slate
        // of schools we don't carry. Recording the matchup distinguishes them.
        if (unmatched.length < 40) {
          unmatched.push(
            `${league}: ${away?.names?.long ?? "?"} @ ${home?.names?.long ?? "?"}`,
          );
        }
        continue;
      }

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
      unmatched_events: unmatched,
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

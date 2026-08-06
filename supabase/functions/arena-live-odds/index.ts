// arena-live-odds — live de-vigged home win probability for in-progress MLB
// games, written to arena_live_odds for the /arena page's front line.
//
// Unlike odds-sync-markets (which freezes first prices so picks can't be
// re-lined), this is a separate live feed that's SUPPOSED to move. One SGO
// /events call covers every live game; when nothing is live (and nothing
// starts within the next 30 min) we skip SGO entirely.
//
// Matching: SGO teams.names.long -> teams table ("City Name"), then find the
// games row with those two team ids starting within +/-12h.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SGO_BASE = "https://api.sportsgameodds.com/v2";
const HOUSE = "00000000-0000-0000-0000-0000000000aa";

// Keep the pot priced at the live line: top up the trailing side with house
// chips (bounded) so late-game pile-on has no stale-seed edge to exploit.
async function rebalancePot(
  supabase: any, col: "game_id" | "event_id", id: string, probA: number,
): Promise<number> {
  const { data } = await supabase.from("arena_stakes")
    .select("side, amount, client_id").eq(col, id).eq("settled", false);
  if (!data?.length) return 0;
  let a = 0, h = 0, house = 0;
  for (const s of data) {
    if (s.side === "away") a += s.amount; else h += s.amount;
    if (s.client_id === HOUSE) house += s.amount;
  }
  const pot = a + h;
  if (pot <= 0) return 0;
  const HOUSE_CAP = 3000, TICK_CAP = 500, BAND = 0.05;
  const fracA = a / pot;
  let side: "away" | "home" | null = null, need = 0;
  if (fracA < probA - BAND) { side = "away"; need = (probA * pot - a) / (1 - probA); }
  else if (fracA > probA + BAND) { side = "home"; const pB = 1 - probA; need = (pB * pot - h) / (1 - pB); }
  if (!side) return 0;
  const amt = Math.floor(Math.min(need, TICK_CAP, HOUSE_CAP - house));
  if (amt < 25) return 0;
  const rows: Record<string, unknown>[] = [];
  let rest = amt;
  while (rest > 0) {
    const c = Math.min(500, rest);
    rows.push({ [col]: id, client_id: HOUSE, side, amount: c });
    rest -= c;
  }
  const { error } = await supabase.from("arena_stakes").insert(rows);
  return error ? 0 : amt;
}

function impliedProb(american: string | number): number | null {
  const a = typeof american === "number" ? american : parseInt(String(american), 10);
  if (!Number.isFinite(a) || a === 0) return null;
  return a > 0 ? 100 / (a + 100) : -a / (-a + 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const SGO_KEY = Deno.env.get("SPORTSGAMEODDS_API_KEY");
    if (!SGO_KEY) {
      return new Response(JSON.stringify({ error: "SPORTSGAMEODDS_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Settle first — completed games with unsettled stakes pay out here, so
    // this runs every tick even when nothing is live.
    let settled = 0;
    const { data: unsettledRows } = await supabase
      .from("arena_stakes").select("game_id").eq("settled", false).limit(1000);
    const unsettledIds = [...new Set((unsettledRows ?? []).map((r) => r.game_id))];
    if (unsettledIds.length) {
      const { data: doneGames } = await supabase
        .from("games").select("id").in("id", unsettledIds).in("status", ["final", "completed"]);
      for (const dg of doneGames ?? []) {
        const { error } = await supabase.rpc("arena_settle_game", { p_game: dg.id });
        if (!error) settled++;
      }
    }

    // Candidate games: MLB rows that started in the last 8h or start in 30min.
    const now = Date.now();
    const { data: games } = await supabase
      .from("games")
      .select("id, start_time, status, home_team_id, away_team_id")
      .ilike("sport_key", "%mlb%")
      .gt("start_time", new Date(now - 8 * 3600_000).toISOString())
      .lt("start_time", new Date(now + 30 * 60_000).toISOString())
      .in("status", ["scheduled", "live", "in_progress"]);

    if (!games?.length) {
      return new Response(JSON.stringify({ success: true, live_games: 0, games_settled: settled, skipped: "nothing live" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: teams } = await supabase
      .from("teams").select("id, name, city").eq("league", "MLB");
    const byFullName = new Map<string, string>();
    for (const t of teams ?? []) {
      byFullName.set(`${t.city} ${t.name}`.toLowerCase(), t.id);
    }

    // Polymarket match lookup (public API): per-game MLB markets give the
    // client a trade-flow stream for every battle, not just World Cup.
    interface PmLite { conditionId: string; question: string; outcomes: string[] }
    let pmList: PmLite[] = [];
    try {
      const pmRes = await fetch(
        "https://gamma-api.polymarket.com/markets?closed=false&limit=100&order=volume24hr&ascending=false");
      if (pmRes.ok) {
        for (const m of (await pmRes.json()) ?? []) {
          try {
            const outcomes = JSON.parse(m.outcomes ?? "[]");
            if (outcomes.length === 2 && m.conditionId) {
              pmList.push({ conditionId: String(m.conditionId), question: String(m.question ?? ""), outcomes });
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* flow enrichment is optional */ }
    const normName = (s: string) => String(s).toLowerCase().replace(/[^a-z]/g, "");
    function pmForTeams(awayName: string, homeName: string): { cond: string; aOutcome: string } | null {
      const a = normName(awayName), h = normName(homeName);
      if (!a || !h) return null;
      for (const m of pmList) {
        const q = normName(m.question);
        if (!q.includes(a) || !q.includes(h)) continue;
        const o0 = normName(m.outcomes[0]), o1 = normName(m.outcomes[1]);
        if (o0.includes(a) || a.includes(o0)) return { cond: m.conditionId, aOutcome: m.outcomes[0] };
        if (o1.includes(a) || a.includes(o1)) return { cond: m.conditionId, aOutcome: m.outcomes[1] };
      }
      return null;
    }
    const teamNameById = new Map<string, string>();
    for (const t of teams ?? []) teamNameById.set(t.id, String(t.name));

    // One SGO call for the same window.
    const startsAfter = new Date(now - 8 * 3600_000).toISOString();
    const startsBefore = new Date(now + 30 * 60_000).toISOString();
    const res = await fetch(
      `${SGO_BASE}/events/?leagueID=MLB&oddsAvailable=true&startsAfter=${startsAfter}` +
      `&startsBefore=${startsBefore}&limit=25&apiKey=${SGO_KEY}`,
    );
    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: `SGO ${res.status}: ${txt.slice(0, 200)}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const events: any[] = (await res.json()).data ?? [];

    const rows: { game_id: string; home_prob: number; updated_at: string }[] = [];
    for (const ev of events) {
      if (ev.status?.completed || ev.status?.finalized) continue;
      const homeId = ev.teams?.home?.names?.long
        ? byFullName.get(String(ev.teams.home.names.long).toLowerCase()) : undefined;
      const awayId = ev.teams?.away?.names?.long
        ? byFullName.get(String(ev.teams.away.names.long).toLowerCase()) : undefined;
      if (!homeId || !awayId) continue;

      const evStart = Date.parse(ev.status?.startsAt ?? "");
      const game = games.find((g) =>
        g.home_team_id === homeId && g.away_team_id === awayId &&
        Math.abs(Date.parse(g.start_time) - evStart) < 12 * 3600_000);
      if (!game) continue;

      // Full-game moneyline, both sides, de-vig.
      let pH: number | null = null, pA: number | null = null;
      for (const odd of Object.values(ev.odds ?? {}) as any[]) {
        if (odd.periodID !== "game" || odd.statID !== "points" || odd.betTypeID !== "ml") continue;
        const american = odd.fairOdds ?? odd.bookOdds;
        if (american == null) continue;
        if (odd.sideID === "home") pH = impliedProb(american);
        if (odd.sideID === "away") pA = impliedProb(american);
      }
      if (pH == null) continue;
      const prob = pA != null ? pH / (pH + pA) : pH;
      const clamped = Math.min(0.97, Math.max(0.03, prob));
      const pm = pmForTeams(
        teamNameById.get(game.away_team_id as string) ?? "",
        teamNameById.get(game.home_team_id as string) ?? "");
      rows.push({
        game_id: game.id, home_prob: clamped, updated_at: new Date().toISOString(),
        pm_condition: pm?.cond ?? null, pm_a_outcome: pm?.aOutcome ?? null,
      });
    }

    // Seed thin pots with house chips split by the market line, once per game.
    // Winners are paid from the pot; the house has no arena_players row, so its
    // "winnings" simply evaporate (chip sink) while its losses fund payouts —
    // this makes underdog payouts real from the very first fan stake.
    const HOUSE_ID = "00000000-0000-0000-0000-0000000000aa";
    const SEED_TOTAL = 1000;
    let seeded = 0;
    for (const r of rows) {
      const { data: existing } = await supabase
        .from("arena_stakes").select("id")
        .eq("game_id", r.game_id).eq("client_id", HOUSE_ID).limit(1);
      if (existing?.length) continue;
      const homeAmt = Math.round(SEED_TOTAL * r.home_prob);
      const seedRows: Record<string, unknown>[] = [];
      for (const [side, amt] of [["home", homeAmt], ["away", SEED_TOTAL - homeAmt]] as const) {
        let rest = amt;
        while (rest > 0) { // stakes are capped at 500/row
          const chunk = Math.min(500, rest);
          seedRows.push({ game_id: r.game_id, client_id: HOUSE_ID, side, amount: chunk });
          rest -= chunk;
        }
      }
      const { error } = await supabase.from("arena_stakes").insert(seedRows);
      if (!error) seeded++;
    }

    let written = 0;
    if (rows.length) {
      let { error, count } = await supabase
        .from("arena_live_odds")
        .upsert(rows, { onConflict: "game_id", count: "exact" });
      // Resilience: if the pm_* columns aren't migrated yet, retry without them
      // so live odds never break waiting on a migration.
      if (error && /pm_condition|pm_a_outcome|column/.test(error.message)) {
        const stripped = rows.map(({ pm_condition, pm_a_outcome, ...rest }) => rest);
        ({ error, count } = await supabase
          .from("arena_live_odds")
          .upsert(stripped, { onConflict: "game_id", count: "exact" }));
      }
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      written = count ?? rows.length;
      // price-river ticks (P of away side = 1 - home_prob)
      const ticks = rows.map((r) => ({ target: r.game_id, prob: Math.min(0.97, Math.max(0.03, 1 - r.home_prob)) }));
      if (ticks.length) await supabase.from("arena_ticks").insert(ticks);
      // keep pots priced at the live line
      for (const r of rows) {
        await rebalancePot(supabase, "game_id", r.game_id as string, 1 - (r.home_prob as number));
      }
    }

    return new Response(JSON.stringify({
      success: true, candidate_games: games.length, sgo_events: events.length, odds_written: written, games_settled: settled, pots_seeded: seeded,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

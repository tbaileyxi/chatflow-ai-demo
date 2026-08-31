// arena-sync-events — World Cup battles for the arena, decoupled from the MLB
// games table. ESPN's public World Cup scoreboard is the source of truth
// (schedule, teams, live scores, finals — no key, no league-id guessing);
// SGO enriches with market odds when its World Cup league can be discovered.
// One cron tick: upsert cards, seed thin pots, grade + settle finals.
//
// Grading: match winner by final score (ESPN includes extra time; a game still
// level after ET — i.e. decided on penalties — grades 'tie' and refunds).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SGO_BASE = "https://api.sportsgameodds.com/v2";
const ESPN_WC = "https://site.web.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const HOUSE_ID = "00000000-0000-0000-0000-0000000000aa";
const SEED_TOTAL = 1000;

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
    if (s.client_id === HOUSE_ID) house += s.amount;
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
    rows.push({ [col]: id, client_id: HOUSE_ID, side, amount: c });
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
const clamp = (p: number) => Math.min(0.97, Math.max(0.03, p));
function norm(s: string): string {
  return String(s).toLowerCase()
    .replace(/united states|usmnt/g, "usa")
    .replace(/[^a-z]/g, "");
}

interface EspnMatch {
  id: string;
  aName: string; bName: string;       // away, home
  aScore: number; bScore: number;
  startsAt: string;
  state: "pre" | "in" | "post";
  period: string | null;
}

async function espnMatches(): Promise<EspnMatch[]> {
  const out: EspnMatch[] = [];
  const res = await fetch(ESPN_WC, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" } });
  if (!res.ok) return out;
  const json = await res.json();
  for (const ev of json.events ?? []) {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away || !ev.date) continue;
    out.push({
      id: String(ev.id),
      aName: away.team?.shortDisplayName || away.team?.displayName || "AWAY",
      bName: home.team?.shortDisplayName || home.team?.displayName || "HOME",
      aScore: Number(away.score ?? 0), bScore: Number(home.score ?? 0),
      startsAt: ev.date,
      state: (ev.status?.type?.state ?? "pre") as EspnMatch["state"],
      period: ev.status?.type?.state === "in"
        ? (ev.status?.displayClock && ev.status.displayClock !== "0'" ? ev.status.displayClock : ev.status?.type?.shortDetail ?? "LIVE")
        : ev.status?.type?.state === "post" ? (ev.status?.type?.shortDetail ?? "FT") : null,
    });
  }
  return out;
}

// crude in-play model when no market odds: goal diff + time decay
function liveHeuristic(aScore: number, bScore: number, startsAt: string): number {
  const mins = Math.min(95, Math.max(0, (Date.now() - Date.parse(startsAt)) / 60000));
  const diff = aScore - bScore; // >0 means side A ahead
  const decay = Math.sqrt(Math.max(5, 95 - mins) / 95); // late goals matter more
  return clamp(0.5 + 0.5 * Math.tanh((diff * 0.45) / decay));
}

// Polymarket public gamma API — no key. Used two ways: match-line enrichment
// (two-team-outcome markets like "Portugal vs. Spain: Team to Advance") and
// standalone top-volume battles (category 'market': politics/culture/futures).
interface PmMarket {
  id: string; question: string; outcomes: string[]; prices: number[];
  closed: boolean; volume24hr: number; conditionId: string;
}
async function polymarketTop(): Promise<PmMarket[]> {
  try {
    const res = await fetch(
      "https://gamma-api.polymarket.com/markets?closed=false&limit=100&order=volume24hr&ascending=false");
    if (!res.ok) return [];
    const raw = await res.json();
    const out: PmMarket[] = [];
    for (const m of raw ?? []) {
      let outcomes: string[] = [], prices: number[] = [];
      try {
        outcomes = JSON.parse(m.outcomes ?? "[]");
        prices = (JSON.parse(m.outcomePrices ?? "[]") as string[]).map(Number);
      } catch { continue; }
      if (outcomes.length !== 2 || prices.length !== 2) continue;
      if (!prices.every((p) => p > 0 && p < 1)) continue;
      out.push({
        id: String(m.id), question: String(m.question ?? ""),
        outcomes, prices, closed: Boolean(m.closed),
        volume24hr: Number(m.volume24hr ?? 0),
        conditionId: String(m.conditionId ?? ""),
      });
    }
    return out;
  } catch { return []; }
}

interface SgoOdds { pA: number | null; ouLine: number | null; pOver: number | null }

async function sgoWorldCupOdds(key: string): Promise<{ league: string; byMatch: Map<string, SgoOdds> }> {
  const byMatch = new Map<string, SgoOdds>();
  let league = "";
  try {
    // discover the league id instead of guessing
    const lres = await fetch(`${SGO_BASE}/leagues/?apiKey=${key}`);
    if (lres.ok) {
      const leagues = (await lres.json()).data ?? [];
      const wc = leagues.find((l: any) =>
        /world.?cup/i.test(`${l.leagueID} ${l.name ?? ""}`) && !/women|club|u\d\d/i.test(`${l.leagueID} ${l.name ?? ""}`));
      if (wc) league = wc.leagueID;
    }
    if (!league) return { league, byMatch };

    const now = Date.now();
    const res = await fetch(
      `${SGO_BASE}/events/?leagueID=${league}` +
      `&startsAfter=${new Date(now - 8 * 3600_000).toISOString()}` +
      `&startsBefore=${new Date(now + 48 * 3600_000).toISOString()}` +
      `&limit=50&apiKey=${key}`,
    );
    if (!res.ok) return { league, byMatch };
    for (const ev of (await res.json()).data ?? []) {
      let pA: number | null = null, pB: number | null = null;
      let ouLine: number | null = null, pOver: number | null = null;
      for (const odd of Object.values(ev.odds ?? {}) as any[]) {
        if ((odd.periodID !== "game" && odd.periodID !== "reg") || odd.statID !== "points") continue;
        const american = odd.fairOdds ?? odd.bookOdds;
        if (american == null) continue;
        if (odd.betTypeID === "ml" && odd.sideID === "away") pA = impliedProb(american);
        if (odd.betTypeID === "ml" && odd.sideID === "home") pB = impliedProb(american);
        if (odd.betTypeID === "ou" && odd.sideID === "over" && odd.statEntityID === "all") {
          const line = parseFloat(odd.fairOverUnder ?? odd.bookOverUnder);
          if (Number.isFinite(line)) { ouLine = line; pOver = impliedProb(american); }
        }
      }
      const key2 = `${norm(ev.teams?.away?.names?.long ?? "")}|${norm(ev.teams?.home?.names?.long ?? "")}`;
      byMatch.set(key2, {
        pA: pA != null && pB != null ? clamp(pA / (pA + pB)) : null,
        ouLine, pOver: pOver != null ? clamp(pOver) : null,
      });
    }
  } catch { /* odds enrichment is optional */ }
  return { league, byMatch };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const matches = await espnMatches();
    const now = Date.now();
    const window = matches.filter((m) => {
      const t = Date.parse(m.startsAt);
      return t > now - 12 * 3600_000 && t < now + 48 * 3600_000;
    });

    const SGO_KEY = Deno.env.get("SPORTSGAMEODDS_API_KEY") ?? "";
    const { league, byMatch } = SGO_KEY ? await sgoWorldCupOdds(SGO_KEY) : { league: "", byMatch: new Map<string, SgoOdds>() };
    const pm = await polymarketTop();
    const pmUsed = new Set<string>();

    // Polymarket line for a match: a two-team-outcome market naming both sides.
    // Returns the prob AND the market's condition id + which outcome label is
    // our side A, so the client can stream the real trade flow.
    interface PmLine { prob: number; cond: string; aOutcome: string }
    function pmMatchLine(aName: string, bName: string): PmLine | null {
      const a = norm(aName), b = norm(bName);
      for (const m of pm) {
        const q = norm(m.question);
        if (!q.includes(a) || !q.includes(b)) continue;
        const o0 = norm(m.outcomes[0]), o1 = norm(m.outcomes[1]);
        let pA: number | null = null, aOutcome = "";
        if (o0.includes(a) || a.includes(o0)) { pA = m.prices[0]; aOutcome = m.outcomes[0]; }
        else if (o1.includes(a) || a.includes(o1)) { pA = m.prices[1]; aOutcome = m.outcomes[1]; }
        if (pA == null) continue;
        pmUsed.add(m.id);
        return { prob: clamp(pA), cond: m.conditionId, aOutcome };
      }
      return null;
    }

    const rows: Record<string, unknown>[] = [];
    for (const m of window) {
      const aLabel = m.aName.toUpperCase(), bLabel = m.bName.toUpperCase();
      const odds = byMatch.get(`${norm(m.aName)}|${norm(m.bName)}`) ?? null;
      const status = m.state === "post" ? "final" : m.state === "in" ? "live" : "scheduled";

      const pmLine = pmMatchLine(m.aName, m.bName);
      let probA: number | null = odds?.pA ?? pmLine?.prob ?? null;
      if (probA == null && status === "live") probA = liveHeuristic(m.aScore, m.bScore, m.startsAt);

      let winner: string | null = null;
      if (status === "final") {
        winner = m.aScore > m.bScore ? "a" : m.bScore > m.aScore ? "b" : "tie";
      }

      rows.push({
        slug: `espn:${m.id}:match`,
        category: "worldcup",
        title: `${aLabel} vs ${bLabel}`,
        side_a_label: aLabel, side_b_label: bLabel,
        status, winner,
        ...(probA != null ? { prob_a: probA } : {}),
        score_a: m.aScore, score_b: m.bScore,
        period_label: m.period,
        starts_at: m.startsAt,
        source: {
          espn_id: m.id, sgo_league: league, card: "match",
          ...(pmLine ? { pm_condition: pmLine.cond, pm_a_outcome: pmLine.aOutcome } : {}),
        },
        updated_at: new Date().toISOString(),
      });

      if (odds?.ouLine != null) {
        let ouWinner: string | null = null;
        if (status === "final") ouWinner = m.aScore + m.bScore > odds.ouLine ? "a" : "b";
        rows.push({
          slug: `espn:${m.id}:total`,
          category: "prop",
          title: `OVER ${odds.ouLine} GOALS · ${aLabel} vs ${bLabel}`,
          side_a_label: `OVER ${odds.ouLine}`, side_b_label: `UNDER ${odds.ouLine}`,
          status, winner: ouWinner,
          ...(odds.pOver != null ? { prob_a: odds.pOver } : {}),
          score_a: m.aScore, score_b: m.bScore,
          period_label: m.period,
          starts_at: m.startsAt,
          source: { espn_id: m.id, sgo_league: league, card: "total", line: odds.ouLine },
          updated_at: new Date().toISOString(),
        });
      }
    }

    // Standalone Polymarket battles: top-volume binary markets not already
    // consumed as a match line. Curated hard: max 3, and nothing that names a
    // team playing today (those would shadow the real match cards).
    const todayNames = new Set(
      window.flatMap((m) => [norm(m.aName), norm(m.bName)]).filter((s) => s.length > 2));
    const SPORTS_RE = /world cup|fifa|nba|nfl|mlb|nhl|premier league|champions league|ufc|f1 | vs\.? |wimbledon|grand slam|super bowl|match|golden boot/i;
    const BANNED_RE = /esports|e-sports|league of legends|dota|cs2|csgo|counter.?strike|valorant|overwatch|call of duty|fortnite|starcraft/i;
    const eligible = pm
      .filter((x) => !pmUsed.has(x.id))
      .filter((x) => {
        const q = norm(x.question);
        return ![...todayNames].some((n) => q.includes(n));
      })
      // trending means CONTESTED: a 95/5 market is a fact, not an argument
      .filter((x) => x.prices[0] >= 0.08 && x.prices[0] <= 0.92)
      .filter((x) => !BANNED_RE.test(x.question));
    // reserve slots: up to 2 sports futures + up to 6 politics/econ/culture
    const standalone = [
      ...eligible.filter((x) => SPORTS_RE.test(x.question)).slice(0, 2),
      ...eligible.filter((x) => !SPORTS_RE.test(x.question)).slice(0, 6),
    ];
    for (const m of standalone) {
      const yesNo = norm(m.outcomes[0]) === "yes";
      rows.push({
        slug: `pm:${m.id}`,
        category: "market",
        title: m.question.toUpperCase(),
        side_a_label: m.outcomes[0].toUpperCase(),
        side_b_label: m.outcomes[1].toUpperCase(),
        status: m.closed ? "final" : "live",
        winner: m.closed ? (m.prices[0] > 0.5 ? "a" : "b") : null,
        prob_a: clamp(m.prices[0]),
        score_a: 0, score_b: 0,
        period_label: yesNo ? `${Math.round(m.prices[0] * 100)}¢` : null,
        starts_at: new Date().toISOString(),
        source: {
          polymarket_id: m.id, vol24: Math.round(m.volume24hr), card: "market",
          pm_condition: m.conditionId, pm_a_outcome: m.outcomes[0],
        },
        updated_at: new Date().toISOString(),
      });
    }

    let written = 0;
    if (rows.length) {
      const { error, count } = await supabase.from("arena_events")
        .upsert(rows, { onConflict: "slug", count: "exact" });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      written = count ?? rows.length;

      // price-river ticks: one point per card per sync (P of side A)
      const slugs = rows.map((r) => r.slug as string);
      const { data: withIds } = await supabase.from("arena_events")
        .select("id, prob_a, status").in("slug", slugs).not("prob_a", "is", null);
      const ticks = (withIds ?? [])
        .filter((r) => r.status !== "final")
        .map((r) => ({ target: r.id, prob: Number(r.prob_a) }));
      if (ticks.length) await supabase.from("arena_ticks").insert(ticks);

      // markets that rotated out of the curated set: prune the unstaked ones,
      // but STAKED ones must keep living — refresh their price/resolution
      // directly from gamma so they never freeze at a stale number
      const keep = new Set(rows.map((r) => r.slug as string));
      const staked: { id: string; pmId: string }[] = [];
      const { data: allMarkets } = await supabase.from("arena_events")
        .select("id, slug").eq("category", "market").neq("status", "final");
      for (const mkt of allMarkets ?? []) {
        if (keep.has(mkt.slug)) continue;
        const { data: fanStakes } = await supabase.from("arena_stakes")
          .select("id").eq("event_id", mkt.id).neq("client_id", HOUSE_ID).limit(1);
        if (fanStakes?.length) {
          const pmId = String(mkt.slug).split(":")[1];
          if (pmId) staked.push({ id: mkt.id, pmId });
          continue;
        }
        await supabase.from("arena_ticks").delete().eq("target", mkt.id);
        await supabase.from("arena_events").delete().eq("id", mkt.id);
      }
      for (const s of staked.slice(0, 12)) {
        try {
          const res2 = await fetch(`https://gamma-api.polymarket.com/markets/${s.pmId}`);
          if (!res2.ok) continue;
          const m2 = await res2.json();
          const prices2 = (JSON.parse(m2.outcomePrices ?? "[]") as string[]).map(Number);
          if (prices2.length !== 2) continue;
          const closed2 = Boolean(m2.closed);
          await supabase.from("arena_events").update({
            prob_a: clamp(prices2[0]),
            status: closed2 ? "final" : "live",
            winner: closed2 ? (prices2[0] > 0.5 ? "a" : "b") : null,
            period_label: `${Math.round(prices2[0] * 100)}¢`,
            starts_at: new Date().toISOString(), // keep it inside the lobby window
            updated_at: new Date().toISOString(),
          }).eq("id", s.id);
          if (!closed2) {
            await supabase.from("arena_ticks").insert({ target: s.id, prob: clamp(prices2[0]) });
          }
        } catch { /* stale refresh is best-effort */ }
      }
    }

    // seed thin pots at the line (house chips; once per event)
    let seeded = 0;
    const { data: openEvents } = await supabase.from("arena_events")
      .select("id, prob_a, status").neq("status", "final").not("prob_a", "is", null);
    for (const evRow of openEvents ?? []) {
      const { data: existing } = await supabase.from("arena_stakes")
        .select("id").eq("event_id", evRow.id).eq("client_id", HOUSE_ID).limit(1);
      if (existing?.length) {
        // already seeded -> keep the pot tracking the live line instead
        await rebalancePot(supabase, "event_id", evRow.id, Number(evRow.prob_a));
        continue;
      }
      const awayAmt = Math.round(SEED_TOTAL * Number(evRow.prob_a));
      const seedRows: Record<string, unknown>[] = [];
      for (const [side, amt] of [["away", awayAmt], ["home", SEED_TOTAL - awayAmt]] as const) {
        let rest = amt;
        while (rest > 0) {
          const chunk = Math.min(500, rest);
          seedRows.push({ event_id: evRow.id, client_id: HOUSE_ID, side, amount: chunk });
          rest -= chunk;
        }
      }
      const { error } = await supabase.from("arena_stakes").insert(seedRows);
      if (!error) seeded++;
    }

    // settle finals with unsettled stakes
    let settled = 0;
    const { data: unsettled } = await supabase.from("arena_stakes")
      .select("event_id").eq("settled", false).not("event_id", "is", null).limit(1000);
    const ids = [...new Set((unsettled ?? []).map((r) => r.event_id))];
    if (ids.length) {
      const { data: finals } = await supabase.from("arena_events")
        .select("id").in("id", ids).eq("status", "final").not("winner", "is", null);
      for (const f of finals ?? []) {
        const { error } = await supabase.rpc("arena_settle_event", { p_event: f.id });
        if (!error) settled++;
      }
    }

    return new Response(JSON.stringify({
      success: true, espn_matches: matches.length, in_window: window.length,
      sgo_league: league || "none", cards_written: written, pots_seeded: seeded, events_settled: settled,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

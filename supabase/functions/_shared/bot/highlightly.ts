// Bot Engine v2 — Highlightly surgical enrichment.
//
// We do NOT use Highlightly as the live spine (ESPN handles that for free).
// Instead, when the brain gates an excitement-worthy event, we call Highlightly
// for team-level box-score stats and attach them to the voice payload.
//
// Budget: 100 calls/day. Strategy:
//   - One match-lookup call per game per poll cycle (cached in-process).
//   - One statistics call per emit (cached in-process for the cycle).
// In a 2.5-hour NBA game with ~5-10 emits, that's ~15-25 calls/game.

const BASKETBALL_BASE = "https://basketball.highlightly.net";
const NBA_LEAGUE_ID = 10996;

interface HighlightlyMatch {
  id: number;
  date: string;
  awayTeam: { id: number; name: string; logo: string };
  homeTeam: { id: number; name: string; logo: string };
  state?: { clock: string | null; description: string };
}

interface HighlightlyStat {
  displayName: string;
  value: number;
}

export interface TeamShootingContext {
  team: string;                   // "New York Knicks"
  fgMade: number | null;
  fgAttempted: number | null;
  threeMade: number | null;
  threeAttempted: number | null;
  ftMade: number | null;
  ftAttempted: number | null;
  assists: number | null;
  rebounds: number | null;
  turnovers: number | null;
  biggestLead: number | null;
}

export interface GameEnrichment {
  away: TeamShootingContext | null;
  home: TeamShootingContext | null;
  fetchedAt: string;
}

// ---------- low-level fetch with auth + timeout ----------

async function hgFetch(path: string, params: Record<string, string | number>): Promise<any | null> {
  const apiKey = Deno.env.get("HIGHLIGHTLY_API_KEY");
  if (!apiKey) return null;
  const url = new URL(`${BASKETBALL_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  try {
    const res = await fetch(url.toString(), {
      headers: { "x-rapidapi-key": apiKey, Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[highlightly] ${res.status} ${url}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[highlightly] fetch error`, err);
    return null;
  }
}

// ---------- per-cycle in-process caches ----------

const matchCache = new Map<string, HighlightlyMatch | null>();   // key: `team:${name}`
const statsCache = new Map<number, GameEnrichment | null>();      // key: highlightly match id

// ---------- resolve a Highlightly match for a team ----------

export async function findNbaMatchForTeam(teamName: string): Promise<HighlightlyMatch | null> {
  const key = `team:${teamName.toLowerCase()}`;
  if (matchCache.has(key)) return matchCache.get(key) ?? null;

  // Highlightly date param uses UTC. We accept any near-window match (today/tomorrow/yesterday)
  // and pick the one whose state is in_play OR closest to now.
  const data = await hgFetch("/matches", { leagueId: NBA_LEAGUE_ID, season: 2025, limit: 20 });
  const matches: HighlightlyMatch[] = data?.data ?? [];
  const needle = teamName.toLowerCase();
  const candidates = matches.filter(
    (m) => m.homeTeam.name.toLowerCase().includes(needle) || m.awayTeam.name.toLowerCase().includes(needle),
  );
  // Prefer in-play, then earliest in the future, then most recent finished.
  const live = candidates.find((m) => /play|live|started/i.test(m.state?.description ?? ""));
  if (live) {
    matchCache.set(key, live);
    return live;
  }
  const now = Date.now();
  candidates.sort((a, b) => Math.abs(new Date(a.date).getTime() - now) - Math.abs(new Date(b.date).getTime() - now));
  const pick = candidates[0] ?? null;
  matchCache.set(key, pick);
  return pick;
}

// ---------- pull stats for a known Highlightly match id ----------

export async function fetchGameStats(matchId: number): Promise<GameEnrichment | null> {
  if (statsCache.has(matchId)) return statsCache.get(matchId) ?? null;
  const data = await hgFetch(`/statistics/${matchId}`, {});
  if (!Array.isArray(data)) {
    statsCache.set(matchId, null);
    return null;
  }
  const sides = data.slice(0, 2).map(normalizeSide);
  // Highlightly statistics returns [home, away] OR [away, home] without a flag.
  // We just hand the caller both and let it match by team name.
  const enrichment: GameEnrichment = {
    away: sides[1] ?? null,
    home: sides[0] ?? null,
    fetchedAt: new Date().toISOString(),
  };
  statsCache.set(matchId, enrichment);
  return enrichment;
}

function normalizeSide(entry: any): TeamShootingContext | null {
  if (!entry?.team?.name) return null;
  const get = (name: string): number | null => {
    const row = (entry.statistics as HighlightlyStat[] | undefined)?.find(
      (s) => s.displayName.toLowerCase() === name.toLowerCase(),
    );
    return row ? Number(row.value) : null;
  };
  return {
    team: entry.team.name,
    fgMade:        get("Succesful Field Goals"),     // (sic — Highlightly's spelling)
    fgAttempted:   get("Field Goals"),
    threeMade:     get("Succesful 3 Pointers"),
    threeAttempted: get("3 Pointers"),
    ftMade:        get("Succesful Free Throws"),
    ftAttempted:   get("Free Throws"),
    assists:       get("Assists"),
    rebounds:      get("Rebounds"),
    turnovers:     get("Turnovers"),
    biggestLead:   get("Biggest Lead"),
  };
}

// ---------- pick the team-side that matches a name ----------

export function pickSide(enrichment: GameEnrichment, teamName: string): TeamShootingContext | null {
  const needle = teamName.toLowerCase();
  if (enrichment.home && enrichment.home.team.toLowerCase().includes(needle)) return enrichment.home;
  if (enrichment.away && enrichment.away.team.toLowerCase().includes(needle)) return enrichment.away;
  return null;
}

// ---------- format a short context string for the voice payload ----------

export function shootingLine(stats: TeamShootingContext): string | null {
  const parts: string[] = [];
  if (stats.fgMade != null && stats.fgAttempted != null && stats.fgAttempted > 0) {
    const pct = Math.round((stats.fgMade / stats.fgAttempted) * 100);
    parts.push(`${stats.fgMade}/${stats.fgAttempted} FG (${pct}%)`);
  }
  if (stats.threeMade != null && stats.threeAttempted != null && stats.threeAttempted > 0) {
    const pct = Math.round((stats.threeMade / stats.threeAttempted) * 100);
    parts.push(`${stats.threeMade}/${stats.threeAttempted} 3PT (${pct}%)`);
  }
  return parts.length ? parts.join(", ") : null;
}

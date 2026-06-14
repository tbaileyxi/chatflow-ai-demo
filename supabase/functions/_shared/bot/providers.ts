// Bot Engine v2 — sports data providers.
// ESPN is the live spine for beta. Highlightly slots in later by env var.
// Both implement SportsDataProvider so nothing downstream knows which is active.

import type {
  Game,
  League,
  PlayEvent,
  SportsDataProvider,
  TeamSide,
} from "./types.ts";

// ---------------------------------------------------------------
// ESPN provider — public hidden endpoints, no key.
// Treat as unofficial: every call try/except, never crash the loop.
// ---------------------------------------------------------------

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

// Pull real box-score stat leaders from the ESPN summary so the smart in-game
// bot can cite actual numbers ("Brunson 31 PTS, 7 AST"). Returns a map of
// lowercased team display name -> one compact leader line. Best-effort.
const STAT_ABBR: Record<string, string> = {
  points: "PTS", assists: "AST", rebounds: "REB",
  passingYards: "PASS YDS", rushingYards: "RUSH YDS", receivingYards: "REC YDS",
  hits: "H", rbis: "RBI", homeRuns: "HR", strikeouts: "K",
  goals: "G", saves: "SV", shots: "SOG",
};
export async function fetchEspnLeaders(
  gameProviderId: string,
  league: League,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const p = leaguePath(league);
  if (!p) return out;
  const data = await safeJson(`${ESPN_BASE}/${p.sport}/${p.league}/summary?event=${gameProviderId}`);
  const teams: any[] = Array.isArray(data?.leaders) ? data.leaders : [];
  for (const t of teams) {
    const teamName = String(t?.team?.displayName ?? "").toLowerCase();
    if (!teamName) continue;
    // Use the team's single top performer (first category names the athlete)
    // and append that athlete's other stat lines for a richer line.
    const cats: any[] = Array.isArray(t?.leaders) ? t.leaders : [];
    const headLd = cats[0]?.leaders?.[0];
    const who = headLd?.athlete?.shortName ?? headLd?.athlete?.displayName;
    if (!who) continue;
    const parts: string[] = [];
    for (const c of cats.slice(0, 2)) {
      const ld = c?.leaders?.[0];
      if (!ld?.displayValue) continue;
      const abbr = STAT_ABBR[String(c?.name ?? "")] ?? String(c?.shortDisplayName ?? c?.name ?? "").toUpperCase();
      parts.push(`${ld.displayValue} ${abbr}`);
    }
    if (parts.length > 0) out.set(teamName, `${who} ${parts.join(", ")}`);
  }
  return out;
}

function leaguePath(league: League): { sport: string; league: string } | null {
  switch (league) {
    case "NBA":   return { sport: "basketball", league: "nba" };
    case "NCAAB": return { sport: "basketball", league: "mens-college-basketball" };
    case "NFL":   return { sport: "football",   league: "nfl" };
    case "NCAAF": return { sport: "football",   league: "college-football" };
    case "MLB":   return { sport: "baseball",   league: "mlb" };
    case "NHL":   return { sport: "hockey",     league: "nhl" };
    default: return null;
  }
}

function mapEspnStatus(state: string | undefined): Game["status"] {
  switch (state) {
    case "pre":      return "scheduled";
    case "in":       return "in_progress";
    case "post":     return "final";
    case "halftime": return "halftime";
    default:         return "scheduled";
  }
}

async function safeJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.warn(`[espn] ${res.status} ${url}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[espn] fetch error`, err);
    return null;
  }
}

function normalizeCompetitorToSide(c: any): TeamSide {
  const team = c?.team ?? {};
  return {
    providerId: String(team.id ?? c.id ?? ""),
    teamId: null,                                       // resolved later from DB
    name: team.shortDisplayName ?? team.name ?? team.displayName ?? "",
    fullName: team.displayName ?? team.name ?? "",
    abbreviation: team.abbreviation,
    score: Number(c.score ?? 0) || 0,
  };
}

function normalizeEspnEvent(ev: any, league: League): Game | null {
  const comp = ev?.competitions?.[0];
  if (!comp) return null;
  const competitors = comp.competitors ?? [];
  const home = competitors.find((c: any) => c.homeAway === "home");
  const away = competitors.find((c: any) => c.homeAway === "away");
  if (!home || !away) return null;
  const status = comp?.status?.type ?? ev?.status?.type ?? {};
  return {
    providerId: String(ev.id),
    league,
    status: mapEspnStatus(status.state),
    startTime: comp.startDate ?? ev.date ?? "",
    home: normalizeCompetitorToSide(home),
    away: normalizeCompetitorToSide(away),
    period: typeof comp?.status?.period === "number" ? comp.status.period : null,
    clock: comp?.status?.displayClock ?? null,
    winProbHome: null,
  };
}

export class EspnProvider implements SportsDataProvider {
  name = "espn";

  async liveGames(league: League): Promise<Game[]> {
    const p = leaguePath(league);
    if (!p) return [];
    const data = await safeJson(`${ESPN_BASE}/${p.sport}/${p.league}/scoreboard`);
    const events = (data?.events ?? []) as any[];
    return events
      .map((e) => normalizeEspnEvent(e, league))
      .filter((g): g is Game => g !== null);
  }

  async gameEvents(gameProviderId: string, league: League): Promise<PlayEvent[]> {
    const p = leaguePath(league);
    if (!p) return [];
    const url = `${ESPN_BASE}/${p.sport}/${p.league}/summary?event=${gameProviderId}`;
    const data = await safeJson(url);
    if (!data) return [];

    // Build a Game stub from header so PlayEvent.game has context.
    const header = data?.header?.competitions?.[0];
    const headerCompetitors = header?.competitors ?? [];
    const hc = headerCompetitors.find((c: any) => c.homeAway === "home");
    const ac = headerCompetitors.find((c: any) => c.homeAway === "away");
    const game: Game = {
      providerId: gameProviderId,
      league,
      status: mapEspnStatus(header?.status?.type?.state),
      startTime: header?.date ?? "",
      home: hc ? normalizeCompetitorToSide(hc) : { providerId: "", teamId: null, name: "", fullName: "", score: 0 },
      away: ac ? normalizeCompetitorToSide(ac) : { providerId: "", teamId: null, name: "", fullName: "", score: 0 },
      period: typeof header?.status?.period === "number" ? header.status.period : null,
      clock: header?.status?.displayClock ?? null,
      winProbHome: null,
    };

    // Plays can live in `plays[]` (NBA/NFL summary) or under `drives.previous[].plays[]`.
    const flatPlays: any[] = [];
    if (Array.isArray(data?.plays)) flatPlays.push(...data.plays);
    if (Array.isArray(data?.drives?.previous)) {
      for (const d of data.drives.previous) {
        if (Array.isArray(d.plays)) flatPlays.push(...d.plays);
      }
    }
    if (Array.isArray(data?.drives?.current?.plays)) {
      flatPlays.push(...data.drives.current.plays);
    }

    const events = flatPlays
      .map((p) => normalizeEspnPlay(p, game))
      .filter((e): e is PlayEvent => e !== null);

    // MLB/NHL: ESPN omits `scoreValue`, so normalizeEspnPlay can't tell which
    // plays scored. Derive runs/goals from the cumulative score CHANGING
    // between consecutive chronological plays. Without this every baseball
    // play has pointsScored=undefined and the brain emits nothing.
    let prevHome = 0;
    let prevAway = 0;
    for (const e of events) {
      if (!e.scoreAfter) continue;
      const dHome = e.scoreAfter.home - prevHome;
      const dAway = e.scoreAfter.away - prevAway;
      if (!e.pointsScored && (dHome > 0 || dAway > 0)) {
        if (dHome > 0) {
          e.pointsScored = dHome;
          e.scoringTeamProviderId = game.home.providerId;
        } else {
          e.pointsScored = dAway;
          e.scoringTeamProviderId = game.away.providerId;
        }
      }
      prevHome = e.scoreAfter.home;
      prevAway = e.scoreAfter.away;
    }

    return events;
  }
}

function normalizeEspnPlay(p: any, game: Game): PlayEvent | null {
  if (!p?.id) return null;
  const text = String(p.text ?? p.shortText ?? "");
  const scoreValue = typeof p.scoreValue === "number" ? p.scoreValue : (p.scoringPlay ? Number(p.scoreValue ?? 0) : 0);
  const teamProviderId = String(p?.team?.id ?? p?.start?.team?.id ?? "");
  return {
    providerId: String(p.id),
    game,
    occurredAt: p.wallclock ?? p.modified ?? game.startTime,
    rawType: String(p?.type?.text ?? p?.type?.id ?? "play"),
    description: text,
    scoringTeamProviderId: teamProviderId || undefined,
    pointsScored: scoreValue > 0 ? scoreValue : undefined,
    scoreAfter: {
      home: Number(p.homeScore ?? 0) || 0,
      away: Number(p.awayScore ?? 0) || 0,
    },
    period: typeof p?.period?.number === "number" ? p.period.number : undefined,
    clock: p?.clock?.displayValue ?? undefined,
    scorerName: extractScorerName(p, text, scoreValue),
  };
}

function extractScorerName(p: any, text: string, scoreValue: number): string | undefined {
  if (!scoreValue || scoreValue <= 0) return undefined;
  // ESPN sometimes attaches participants with athlete refs; cheap fallback is to
  // pull the leading name from the play text ("Stephen Curry makes 27-foot three…").
  const participants = p?.participants;
  if (Array.isArray(participants)) {
    for (const part of participants) {
      const display = part?.athlete?.displayName;
      if (display) return display;
    }
  }
  const m = text.match(/^([A-Z][a-zA-Z'.\-]+(?:\s[A-Z][a-zA-Z'.\-]+){1,3})\b/);
  return m ? m[1] : undefined;
}

// ---------------------------------------------------------------
// Highlightly provider — stub. Same interface; selectable via env var.
// Fill in when we switch the contract; until then it errors out
// loudly so anyone enabling it knows it needs implementation.
// ---------------------------------------------------------------

export class HighlightlyProvider implements SportsDataProvider {
  name = "highlightly";
  async liveGames(_league: League): Promise<Game[]> {
    throw new Error("HighlightlyProvider not implemented yet");
  }
  async gameEvents(_gameId: string, _league: League): Promise<PlayEvent[]> {
    throw new Error("HighlightlyProvider not implemented yet");
  }
}

// ---------------------------------------------------------------
// Factory — env-selected.
// ---------------------------------------------------------------

export function getProvider(): SportsDataProvider {
  const name = (Deno.env.get("SPORTS_PROVIDER") || "espn").toLowerCase();
  switch (name) {
    case "highlightly": return new HighlightlyProvider();
    default:            return new EspnProvider();
  }
}

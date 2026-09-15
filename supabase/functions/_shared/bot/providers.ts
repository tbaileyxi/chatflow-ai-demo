// Bot Engine v2 — sports data providers.
// ESPN is the live spine for beta. Highlightly slots in later by env var.
// Both implement SportsDataProvider so nothing downstream knows which is active.

import { ESPN_HEADERS } from "../espnFetch.ts";
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

const ESPN_BASE = "https://site.web.api.espn.com/apis/site/v2/sports";

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

// ---------------------------------------------------------------
// Box-score stat lines.  This exists because ESPN's `leaders` array is EMPTY
// for MLB (and thin elsewhere), which is why the bot had never once cited a
// stat — it only ever had the score.  `boxscore.players` is always populated
// and carries both game and season numbers, so we read it directly.
//
// Returns two indexes:
//   byPlayer — every player, keyed by several name spellings, so the scorer
//              named in a play can be matched to their own line.
//   byTeam   — that team's best performer, keyed by EVERY team-name variant
//              ESPN exposes (displayName / name / abbreviation / location).
//              The old code keyed only on displayName ("New York Mets") and
//              looked up with our DB nickname ("Mets"), so it always missed.
// Strings are pre-formatted here; the model never computes a number.
// ---------------------------------------------------------------

// Priority is per stat GROUP, not global. This matters: "R", "H" and "HR" mean
// runs/hits SCORED in a batting group and runs/hits ALLOWED in a pitching one.
// A single flat list picks the batting labels off a pitcher's row and states
// his line exactly backwards ("5 R, 8 H" for a guy who gave up five).
const STAT_GROUPS: Array<{ when: string; priority: string[] }> = [
  { when: "IP",    priority: ["IP", "K", "ER", "H", "ERA"] },          // pitching
  { when: "H-AB",  priority: ["H-AB", "R", "RBI", "HR", "AVG"] },      // batting
  { when: "C/ATT", priority: ["C/ATT", "YDS", "TD", "INT"] },          // passing
  { when: "CAR",   priority: ["CAR", "YDS", "TD", "LONG"] },           // rushing
  { when: "REC",   priority: ["REC", "YDS", "TD", "LONG"] },           // receiving
  { when: "PTS",   priority: ["PTS", "REB", "AST", "3PT"] },           // basketball
  { when: "SOG",   priority: ["G", "A", "SOG"] },                      // hockey
];
const STAT_PRIORITY_FALLBACK = ["YDS", "TD", "PTS", "G", "A"];
// Labels that read better without the label — "2-5" beats "2-5 H-AB".
const BARE_LABELS = new Set(["H-AB", "C/ATT"]);
// Groups we never quote a player from. "fumbles" is the dangerous one: its
// label REC means RECOVERED, which is indistinguishable from a reception once
// formatted, so a fumble renders as "1 REC". The rest are noise for a
// play reaction.
const SKIP_GROUPS = new Set(["fumbles", "punting", "kickreturns", "puntreturns", "defensive", "interceptions"]);

function isEmptyStat(v: string): boolean {
  const s = v.trim();
  return s === "" || s === "0" || s === "0.0" || s === "--" || s === "0-0" || s === ".000";
}

function formatStatLine(labels: string[], stats: string[]): string {
  const pairs = new Map<string, string>();
  labels.forEach((l, i) => {
    const v = stats[i];
    if (typeof v === "string" && !isEmptyStat(v)) pairs.set(l, v.trim());
  });
  // Pick the priority list belonging to THIS group, identified by a label only
  // that group has. Falls back to a small generic list for unknown shapes.
  const group = STAT_GROUPS.find((g) => labels.includes(g.when));
  const priority = group ? group.priority : STAT_PRIORITY_FALLBACK;

  const picked: string[] = [];
  for (const label of priority) {
    if (picked.length >= 4) break;
    const v = pairs.get(label);
    if (!v) continue;
    picked.push(BARE_LABELS.has(label) ? v : `${v} ${label}`);
  }
  return picked.join(", ");
}

function nameKeys(athlete: any): string[] {
  const short = String(athlete?.shortName ?? "").toLowerCase().trim();
  const full = String(athlete?.displayName ?? "").toLowerCase().trim();
  const last = String(athlete?.lastName ?? "").toLowerCase().trim()
    || full.split(" ").slice(-1)[0] || "";
  return [short, full, last].filter((s) => s.length > 1);
}

function teamKeys(team: any): string[] {
  return [team?.displayName, team?.name, team?.shortDisplayName, team?.abbreviation, team?.location]
    .map((s) => String(s ?? "").toLowerCase().trim())
    .filter((s) => s.length > 0);
}

// The poller calls this once per GATED PLAY, and a busy game gates many plays
// in one sweep — without a cache that is N identical downloads of the same
// large summary payload, which is enough to blow the function's wall clock.
// TTL is short so numbers still move during a game, but a single sweep pays
// for one fetch per game instead of one per play.
type BoxLines = { byPlayer: Map<string, string>; byTeam: Map<string, string> };
const BOX_TTL_MS = 60_000;
const boxCache = new Map<string, { at: number; value: BoxLines }>();

export async function fetchEspnBoxScoreLines(
  gameProviderId: string,
  league: League,
): Promise<BoxLines> {
  const cacheKey = `${league}:${gameProviderId}`;
  const hit = boxCache.get(cacheKey);
  if (hit && Date.now() - hit.at < BOX_TTL_MS) return hit.value;

  const byPlayer = new Map<string, string>();
  const byTeam = new Map<string, string>();
  const p = leaguePath(league);
  if (!p) return { byPlayer, byTeam };

  const data = await safeJson(`${ESPN_BASE}/${p.sport}/${p.league}/summary?event=${gameProviderId}`);
  const teams: any[] = Array.isArray(data?.boxscore?.players) ? data.boxscore.players : [];

  for (const t of teams) {
    let best = { line: "", who: "", score: -1 };
    // Richest line wins, not the first one seen. A player can appear in several
    // groups (Bijan Robinson rushes AND receives); ESPN lists rushing first, so
    // first-write-wins would cite his 24 rushing yards on a 100-yard receiving
    // day. Component count is a good proxy for "the line that tells the story".
    const bestByKey = new Map<string, { line: string; score: number }>();

    for (const group of (Array.isArray(t?.statistics) ? t.statistics : [])) {
      const groupName = String(group?.name ?? "").toLowerCase();
      if (SKIP_GROUPS.has(groupName)) continue;
      const labels: string[] = Array.isArray(group?.labels) ? group.labels : [];
      for (const a of (Array.isArray(group?.athletes) ? group.athletes : [])) {
        const stats: string[] = Array.isArray(a?.stats) ? a.stats : [];
        if (labels.length === 0 || stats.length === 0) continue;
        const line = formatStatLine(labels, stats);
        if (!line) continue;
        const score = line.split(",").length;
        const who = a?.athlete?.shortName ?? a?.athlete?.displayName ?? "";
        for (const k of nameKeys(a?.athlete)) {
          const prev = bestByKey.get(k);
          if (!prev || score > prev.score) bestByKey.set(k, { line, score });
        }
        if (who && score > best.score) best = { line, who, score };
      }
    }
    for (const [k, v] of bestByKey) {
      if (!byPlayer.has(k)) byPlayer.set(k, v.line);
    }
    if (best.who) {
      for (const k of teamKeys(t?.team)) {
        if (!byTeam.has(k)) byTeam.set(k, `${best.who} ${best.line}`);
      }
    }
  }
  const value = { byPlayer, byTeam };
  boxCache.set(cacheKey, { at: Date.now(), value });
  return value;
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
    // ESPN 403s without a User-Agent. This sent none, so every scoreboard call
    // came back null and the poller reported games_seen: 0 through entire slates
    // of live games — silently, because a null here reads as "no games".
    const res = await fetch(url, { headers: ESPN_HEADERS });
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

  // ESPN's bare scoreboard answers with the current WEEK, not the current day.
  // While UNC played TCU in Dublin it returned week 1 — Sep 4 through Sep 7 —
  // and the game being played that afternoon was not in it. The bot had no game
  // to narrate, so a live room stayed silent through an actual live game.
  //
  // Asking for an explicit date range as well fixes it. Yesterday through
  // tomorrow rather than just today, because ESPN dates its scoreboard in
  // Eastern time: a night kickoff is already tomorrow in UTC.
  async liveGames(league: League): Promise<Game[]> {
    const p = leaguePath(league);
    if (!p) return [];

    const day = (offset: number) =>
      new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
    const base = `${ESPN_BASE}/${p.sport}/${p.league}/scoreboard`;

    const [week, days] = await Promise.all([
      safeJson(base),
      safeJson(`${base}?dates=${day(-1)}-${day(1)}&limit=200`),
    ]);

    // The same game comes back from both calls; ESPN's event id is the identity.
    const byId = new Map<string, any>();
    for (const e of [...(week?.events ?? []), ...(days?.events ?? [])]) {
      if (e?.id) byId.set(e.id, e);
    }

    return [...byId.values()]
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

    // THE CLEAN SENTENCE LIVES IN A DIFFERENT ARRAY.
    //
    // drives[].plays[].text is raw play-by-play, written for a gamecast that
    // shows it beside a field diagram:
    //   "(Shotgun) P.Mahomes scrambles up the middle for 15 yards, TOUCHDOWN.
    //    H.Butker extra point is GOOD, Center-J.Winchester, Holder-M.Araiza."
    // The holder and the long snapper are in there. Nobody in a chat room
    // wants that, and shortText does not exist on these objects at all.
    //
    // ESPN also publishes `scoringPlays`, the same play written for a human:
    //   "Patrick Mahomes 15 Yd Rush (Harrison Butker Kick)"
    // Same id, so it can be matched exactly rather than guessed at.
    const cleanById = new Map<string, string>();
    for (const sp of (Array.isArray(data?.scoringPlays) ? data.scoringPlays : [])) {
      const t = String(sp?.text ?? "").trim();
      if (sp?.id && t) cleanById.set(String(sp.id), t);
    }

    const events = flatPlays
      .map((p) => normalizeEspnPlay(p, game, cleanById))
      .filter((e): e is PlayEvent => e !== null);

    // Sort chronologically. NOTHING guaranteed this before, and two things
    // depend on it:
    //   1. The score-delta loop below reads "consecutive chronological plays"
    //      to work out who scored. Out of order, the deltas go negative and
    //      the run is attributed to the wrong side or dropped entirely.
    //   2. Emission order becomes message order in the room. Unsorted, a
    //      first-inning RBI posted AFTER a fourth-inning blowout line, so the
    //      chat read backwards — seen in production 2026-08-07.
    // ESPN play ids increase with play order, so they are the tie-break when
    // wallclock is missing (it falls back to game.startTime for every play).
    const playSeq = (e: PlayEvent) => {
      const n = Number(String(e.providerId).replace(/\D/g, ""));
      return Number.isFinite(n) ? n : 0;
    };
    events.sort((a, b) => {
      const ta = Date.parse(a.occurredAt) || 0;
      const tb = Date.parse(b.occurredAt) || 0;
      if (ta !== tb) return ta - tb;
      return playSeq(a) - playSeq(b);
    });

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

function normalizeEspnPlay(
  p: any,
  game: Game,
  cleanById?: Map<string, string>,
): PlayEvent | null {
  if (!p?.id) return null;
  // The readable version when ESPN has one for this play, the raw one
  // otherwise — a non-scoring play has no scoringPlays entry.
  const text = String(
    cleanById?.get(String(p.id)) ?? p.text ?? p.shortText ?? "",
  );
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

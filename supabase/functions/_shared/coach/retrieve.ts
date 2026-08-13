// Coach retrieval layer.
//
// THE IRON RULE STILL HOLDS: the model is a MOUTH, never EYES. What changed is
// who assembles the facts. The bot engine assembles them from a play gater;
// this module assembles them from our own database and the sports APIs we
// already call. The model still cannot search, cannot recall, and cannot say
// anything that is not in the payload it is handed.
//
// Three tiers of grounding, in descending order of trust:
//   1. OUR DATABASE   — chat, ledgers, members, the bot's own emitted lines.
//                       Unique to us. Nobody else can answer from this.
//   2. SPORTS APIS    — scores, schedule, records. Structured, already wired.
//   3. MODEL KNOWLEDGE — only for settled history (past championships, famous
//      games, rivalries). Never for anything that moves: roster, who starts,
//      who is hurt, this season's record, standings. Those are tier 1 or 2 or
//      the Coach says it doesn't have them. See the `knowledge` lane in
//      answer.ts.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

// ---------------------------------------------------------------------------
// Types — these ARE the payload contract. If a field isn't here, the model
// cannot reference it.
// ---------------------------------------------------------------------------

export interface TranscriptLine {
  /** 1-based index. The model cites these so we can verify attribution. */
  n: number;
  id: string;
  speaker: string;
  text: string;
  at: string;
  isBot: boolean;
}

export interface GameBeat {
  at: string;
  text: string;
  excitement: number | null;
}

export interface LedgerRow {
  name: string;
  wins: number;
  losses: number;
  net: number;
  streak: number;
}

export interface GameSnapshot {
  state: "live" | "postgame" | "pregame" | "none";
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  period: string | null;
  clock: string | null;
  startTime: string;
}

export interface BoxScore {
  /** "New York Yankees: 7 R, 11 H, 0 E" — one line per side, pre-formatted. */
  teamLines: string[];
  /** "Judge 2-4, HR, 3 RBI" — best performer per side. */
  leaderLines: string[];
}

export interface HuddleContext {
  huddleId: string;
  huddleName: string;
  teamId: string | null;
  teamName: string | null;
  league: string | null;
  memberCount: number;
}

// ---------------------------------------------------------------------------
// 1. The room — what people actually said.
// ---------------------------------------------------------------------------

/**
 * Pull the room's recent conversation, oldest-first, numbered for citation.
 *
 * Bot messages are included and flagged. That matters: in a quiet room the
 * bot's own news posts ARE the history, and "what did I miss" recapping team
 * news for someone who just joined is a real answer, not a fallback.
 */
export async function getRoomTranscript(
  supabase: SupabaseClient,
  huddleId: string,
  sinceIso: string,
  limit = 250,
): Promise<TranscriptLine[]> {
  const { data, error } = await supabase
    .from("huddle_messages")
    .select("id, user_id, content, created_at, is_bot_message, message_type")
    .eq("huddle_id", huddleId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.warn("[coach.retrieve] transcript failed", error);
    return [];
  }

  const humanIds = [...new Set(
    data.filter((m) => !m.is_bot_message).map((m) => m.user_id),
  )];
  const names = await resolveNames(supabase, humanIds);

  // Back to chronological for the model — a recap that reads backwards is
  // worse than no recap.
  return data
    .reverse()
    .filter((m) => (m.content ?? "").trim().length > 0)
    .map((m, i) => ({
      n: i + 1,
      id: m.id,
      speaker: m.is_bot_message ? "Coach" : (names.get(m.user_id) ?? "Someone"),
      text: String(m.content).slice(0, 500),
      at: m.created_at,
      isBot: !!m.is_bot_message,
    }));
}

async function resolveNames(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("user_id, display_name, username")
    .in("user_id", userIds);
  return new Map(
    (data ?? []).map((p: Record<string, string>) => [
      p.user_id,
      p.display_name || p.username || "Someone",
    ]),
  );
}

// ---------------------------------------------------------------------------
// 2. The game — what the Coach already said about it.
// ---------------------------------------------------------------------------

/**
 * The Coach's own emitted in-game lines, from bot_emit_log.
 *
 * This is the answer to "does it actually watch the game?" — bot-live-poller
 * reads ESPN's play-by-play every 60s, gates plays on excitement, and logs
 * every line it emits along with the structured facts behind it. So the game
 * half of a recap is a SELECT against work already done, not a second
 * integration and not a second pass over the play feed.
 */
export async function getGameBeats(
  supabase: SupabaseClient,
  teamId: string,
  sinceIso: string,
  mode: "in_game" | "news" = "in_game",
  limit = 40,
): Promise<GameBeat[]> {
  const { data, error } = await supabase
    .from("bot_emit_log")
    .select("message_text, excitement_score, created_at")
    .eq("team_id", teamId)
    .eq("mode", mode)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data) {
    console.warn("[coach.retrieve] beats failed", error);
    return [];
  }
  return data.map((r) => ({
    at: r.created_at,
    text: r.message_text,
    excitement: r.excitement_score ?? null,
  }));
}

// ---------------------------------------------------------------------------
// 3. The ledger — who's actually winning in this room.
// ---------------------------------------------------------------------------

/**
 * Season standings for THIS huddle only.
 *
 * Scoped hard to one huddle on purpose. The Coach must never surface another
 * room's ledger, and "who's the worst bettor" is only a fair question about
 * the people in the room being asked.
 *
 * Sorted worst-first is deliberate — the funny question is the common one.
 */
export async function getLedger(
  supabase: SupabaseClient,
  huddleId: string,
): Promise<LedgerRow[]> {
  const { data, error } = await supabase
    .from("fade_season_stats")
    .select("user_id, total_points, total_wins, total_losses, current_streak")
    .eq("huddle_id", huddleId);

  if (error || !data || data.length === 0) return [];

  const names = await resolveNames(supabase, data.map((r) => r.user_id));
  return data
    .map((r) => ({
      name: names.get(r.user_id) ?? "A member",
      wins: r.total_wins ?? 0,
      losses: r.total_losses ?? 0,
      net: r.total_points ?? 0,
      streak: r.current_streak ?? 0,
    }))
    .sort((a, b) => a.net - b.net);
}

// ---------------------------------------------------------------------------
// 4. The scoreboard — from our own games table.
// ---------------------------------------------------------------------------

export async function getGameSnapshot(
  supabase: SupabaseClient,
  teamId: string,
): Promise<GameSnapshot | null> {
  // Most recent game touching this team, in either direction: a live one if
  // there is one, otherwise the last final, otherwise the next scheduled.
  const { data: raw } = await supabase
    .from("games")
    .select(
      "status, start_time, home_score, away_score, period, clock, home_team_id, away_team_id, sport_key",
    )
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order("start_time", { ascending: false })
    .limit(20);

  // The sport MUST match the team's own sport. Without this the Coach told a
  // Browns room "preseason loss, Lions 114 - Browns 110" — a real row in the
  // games table with sport_key basketball_nba and NFL teams attached, because
  // whatever wrote it matched a Pistons/Cavaliers game on the shared city
  // names "Detroit" and "Cleveland". The model reported it faithfully, which
  // is exactly why an unfiltered read is dangerous: bad data becomes a
  // confident, specific, completely invented result.
  const { data: teamRow } = await supabase
    .from("teams").select("league").eq("id", teamId).maybeSingle();
  const league = String((teamRow as any)?.league ?? "").toUpperCase();
  const family =
    league === "MLB" ? "baseball"
    : league === "NHL" ? "hockey"
    : league === "NBA" ? "basketball"
    : league === "NFL" ? "americanfootball"
    : null;   // NCAA covers several sports — do not guess, just don't filter

  const data = family
    ? (raw ?? []).filter((g: any) => String(g.sport_key ?? "").includes(family))
    : (raw ?? []);

  if (!data || data.length === 0) return null;

  const live = data.find((g) => ["live", "in_progress", "halftime"].includes(String(g.status)));
  const now = Date.now();
  const lastFinal = data.find(
    (g) => String(g.status) === "final" && Date.parse(g.start_time) <= now,
  );
  const nextUp = [...data]
    .reverse()
    .find((g) => String(g.status) === "scheduled" && Date.parse(g.start_time) > now);

  const g = live ?? lastFinal ?? nextUp;
  if (!g) return null;

  const teamNames = await resolveTeamNames(supabase, [g.home_team_id, g.away_team_id]);
  const state: GameSnapshot["state"] = live
    ? "live"
    : g === lastFinal
      ? "postgame"
      : "pregame";

  return {
    state,
    home: teamNames.get(g.home_team_id) ?? "Home",
    away: teamNames.get(g.away_team_id) ?? "Away",
    homeScore: g.home_score ?? null,
    awayScore: g.away_score ?? null,
    period: g.period ?? null,
    clock: g.clock ?? null,
    startTime: g.start_time,
  };
}

async function resolveTeamNames(
  supabase: SupabaseClient,
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const clean = ids.filter((i): i is string => !!i);
  if (clean.length === 0) return new Map();
  const { data } = await supabase
    .from("teams")
    .select("id, name, city")
    .in("id", clean);
  return new Map(
    (data ?? []).map((t: Record<string, string>) => [
      t.id,
      [t.city, t.name].filter(Boolean).join(" ").trim() || t.name,
    ]),
  );
}

/**
 * Team totals and top performers for the team's current-or-most-recent game.
 *
 * This is what makes "how many hits do the Yankees have" answerable. It reads
 * the SAME ESPN summary payload bot-live-poller already pulls for play-by-play,
 * so there is no new vendor, no new key, and during a live game the response is
 * usually already warm.
 *
 * Every number is copied verbatim out of the response — the model is never
 * asked to add anything up.
 */
export async function getBoxScore(
  supabase: SupabaseClient,
  teamId: string,
  league: string | null,
): Promise<BoxScore | null> {
  if (!league) return null;
  const p = leaguePath(league);
  if (!p) return null;

  const { data: game } = await supabase
    .from("games")
    .select("odds_game_id, status, start_time")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .in("status", ["live", "in_progress", "halftime", "final"])
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!game?.odds_game_id) return null;

  // odds_game_id is "espn-{sport}-{id}". Match the trailing digits rather than
  // stripping a prefix — "college-football" contains a hyphen, so a
  // /^espn-[a-z]+-/ strip leaves "football-401872926" behind.
  const idMatch = /(\d+)$/.exec(String(game.odds_game_id));
  if (!idMatch) return null;

  try {
    const res = await fetch(
      `${ESPN_BASE}/${p.sport}/${p.league}/summary?event=${idMatch[1]}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = await res.json();

    const teamLines: string[] = [];
    for (const t of (data?.boxscore?.teams ?? []) as Record<string, unknown>[]) {
      const team = t.team as Record<string, unknown> | undefined;
      const name = String(team?.displayName ?? team?.name ?? "").trim();
      if (!name) continue;
      const stats = (t.statistics ?? []) as Record<string, unknown>[];
      const parts = stats
        .map((s) => {
          const label = String(s.abbreviation ?? s.label ?? s.name ?? "").trim();
          const val = String(s.displayValue ?? s.value ?? "").trim();
          return label && val ? `${val} ${label}` : "";
        })
        .filter(Boolean)
        .slice(0, 8);
      if (parts.length > 0) teamLines.push(`${name}: ${parts.join(", ")}`);
    }

    const leaderLines: string[] = [];
    for (const t of (data?.leaders ?? []) as Record<string, unknown>[]) {
      const team = t.team as Record<string, unknown> | undefined;
      const name = String(team?.displayName ?? "").trim();
      const cats = (t.leaders ?? []) as Record<string, unknown>[];
      const top = (cats[0]?.leaders as Record<string, unknown>[] | undefined)?.[0];
      const who = (top?.athlete as Record<string, unknown> | undefined)?.displayName;
      const val = top?.displayValue;
      if (name && who && val) leaderLines.push(`${name}: ${who} — ${val}`);
    }

    if (teamLines.length === 0 && leaderLines.length === 0) return null;
    return { teamLines, leaderLines };
  } catch (err) {
    console.warn("[coach.retrieve] boxscore unavailable", err);
    return null;
  }
}

/**
 * Season W-L computed from our own `games` rows.
 *
 * Deliberately NOT scraped from anywhere: we already store every final score
 * for tracked teams, so this is tier-1 data that cannot be wrong in a way the
 * room can catch us on. Enrich with ESPN standings separately (below) —
 * that call is allowed to fail.
 */
export async function getTeamRecord(
  supabase: SupabaseClient,
  teamId: string,
): Promise<{ wins: number; losses: number } | null> {
  const seasonStart = new Date();
  seasonStart.setMonth(seasonStart.getMonth() - 10);

  const { data } = await supabase
    .from("games")
    .select("home_team_id, away_team_id, home_score, away_score, status")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("status", "final")
    .gte("start_time", seasonStart.toISOString());

  if (!data || data.length === 0) return null;

  let wins = 0;
  let losses = 0;
  for (const g of data) {
    if (g.home_score == null || g.away_score == null) continue;
    const isHome = g.home_team_id === teamId;
    const us = isHome ? g.home_score : g.away_score;
    const them = isHome ? g.away_score : g.home_score;
    if (us > them) wins++;
    else if (us < them) losses++;
  }
  return wins + losses > 0 ? { wins, losses } : null;
}

/**
 * The next scheduled game, always — regardless of what just happened.
 *
 * Separate from getGameSnapshot on purpose. That one answers "what's the state
 * of things" and prioritises live > just-finished > upcoming, which means an
 * hour after a final it would answer "when do we play next?" with the game that
 * just ended. "What time is the next game" is one of the two questions people
 * will actually ask most, so it gets its own query.
 */
export async function getNextGame(
  supabase: SupabaseClient,
  teamId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("games")
    .select("start_time, home_team_id, away_team_id")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("status", "scheduled")
    .gt("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const names = await resolveTeamNames(supabase, [data.home_team_id, data.away_team_id]);
  const home = names.get(data.home_team_id) ?? "Home";
  const away = names.get(data.away_team_id) ?? "Away";
  const isHome = data.home_team_id === teamId;
  const opponent = isHome ? away : home;

  // ISO timestamp is included verbatim so the model never does timezone math —
  // it states the date/time it is given and nothing else.
  const when = new Date(data.start_time).toLocaleString("en-US", {
    weekday: "long", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
    timeZone: "America/New_York",
  });
  return `${isHome ? "vs" : "at"} ${opponent} — ${when} (ET)`;
}

/**
 * Every final result this season, as pre-formatted lines.
 *
 * This is the grounding for trivia. General franchise-history trivia has no
 * source here and the model must not invent it — a wrong trivia answer is
 * caught instantly by the exact people in the room, which is the same
 * credibility hit as a wrong roster. What IS defensible is trivia built from
 * this season's real results plus the room's own ledger, and that version is
 * differentiated: nobody else can generate it.
 */
export async function getSeasonResults(
  supabase: SupabaseClient,
  teamId: string,
  limit = 30,
): Promise<string[]> {
  const seasonStart = new Date();
  seasonStart.setMonth(seasonStart.getMonth() - 10);

  const { data } = await supabase
    .from("games")
    .select("home_team_id, away_team_id, home_score, away_score, start_time")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("status", "final")
    .gte("start_time", seasonStart.toISOString())
    .order("start_time", { ascending: false })
    .limit(limit);
  if (!data || data.length === 0) return [];

  const names = await resolveTeamNames(
    supabase,
    data.flatMap((g) => [g.home_team_id, g.away_team_id]),
  );

  return data
    .filter((g) => g.home_score != null && g.away_score != null)
    .map((g) => {
      const date = new Date(g.start_time).toLocaleDateString("en-US", {
        month: "short", day: "numeric",
      });
      const home = names.get(g.home_team_id) ?? "Home";
      const away = names.get(g.away_team_id) ?? "Away";
      return `${date}: ${away} ${g.away_score} at ${home} ${g.home_score}`;
    });
}

/**
 * Team standing + record, straight from ESPN.
 *
 * VERIFIED against live responses, not guessed. The previous version walked the
 * /standings tree looking for a matching team and usually found nothing, which
 * meant the single most likely question in the product ("where are we in the
 * standings?") fell back to a shrug. That is not acceptable — it is a basic
 * fact and the alternative to having it is the model inventing one.
 *
 * Two steps, both confirmed working for pro AND college:
 *   1. /teams?limit=1000  -> resolve our team name to ESPN's numeric id
 *   2. /teams/{id}        -> team.standingSummary ("2nd in AL East", "1st in SEC")
 *                            team.record.items[0].summary ("66-52")
 *
 * Why the id and not the abbreviation: the logo slug we store looks like a key
 * but is not one. Texas A&M's logo is ".../ncaa/500/tam.png" while its ESPN
 * abbreviation is "TA&M" — /teams/tam 404s, /teams/245 works.
 */
export interface TeamStanding {
  standing: string | null;   // "2nd in AL East"
  record: string | null;     // "66-52"
}

// League roster cache. 758 college teams is a big response and it changes about
// once a year, so fetching it per question would be absurd. Cached for the life
// of the isolate, with a day's TTL as a backstop.
const ESPN_TEAM_CACHE = new Map<string, { at: number; ids: Map<string, string> }>();
const TEAM_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeTeamKey(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

async function espnTeamIndex(
  sport: string,
  leaguePathName: string,
): Promise<Map<string, string>> {
  const cacheKey = `${sport}/${leaguePathName}`;
  const hit = ESPN_TEAM_CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < TEAM_CACHE_TTL_MS) return hit.ids;

  const ids = new Map<string, string>();
  try {
    const res = await fetch(
      `${ESPN_BASE}/${sport}/${leaguePathName}/teams?limit=1000`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return ids;
    const data = await res.json();
    const teams = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
    for (const entry of teams as Record<string, unknown>[]) {
      const t = entry.team as Record<string, unknown> | undefined;
      if (!t?.id) continue;
      const id = String(t.id);
      // Index every spelling ESPN gives us. Our DB stores city + nickname
      // ("Ohio State" + "Buckeyes"), which matches displayName exactly for most
      // teams; slug and shortDisplayName cover the rest.
      for (const field of ["displayName", "name", "slug", "shortDisplayName", "location"]) {
        const v = t[field];
        if (typeof v === "string" && v.trim()) {
          const k = normalizeTeamKey(v);
          if (k && !ids.has(k)) ids.set(k, id);
        }
      }
    }
  } catch (err) {
    console.warn("[coach.retrieve] espn team index failed", err);
  }
  ESPN_TEAM_CACHE.set(cacheKey, { at: Date.now(), ids });
  return ids;
}

export async function getEspnStanding(
  league: string | null,
  teamName: string | null,
): Promise<TeamStanding | null> {
  if (!league || !teamName) return null;
  const p = leaguePath(league);
  if (!p) return null;

  try {
    const index = await espnTeamIndex(p.sport, p.league);
    if (index.size === 0) return null;

    const espnId = index.get(normalizeTeamKey(teamName));
    if (!espnId) {
      // Unresolved is a real outcome, not an error to paper over. Log it so a
      // team that never matches shows up rather than silently answering "I
      // don't have standings" forever.
      console.warn(`[coach.retrieve] no ESPN id for "${teamName}" in ${league}`);
      return null;
    }

    const res = await fetch(
      `${ESPN_BASE}/${p.sport}/${p.league}/teams/${espnId}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const t = (await res.json())?.team ?? {};

    const items = (t?.record?.items ?? []) as Record<string, unknown>[];
    const overall = items.find((i) =>
      String(i.description ?? "").toLowerCase().includes("overall")
    ) ?? items[0];

    const standing = typeof t.standingSummary === "string" ? t.standingSummary : null;
    const record = overall && typeof overall.summary === "string" ? overall.summary : null;
    if (!standing && !record) return null;
    return { standing, record };
  } catch (err) {
    console.warn("[coach.retrieve] standing lookup failed", err);
    return null;
  }
}

function leaguePath(league: string): { sport: string; league: string } | null {
  switch (league.toUpperCase()) {
    case "NBA":   return { sport: "basketball", league: "nba" };
    case "NCAAB": return { sport: "basketball", league: "mens-college-basketball" };
    case "NFL":   return { sport: "football", league: "nfl" };
    case "NCAAF":
    case "NCAA":  return { sport: "football", league: "college-football" };
    case "MLB":   return { sport: "baseball", league: "mlb" };
    case "NHL":   return { sport: "hockey", league: "nhl" };
    default:      return null;
  }
}

// ---------------------------------------------------------------------------
// 5. Room metadata.
// ---------------------------------------------------------------------------

export async function getHuddleContext(
  supabase: SupabaseClient,
  huddleId: string,
): Promise<HuddleContext | null> {
  const { data: huddle } = await supabase
    .from("huddles")
    .select("id, name, team_id")
    .eq("id", huddleId)
    .maybeSingle();
  if (!huddle) return null;

  let teamName: string | null = null;
  let league: string | null = null;
  if (huddle.team_id) {
    const { data: team } = await supabase
      .from("teams")
      .select("name, city, league")
      .eq("id", huddle.team_id)
      .maybeSingle();
    if (team) {
      teamName = [team.city, team.name].filter(Boolean).join(" ").trim() || team.name;
      league = team.league ?? null;
    }
  }

  const { count } = await supabase
    .from("huddle_members")
    .select("user_id", { count: "exact", head: true })
    .eq("huddle_id", huddleId);

  return {
    huddleId: huddle.id,
    huddleName: huddle.name,
    teamId: huddle.team_id ?? null,
    teamName,
    league,
    memberCount: count ?? 0,
  };
}

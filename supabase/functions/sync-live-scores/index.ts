import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ESPN API endpoints — all free, no API key required
const ESPN_ENDPOINTS: Record<string, string> = {
  nfl: 'https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  ncaaf: 'https://site.web.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  nba: 'https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  ncaab: 'https://site.web.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
  nhl: 'https://site.web.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  mlb: 'https://site.web.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
};

// Map ESPN sport keys to Odds API sport_key values used in the games table
const SPORT_KEY_MAP: Record<string, string> = {
  nfl: 'americanfootball_nfl',
  ncaaf: 'americanfootball_ncaaf',
  nba: 'basketball_nba',
  ncaab: 'basketball_ncaab',
  nhl: 'icehockey_nhl',
  mlb: 'baseball_mlb',
};

interface ESPNGame {
  id: string;
  name: string;
  shortName: string;
  date: string;
  status: {
    type: {
      name: string;
      state: string; // 'pre' | 'in' | 'post'
      completed: boolean;
    };
    displayClock?: string;
    period?: number;
  };
  competitions: Array<{
    competitors: Array<{
      team: {
        displayName: string;
        shortDisplayName: string;
        abbreviation: string;
      };
      score: string;
      homeAway: string;
    }>;
  }>;
}

// ESPN's scoreboard, asked twice.
//
// The bare endpoint answers with the current WEEK, not the current DAY. In
// college football that meant week 1 — Sep 4 through Sep 7 — while UNC was
// playing TCU in Dublin that same afternoon. The game was simply absent from
// the feed, so the sync could not score it, and the room kept showing next
// week's fixture with the real game underway.
//
// So: the bare call for the week ahead, which is what puts upcoming fixtures in
// the table, plus an explicit three-day range for what is actually happening
// now. ESPN dates its scoreboard in Eastern time, so the range runs yesterday
// through tomorrow rather than just today — a 20:00 ET kickoff is already
// tomorrow in UTC, and asking only for "today" drops it.
async function fetchOneScoreboard(url: string, sport: string): Promise<ESPNGame[]> {
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" } });
    if (!response.ok) {
      console.error(`ESPN API error for ${sport}: ${response.status} (${url})`);
      return [];
    }
    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error(`Error fetching ESPN ${sport}:`, error);
    return [];
  }
}

function espnDate(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function fetchESPNScores(sport: string): Promise<ESPNGame[]> {
  const endpoint = ESPN_ENDPOINTS[sport];
  if (!endpoint) return [];

  const range = `${espnDate(-1)}-${espnDate(1)}`;
  const [thisWeek, theseDays] = await Promise.all([
    fetchOneScoreboard(endpoint, sport),
    fetchOneScoreboard(`${endpoint}?dates=${range}&limit=200`, sport),
  ]);

  // Same game can come back from both calls. ESPN's event id is the identity.
  const byId = new Map<string, ESPNGame>();
  for (const g of [...thisWeek, ...theseDays]) {
    if (g?.id) byId.set(g.id, g);
  }
  return [...byId.values()];
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(football|basketball|baseball|hockey)/gi, '')
    .replace(/\s+(state|university|college)/gi, (match) => match.toLowerCase())
    .trim();
}

function findMatchingGame(
  games: ESPNGame[],
  team1Name: string | null,
  team2Name: string | null,
): ESPNGame | null {
  if (!team1Name && !team2Name) return null;

  const n1 = team1Name ? normalizeTeamName(team1Name) : '';
  const n2 = team2Name ? normalizeTeamName(team2Name) : '';

  for (const game of games) {
    const competitors = game.competitions?.[0]?.competitors || [];
    if (competitors.length < 2) continue;

    const g1 = normalizeTeamName(competitors[0].team.displayName);
    const g2 = normalizeTeamName(competitors[1].team.displayName);

    // Each of our two teams must match a DIFFERENT ESPN competitor. Matching
    // on either team alone (the old `match1 || match2`) is what let a future
    // "Bears @ Panthers" row claim last night's "Panthers @ Cardinals" result
    // and inherit its score — seen in production 2026-08-07.
    //
    // This matters far more in college football: normalizeTeamName strips
    // "State"/"University" and compares by substring in both directions, so
    // "Michigan" matches "Michigan State" and "Miami" matches "Miami (OH)".
    // With a full season of scheduled rows sitting in the table, single-team
    // matching would corrupt games every week.
    const hits = (n: string) => ({
      first: !!n && (g1.includes(n) || n.includes(g1)),
      second: !!n && (g2.includes(n) || n.includes(g2)),
    });
    const h1 = hits(n1);
    const h2 = hits(n2);

    if (n1 && n2) {
      // Both names known: require a consistent pairing across both slots.
      if ((h1.first && h2.second) || (h1.second && h2.first)) return game;
      continue;
    }
    // Only one name known — fall back to a single-team match, which is the
    // best we can do, but never when we had both names available.
    if ((n1 && (h1.first || h1.second)) || (n2 && (h2.first || h2.second))) return game;
  }
  return null;
}

// Format period number into human-readable (e.g. "Q3", "P2", "3rd")
function formatPeriod(period: number | undefined, sport: string): string | null {
  if (!period) return null;
  if (sport === 'nba' || sport === 'ncaab') return `Q${period}`;
  if (sport === 'nhl') return `P${period}`;
  if (sport === 'nfl' || sport === 'ncaaf') return `Q${period}`;
  if (sport === 'mlb') return `${period}`;
  return `${period}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🏈 Starting ESPN live score sync...');

    // ──────────────────────────────────────────────────────
    // Part 1: Update live_events (existing behavior)
    // ──────────────────────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: liveEvents } = await supabase
      .from('live_events')
      .select('id, name, team1_id, team2_id, status, score_team1, score_team2, teams!live_events_team1_id_fkey(id, name, league), teams!live_events_team2_id_fkey(id, name, league)')
      .in('status', ['upcoming', 'live', 'in_progress'])
      .gte('start_time', today.toISOString())
      .lte('start_time', tomorrow.toISOString());

    // Gather which sports we need from live_events
    const sportsFromEvents = new Set<string>();
    for (const event of liveEvents || []) {
      const team1 = (event as any)['teams!live_events_team1_id_fkey'];
      if (team1?.league) sportsFromEvents.add(team1.league.toLowerCase());
    }

    // ──────────────────────────────────────────────────────
    // Part 2: Fetch ALL sports from ESPN (for games table)
    // ──────────────────────────────────────────────────────
    const allEspnGames: Map<string, ESPNGame[]> = new Map();
    const sportsToFetch = Object.keys(ESPN_ENDPOINTS);

    for (const sport of sportsToFetch) {
      const games = await fetchESPNScores(sport);
      allEspnGames.set(sport, games);
      if (games.length > 0) {
        console.log(`ESPN ${sport}: ${games.length} games`);
      }
    }

    // ──────────────────────────────────────────────────────
    // Part 2a: Update live_events with ESPN data
    // ──────────────────────────────────────────────────────
    let liveEventsUpdated = 0;

    for (const event of liveEvents || []) {
      const team1Data = (event as any)['teams!live_events_team1_id_fkey'];
      const team2Data = (event as any)['teams!live_events_team2_id_fkey'];
      const team1Name = team1Data?.name || event.name?.split(' vs ')[0];
      const team2Name = team2Data?.name || event.name?.split(' vs ')[1];

      // Search all sports for a match
      let matchingGame: ESPNGame | null = null;
      for (const games of allEspnGames.values()) {
        matchingGame = findMatchingGame(games, team1Name, team2Name);
        if (matchingGame) break;
      }

      if (!matchingGame) {
        console.log(`⚠️ No ESPN match for live_event: ${event.name}`);
        continue;
      }

      const competitors = matchingGame.competitions?.[0]?.competitors || [];
      const homeTeam = competitors.find(c => c.homeAway === 'home');
      const awayTeam = competitors.find(c => c.homeAway === 'away');

      if (!homeTeam || !awayTeam) continue;

      const homeScore = parseInt(homeTeam.score) || 0;
      const awayScore = parseInt(awayTeam.score) || 0;

      // Assign scores to correct team positions
      const homeNorm = normalizeTeamName(homeTeam.team.displayName);
      const t1Norm = team1Name ? normalizeTeamName(team1Name) : '';
      const t1IsHome = homeNorm.includes(t1Norm) || t1Norm.includes(homeNorm);

      const score1 = t1IsHome ? homeScore : awayScore;
      const score2 = t1IsHome ? awayScore : homeScore;

      let newStatus = event.status;
      if (matchingGame.status.type.completed) newStatus = 'completed';
      else if (matchingGame.status.type.state === 'in') newStatus = 'live';

      if (score1 !== event.score_team1 || score2 !== event.score_team2 || newStatus !== event.status) {
        const { error } = await supabase
          .from('live_events')
          .update({
            score_team1: score1,
            score_team2: score2,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', event.id);

        if (!error) liveEventsUpdated++;
        else console.error(`Error updating live_event ${event.id}:`, error);
      }
    }

    // Team lookup lives here, above BOTH the users of it: the enrichment pass
    // below repairs games missing a side, and the insert pass further down
    // resolves sides for new ones. It used to sit only above the insert, so
    // the repair referenced it before initialization and took the whole sync
    // down with it — scores stopped updating everywhere, not just the one game.
    const SPORT_TO_LEAGUE: Record<string, string> = {
      nfl: 'NFL', ncaaf: 'NCAAF', nba: 'NBA', ncaab: 'NCAAB', nhl: 'NHL', mlb: 'MLB',
    };

    const { data: allTeams } = await supabase
      .from('teams')
      .select('id, name, city, league');
    // Exact-match index only (full "City Name" and bare "Name") with league
    // verification — fuzzy matching across leagues misfires (Rangers, Giants…).
    const teamIndex = new Map<string, { id: string; league: string }>();
    for (const t of allTeams ?? []) {
      const league = (t.league ?? '').toUpperCase();
      const full = `${t.city ?? ''} ${t.name}`.trim().toLowerCase();
      if (!teamIndex.has(full)) teamIndex.set(full, { id: t.id, league });
      const short = String(t.name).toLowerCase();
      if (!teamIndex.has(short)) teamIndex.set(short, { id: t.id, league });
    }
    // ESPN says NCAAF and NCAAB; our teams table says NCAA for both. Comparing
    // them raw means 'NCAA' === 'NCAAF' is false for every college team, so NO
    // college game was ever matched or created — a live UNC game in Dublin was
    // simply absent from the database while the room showed next week's fixture
    // and no updates at all. bot-live-poller already normalises this exact pair;
    // this function did not.
    const dbLeague = (l: string) => (l === 'NCAAF' || l === 'NCAAB' ? 'NCAA' : l);

    const resolveTeamId = (league: string, displayName?: string, shortName?: string): string | null => {
      const want = dbLeague(league);
      for (const key of [displayName?.toLowerCase(), shortName?.toLowerCase()]) {
        if (!key) continue;
        const hit = teamIndex.get(key);
        if (hit && dbLeague(hit.league) === want) return hit.id;
      }
      return null;
    };


    // ──────────────────────────────────────────────────────
    // Part 3: Enrich games table with ESPN period + clock
    // ──────────────────────────────────────────────────────
    // Get all games that are live or recently started (scheduled but past commence time)
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    // Upper bound matters as much as the lower one: without it, EVERY future
    // scheduled game (all of September, all season) stays an eligible match
    // target forever, so one bad name match writes today's score onto a game
    // weeks away. A game can only be live or final if it has kicked off, so
    // only consider rows starting within the next few hours.
    const sixHoursAhead = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const GAME_COLS =
      '*, home_team:teams!games_home_team_id_fkey(id, name, city), away_team:teams!games_away_team_id_fkey(id, name, city)';

    // TWO FETCHES, because the window is right for FINDING games and wrong for
    // FINISHING them.
    //
    // This was one query bounded at six hours either side of now, which meant a
    // game that started more than six hours ago was never looked at again. Miss
    // one run, or have a game go long, and nothing would ever mark it final —
    // it sat 'in_progress' forever. That is not hypothetical: a Mets room showed
    // "Padres 1 — Mets 4, 9 · 0:00" with the live dot blinking, against a team
    // they had not played in weeks, because useLiveGameContext takes the newest
    // in_progress game for a team and that row outranked every real fixture.
    //
    // The upper bound stays: a game cannot be live before it kicks off, and
    // without it one bad name match writes tonight's score onto a game weeks
    // away. The lower bound only belongs on games we are still WAITING to start.
    const { data: windowGames } = await supabase
      .from('games')
      .select(GAME_COLS)
      .eq('status', 'scheduled')
      .gte('start_time', sixHoursAgo.toISOString())
      .lte('start_time', sixHoursAhead.toISOString());

    // Anything already marked live, however old. A game does not stop needing
    // to be finished just because we stopped looking at it. Capped at two days
    // so this cannot grow without limit if a whole season goes wrong.
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const { data: stillLive } = await supabase
      .from('games')
      .select(GAME_COLS)
      .in('status', ['in_progress', 'live'])
      .gte('start_time', twoDaysAgo.toISOString())
      .lte('start_time', sixHoursAhead.toISOString());

    const seen = new Set<string>();
    const activeGames = [...(windowGames || []), ...(stillLive || [])].filter((g: any) => {
      if (seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    });

    let gamesEnriched = 0;
    const repairErrors: string[] = [];

    for (const game of activeGames || []) {
      const homeName = (game as any).home_team?.name;
      const awayName = (game as any).away_team?.name;
      const homeCity = (game as any).home_team?.city;
      const awayCity = (game as any).away_team?.city;

      // Build full names for matching
      const homeFullName = homeCity ? `${homeCity} ${homeName}` : homeName;
      const awayFullName = awayCity ? `${awayCity} ${awayName}` : awayName;

      // Determine which ESPN sport to search based on sport_key
      let matchingGame: ESPNGame | null = null;
      let matchedSport = '';

      for (const [sport, oddsSportKey] of Object.entries(SPORT_KEY_MAP)) {
        if (game.sport_key === oddsSportKey) {
          const espnGames = allEspnGames.get(sport) || [];
          matchingGame = findMatchingGame(espnGames, homeFullName, awayFullName);
          if (!matchingGame) {
            // Try with just team names (no city)
            matchingGame = findMatchingGame(espnGames, homeName, awayName);
          }
          matchedSport = sport;
          break;
        }
      }

      if (!matchingGame) continue;

      // Extract ESPN enrichment data
      const espnState = matchingGame.status.type.state;
      const espnCompleted = matchingGame.status.type.completed;
      const espnClock = matchingGame.status.displayClock || null;
      const espnPeriod = formatPeriod(matchingGame.status.period, matchedSport);

      // Parse ESPN scores
      const competitors = matchingGame.competitions?.[0]?.competitors || [];
      const espnHome = competitors.find(c => c.homeAway === 'home');
      const espnAway = competitors.find(c => c.homeAway === 'away');

      if (!espnHome || !espnAway) continue;

      const espnHomeScore = parseInt(espnHome.score) || 0;
      const espnAwayScore = parseInt(espnAway.score) || 0;

      // Match ESPN home/away to our home/away
      const espnHomeNorm = normalizeTeamName(espnHome.team.displayName);
      const ourHomeNorm = homeName ? normalizeTeamName(homeName) : '';
      const sameOrientation = espnHomeNorm.includes(ourHomeNorm) || ourHomeNorm.includes(espnHomeNorm);

      const finalHomeScore = sameOrientation ? espnHomeScore : espnAwayScore;
      const finalAwayScore = sameOrientation ? espnAwayScore : espnHomeScore;

      // Determine status
      let newStatus = game.status;
      if (espnCompleted) {
        newStatus = 'final';
      } else if (espnState === 'in') {
        newStatus = 'in_progress';
      }

      // Build update payload — only include fields that changed
      const updates: Record<string, any> = {};

      // Repair a game that only has one team.
      //
      // Games inserted before opponent placeholders existed carry a null on the
      // side we did not recognise, and a USC room read "Away 0 — Trojans 21"
      // because of it. Those rows are never re-inserted — the insert path skips
      // anything already in the table — so the fix has to happen here, on the
      // pass that already has the ESPN game in hand.
      if (!game.home_team_id || !game.away_team_id) {
        // We know which of our sides is filled; the ESPN competitor that is not
        // its counterpart is the one we are missing.
        const missingIsHome = !game.home_team_id;
        const espnMissing = missingIsHome
          ? (sameOrientation ? espnHome : espnAway)
          : (sameOrientation ? espnAway : espnHome);

        const nm = espnMissing.team.shortDisplayName || espnMissing.team.displayName;
        const existingId = resolveTeamId(
          SPORT_TO_LEAGUE[matchedSport],
          espnMissing.team.displayName,
          espnMissing.team.shortDisplayName,
        );
        let fillId = existingId;
        if (!fillId) {
          const { data: made, error: makeErr } = await supabase
            .from('teams')
            .insert({
              name: nm,
              city: espnMissing.team.location ?? null,
              league: dbLeague(SPORT_TO_LEAGUE[matchedSport]),
              logo_url: espnMissing.team.logo ?? null,
              status: 'inactive',
            })
            .select('id')
            .maybeSingle();
          if (makeErr) repairErrors.push(`${nm}: ${makeErr.message}`);
          fillId = made?.id ?? null;
        }
        if (fillId) {
          updates[missingIsHome ? 'home_team_id' : 'away_team_id'] = fillId;
          console.log(`🩹 Filled missing ${missingIsHome ? 'home' : 'away'} team: ${nm}`);
        }
      }

      if (espnClock !== game.clock) updates.clock = espnClock;
      if (espnPeriod !== game.period) updates.period = espnPeriod;
      if (finalHomeScore !== game.home_score) updates.home_score = finalHomeScore;
      if (finalAwayScore !== game.away_score) updates.away_score = finalAwayScore;
      if (newStatus !== game.status) updates.status = newStatus;

      if (Object.keys(updates).length > 0) {
        updates.last_synced_at = new Date().toISOString();

        const { error } = await supabase
          .from('games')
          .update(updates)
          .eq('id', game.id);

        if (!error) {
          gamesEnriched++;
          console.log(`📊 Games enriched: ${homeName} vs ${awayName} → ${espnPeriod} ${espnClock} (${finalHomeScore}-${finalAwayScore}) [${newStatus}]`);
        } else {
          console.error(`Error enriching game ${game.id}:`, error);
        }
      }
    }

    // ──────────────────────────────────────────────────────
    // Part 4: INSERT games we don't have yet.
    // The games table was originally seeded by a now-dead Odds API ingestion.
    // Parts 1–3 only UPDATE existing rows, so once that ingestion stopped the
    // table went permanently stale and no current games (or scores) existed
    // for any league. This pass creates rows for today's ESPN games that
    // involve a team in our DB, keyed on odds_game_id = "espn-{sport}-{id}"
    // so reruns are idempotent. Parts 2–3 then keep them updated.
    // ──────────────────────────────────────────────────────
    let gamesInserted = 0;
    for (const [sport, espnGames] of allEspnGames.entries()) {
      const sportKey = SPORT_KEY_MAP[sport];
      const league = SPORT_TO_LEAGUE[sport];
      if (!sportKey || !league) continue;

      for (const eg of espnGames) {
        const comps = eg.competitions?.[0]?.competitors || [];
        const home = comps.find((c) => c.homeAway === 'home');
        const away = comps.find((c) => c.homeAway === 'away');
        if (!home || !away) continue;

        let homeTeamId = resolveTeamId(league, home.team.displayName, home.team.shortDisplayName);
        let awayTeamId = resolveTeamId(league, away.team.displayName, away.team.shortDisplayName);
        // Only track games at least one of our teams plays in.
        if (!homeTeamId && !awayTeamId) continue;

        // The other side needs a name too.
        //
        // A USC room showed "Away 0 — Trojans 14". San Jose State is not one of
        // our 71 college teams, so away_team_id was null and the scoreboard had
        // nothing to print but the word "Away". Half a scoreboard is worse than
        // no scoreboard: it reads like a bug, because it is one.
        //
        // So the opponent gets a row — marked 'inactive', not 'active'. Every
        // team picker, discovery list and admin count filters on status
        // 'active', so these stay invisible there, and the bot's own team index
        // filters the same way so it does not start following the whole of
        // college football. They exist for one purpose: the join that puts a
        // name on the other half of the score.
        if (!homeTeamId || !awayTeamId) {
          const missing = homeTeamId ? away : home;
          const { data: made } = await supabase
            .from('teams')
            .insert({
              name: missing.team.shortDisplayName || missing.team.displayName,
              city: missing.team.location ?? null,
              league: dbLeague(league),
              logo_url: missing.team.logo ?? null,
              status: 'inactive',
            })
            .select('id')
            .maybeSingle();
          if (made?.id) {
            if (homeTeamId) awayTeamId = made.id; else homeTeamId = made.id;
          }
        }

        const oddsGameId = `espn-${sport}-${eg.id}`;
        const { data: existing } = await supabase
          .from('games')
          .select('id')
          .eq('odds_game_id', oddsGameId)
          .maybeSingle();
        if (existing) continue;

        // The same game also arrives from the odds feed under ITS id — a 32-char
        // hash, nothing like `espn-…` — so matching on odds_game_id alone let us
        // insert a second row for a game already in the table. 146 of 1000 rows
        // were twins. The odds row is the one to keep: markets hang off its id,
        // so an ESPN twin is a game nobody can bet on. Enrichment below scores
        // whichever row is there, so skipping loses nothing.
        //
        // Teams plus a same-day kickoff, not an exact timestamp: the two feeds
        // disagree by a few minutes on when a game starts, which is exactly how
        // the twins got in.
        if (homeTeamId && awayTeamId) {
          const dayStart = new Date(eg.date); dayStart.setUTCHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart.getTime() + 36 * 60 * 60 * 1000);
          const { data: twin } = await supabase
            .from('games')
            .select('id')
            .eq('home_team_id', homeTeamId)
            .eq('away_team_id', awayTeamId)
            .gte('start_time', dayStart.toISOString())
            .lt('start_time', dayEnd.toISOString())
            .limit(1)
            .maybeSingle();
          if (twin) continue;
        }

        const status = eg.status.type.completed
          ? 'final'
          : eg.status.type.state === 'in'
            ? 'in_progress'
            : 'scheduled';

        const { error: insertErr } = await supabase.from('games').insert({
          odds_game_id: oddsGameId,
          sport_key: sportKey,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_score: parseInt(home.score) || 0,
          away_score: parseInt(away.score) || 0,
          clock: eg.status.displayClock || null,
          period: formatPeriod(eg.status.period, sport),
          status,
          start_time: eg.date,
          last_synced_at: new Date().toISOString(),
        });
        if (!insertErr) {
          gamesInserted++;
          console.log(`🆕 Game inserted: ${away.team.displayName} @ ${home.team.displayName} [${status}]`);
        } else {
          console.error(`Error inserting game ${oddsGameId}:`, insertErr);
        }
      }
    }

    console.log(`✅ ESPN sync done: ${liveEventsUpdated} live_events, ${gamesEnriched} games enriched, ${gamesInserted} games inserted`);

    return new Response(JSON.stringify({
      success: true,
      live_events_updated: liveEventsUpdated,
      games_enriched: gamesEnriched,
      games_inserted: gamesInserted,
      repair_errors: repairErrors,
      sports_fetched: sportsToFetch.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in sync-live-scores:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

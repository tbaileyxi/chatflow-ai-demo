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

  // THREE CALLS, because none of them is complete on its own.
  //
  // The bare endpoint answers with the current WEEK but only about 25 marquee
  // games — Colorado at Georgia Tech, a Thursday primetime fixture, is not in
  // it, and neither was South Carolina's opener. The tight day range covers
  // what is happening now. Neither reaches next weekend's full slate, which is
  // why fixtures went missing and could not be re-inserted once removed.
  //
  // The third call asks for the next eight days with a real limit, which is the
  // one that actually returns everybody.
  const near = `${espnDate(-1)}-${espnDate(1)}`;
  const ahead = `${espnDate(0)}-${espnDate(8)}`;
  const [thisWeek, theseDays, nextWeek] = await Promise.all([
    fetchOneScoreboard(endpoint, sport),
    fetchOneScoreboard(`${endpoint}?dates=${near}&limit=300`, sport),
    fetchOneScoreboard(`${endpoint}?dates=${ahead}&limit=400`, sport),
  ]);

  // Same game can come back from both calls. ESPN's event id is the identity.
  const byId = new Map<string, ESPNGame>();
  for (const g of [...thisWeek, ...theseDays, ...nextWeek]) {
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
      .select('id, name, city, league, status');
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
    // Off by default. Turned on deliberately after a report-only run has been
    // read, because this deletes.
    const VERIFY_DELETE = (Deno.env.get('VERIFY_DELETE') || 'false') === 'true';
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
    let upcomingRepaired = 0;

    // ── Correct fixture dates that drifted ───────────────────────────────
    //
    // Two scheduled games sat in the table dated 2026-08-29 while ESPN had them
    // on September 5 and September 7. A Stanford room therefore showed its next
    // fixture as a date that had already passed — the scoreboard reads as stale
    // or broken, and a pregame heads-up either fires at the wrong time or never.
    //
    // Football only, deliberately. A fixture pair is effectively unique in a
    // football season, so matching on the two teams alone is safe. Baseball
    // teams play three games in a row against each other, and matching on teams
    // without a date there would happily move Tuesday's game onto Thursday.
    let datesFixed = 0;
    let staleDupes = 0;
    try {
      const soon = new Date(now.getTime() + 21 * 86400000).toISOString();
      const back = new Date(now.getTime() - 3 * 86400000).toISOString();
      const { data: upcoming } = await supabase
        .from('games')
        .select('id, sport_key, start_time, home_team_id, away_team_id')
        .eq('status', 'scheduled')
        .in('sport_key', ['americanfootball_ncaaf', 'americanfootball_nfl'])
        .gte('start_time', back)
        .lte('start_time', soon);

      for (const ug of upcoming ?? []) {
        if (!ug.home_team_id || !ug.away_team_id) continue;
        const hm = allTeams?.find((x: any) => x.id === ug.home_team_id);
        const aw = allTeams?.find((x: any) => x.id === ug.away_team_id);
        if (!hm || !aw) continue;

        const sport = Object.entries(SPORT_KEY_MAP).find(([, k]) => k === ug.sport_key)?.[0];
        if (!sport) continue;

        const match = findMatchingGame(
          allEspnGames.get(sport) ?? [],
          hm.city ? `${hm.city} ${hm.name}` : hm.name,
          aw.city ? `${aw.city} ${aw.name}` : aw.name,
        );
        if (!match?.date) continue;

        const theirs = new Date(match.date).getTime();
        const ours = new Date(ug.start_time).getTime();
        // Two hours of slack: kickoff times get nudged, and rewriting the row
        // every sync over a few minutes' drift would be pure churn.
        if (Math.abs(theirs - ours) < 2 * 3600 * 1000) continue;

        // Is the correct row already there?
        //
        // Moving a wrongly-dated row onto the right date does not fix it when a
        // correctly-dated row already exists — it just makes two. That is what
        // happened to Miami at Stanford: the Sep 5 row was already present, and
        // the stale Aug 29 copy landed on top of it. A row like that is not
        // mis-dated, it is redundant, and it wants merging rather than moving.
        const near = new Date(match.date).getTime();
        const { data: already } = await supabase
          .from('games')
          .select('id')
          .eq('home_team_id', ug.home_team_id)
          .eq('away_team_id', ug.away_team_id)
          .neq('id', ug.id)
          .gte('start_time', new Date(near - 6 * 3600 * 1000).toISOString())
          .lte('start_time', new Date(near + 6 * 3600 * 1000).toISOString())
          .limit(1)
          .maybeSingle();
        if (already) { staleDupes++; continue; }

        const { error } = await supabase
          .from('games')
          .update({ start_time: match.date, last_synced_at: new Date().toISOString() })
          .eq('id', ug.id);
        if (!error) {
          datesFixed++;
          console.log(`🩹 Moved ${aw.name} @ ${hm.name}: ${ug.start_time} -> ${match.date}`);
        }
      }
    } catch (err) {
      repairErrors.push(`date repair: ${(err as Error).message}`);
    }

    // ── Verify the schedule against ESPN ─────────────────────────────────
    //
    // The odds feed wrote fixtures with nickname-matched teams: "Portland Trail
    // Blazers at Illinois", "Arizona Cardinals at Ohio State", "Clemson at
    // Georgia" for a game that is really Tennessee State at Georgia.
    //
    // NO DATES IN THIS COMPARISON. The first version asked ESPN for our stored
    // calendar date and deleted Colorado at Georgia Tech — a real Thursday
    // primetime game — because a 7:30pm ET kickoff is the next day in UTC and
    // ESPN's Friday slate never contained it. So this asks one question only:
    // do these two teams play each other at all in the next eight days? A pair
    // that exists is kept whatever date we hold for it, and the repair pass
    // corrects the time separately.
    //
    // Still conservative: odds-sourced rows only, so ESPN's own inserts are
    // never judged against ESPN; a healthy slate required before anything is
    // touched; and a foreign key veto leaves a row alone.
    let scheduleChecked = 0;
    let scheduleDropped = 0;
    const scheduleDrops: string[] = [];
    try {
      const horizon = new Date(now.getTime() + 8 * 86400000).toISOString();
      const { data: future } = await supabase
        .from('games')
        .select('id, odds_game_id, sport_key, start_time, home_team_id, away_team_id')
        .eq('status', 'scheduled')
        .in('sport_key', ['americanfootball_ncaaf', 'americanfootball_nfl'])
        .gte('start_time', new Date(now.getTime() + 6 * 3600 * 1000).toISOString())
        .lte('start_time', horizon);

      for (const g of future ?? []) {
        if (String(g.odds_game_id).startsWith('espn-')) continue;
        const sport = Object.entries(SPORT_KEY_MAP).find(([, k]) => k === g.sport_key)?.[0];
        if (!sport) continue;
        const pool = allEspnGames.get(sport) ?? [];
        if (pool.length < 20) continue;   // feed did not answer properly

        const hm = allTeams?.find((x: any) => x.id === g.home_team_id);
        const aw = allTeams?.find((x: any) => x.id === g.away_team_id);
        if (!hm || !aw) continue;         // a missing side is the repair's job

        scheduleChecked++;
        const hFull = hm.city ? `${hm.city} ${hm.name}` : hm.name;
        const aFull = aw.city ? `${aw.city} ${aw.name}` : aw.name;
        if (findMatchingGame(pool, hFull, aFull)) continue;

        if (VERIFY_DELETE) {
          const { error: delErr } = await supabase.from('games').delete().eq('id', g.id);
          if (delErr) continue;
        }
        scheduleDropped++;
        if (scheduleDrops.length < 80) scheduleDrops.push(`${g.start_time.slice(0, 10)} ${aFull} @ ${hFull}`);
      }
    } catch (err) {
      repairErrors.push(`schedule verify: ${(err as Error).message}`);
    }

    // ── Repair upcoming games that only have one team ────────────────────
    //
    // Yesterday's fix filled the missing side during enrichment, which only
    // looks at games happening around NOW. A room whose next fixture is a week
    // out still read "Away @ Aggies · Sat, Sep 5" — the scoreboard people see
    // most of the time is the one for a game that has not started, and that was
    // exactly the one left broken.
    //
    // Matched on the known team AND the same calendar day. Single-team matching
    // is otherwise dangerous: A&M has fixtures on Sep 5 and Sep 6, and without
    // the date this would happily fill one from the other.
    try {
      const twoDaysBack = new Date(now.getTime() - 2 * 86400000).toISOString();
      const twoWeeksOn  = new Date(now.getTime() + 14 * 86400000).toISOString();
      const { data: halfGames } = await supabase
        .from('games')
        .select('id, sport_key, start_time, home_team_id, away_team_id')
        .or('home_team_id.is.null,away_team_id.is.null')
        .gte('start_time', twoDaysBack)
        .lte('start_time', twoWeeksOn);

      for (const hg of halfGames ?? []) {
        const knownId = hg.home_team_id ?? hg.away_team_id;
        if (!knownId) continue;  // neither side known: nothing to match on
        const known = allTeams?.find((t: any) => t.id === knownId);
        if (!known) continue;

        const sport = Object.entries(SPORT_KEY_MAP)
          .find(([, key]) => key === hg.sport_key)?.[0];
        if (!sport) continue;

        // CLOSEST IN TIME, not same calendar day.
        //
        // Requiring an exact day match was too strict: Georgia and South
        // Carolina both had fixtures whose opponent stayed null because our
        // stored kickoff was hours off ESPN's, and both pages went out with no
        // fixture line at all.
        //
        // But a plain team match is too loose in the other direction — A&M has
        // games on consecutive days, and matching on the team alone fills one
        // from the other. Taking the candidate nearest our stored time gets
        // both: tolerant of a few hours, still decisive between two fixtures a
        // day apart.
        const ourTime = Date.parse(hg.start_time);
        const full = known.city ? `${known.city} ${known.name}` : known.name;
        const pool = (allEspnGames.get(sport) ?? []).filter((e: any) => {
          const d = Date.parse(String(e.date ?? ''));
          return Number.isFinite(d) && Math.abs(d - ourTime) < 36 * 3600 * 1000;
        });

        // Search what we already fetched; if this team is not in it, ask ESPN
        // for that specific day.
        //
        // The default scoreboard returns about 25 marquee games, not the full
        // slate — South Carolina's opener against Kent State was not in it, so
        // the opponent stayed null and the page had no fixture line. The
        // fallback has to trigger on NO MATCH, not on an empty pool: the pool
        // was full of other Saturday games, just not theirs.
        const nearest = (games: any[]) => {
          let best: any = null;
          let gap = Infinity;
          for (const c of games) {
            // Full name only. A bare nickname matched "Bulldogs" against Fresno
            // State and filled a phantom Georgia fixture with USC.
            if (!findMatchingGame([c], full, null)) continue;
            const g = Math.abs(Date.parse(String(c.date)) - ourTime);
            if (g < gap) { gap = g; best = c; }
          }
          return best;
        };

        let match: any = nearest(pool);
        if (!match) {
          const day = hg.start_time.slice(0, 10).replace(/-/g, "");
          const dayGames = await fetchOneScoreboard(
            `${ESPN_ENDPOINTS[sport]}?dates=${day}&limit=300`, sport,
          );
          match = nearest(dayGames.filter((e: any) => {
            const d = Date.parse(String(e.date ?? ""));
            return Number.isFinite(d) && Math.abs(d - ourTime) < 36 * 3600 * 1000;
          }));
        }
        if (!match) continue;

        const comps = match.competitions?.[0]?.competitors || [];
        const eh = comps.find((c: any) => c.homeAway === 'home');
        const ea = comps.find((c: any) => c.homeAway === 'away');
        if (!eh || !ea) continue;

        const knownNorm = normalizeTeamName(full);
        const ehNorm = normalizeTeamName(eh.team.displayName);
        const weAreHome = ehNorm.includes(knownNorm) || knownNorm.includes(ehNorm);
        const missing = hg.home_team_id ? ea : eh;
        // If our known team is the ESPN away side, the side we lack is home.
        const theirs = weAreHome ? ea : eh;
        const use = hg.home_team_id && hg.away_team_id ? missing : theirs;

        const nm = use.team.name || use.team.shortDisplayName || use.team.displayName;
        let fillId = resolveTeamId(SPORT_TO_LEAGUE[sport], use.team.displayName, use.team.shortDisplayName);
        if (!fillId) {
          const { data: made, error: mkErr } = await supabase
            .from('teams')
            .insert({
              name: nm,
              city: use.team.location ?? null,
              league: dbLeague(SPORT_TO_LEAGUE[sport]),
              logo_url: use.team.logo ?? null,
              status: 'inactive',
            })
            .select('id')
            .maybeSingle();
          if (mkErr) repairErrors.push(`${nm}: ${mkErr.message}`);
          fillId = made?.id ?? null;
        }
        if (!fillId) continue;

        await supabase
          .from('games')
          .update(hg.home_team_id ? { away_team_id: fillId } : { home_team_id: fillId })
          .eq('id', hg.id);
        upcomingRepaired++;
        console.log(`🩹 Upcoming game ${hg.start_time.slice(0, 10)}: filled ${nm}`);
      }
    } catch (err) {
      repairErrors.push(`upcoming repair: ${(err as Error).message}`);
    }


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

      // Rename a placeholder through the GAME, not through its name.
      //
      // The pass above finds placeholders by looking them up by name, which
      // cannot work when the name is the broken thing: "Hawai'i Hawai'i" does
      // not match ESPN's "Hawai'i Rainbow Warriors" under any key. But here we
      // already know which ESPN game this row IS, so the competitor opposite our
      // team tells us the nickname directly.
      for (const [ourId, espnSide] of [
        [game.home_team_id, sameOrientation ? espnHome : espnAway],
        [game.away_team_id, sameOrientation ? espnAway : espnHome],
      ] as Array<[string | null, any]>) {
        if (!ourId || !espnSide?.team?.name) continue;
        const ours = allTeams?.find((x: any) => x.id === ourId);
        if (!ours || ours.status !== 'inactive') continue;
        if (ours.name === espnSide.team.name) continue;
        const { error: renErr } = await supabase
          .from('teams').update({ name: espnSide.team.name }).eq('id', ourId);
        if (!renErr) {
          console.log(`🩹 Renamed via game: ${ours.city} ${ours.name} -> ${espnSide.team.name}`);
          ours.name = espnSide.team.name;
          namesFixed++;
        }
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

        const nm = espnMissing.team.name || espnMissing.team.shortDisplayName || espnMissing.team.displayName;
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
    // Repair placeholder names created before the nickname was read properly.
    //
    // Opponent rows were built with ESPN's shortDisplayName, which is an
    // abbreviated SCHOOL ("New Mexico St", "San José St") and not a nickname, so
    // prepending the city produced "New Mexico State New Mexico St" and
    // "Hawai'i Hawai'i" on scoreboards. New rows use `name` now; these are the
    // ones already written. Only 'inactive' rows are touched — the real teams
    // are curated and must never be renamed by a sync.
    let namesFixed = 0;
    try {
      for (const [sport, espnGames] of allEspnGames.entries()) {
        const league = SPORT_TO_LEAGUE[sport];
        if (!league) continue;
        for (const eg of espnGames) {
          for (const c of (eg.competitions?.[0]?.competitors || [])) {
            const nick = c.team?.name;
            if (!nick) continue;
            const id = resolveTeamId(league, c.team.displayName, c.team.shortDisplayName);
            if (!id) continue;
            const ours = allTeams?.find((x: any) => x.id === id);
            if (!ours || ours.status !== 'inactive') continue;
            if (ours.name === nick) continue;
            const { error } = await supabase
              .from('teams').update({ name: nick }).eq('id', id);
            if (!error) {
              ours.name = nick;
              namesFixed++;
              console.log(`🩹 Renamed placeholder ${ours.city} -> ${nick}`);
            }
          }
        }
      }
    } catch (err) {
      repairErrors.push(`name repair: ${(err as Error).message}`);
    }

    let gamesInserted = 0;

    // Every odds_game_id this run will look at, fetched in one go.
    //
    // The check below used to be one HTTP request per ESPN game, inside the
    // loop. That is O(games) PostgREST calls on a cron that runs all day, and
    // it was invisible until football season opened at the end of August and
    // the games-per-run multiplied: 6.3M single-row lookups, 61% of every API
    // request the project made, and the bulk of a 6 GB egress overage. The
    // same answer costs one request per 500 games instead.
    const wantedOddsGameIds: string[] = [];
    for (const [sp, egs] of allEspnGames.entries()) {
      for (const eg of egs) wantedOddsGameIds.push(`espn-${sp}-${eg.id}`);
    }
    const knownOddsGameIds = new Set<string>();
    for (let i = 0; i < wantedOddsGameIds.length; i += 500) {
      const { data: known } = await supabase
        .from('games')
        .select('odds_game_id')
        .in('odds_game_id', wantedOddsGameIds.slice(i, i + 500));
      for (const r of (known ?? []) as { odds_game_id: string | null }[]) {
        if (r.odds_game_id) knownOddsGameIds.add(r.odds_game_id);
      }
    }

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
              // ESPN's `name` is the nickname ('Aggies'); shortDisplayName is an
              // abbreviated SCHOOL ('New Mexico St'), and using it as the nickname
              // rendered "New Mexico State New Mexico St" once city was prepended.
              name: missing.team.name || missing.team.shortDisplayName || missing.team.displayName,
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
        if (knownOddsGameIds.has(oddsGameId)) continue;

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
        // A TIGHT window, deliberately.
        //
        // This was "same UTC day, plus 36 hours", which is wrong for exactly the
        // case baseball produces constantly: a 9:38pm ET night game is 01:38 UTC
        // the NEXT day, and the following afternoon's game in the same series is
        // 20:08 UTC that same day. Two real games, same teams, one UTC date —
        // and the wide window would have called the second one a duplicate and
        // never inserted it.
        //
        // The twins this is actually for differ by MINUTES: the two feeds
        // disagree slightly on kickoff, nothing more. Six hours covers that with
        // room to spare and cannot reach the next game in a series.
        if (homeTeamId && awayTeamId) {
          const around = new Date(eg.date).getTime();
          const dayStart = new Date(around - 6 * 60 * 60 * 1000);
          const dayEnd = new Date(around + 6 * 60 * 60 * 1000);
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
      upcoming_repaired: upcomingRepaired,
      names_fixed: namesFixed,
      dates_fixed: datesFixed,
      schedule_checked: scheduleChecked,
      schedule_dropped: scheduleDropped,
      schedule_drops: scheduleDrops,
      stale_duplicates: staleDupes,
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

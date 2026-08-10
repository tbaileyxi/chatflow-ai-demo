import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ESPN API endpoints — all free, no API key required
const ESPN_ENDPOINTS: Record<string, string> = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  ncaaf: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  ncaab: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
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

async function fetchESPNScores(sport: string): Promise<ESPNGame[]> {
  const endpoint = ESPN_ENDPOINTS[sport];
  if (!endpoint) return [];

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      console.error(`ESPN API error for ${sport}: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error(`Error fetching ESPN ${sport}:`, error);
    return [];
  }
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

    const { data: activeGames } = await supabase
      .from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(id, name, city), away_team:teams!games_away_team_id_fkey(id, name, city)')
      .in('status', ['scheduled', 'in_progress', 'live'])
      .gte('start_time', sixHoursAgo.toISOString())
      .lte('start_time', sixHoursAhead.toISOString());

    let gamesEnriched = 0;

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
    const resolveTeamId = (league: string, displayName?: string, shortName?: string): string | null => {
      for (const key of [displayName?.toLowerCase(), shortName?.toLowerCase()]) {
        if (!key) continue;
        const hit = teamIndex.get(key);
        if (hit && hit.league === league) return hit.id;
      }
      return null;
    };

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

        const homeTeamId = resolveTeamId(league, home.team.displayName, home.team.shortDisplayName);
        const awayTeamId = resolveTeamId(league, away.team.displayName, away.team.shortDisplayName);
        // Only track games at least one of our teams plays in.
        if (!homeTeamId && !awayTeamId) continue;

        const oddsGameId = `espn-${sport}-${eg.id}`;
        const { data: existing } = await supabase
          .from('games')
          .select('id')
          .eq('odds_game_id', oddsGameId)
          .maybeSingle();
        if (existing) continue;

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

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
};

// Map ESPN sport keys to Odds API sport_key values used in the games table
const SPORT_KEY_MAP: Record<string, string> = {
  nfl: 'americanfootball_nfl',
  ncaaf: 'americanfootball_ncaaf',
  nba: 'basketball_nba',
  ncaab: 'basketball_ncaab',
  nhl: 'icehockey_nhl',
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

    const match1 = n1 && (g1.includes(n1) || n1.includes(g1) || g2.includes(n1) || n1.includes(g2));
    const match2 = n2 && (g1.includes(n2) || n2.includes(g1) || g2.includes(n2) || n2.includes(g2));

    if (match1 || match2) return game;
  }
  return null;
}

// Format period number into human-readable (e.g. "Q3", "P2", "3rd")
function formatPeriod(period: number | undefined, sport: string): string | null {
  if (!period) return null;
  if (sport === 'nba' || sport === 'ncaab') return `Q${period}`;
  if (sport === 'nhl') return `P${period}`;
  if (sport === 'nfl' || sport === 'ncaaf') return `Q${period}`;
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

    const { data: activeGames } = await supabase
      .from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(id, name, city), away_team:teams!games_away_team_id_fkey(id, name, city)')
      .in('status', ['scheduled', 'in_progress', 'live'])
      .gte('start_time', sixHoursAgo.toISOString());

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

    console.log(`✅ ESPN sync done: ${liveEventsUpdated} live_events, ${gamesEnriched} games enriched`);

    return new Response(JSON.stringify({
      success: true,
      live_events_updated: liveEventsUpdated,
      games_enriched: gamesEnriched,
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

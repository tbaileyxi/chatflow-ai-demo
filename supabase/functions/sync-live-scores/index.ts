import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ESPN API endpoints for different sports
const ESPN_ENDPOINTS: Record<string, string> = {
  ncaaf: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  ncaab: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
};

interface ESPNGame {
  id: string;
  name: string;
  shortName: string;
  status: {
    type: {
      name: string;
      state: string;
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
  if (!endpoint) {
    console.log(`No ESPN endpoint for sport: ${sport}`);
    return [];
  }

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      console.error(`ESPN API error for ${sport}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error(`Error fetching ESPN data for ${sport}:`, error);
    return [];
  }
}

function normalizeTeamName(name: string): string {
  // Remove common suffixes and normalize for matching
  return name
    .toLowerCase()
    .replace(/\s+(football|basketball|baseball|hockey)/gi, '')
    .replace(/\s+(state|university|college)/gi, (match) => match.toLowerCase())
    .trim();
}

function findMatchingGame(games: ESPNGame[], team1Name: string | null, team2Name: string | null): ESPNGame | null {
  if (!team1Name && !team2Name) return null;

  const normalizedTeam1 = team1Name ? normalizeTeamName(team1Name) : '';
  const normalizedTeam2 = team2Name ? normalizeTeamName(team2Name) : '';

  for (const game of games) {
    const competitors = game.competitions?.[0]?.competitors || [];
    if (competitors.length < 2) continue;

    const gameTeam1 = normalizeTeamName(competitors[0].team.displayName);
    const gameTeam2 = normalizeTeamName(competitors[1].team.displayName);

    // Check if either team matches
    const team1Match = normalizedTeam1 && (
      gameTeam1.includes(normalizedTeam1) || 
      normalizedTeam1.includes(gameTeam1) ||
      gameTeam2.includes(normalizedTeam1) ||
      normalizedTeam1.includes(gameTeam2)
    );
    
    const team2Match = normalizedTeam2 && (
      gameTeam1.includes(normalizedTeam2) || 
      normalizedTeam2.includes(gameTeam1) ||
      gameTeam2.includes(normalizedTeam2) ||
      normalizedTeam2.includes(gameTeam2)
    );

    if (team1Match || team2Match) {
      return game;
    }
  }

  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🏈 Starting live score sync...');

    // Get all live or upcoming events from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: liveEvents, error: eventsError } = await supabase
      .from('live_events')
      .select('id, name, team1_id, team2_id, status, score_team1, score_team2, teams!live_events_team1_id_fkey(id, name, league), teams!live_events_team2_id_fkey(id, name, league)')
      .in('status', ['upcoming', 'live', 'in_progress'])
      .gte('start_time', today.toISOString())
      .lte('start_time', tomorrow.toISOString());

    if (eventsError) {
      console.error('Error fetching live events:', eventsError);
      throw eventsError;
    }

    console.log(`Found ${liveEvents?.length || 0} live/upcoming events to sync`);

    if (!liveEvents || liveEvents.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No live events to sync',
        updated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch scores from all relevant sports
    const sportsToFetch = new Set<string>();
    for (const event of liveEvents) {
      const team1 = (event as any).teams;
      if (team1?.league) {
        sportsToFetch.add(team1.league.toLowerCase());
      }
    }

    console.log(`Fetching scores for sports: ${Array.from(sportsToFetch).join(', ')}`);

    const allGames: ESPNGame[] = [];
    for (const sport of sportsToFetch) {
      const games = await fetchESPNScores(sport);
      console.log(`Found ${games.length} ${sport} games from ESPN`);
      allGames.push(...games);
    }

    // Match and update scores
    let updatedCount = 0;
    for (const event of liveEvents) {
      const team1Data = (event as any)['teams!live_events_team1_id_fkey'];
      const team2Data = (event as any)['teams!live_events_team2_id_fkey'];
      
      const team1Name = team1Data?.name || event.name?.split(' vs ')[0];
      const team2Name = team2Data?.name || event.name?.split(' vs ')[1];

      const matchingGame = findMatchingGame(allGames, team1Name, team2Name);
      
      if (matchingGame) {
        const competitors = matchingGame.competitions?.[0]?.competitors || [];
        const homeTeam = competitors.find(c => c.homeAway === 'home');
        const awayTeam = competitors.find(c => c.homeAway === 'away');

        // Match scores to our team1/team2 based on name matching
        let score1 = 0;
        let score2 = 0;
        let newStatus = event.status;

        if (homeTeam && awayTeam) {
          const homeScore = parseInt(homeTeam.score) || 0;
          const awayScore = parseInt(awayTeam.score) || 0;

          // Determine which score goes to which team
          const homeTeamNormalized = normalizeTeamName(homeTeam.team.displayName);
          const team1Normalized = team1Name ? normalizeTeamName(team1Name) : '';

          if (homeTeamNormalized.includes(team1Normalized) || team1Normalized.includes(homeTeamNormalized)) {
            score1 = homeScore;
            score2 = awayScore;
          } else {
            score1 = awayScore;
            score2 = homeScore;
          }

          // Update status based on game state
          if (matchingGame.status.type.completed) {
            newStatus = 'completed';
          } else if (matchingGame.status.type.state === 'in') {
            newStatus = 'live';
          }
        }

        // Only update if scores changed
        if (score1 !== event.score_team1 || score2 !== event.score_team2 || newStatus !== event.status) {
          console.log(`📊 Updating ${event.name}: ${score1}-${score2} (${newStatus})`);
          
          const { error: updateError } = await supabase
            .from('live_events')
            .update({
              score_team1: score1,
              score_team2: score2,
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', event.id);

          if (updateError) {
            console.error(`Error updating event ${event.id}:`, updateError);
          } else {
            updatedCount++;
          }
        }
      } else {
        console.log(`⚠️ No ESPN match found for: ${event.name}`);
      }
    }

    console.log(`✅ Sync complete. Updated ${updatedCount} events.`);

    return new Response(JSON.stringify({
      success: true,
      message: `Synced live scores`,
      updated: updatedCount,
      total: liveEvents.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in sync-live-scores:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

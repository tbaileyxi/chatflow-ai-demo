import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sport keys for Odds API
const SPORT_KEYS = [
  'americanfootball_nfl',
  'americanfootball_ncaaf', 
  'basketball_nba',
  'basketball_ncaab',
  'icehockey_nhl',
  'baseball_mlb'
];

// Cooldown duration in milliseconds (90 minutes)
const COOLDOWN_DURATION_MS = 90 * 60 * 1000;

interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores?: Array<{ name: string; score: string }>;
}

interface Team {
  id: string;
  name: string;
  city: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ODDS_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('Starting games sync...');

    // Get all teams for matching
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, city')
      .eq('status', 'active');

    if (teamsError) throw teamsError;

    const teamMap = new Map<string, Team>();
    teams?.forEach(team => {
      // Create multiple lookup keys for team matching
      const keys = [
        team.name.toLowerCase(),
        `${team.city} ${team.name}`.toLowerCase(),
        team.city.toLowerCase()
      ];
      keys.forEach(key => teamMap.set(key, team));
    });

    // Helper to find team by name
    const findTeam = (teamName: string): Team | null => {
      const normalized = teamName.toLowerCase();
      
      // Direct match
      if (teamMap.has(normalized)) return teamMap.get(normalized)!;
      
      // Try partial matches
      for (const [key, team] of teamMap.entries()) {
        if (normalized.includes(key) || key.includes(normalized)) {
          return team;
        }
      }
      
      // Try matching just the last word (team name without city)
      const lastWord = normalized.split(' ').pop() || '';
      for (const [key, team] of teamMap.entries()) {
        if (key.includes(lastWord) && lastWord.length > 3) {
          return team;
        }
      }
      
      return null;
    };

    let gamesUpserted = 0;
    let teamsUpdated = 0;
    const liveTeamIds = new Set<string>();
    const finalTeamIds = new Set<string>();

    // Fetch games from Odds API for each sport
    for (const sportKey of SPORT_KEYS) {
      try {
        // Fetch scores for live/completed games
        const scoresUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/?apiKey=${ODDS_API_KEY}&daysFrom=1`;
        const scoresResponse = await fetch(scoresUrl);
        
        if (!scoresResponse.ok) {
          console.log(`Skipping ${sportKey}: ${scoresResponse.status}`);
          continue;
        }

        const games: OddsApiGame[] = await scoresResponse.json();
        console.log(`Fetched ${games.length} games for ${sportKey}`);

        for (const game of games) {
          const homeTeam = findTeam(game.home_team);
          const awayTeam = findTeam(game.away_team);

          // Determine game status
          let status: 'scheduled' | 'live' | 'final' = 'scheduled';
          const now = new Date();
          const commenceTime = new Date(game.commence_time);
          
          if (game.completed) {
            status = 'final';
          } else if (commenceTime <= now) {
            status = 'live';
          }

          // Parse scores
          let homeScore: number | null = null;
          let awayScore: number | null = null;
          
          if (game.scores) {
            const homeScoreData = game.scores.find(s => s.name === game.home_team);
            const awayScoreData = game.scores.find(s => s.name === game.away_team);
            homeScore = homeScoreData ? parseInt(homeScoreData.score) : null;
            awayScore = awayScoreData ? parseInt(awayScoreData.score) : null;
          }

          // Upsert game
          const { error: upsertError } = await supabase
            .from('games')
            .upsert({
              odds_game_id: game.id,
              sport_key: sportKey,
              start_time: game.commence_time,
              status,
              home_team_id: homeTeam?.id || null,
              away_team_id: awayTeam?.id || null,
              home_score: homeScore,
              away_score: awayScore,
              last_synced_at: new Date().toISOString()
            }, { onConflict: 'odds_game_id' });

          if (upsertError) {
            console.error('Error upserting game:', upsertError);
            continue;
          }

          gamesUpserted++;

          // Track live/final teams
          if (status === 'live') {
            if (homeTeam) liveTeamIds.add(homeTeam.id);
            if (awayTeam) liveTeamIds.add(awayTeam.id);
          } else if (status === 'final') {
            if (homeTeam) finalTeamIds.add(homeTeam.id);
            if (awayTeam) finalTeamIds.add(awayTeam.id);
          }
        }
      } catch (sportError) {
        console.error(`Error fetching ${sportKey}:`, sportError);
      }
    }

    console.log(`Upserted ${gamesUpserted} games`);

    // Now update teams_live_state based on current games
    const now = new Date();

    // Get current live games with team mappings
    const { data: liveGames } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'live');

    // Update live teams
    for (const game of liveGames || []) {
      if (game.home_team_id) {
        await supabase.from('teams_live_state').upsert({
          team_id: game.home_team_id,
          state: 'live',
          active_game_id: game.id,
          active_opponent_team_id: game.away_team_id,
          home_score: game.home_score,
          away_score: game.away_score,
          is_home_team: true,
          cooldown_ends_at: null,
          updated_at: now.toISOString()
        }, { onConflict: 'team_id' });
        teamsUpdated++;
      }

      if (game.away_team_id) {
        await supabase.from('teams_live_state').upsert({
          team_id: game.away_team_id,
          state: 'live',
          active_game_id: game.id,
          active_opponent_team_id: game.home_team_id,
          home_score: game.away_score,
          away_score: game.home_score,
          is_home_team: false,
          cooldown_ends_at: null,
          updated_at: now.toISOString()
        }, { onConflict: 'team_id' });
        teamsUpdated++;
      }
    }

    // Handle cooldown for recently finished games
    const { data: finalGames } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'final')
      .gte('last_synced_at', new Date(now.getTime() - COOLDOWN_DURATION_MS).toISOString());

    for (const game of finalGames || []) {
      const cooldownEnds = new Date(now.getTime() + COOLDOWN_DURATION_MS);
      
      // Check if team isn't already in a live game
      if (game.home_team_id && !liveTeamIds.has(game.home_team_id)) {
        const { data: existing } = await supabase
          .from('teams_live_state')
          .select('state')
          .eq('team_id', game.home_team_id)
          .single();

        if (!existing || existing.state !== 'live') {
          await supabase.from('teams_live_state').upsert({
            team_id: game.home_team_id,
            state: 'cooldown',
            active_game_id: game.id,
            active_opponent_team_id: game.away_team_id,
            home_score: game.home_score,
            away_score: game.away_score,
            is_home_team: true,
            cooldown_ends_at: cooldownEnds.toISOString(),
            updated_at: now.toISOString()
          }, { onConflict: 'team_id' });
          teamsUpdated++;
        }
      }

      if (game.away_team_id && !liveTeamIds.has(game.away_team_id)) {
        const { data: existing } = await supabase
          .from('teams_live_state')
          .select('state')
          .eq('team_id', game.away_team_id)
          .single();

        if (!existing || existing.state !== 'live') {
          await supabase.from('teams_live_state').upsert({
            team_id: game.away_team_id,
            state: 'cooldown',
            active_game_id: game.id,
            active_opponent_team_id: game.home_team_id,
            home_score: game.away_score,
            away_score: game.home_score,
            is_home_team: false,
            cooldown_ends_at: cooldownEnds.toISOString(),
            updated_at: now.toISOString()
          }, { onConflict: 'team_id' });
          teamsUpdated++;
        }
      }
    }

    // Clear expired cooldowns (set to normal)
    const { data: expiredCooldowns } = await supabase
      .from('teams_live_state')
      .select('team_id')
      .eq('state', 'cooldown')
      .lt('cooldown_ends_at', now.toISOString());

    for (const item of expiredCooldowns || []) {
      await supabase.from('teams_live_state').update({
        state: 'normal',
        active_game_id: null,
        active_opponent_team_id: null,
        home_score: null,
        away_score: null,
        cooldown_ends_at: null,
        updated_at: now.toISOString()
      }).eq('team_id', item.team_id);
      teamsUpdated++;
    }

    // Clear teams that are no longer in any active game
    const liveTeamIdsArray = Array.from(liveTeamIds);
    if (liveTeamIdsArray.length > 0) {
      const { data: staleStates } = await supabase
        .from('teams_live_state')
        .select('team_id')
        .eq('state', 'live')
        .not('team_id', 'in', `(${liveTeamIdsArray.join(',')})`);

      for (const item of staleStates || []) {
        // Move to cooldown instead of immediately to normal
        await supabase.from('teams_live_state').update({
          state: 'cooldown',
          cooldown_ends_at: new Date(now.getTime() + COOLDOWN_DURATION_MS).toISOString(),
          updated_at: now.toISOString()
        }).eq('team_id', item.team_id);
        teamsUpdated++;
      }
    }

    console.log(`Updated ${teamsUpdated} team states`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        games_synced: gamesUpserted,
        teams_updated: teamsUpdated,
        live_teams: liveTeamIds.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync games error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

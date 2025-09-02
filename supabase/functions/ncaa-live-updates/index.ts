import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Team name mapping for better matching
const teamNameMapping: Record<string, string[]> = {
  'Alabama Crimson Tide': ['Alabama', 'Crimson Tide', 'Bama'],
  'Georgia Bulldogs': ['Georgia', 'Bulldogs', 'UGA'],
  'Michigan Wolverines': ['Michigan', 'Wolverines', 'U of M'],
  'Ohio State Buckeyes': ['Ohio State', 'Buckeyes', 'OSU'],
  'Texas Longhorns': ['Texas', 'Longhorns', 'UT'],
  'Oklahoma Sooners': ['Oklahoma', 'Sooners', 'OU'],
  'Notre Dame Fighting Irish': ['Notre Dame', 'Fighting Irish', 'ND'],
  'Clemson Tigers': ['Clemson', 'Tigers'],
  'LSU Tigers': ['LSU', 'Tigers'],
  'Florida Gators': ['Florida', 'Gators', 'UF'],
  'Auburn Tigers': ['Auburn', 'Tigers'],
  'Penn State Nittany Lions': ['Penn State', 'Nittany Lions', 'PSU'],
  'Wisconsin Badgers': ['Wisconsin', 'Badgers'],
  'Oregon Ducks': ['Oregon', 'Ducks'],
  'USC Trojans': ['USC', 'Trojans', 'Southern California'],
  'Washington Huskies': ['Washington', 'Huskies', 'UW'],
  'Miami Hurricanes': ['Miami', 'Hurricanes', 'The U'],
  'Florida State Seminoles': ['Florida State', 'Seminoles', 'FSU'],
  'Tennessee Volunteers': ['Tennessee', 'Volunteers', 'Vols'],
  'Kentucky Wildcats': ['Kentucky', 'Wildcats', 'UK'],
  'South Carolina Gamecocks': ['South Carolina', 'Gamecocks'],
  'Mississippi State Bulldogs': ['Mississippi State', 'Bulldogs', 'MSU'],
  'Ole Miss Rebels': ['Ole Miss', 'Rebels', 'Mississippi'],
  'Arkansas Razorbacks': ['Arkansas', 'Razorbacks'],
  'Missouri Tigers': ['Missouri', 'Tigers', 'Mizzou'],
  'Vanderbilt Commodores': ['Vanderbilt', 'Commodores'],
  'Texas A&M Aggies': ['Texas A&M', 'Aggies', 'TAMU'],
  'North Carolina Tar Heels': ['North Carolina', 'Tar Heels', 'UNC', 'Chapel Hill'],
  'Boise State Broncos': ['Boise State', 'Broncos'],
  'BYU Cougars': ['BYU', 'Cougars', 'Brigham Young'],
  'Colorado Buffaloes': ['Colorado', 'Buffaloes', 'Buffs'],
  'Utah Utes': ['Utah', 'Utes'],
  'Arizona State Sun Devils': ['Arizona State', 'Sun Devils', 'ASU'],
  'UCLA Bruins': ['UCLA', 'Bruins'],
  'Stanford Cardinal': ['Stanford', 'Cardinal'],
  'California Golden Bears': ['California', 'Golden Bears', 'Cal', 'Berkeley'],
  'Oklahoma State Cowboys': ['Oklahoma State', 'Cowboys', 'OSU'],
  'TCU Horned Frogs': ['TCU', 'Horned Frogs'],
  'Baylor Bears': ['Baylor', 'Bears'],
  'Kansas Jayhawks': ['Kansas', 'Jayhawks', 'KU'],
  'Kansas State Wildcats': ['Kansas State', 'Wildcats', 'K-State'],
  'West Virginia Mountaineers': ['West Virginia', 'Mountaineers', 'WVU'],
  'Iowa State Cyclones': ['Iowa State', 'Cyclones'],
  'Texas Tech Red Raiders': ['Texas Tech', 'Red Raiders', 'TTU']
}

function findMatchingTeam(teams: any[], gameTeamName: string): any | null {
  console.log(`🔍 Matching ESPN team: "${gameTeamName}"`);
  
  // Special handling for North Carolina variations
  if (gameTeamName.toLowerCase().includes('north carolina') || 
      gameTeamName.toLowerCase().includes('tar heels') ||
      gameTeamName.toLowerCase() === 'unc') {
    console.log(`🎯 Special UNC matching for: ${gameTeamName}`);
    const uncMatch = teams.find(team => 
      team.name.toLowerCase().includes('tar heels') ||
      team.name.toLowerCase().includes('north carolina') ||
      team.city.toLowerCase().includes('chapel hill')
    );
    if (uncMatch) {
      console.log(`✅ UNC match found: ${uncMatch.name} (${uncMatch.city})`);
      return uncMatch;
    }
  }
  
  // Direct name match first
  let match = teams.find(team => 
    team.name.toLowerCase() === gameTeamName.toLowerCase() ||
    team.city.toLowerCase() === gameTeamName.toLowerCase() ||
    `${team.city} ${team.name}`.toLowerCase() === gameTeamName.toLowerCase()
  );
  
  if (match) {
    console.log(`✅ Direct match found: ${match.name} (${match.city})`);
    return match;
  }

  // Check mapping
  for (const [fullName, aliases] of Object.entries(teamNameMapping)) {
    if (aliases.some(alias => 
      alias.toLowerCase() === gameTeamName.toLowerCase() ||
      gameTeamName.toLowerCase().includes(alias.toLowerCase()) ||
      alias.toLowerCase().includes(gameTeamName.toLowerCase())
    )) {
      // Find team by full name or city
      match = teams.find(team => 
        `${team.city} ${team.name}`.toLowerCase() === fullName.toLowerCase() ||
        team.name.toLowerCase() === fullName.split(' ').slice(-1)[0].toLowerCase()
      );
      if (match) {
        console.log(`✅ Alias match found: ${match.name} (${match.city}) via ${fullName}`);
        return match;
      }
    }
  }

  // Fallback: partial matching
  match = teams.find(team => 
    team.name.toLowerCase().includes(gameTeamName.toLowerCase()) ||
    gameTeamName.toLowerCase().includes(team.name.toLowerCase()) ||
    team.city.toLowerCase().includes(gameTeamName.toLowerCase()) ||
    gameTeamName.toLowerCase().includes(team.city.toLowerCase())
  );

  if (match) {
    console.log(`✅ Partial match found: ${match.name} (${match.city})`);
  } else {
    console.log(`❌ No match found for: ${gameTeamName}`);
  }

  return match;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all teams from database
    const { data: teams, error: teamsError } = await supabaseClient
      .from('teams')
      .select('*');

    if (teamsError) {
      throw new Error(`Failed to fetch teams: ${teamsError.message}`);
    }

    // Fetch NCAA football games
    const espnUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard';
    const espnResponse = await fetch(espnUrl);
    
    if (!espnResponse.ok) {
      throw new Error(`ESPN API error: ${espnResponse.status}`);
    }

    const espnData = await espnResponse.json();
    const gamesProcessed = [];

    // Get system user for bot messages
    const { data: systemUserId } = await supabaseClient.rpc('get_or_create_system_user');

    for (const game of espnData.events || []) {
      try {
        const gameId = game.id;
        const status = game.status?.type?.description || 'Unknown';
        const period = game.status?.period || 0;
        const clock = game.status?.displayClock || '';

        if (game.competitions && game.competitions.length > 0) {
          const competition = game.competitions[0];
          const competitors = competition.competitors || [];

          if (competitors.length >= 2) {
            const homeTeam = competitors.find((c: any) => c.homeAway === 'home');
            const awayTeam = competitors.find((c: any) => c.homeAway === 'away');

            if (homeTeam && awayTeam) {
              const homeScore = homeTeam.score || '0';
              const awayScore = awayTeam.score || '0';
              const scoreText = `${awayTeam.team?.displayName || 'Away'} ${awayScore} - ${homeScore} ${homeTeam.team?.displayName || 'Home'}`;

              // Find matching teams in our database
              const dbHomeTeam = findMatchingTeam(teams, homeTeam.team?.displayName || '');
              const dbAwayTeam = findMatchingTeam(teams, awayTeam.team?.displayName || '');

              console.log(`Game: ${awayTeam.team?.displayName} vs ${homeTeam.team?.displayName}`);
              console.log(`DB matches: Away=${dbAwayTeam?.name || 'None'}, Home=${dbHomeTeam?.name || 'None'}`);

              // Check for game state changes
              const { data: existingGame } = await supabaseClient
                .from('game_states')
                .select('*')
                .eq('game_id', gameId)
                .single();

              let shouldNotify = false;
              let notificationMessage = '';

              if (!existingGame) {
                // New game
                shouldNotify = true;
                notificationMessage = `🏈 Game Started: ${scoreText} (${status})`;
              } else {
                // Check for changes
                if (existingGame.last_score !== scoreText) {
                  shouldNotify = true;
                  notificationMessage = `🔥 Score Update: ${scoreText}`;
                }
                
                if (existingGame.last_period !== period && period > existingGame.last_period) {
                  shouldNotify = true;
                  notificationMessage = `⏰ ${status} - ${clock}`;
                }

                if (existingGame.last_status !== status && (status.includes('Final') || status.includes('End'))) {
                  shouldNotify = true;
                  notificationMessage = `🏁 Game Final: ${scoreText}`;
                }
              }

              // Update or insert game state with error handling
              try {
                await supabaseClient
                  .from('game_states')
                  .upsert({
                    game_id: gameId,
                    last_score: scoreText,
                    last_period: period,
                    last_clock: clock,
                    last_status: status,
                    teams: {
                      home: {
                        name: homeTeam.team?.displayName,
                        score: homeScore,
                        dbTeamId: dbHomeTeam?.id
                      },
                      away: {
                        name: awayTeam.team?.displayName,
                        score: awayScore,
                        dbTeamId: dbAwayTeam?.id
                      }
                    }
                  }, {
                    onConflict: 'game_id'
                  });
              } catch (stateError) {
                console.error(`Failed to update game state for ${gameId}:`, stateError);
                // Continue processing even if state update fails
              }

              // Send notifications to relevant huddles if there's an update
              if (shouldNotify) {
                const relevantTeams = [dbHomeTeam, dbAwayTeam].filter(Boolean);
                
                for (const team of relevantTeams) {
                  // Find huddles for this team
                  const { data: huddles } = await supabaseClient
                    .from('huddles')
                    .select('id, name')
                    .eq('team_id', team.id);

                  // Send message to each huddle with deduplication
                  for (const huddle of huddles || []) {
                    // Check for recent duplicates (within 5 minutes)
                    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                    const { data: existingMsg } = await supabaseClient
                      .from('huddle_messages')
                      .select('id')
                      .eq('huddle_id', huddle.id)
                      .eq('is_bot_message', true)
                      .eq('content', notificationMessage)
                      .gte('created_at', fiveMinAgo)
                      .limit(1)
                      .maybeSingle();

                    if (existingMsg) {
                      console.log(`Skipping duplicate game update in huddle: ${huddle.name}`);
                      continue;
                    }

                    console.log(`📤 Posting to huddle "${huddle.name}": ${notificationMessage}`);
                    
                    await supabaseClient
                      .from('huddle_messages')
                      .insert({
                        huddle_id: huddle.id,
                        user_id: systemUserId,
                        content: notificationMessage,
                        is_bot_message: true,
                        is_team_agent_message: true,
                        origin_team_id: team.id,
                        message_type: 'game_update'
                      });

                    // Update huddle last_message_at
                    await supabaseClient
                      .from('huddles')
                      .update({ last_message_at: new Date().toISOString() })
                      .eq('id', huddle.id);
                  }
                }

                gamesProcessed.push({
                  gameId,
                  message: notificationMessage,
                  teamsNotified: relevantTeams.map(t => t.name)
                });
              }
            }
          }
        }
      } catch (gameError) {
        console.error(`Error processing game ${game.id}:`, gameError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: gamesProcessed.length,
      updates: gamesProcessed
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in ncaa-live-updates:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
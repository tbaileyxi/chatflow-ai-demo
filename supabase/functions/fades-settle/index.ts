import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all locked fades that need settling
    const { data: lockedFades, error: fadesError } = await supabase
      .from('fades')
      .select('*')
      .eq('status', 'locked')
      .lt('game_commence_time', new Date().toISOString());

    if (fadesError) {
      console.error('Error fetching locked fades:', fadesError);
      throw fadesError;
    }

    console.log(`Found ${lockedFades?.length || 0} locked fades to check`);

    // Also expire open fades past commence time
    const { data: expiredFades, error: expireError } = await supabase
      .from('fades')
      .update({ status: 'expired' })
      .eq('status', 'open')
      .lt('game_commence_time', new Date().toISOString())
      .select();

    if (expireError) {
      console.error('Error expiring fades:', expireError);
    } else {
      console.log(`Expired ${expiredFades?.length || 0} open fades`);
    }

    // Group fades by game_id
    const fadesByGame = new Map<string, any[]>();
    for (const fade of lockedFades || []) {
      const existing = fadesByGame.get(fade.game_id) || [];
      existing.push(fade);
      fadesByGame.set(fade.game_id, existing);
    }

    const apiKey = Deno.env.get('ODDS_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ODDS_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let settledCount = 0;
    const settledFades: any[] = [];

    // Process each game's fades
    for (const [gameId, fades] of fadesByGame) {
      const sport = fades[0].sport;
      
      // Fetch scores for this sport
      const scoresUrl = `https://api.the-odds-api.com/v4/sports/${sport}/scores/?apiKey=${apiKey}&daysFrom=3`;
      
      try {
        const scoresResponse = await fetch(scoresUrl);
        if (!scoresResponse.ok) {
          console.error(`Failed to fetch scores for ${sport}:`, scoresResponse.status);
          continue;
        }

        const scores = await scoresResponse.json();
        const gameScore = scores.find((s: any) => s.id === gameId);

        if (!gameScore || !gameScore.completed) {
          console.log(`Game ${gameId} not completed yet`);
          continue;
        }

        const homeScore = gameScore.scores?.find((s: any) => s.name === gameScore.home_team)?.score;
        const awayScore = gameScore.scores?.find((s: any) => s.name === gameScore.away_team)?.score;

        if (homeScore === undefined || awayScore === undefined) {
          console.log(`Missing scores for game ${gameId}`);
          continue;
        }

        const totalScore = parseInt(homeScore) + parseInt(awayScore);
        console.log(`Game ${gameId} final: ${gameScore.home_team} ${homeScore} - ${awayScore} ${gameScore.away_team}`);

        // Settle each fade for this game
        for (const fade of fades) {
          let winnerId: string | null = null;
          let winnerSide: 'poster' | 'accepter' | null = null;

          // Determine winner based on fade type
          switch (fade.fade_type) {
            case 'over':
              if (totalScore > fade.line_value) {
                winnerId = fade.poster_id;
                winnerSide = 'poster';
              } else if (totalScore < fade.line_value) {
                winnerId = fade.accepter_id;
                winnerSide = 'accepter';
              }
              break;

            case 'under':
              if (totalScore < fade.line_value) {
                winnerId = fade.poster_id;
                winnerSide = 'poster';
              } else if (totalScore > fade.line_value) {
                winnerId = fade.accepter_id;
                winnerSide = 'accepter';
              }
              break;

            case 'spread':
              // Poster took the spread (team to cover)
              const homeTeamLower = fade.home_team.toLowerCase();
              const fadeTeamIsHome = fade.line_description.toLowerCase().includes(homeTeamLower.split(' ')[0]);
              
              const margin = fadeTeamIsHome 
                ? parseInt(homeScore) - parseInt(awayScore)
                : parseInt(awayScore) - parseInt(homeScore);
              
              const covered = margin + fade.line_value > 0;
              
              if (covered) {
                winnerId = fade.poster_id;
                winnerSide = 'poster';
              } else if (margin + fade.line_value < 0) {
                winnerId = fade.accepter_id;
                winnerSide = 'accepter';
              }
              break;

            case 'team_total':
              const teamIsHome = fade.line_description.toLowerCase().includes(fade.home_team.toLowerCase().split(' ')[0]);
              const teamScore = teamIsHome ? parseInt(homeScore) : parseInt(awayScore);
              
              if (teamScore > fade.line_value) {
                winnerId = fade.poster_id;
                winnerSide = 'poster';
              } else if (teamScore < fade.line_value) {
                winnerId = fade.accepter_id;
                winnerSide = 'accepter';
              }
              break;
          }

          if (winnerId) {
            // Update fade as settled with settlement_status
            const { error: updateError } = await supabase
              .from('fades')
              .update({
                status: 'settled',
                winner_id: winnerId,
                final_score_home: parseInt(homeScore),
                final_score_away: parseInt(awayScore),
                settled_at: new Date().toISOString(),
                settlement_status: 'unpaid', // Initialize settlement status
              })
              .eq('id', fade.id);

            if (updateError) {
              console.error(`Error settling fade ${fade.id}:`, updateError);
              continue;
            }

            // Update ledgers
            await updateLedger(supabase, fade, winnerId);

            // Update season stats
            await updateSeasonStats(supabase, fade, winnerId);

            // Post settlement message to huddle
            await postSettlementMessage(supabase, fade, winnerId, winnerSide!, totalScore);

            settledCount++;
            settledFades.push({
              id: fade.id,
              winner_id: winnerId,
              final_score: `${homeScore}-${awayScore}`,
            });
          }
        }
      } catch (error) {
        console.error(`Error processing game ${gameId}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        settled_count: settledCount,
        expired_count: expiredFades?.length || 0,
        settled_fades: settledFades,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fades-settle:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function updateLedger(supabase: any, fade: any, winnerId: string) {
  const loserId = winnerId === fade.poster_id ? fade.accepter_id : fade.poster_id;
  
  // Order user IDs consistently (alphabetically) for lookup
  const [userA, userB] = [fade.poster_id, fade.accepter_id].sort();
  
  // Try to get existing ledger
  const { data: existingLedger } = await supabase
    .from('fade_ledgers')
    .select('*')
    .eq('huddle_id', fade.huddle_id)
    .eq('user_a_id', userA)
    .eq('user_b_id', userB)
    .maybeSingle();

  const winnerIsA = winnerId === userA;
  const pointChange = fade.stake;

  if (existingLedger) {
    // Update existing ledger
    await supabase
      .from('fade_ledgers')
      .update({
        net_points: existingLedger.net_points + (winnerIsA ? pointChange : -pointChange),
        total_fades: existingLedger.total_fades + 1,
        user_a_wins: existingLedger.user_a_wins + (winnerIsA ? 1 : 0),
        user_b_wins: existingLedger.user_b_wins + (winnerIsA ? 0 : 1),
        last_fade_at: new Date().toISOString(),
      })
      .eq('id', existingLedger.id);
  } else {
    // Create new ledger
    await supabase
      .from('fade_ledgers')
      .insert({
        huddle_id: fade.huddle_id,
        user_a_id: userA,
        user_b_id: userB,
        net_points: winnerIsA ? pointChange : -pointChange,
        total_fades: 1,
        user_a_wins: winnerIsA ? 1 : 0,
        user_b_wins: winnerIsA ? 0 : 1,
        last_fade_at: new Date().toISOString(),
      });
  }
}

async function updateSeasonStats(supabase: any, fade: any, winnerId: string) {
  const loserId = winnerId === fade.poster_id ? fade.accepter_id : fade.poster_id;
  const season = new Date().getFullYear();

  // Update winner's stats
  const { data: winnerStats } = await supabase
    .from('fade_season_stats')
    .select('*')
    .eq('huddle_id', fade.huddle_id)
    .eq('user_id', winnerId)
    .eq('season_year', season)
    .maybeSingle();

  if (winnerStats) {
    const newStreak = winnerStats.current_streak >= 0 
      ? winnerStats.current_streak + 1 
      : 1;
    
    await supabase
      .from('fade_season_stats')
      .update({
        total_points: winnerStats.total_points + fade.stake,
        total_wins: winnerStats.total_wins + 1,
        current_streak: newStreak,
        updated_at: new Date().toISOString(),
      })
      .eq('id', winnerStats.id);
  } else {
    await supabase
      .from('fade_season_stats')
      .insert({
        huddle_id: fade.huddle_id,
        user_id: winnerId,
        season_year: season,
        total_points: fade.stake,
        total_wins: 1,
        current_streak: 1,
      });
  }

  // Update loser's stats
  const { data: loserStats } = await supabase
    .from('fade_season_stats')
    .select('*')
    .eq('huddle_id', fade.huddle_id)
    .eq('user_id', loserId)
    .eq('season_year', season)
    .maybeSingle();

  if (loserStats) {
    const newStreak = loserStats.current_streak <= 0 
      ? loserStats.current_streak - 1 
      : -1;
    
    await supabase
      .from('fade_season_stats')
      .update({
        total_points: loserStats.total_points - fade.stake,
        total_losses: loserStats.total_losses + 1,
        current_streak: newStreak,
        updated_at: new Date().toISOString(),
      })
      .eq('id', loserStats.id);
  } else {
    await supabase
      .from('fade_season_stats')
      .insert({
        huddle_id: fade.huddle_id,
        user_id: loserId,
        season_year: season,
        total_points: -fade.stake,
        total_losses: 1,
        current_streak: -1,
      });
  }
}

async function postSettlementMessage(supabase: any, fade: any, winnerId: string, winnerSide: 'poster' | 'accepter', totalScore: number) {
  // Get winner and loser profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, display_name, username')
    .in('user_id', [fade.poster_id, fade.accepter_id]);

  const winnerProfile = profiles?.find((p: any) => p.user_id === winnerId);
  const loserProfile = profiles?.find((p: any) => p.user_id !== winnerId);

  const winnerName = winnerProfile?.display_name || winnerProfile?.username || 'Winner';
  const loserName = loserProfile?.display_name || loserProfile?.username || 'Opponent';

  const message = `🏆 ${fade.line_description} hit! ${winnerName} wins ${fade.stake} points from ${loserName} 🎉`;

  // Get system user
  const { data: systemUser } = await supabase.rpc('get_or_create_system_user');

  await supabase
    .from('huddle_messages')
    .insert({
      huddle_id: fade.huddle_id,
      user_id: systemUser,
      content: message,
      message_type: 'fade_settlement',
      is_bot_message: true,
    });
}

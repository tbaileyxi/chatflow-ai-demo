import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting Week 1 NFL pick\'em backfill...')

    // Get all Week 1 NFL games that are final but not yet processed
    const { data: week1Games } = await supabase
      .from('pickem_games')
      .select(`
        *,
        pickem_weeks!inner(league, week_number, season_year)
      `)
      .eq('pickem_weeks.league', 'nfl')
      .eq('pickem_weeks.week_number', 1)
      .eq('pickem_weeks.season_year', 2024)

    console.log(`Found ${week1Games?.length || 0} Week 1 NFL games`)

    if (!week1Games || week1Games.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No Week 1 NFL games found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch ESPN data for Week 1 NFL
    const espnUrl = `https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=1&seasontype=2`
    console.log('Fetching ESPN data from:', espnUrl)
    
    const espnResponse = await fetch(espnUrl, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" } })
    const espnData = await espnResponse.json()

    if (!espnData.events || espnData.events.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No ESPN games found for Week 1' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${espnData.events.length} ESPN games for Week 1`)

    let updatedGames = 0

    // Process each game
    for (const game of week1Games) {
      const espnGame = espnData.events.find((e: any) => e.id === game.espn_game_id)
      
      if (!espnGame) {
        console.log(`No ESPN game found for ID ${game.espn_game_id}`)
        continue
      }

      const competition = espnGame.competitions[0]
      const status = competition.status.type.name.toLowerCase()
      
      let winningTeam = null
      if (status === 'final') {
        const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home')
        const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away')
        
        if (homeTeam && awayTeam) {
          const homeScore = parseInt(homeTeam.score)
          const awayScore = parseInt(awayTeam.score)
          
          if (homeScore > awayScore) {
            winningTeam = homeTeam.team.displayName
          } else if (awayScore > homeScore) {
            winningTeam = awayTeam.team.displayName
          }
        }
      }

      // Update the game with status and winning team
      const { error: updateError } = await supabase
        .from('pickem_games')
        .update({
          status: status,
          winning_team: winningTeam
        })
        .eq('id', game.id)

      if (updateError) {
        console.error(`Error updating game ${game.id}:`, updateError)
      } else {
        console.log(`Updated game ${game.espn_game_id}: status=${status}, winner=${winningTeam}`)
        updatedGames++
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Week 1 backfill complete', 
        updatedGames,
        totalGames: week1Games.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in backfill function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
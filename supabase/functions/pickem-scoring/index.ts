import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting pick\'em scoring update...')

    // Get all games from the current week that might need updates
    const { data: games, error: gamesError } = await supabase
      .from('pickem_games')
      .select(`
        *,
        pickem_weeks!inner(*)
      `)
      .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .lte('start_time', new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()) // Next 2 days
      .in('status', ['scheduled', 'in_progress'])

    if (gamesError) throw gamesError
    if (!games || games.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No games to update',
        updated: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let updatedGames = 0

    // Group games by league for efficient API calls
    const gamesByLeague = games.reduce((acc: any, game: any) => {
      const league = game.pickem_weeks.league
      if (!acc[league]) acc[league] = []
      acc[league].push(game)
      return acc
    }, {})

    // Update each league
    for (const [league, leagueGames] of Object.entries(gamesByLeague)) {
      try {
        // Get current week for this league
        const weekNumber = (leagueGames as any)[0].pickem_weeks.week_number
        const seasonYear = (leagueGames as any)[0].pickem_weeks.season_year

        const espnUrl = league === 'nfl' 
          ? `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${weekNumber}&seasontype=2&dates=${seasonYear}`
          : `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?week=${weekNumber}&seasontype=2&dates=${seasonYear}`
        
        const espnResponse = await fetch(espnUrl)
        const espnData = await espnResponse.json()

        if (!espnData.events) continue

        // Update each game
        for (const game of leagueGames as any[]) {
          const espnGame = espnData.events.find((e: any) => e.id === game.espn_game_id)
          if (!espnGame) continue

          const competition = espnGame.competitions[0]
          if (!competition) continue

          const gameStatus = espnGame.status.type.name.toLowerCase()
          let status = 'scheduled'
          if (gameStatus.includes('in progress') || gameStatus.includes('halftime')) {
            status = 'in_progress'
          } else if (gameStatus.includes('final')) {
            status = 'final'
          } else if (gameStatus.includes('postponed') || gameStatus.includes('canceled')) {
            status = 'postponed'
          }

          // Determine winner if game is final
          let winningTeam = null
          if (status === 'final' && competition.competitors) {
            const winner = competition.competitors.find((c: any) => c.winner === true)
            if (winner) {
              winningTeam = winner.team.displayName
            }
          }

          // Only update if status or winner changed
          if (game.status !== status || game.winning_team !== winningTeam) {
            const { error: updateError } = await supabase
              .from('pickem_games')
              .update({
                status,
                winning_team: winningTeam,
                updated_at: new Date().toISOString()
              })
              .eq('id', game.id)

            if (updateError) {
              console.error('Error updating game:', updateError)
            } else {
              updatedGames++
              console.log(`Updated game ${game.espn_game_id}: ${status}, winner: ${winningTeam}`)
            }
          }
        }
      } catch (error) {
        console.error(`Error updating ${league} games:`, error)
      }
    }

    return new Response(JSON.stringify({
      message: `Pick'em scoring update complete`,
      updated: updatedGames,
      total_checked: games.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in pickem-scoring:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
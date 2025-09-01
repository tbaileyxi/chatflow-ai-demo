import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ESPNGame {
  id: string;
  name: string;
  shortName: string;
  date: string;
  competitions: Array<{
    competitors: Array<{
      team: {
        displayName: string;
        abbreviation: string;
      };
      homeAway: string;
    }>;
  }>;
  status: {
    type: {
      name: string;
      state: string;
    };
  };
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

    const { league, season_year, week_number } = await req.json()
    
    if (!league || !season_year || !week_number) {
      throw new Error('Missing required parameters: league, season_year, week_number')
    }

    console.log(`Syncing ${league} week ${week_number} for ${season_year}`)

    // Fetch from ESPN API
    const espnUrl = league === 'nfl' 
      ? `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week_number}&seasontype=2&dates=${season_year}`
      : `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?week=${week_number}&seasontype=2&dates=${season_year}`
    
    const espnResponse = await fetch(espnUrl)
    const espnData = await espnResponse.json()

    if (!espnData.events || espnData.events.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No games found for this week',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Calculate week start/end based on games
    const gameDates = espnData.events.map((game: ESPNGame) => new Date(game.date))
    const weekStart = new Date(Math.min(...gameDates.map(d => d.getTime())))
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(Math.max(...gameDates.map(d => d.getTime())))
    weekEnd.setHours(23, 59, 59, 999)

    // Create or update week
    const { data: weekData, error: weekError } = await supabase
      .from('pickem_weeks')
      .upsert({
        league,
        season_year,
        week_number,
        start_at: weekStart.toISOString(),
        end_at: weekEnd.toISOString()
      }, { 
        onConflict: 'league,season_year,week_number',
        ignoreDuplicates: false 
      })
      .select()
      .single()

    if (weekError) throw weekError

    // Process games
    let processedGames = 0
    for (const game of espnData.events) {
      const competition = game.competitions[0]
      if (!competition) continue

      const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home')
      const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away')
      
      if (!homeTeam || !awayTeam) continue

      const gameStatus = game.status.type.name.toLowerCase()
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

      const { error: gameError } = await supabase
        .from('pickem_games')
        .upsert({
          week_id: weekData.id,
          espn_game_id: game.id,
          home_team: homeTeam.team.displayName,
          away_team: awayTeam.team.displayName,
          start_time: new Date(game.date).toISOString(),
          status,
          winning_team: winningTeam
        }, { 
          onConflict: 'week_id,espn_game_id',
          ignoreDuplicates: false 
        })

      if (gameError) {
        console.error('Error upserting game:', gameError)
        continue
      }
      
      processedGames++
    }

    return new Response(JSON.stringify({
      message: `Successfully synced ${league} week ${week_number}`,
      processed: processedGames,
      week_id: weekData.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in pickem-sync:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
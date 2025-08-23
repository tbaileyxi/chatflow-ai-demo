import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ESPNGame {
  id: string
  status: {
    type: {
      id: string
      name: string
      state: string
      completed: boolean
    }
    period: number
    displayClock: string
  }
  competitions: Array<{
    id: string
    date: string
    competitors: Array<{
      id: string
      team: {
        id: string
        displayName: string
        abbreviation: string
        logo: string
      }
      score: string
      homeAway: string
    }>
    status: {
      type: {
        id: string
        name: string
        state: string
      }
      period: number
      displayClock: string
    }
  }>
}

interface GameState {
  gameId: string
  lastScore: string
  lastPeriod: number
  lastClock: string
  lastStatus: string
  teams: Array<{
    id: string
    name: string
    score: number
  }>
}

// Store game states in memory (in production, use Redis or database)
const gameStates = new Map<string, GameState>()

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting live game bot polling...')

    // Fetch followed teams to know which games to monitor
    const { data: followedTeams } = await supabase
      .from('user_follows')
      .select('team_id, teams(name, city)')

    const teamIds = new Set(followedTeams?.map(f => f.team_id) || [])
    console.log(`Monitoring ${teamIds.size} followed teams`)

    // Poll NFL games
    await pollLeague('nfl', teamIds, supabase)
    
    // Poll NCAA games
    await pollLeague('college-football', teamIds, supabase)

    return new Response(
      JSON.stringify({ success: true, message: 'Live game bot completed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Live game bot error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function pollLeague(league: string, teamIds: Set<string>, supabase: any) {
  try {
    console.log(`Polling ${league} games...`)
    
    const apiUrl = `https://site.api.espn.com/apis/site/v2/sports/football/${league}/scoreboard`
    const response = await fetch(apiUrl)
    
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`)
    }

    const data = await response.json()
    const games = data.events || []

    console.log(`Found ${games.length} ${league} games`)

    for (const game of games) {
      await processGame(game, league, teamIds, supabase)
    }

  } catch (error) {
    console.error(`Error polling ${league}:`, error)
  }
}

async function processGame(game: ESPNGame, league: string, teamIds: Set<string>, supabase: any) {
  try {
    const gameId = game.id
    const competition = game.competitions[0]
    const status = competition.status || game.status
    
    const teams = competition.competitors.map(comp => ({
      id: comp.team.id,
      name: comp.team.displayName,
      abbreviation: comp.team.abbreviation,
      score: parseInt(comp.score || '0'),
      isHome: comp.homeAway === 'home'
    }))

    // Check if any of our followed teams are playing
    const relevantTeams = teams.filter(team => 
      teamIds.has(team.id) || hasTeamMatch(team.name, teamIds, supabase)
    )

    if (relevantTeams.length === 0) {
      return // Skip games we don't care about
    }

    console.log(`Processing game: ${teams[0].name} vs ${teams[1].name}`)

    const currentState: GameState = {
      gameId,
      lastScore: `${teams[0].score}-${teams[1].score}`,
      lastPeriod: status.period || 0,
      lastClock: status.displayClock || '',
      lastStatus: status.type.state || '',
      teams
    }

    const previousState = gameStates.get(gameId)
    
    // Detect changes and post updates
    if (!previousState) {
      // New game detected
      if (status.type.state === 'in') {
        await postGameStart(teams, competition.date, supabase)
      }
    } else {
      await detectAndPostChanges(previousState, currentState, supabase)
    }

    // Update stored state
    gameStates.set(gameId, currentState)

    // Clean up completed games after 1 hour
    if (status.type.completed) {
      setTimeout(() => gameStates.delete(gameId), 3600000)
    }

  } catch (error) {
    console.error('Error processing game:', error)
  }
}

async function detectAndPostChanges(previous: GameState, current: GameState, supabase: any) {
  // Score change
  if (previous.lastScore !== current.lastScore) {
    await postScoreUpdate(current, supabase)
  }

  // Period change (quarter/half)
  if (previous.lastPeriod !== current.lastPeriod) {
    await postPeriodChange(previous, current, supabase)
  }

  // Game status change (end of game)
  if (previous.lastStatus === 'in' && current.lastStatus === 'post') {
    await postGameEnd(current, supabase)
  }
}

async function postGameStart(teams: any[], gameDate: string, supabase: any) {
  const content = `🏈 KICKOFF! ${teams[0].name} vs ${teams[1].name} - Game is LIVE!`
  
  console.log('Posting game start:', content)
  
  await postToTeamFeeds(teams, content, supabase)
}

async function postScoreUpdate(gameState: GameState, supabase: any) {
  const { teams, lastPeriod, lastClock } = gameState
  const periodText = getPeriodText(lastPeriod)
  
  const content = `🔥 ${teams[0].name} ${teams[0].score} - ${teams[1].score} ${teams[1].name}\n${periodText}${lastClock ? ` | ${lastClock}` : ''}`
  
  console.log('Posting score update:', content)
  
  await postToTeamFeeds(teams, content, supabase)
}

async function postPeriodChange(previous: GameState, current: GameState, supabase: any) {
  const periodText = getPeriodEndText(previous.lastPeriod)
  const { teams } = current
  
  const content = `⏰ ${periodText}\n${teams[0].name} ${teams[0].score} - ${teams[1].score} ${teams[1].name}`
  
  console.log('Posting period change:', content)
  
  await postToTeamFeeds(teams, content, supabase)
}

async function postGameEnd(gameState: GameState, supabase: any) {
  const { teams } = gameState
  const winner = teams[0].score > teams[1].score ? teams[0] : teams[1]
  const loser = teams[0].score > teams[1].score ? teams[1] : teams[0]
  
  const content = `🏆 FINAL: ${winner.name.toUpperCase()} WIN!\n${teams[0].name} ${teams[0].score} - ${teams[1].score} ${teams[1].name}`
  
  console.log('Posting game end:', content)
  
  await postToTeamFeeds(teams, content, supabase)
}

async function postToTeamFeeds(teams: any[], content: string, supabase: any) {
  try {
    // Get team IDs from our database by matching names
    for (const team of teams) {
      const { data: dbTeam } = await supabase
        .from('teams')
        .select('id')
        .or(`name.ilike.%${team.name}%,city.ilike.%${team.abbreviation}%`)
        .limit(1)
        .single()

      if (dbTeam) {
        // Post to team feed
        await supabase
          .from('posts')
          .insert({
            content,
            team_id: dbTeam.id,
            is_agent_post: true,
            is_team_agent_message: true,
            target_audience: ['team_feed'],
            delivery_status: 'sent'
          })

        console.log(`Posted to team ${team.name} feed`)
      }
    }
  } catch (error) {
    console.error('Error posting to team feeds:', error)
  }
}

function getPeriodText(period: number): string {
  switch (period) {
    case 1: return '1st Quarter'
    case 2: return '2nd Quarter'
    case 3: return '3rd Quarter'
    case 4: return '4th Quarter'
    default: return period > 4 ? 'Overtime' : 'Game'
  }
}

function getPeriodEndText(period: number): string {
  switch (period) {
    case 1: return 'End of 1st Quarter'
    case 2: return 'HALFTIME'
    case 3: return 'End of 3rd Quarter'
    case 4: return 'End of 4th Quarter'
    default: return 'End of Period'
  }
}

async function hasTeamMatch(teamName: string, teamIds: Set<string>, supabase: any): Promise<boolean> {
  // This would check if the team name matches any of our followed teams
  // For now, return false to keep it simple
  return false
}

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

// Store game states in database for persistence across function calls
async function getGameState(gameId: string, supabase: any): Promise<GameState | null> {
  try {
    const { data } = await supabase
      .from('game_states')
      .select('*')
      .eq('game_id', gameId)
      .single()
    
    return data ? {
      gameId: data.game_id,
      lastScore: data.last_score,
      lastPeriod: data.last_period,
      lastClock: data.last_clock,
      lastStatus: data.last_status,
      teams: data.teams
    } : null
  } catch {
    return null
  }
}

async function setGameState(gameState: GameState, supabase: any) {
  await supabase
    .from('game_states')
    .upsert({
      game_id: gameState.gameId,
      last_score: gameState.lastScore,
      last_period: gameState.lastPeriod,
      last_clock: gameState.lastClock,
      last_status: gameState.lastStatus,
      teams: gameState.teams,
      updated_at: new Date().toISOString()
    })
}

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

    // Clean up old entries from in-memory cache
    cleanupCache()

    // Fetch followed teams to know which games to monitor
    const { data: followedTeams } = await supabase
      .from('user_follows')
      .select('team_id, teams(name, city, conference)')

    // Fetch all Power 4 NCAA teams (automatically included in monitoring)
    const { data: power4Teams } = await supabase
      .from('teams')
      .select('id, name, city, conference, league')
      .eq('league', 'NCAA')
      .in('conference', ['SEC', 'Big Ten', 'Big 12', 'ACC'])

    // Fetch teams that have active huddles (ensure we monitor what users care about)
    const { data: huddleTeamRefs } = await supabase
      .from('huddles')
      .select('team_id')
      .not('team_id', 'is', null)

    const huddleTeamIds = Array.from(new Set((huddleTeamRefs || []).map(h => h.team_id)))
    let huddleTeams: any[] = []
    if (huddleTeamIds.length > 0) {
      const { data: fetchedHuddleTeams } = await supabase
        .from('teams')
        .select('id, name, city, conference, league')
        .in('id', huddleTeamIds)
      huddleTeams = fetchedHuddleTeams || []
    }

    // Combine followed teams, Power 4 teams, and huddle teams
    const allTeams = new Map()
    
    // Add followed teams
    followedTeams?.forEach(f => {
      if (f.teams) {
        allTeams.set(f.team_id, {
          id: f.team_id,
          name: f.teams.name,
          city: f.teams.city,
          conference: f.teams.conference,
          league: 'UNKNOWN'
        })
      }
    })
    
    // Add Power 4 teams (automatically monitored)
    power4Teams?.forEach(team => {
      allTeams.set(team.id, team)
    })

    // Add teams that have huddles
    huddleTeams.forEach(team => {
      allTeams.set(team.id, team)
    })

    const teamIds = new Set(Array.from(allTeams.keys()))
    console.log(`Monitoring ${teamIds.size} teams (${followedTeams?.length || 0} followed + ${power4Teams?.length || 0} Power 4 NCAA teams + ${huddleTeamIds.length} huddle teams)`)

    // Poll NFL games
    await pollLeague('nfl', teamIds, allTeams, supabase)
    
    // Poll NCAA games  
    await pollLeague('college-football', teamIds, allTeams, supabase)

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

async function pollLeague(league: string, teamIds: Set<string>, allTeams: Map<string, any>, supabase: any) {
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
      await processGame(game, league, teamIds, allTeams, supabase)
    }

  } catch (error) {
    console.error(`Error polling ${league}:`, error)
  }
}

async function processGame(game: ESPNGame, league: string, teamIds: Set<string>, allTeams: Map<string, any>, supabase: any) {
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

    // Check if any of our monitored teams are playing
    const relevantTeams = teams.filter(team => 
      hasTeamMatch(team, allTeams, supabase)
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

    const previousState = await getGameState(gameId, supabase)
    
    // Detect changes and post updates
    if (!previousState) {
      // New game detected
      if (status.type.state === 'in') {
        await postGameStart(teams, competition.date, league, supabase)
      }
    } else {
      await detectAndPostChanges(previousState, currentState, league, supabase)
    }

    // Update stored state
    await setGameState(currentState, supabase)

    // Clean up completed games
    if (status.type.completed) {
      await supabase
        .from('game_states')
        .delete()
        .eq('game_id', gameId)
    }

  } catch (error) {
    console.error('Error processing game:', error)
  }
}

async function detectAndPostChanges(previous: GameState, current: GameState, league: string, supabase: any) {
  // Score change
  if (previous.lastScore !== current.lastScore) {
    await postScoreUpdate(current, league, supabase)
  }

  // Period change (quarter/half)
  if (previous.lastPeriod !== current.lastPeriod) {
    await postPeriodChange(previous, current, league, supabase)
  }

  // Game status change (end of game)
  if (previous.lastStatus === 'in' && current.lastStatus === 'post') {
    await postGameEnd(current, league, supabase)
  }
}

async function postGameStart(teams: any[], gameDate: string, league: string, supabase: any) {
  const content = `🏈 KICKOFF! ${teams[0].name} vs ${teams[1].name} - Game is LIVE!`
  
  console.log('Posting game start:', content)
  
  await postToTeamFeeds(teams, content, league, supabase)
}

async function postScoreUpdate(gameState: GameState, league: string, supabase: any) {
  const { teams, lastPeriod, lastClock } = gameState
  const periodText = getPeriodText(lastPeriod)
  
  const content = `🔥 ${teams[0].name} ${teams[0].score} - ${teams[1].score} ${teams[1].name}\n${periodText}${lastClock ? ` | ${lastClock}` : ''}`
  
  console.log('Posting score update:', content)
  
  await postToTeamFeeds(teams, content, league, supabase)
}

async function postPeriodChange(previous: GameState, current: GameState, league: string, supabase: any) {
  const periodText = getPeriodEndText(previous.lastPeriod)
  const { teams } = current
  
  const content = `⏰ ${periodText}\n${teams[0].name} ${teams[0].score} - ${teams[1].score} ${teams[1].name}`
  
  console.log('Posting period change:', content)
  
  await postToTeamFeeds(teams, content, league, supabase)
}

async function postGameEnd(gameState: GameState, league: string, supabase: any) {
  const { teams } = gameState
  const winner = teams[0].score > teams[1].score ? teams[0] : teams[1]
  const loser = teams[0].score > teams[1].score ? teams[1] : teams[0]
  
  const content = `🏆 FINAL: ${winner.name.toUpperCase()} WIN!\n${teams[0].name} ${teams[0].score} - ${teams[1].score} ${teams[1].name}`
  
  console.log('Posting game end:', content)
  
  await postToTeamFeeds(teams, content, league, supabase)
}

// In-memory cache to track recent messages and prevent rapid duplicates
const recentMessages = new Map<string, number>()

// Clean up old entries from cache (run every 10 minutes)
function cleanupCache() {
  const now = Date.now()
  const tenMinAgo = now - 10 * 60 * 1000
  
  for (const [key, timestamp] of recentMessages) {
    if (timestamp < tenMinAgo) {
      recentMessages.delete(key)
    }
  }
}

async function postToTeamFeeds(teams: any[], content: string, league: string, supabase: any) {
  try {
    // Get or create system user for bot messages
    const { data: systemUserId } = await supabase.rpc('get_or_create_system_user')
    
    if (!systemUserId) {
      console.error('Failed to get system user ID')
      return
    }

    // Get team IDs from our database by improved matching for NCAA teams
    for (const team of teams) {
      // Try multiple matching strategies for better NCAA team identification
      let dbTeam = null
      
      // Strategy 1: Try nickname-based match with wildcards (handles multi-word nicknames)
      const teamWords = team.name.split(' ')
      const nicknameTwoWords = teamWords.slice(-2).join(' ') // e.g., "Fighting Irish"
      const nicknameOneWord = teamWords[teamWords.length - 1] // e.g., "Hurricanes"

      const orFilters: string[] = []
      if (nicknameTwoWords) orFilters.push(`name.ilike.%${nicknameTwoWords}%`)
      if (nicknameOneWord) orFilters.push(`name.ilike.%${nicknameOneWord}%`)

      if (orFilters.length > 0) {
        const { data: nicknameMatch } = await supabase
          .from('teams')
          .select('id, name, city, league')
          .or(orFilters.join(','))
          .limit(10)
        
        if (nicknameMatch && nicknameMatch.length > 0) {
          // Prefer by league context and city alignment
          for (const match of nicknameMatch) {
            const cityMatches = match.city && team.name.toLowerCase().includes((match.city as string).toLowerCase())
            if (league === 'college-football' && match.league === 'NCAA') {
              dbTeam = match
              if (cityMatches) break
            } else if (league === 'nfl' && match.league === 'NFL') {
              dbTeam = match
              if (cityMatches) break
            } else if (!dbTeam) {
              // Fallback to the first candidate
              dbTeam = match
            }
          }
        }
      }
      
      // Strategy 2: If still no match, try full name contains
      if (!dbTeam) {
        const { data: nameContains } = await supabase
          .from('teams')
          .select('id, name, city, league')
          .ilike('name', `%${team.name}%`)
          .limit(1)
          .maybeSingle()
        if (nameContains) dbTeam = nameContains
      }

      // Strategy 3: If still no match, try city-based fallback (useful for colleges like "Notre Dame")
      if (!dbTeam && team.name.includes(' ')) {
        const cityToken = team.name.split(' ')[0]
        const { data: cityMatch } = await supabase
          .from('teams')
          .select('id, name, city, league')
          .or(`city.ilike.%${cityToken}%,name.ilike.%${cityToken}%`)
          .limit(1)
          .maybeSingle()
        if (cityMatch) dbTeam = cityMatch
      }


      if (dbTeam) {
        console.log(`Matched ESPN team "${team.name}" to DB team "${dbTeam.name}" (${dbTeam.city})`)
        
        // Find all huddles for this team
        const { data: huddles } = await supabase
          .from('huddles')
          .select('id, name')
          .eq('team_id', dbTeam.id)

        console.log(`Found ${huddles?.length || 0} huddles for team ${dbTeam.name}`)

        // Post to each team huddle with enhanced de-duplication
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
        for (const huddle of huddles || []) {
          // Check in-memory cache first for rapid duplicate prevention
          const cacheKey = `${huddle.id}-${content}`
          const lastMessageTime = recentMessages.get(cacheKey)
          const now = Date.now()
          
          if (lastMessageTime && (now - lastMessageTime) < 2 * 60 * 1000) { // 2 minute rapid check
            console.log(`Skipping duplicate game update in huddle: ${huddle.name} (in-memory cache)`)
            continue
          }

          // Check database for recent duplicates with extended timeframe
          const { data: existingMsg } = await supabase
            .from('huddle_messages')
            .select('id')
            .eq('huddle_id', huddle.id)
            .eq('is_bot_message', true)
            .eq('message_type', 'game_update')
            .eq('content', content)
            .gte('created_at', tenMinAgo)
            .limit(1)
            .maybeSingle()

          if (existingMsg) {
            console.log(`Skipping duplicate game update in huddle: ${huddle.name}`)
            continue
          }

          // Update in-memory cache
          recentMessages.set(cacheKey, now)

          const { error } = await supabase
            .from('huddle_messages')
            .insert({
              content,
              huddle_id: huddle.id,
              user_id: systemUserId,
              is_bot_message: true,
              message_type: 'game_update'
            })

          if (error) {
            console.error(`Error posting to huddle ${huddle.name}:`, error)
          } else {
            console.log(`Posted game update to huddle: ${huddle.name}`)
          }
        }

        // Also post to main team feed for visibility (de-duplicated within 10 minutes)
        const tenMinAgoFeed = new Date(Date.now() - 10 * 60 * 1000).toISOString()
        const { data: existingPost } = await supabase
          .from('posts')
          .select('id')
          .eq('team_id', dbTeam.id)
          .eq('is_team_agent_message', true)
          .eq('content', content)
          .gte('created_at', tenMinAgoFeed)
          .limit(1)
          .maybeSingle()

        if (!existingPost) {
          const { error: postError } = await supabase
            .from('posts')
            .insert({
              content,
              team_id: dbTeam.id,
              is_agent_post: true,
              is_team_agent_message: true,
              target_audience: ['team_feed'],
              delivery_status: 'sent'
            })

          if (postError) {
            console.error(`Error posting to team ${dbTeam.name} feed:`, postError)
          } else {
            console.log(`Posted to team ${dbTeam.name} feed and ${huddles?.length || 0} huddles`)
          }
        } else {
          console.log(`Skipping duplicate post to team ${dbTeam.name} feed`)
        }
      } else {
        console.log(`Could not match ESPN team "${team.name}" (${team.abbreviation}) to any team in database`)
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

function hasTeamMatch(espnTeam: any, allTeams: Map<string, any>, supabase: any): boolean {
  // Check if this ESPN team matches any of our monitored teams
  for (const [teamId, team] of allTeams) {
    // Direct name match (case insensitive)
    if (team.name.toLowerCase() === espnTeam.name.toLowerCase()) {
      return true
    }
    
    // NCAA-specific matching: check if city matches ESPN team name
    if (team.city && espnTeam.name.toLowerCase().includes(team.city.toLowerCase())) {
      return true
    }
    
    // Check if ESPN team name contains our team's name  
    if (espnTeam.name.toLowerCase().includes(team.name.toLowerCase())) {
      return true
    }
    
    // Check abbreviation matches
    if (espnTeam.abbreviation && (
      espnTeam.abbreviation.toLowerCase() === team.name.toLowerCase() ||
      team.city?.toLowerCase().startsWith(espnTeam.abbreviation.toLowerCase())
    )) {
      return true
    }
  }
  
  return false
}

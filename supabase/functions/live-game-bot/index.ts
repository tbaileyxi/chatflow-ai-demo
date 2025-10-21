import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHighlightlyClient } from "../_shared/highlightly-client.ts";
import { shouldPollNow } from "../_shared/game-schedule.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GameState {
  gameId: string;
  lastScore: string;
  lastPeriod: number;
  lastClock: string;
  lastStatus: string;
  teams: Array<{
    id: number;
    name: string;
    score: number;
  }>;
}

// Store game states in database for persistence across function calls
async function getGameState(gameId: string, supabase: any): Promise<GameState | null> {
  try {
    const { data } = await supabase
      .from("game_states")
      .select("*")
      .eq("game_id", gameId)
      .single();

    return data
      ? {
          gameId: data.game_id,
          lastScore: data.last_score,
          lastPeriod: data.last_period,
          lastClock: data.last_clock,
          lastStatus: data.last_status,
          teams: data.teams,
        }
      : null;
  } catch {
    return null;
  }
}

async function setGameState(gameState: GameState, supabase: any) {
  try {
    await supabase.from("game_states").upsert(
      {
        game_id: gameState.gameId,
        last_score: gameState.lastScore,
        last_period: gameState.lastPeriod,
        last_clock: gameState.lastClock,
        last_status: gameState.lastStatus,
        teams: gameState.teams,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "game_id",
      }
    );
  } catch (error) {
    console.error(`Failed to update game state for ${gameState.gameId}:`, error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const highlightly = createHighlightlyClient();

    console.log("Starting live game bot polling...");

    // Clean up old entries from in-memory cache
    cleanupCache();

    // Fetch teams with Highlightly IDs
    const { data: allTeamsData } = await supabase
      .from("teams")
      .select("id, highlightly_id, name, city, league")
      .not("highlightly_id", "is", null);

    const allTeams = new Map();
    allTeamsData?.forEach((team) => {
      allTeams.set(team.id, team);
    });

    const teamHighlightlyIds = new Set(
      allTeamsData?.map((t) => t.highlightly_id).filter(Boolean) || []
    );

    console.log(`Monitoring ${teamHighlightlyIds.size} teams with Highlightly integration`);

    // Poll NFL games
    await pollLeague("NFL", teamHighlightlyIds, allTeams, supabase, highlightly);

    // Poll NCAA games
    await pollLeague("NCAA", teamHighlightlyIds, allTeams, supabase, highlightly);

    return new Response(
      JSON.stringify({ success: true, message: "Live game bot completed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Live game bot error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Match data cache to reduce API calls
const matchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

async function pollLeague(
  league: "NFL" | "NCAA",
  teamIds: Set<number>,
  allTeams: Map<string, any>,
  supabase: any,
  highlightly: any
) {
  try {
    // Smart scheduling: only poll during game times
    if (!shouldPollNow(league)) {
      console.log(`Skipping ${league} poll - outside game window`);
      return;
    }

    const now = new Date();
    const etTime = now.toLocaleString("en-US", { timeZone: "America/New_York" });
    const today = now.toISOString().split("T")[0];
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const currentYear = now.getFullYear();
    
    console.log(`🏈 [${league}] Polling games at ${etTime} ET`);
    console.log(`🏈 [${league}] Checking dates: ${today} and ${yesterday}`);

    let matches: any[] = [];
    let strategyUsed = '';

    // Strategy 1: Query by date + league for last 24 hours (most specific)
    console.log(`🔍 [${league}] Strategy 1: Querying by date (${today} + ${yesterday})`);
    
    const dateMatchesToday = await highlightly.getMatches({ 
      league, 
      date: today,
      limit: 100 
    });
    
    const dateMatchesYesterday = await highlightly.getMatches({ 
      league, 
      date: yesterday,
      limit: 100 
    });
    
    const combinedDateMatches = [
      ...(Array.isArray(dateMatchesToday) ? dateMatchesToday : []),
      ...(Array.isArray(dateMatchesYesterday) ? dateMatchesYesterday : [])
    ];
    
    if (combinedDateMatches.length > 0) {
      matches = combinedDateMatches;
      strategyUsed = 'date (24h)';
      console.log(`✅ [${league}] Strategy 1 SUCCESS: Found ${matches.length} games (today: ${dateMatchesToday?.length || 0}, yesterday: ${dateMatchesYesterday?.length || 0})`);
    } else {
      console.log(`⚠️ [${league}] Strategy 1 FAILED: No games found by date`);
      
      // Strategy 2: Query by season + league
      console.log(`🔍 [${league}] Strategy 2: Querying by season (${currentYear})`);
      const seasonMatches = await highlightly.getMatches({ 
        league,
        season: currentYear,
        limit: 100
      });
      
      if (seasonMatches && seasonMatches.length > 0) {
        // Filter to today's games manually
        matches = seasonMatches.filter(m => {
          const matchDate = new Date(m.startTime || m.date).toISOString().split("T")[0];
          return matchDate === today;
        });
        strategyUsed = 'season+filter';
        console.log(`✅ [${league}] Strategy 2 SUCCESS: Found ${matches.length} games for today`);
      } else {
        console.log(`⚠️ [${league}] Strategy 2 FAILED: No games found by season`);
        
        // Strategy 3: Get all league games (last resort)
        console.log(`🔍 [${league}] Strategy 3: Querying all ${league} games`);
        const allMatches = await highlightly.getMatches({ 
          league,
          limit: 100
        });
        
        if (allMatches && allMatches.length > 0) {
          // Filter to live or today's games
          const todayOrLive = allMatches.filter(m => {
            if (m.status === 'in_progress') return true;
            const matchDate = new Date(m.startTime || m.date).toISOString().split("T")[0];
            return matchDate === today;
          });
          matches = todayOrLive;
          strategyUsed = 'all+filter';
          console.log(`✅ [${league}] Strategy 3 SUCCESS: Found ${matches.length} relevant games`);
        } else {
          console.error(`❌ [${league}] All strategies FAILED - API returned no data`);
          return;
        }
      }
    }

    // Final validation
    if (!matches || !Array.isArray(matches) || matches.length === 0) {
      console.warn(`⚠️ [${league}] No relevant matches found after all strategies`);
      return;
    }

    console.log(`📊 [${league}] Processing ${matches.length} games (strategy: ${strategyUsed})`);
    
    // Log game details for debugging
    matches.forEach(match => {
      const homeTeam = match.homeTeam?.name || match.homeTeam?.displayName || 'Unknown';
      const awayTeam = match.awayTeam?.name || match.awayTeam?.displayName || 'Unknown';
      const status = match.status || 'unknown';
      const score = match.homeTeam?.score !== undefined 
        ? `${awayTeam} ${match.awayTeam?.score || 0} @ ${homeTeam} ${match.homeTeam?.score || 0}` 
        : `${awayTeam} @ ${homeTeam}`;
      
      console.log(`   🏈 Game ${match.id}: ${score} - ${status}`);
    });

    // Process each game
    for (const match of matches) {
      // Check cache first to reduce API calls
      const cacheKey = `${league}-${match.id}`;
      const cached = matchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        continue;
      }
      
      await processGame(match, league, teamIds, allTeams, supabase);
      
      // Cache the match data
      matchCache.set(cacheKey, { data: match, timestamp: Date.now() });
    }
    
    console.log(`✅ [${league}] Polling cycle complete`);
  } catch (error) {
    console.error(`❌ [${league}] Error in pollLeague:`, error);
  }
}

async function processGame(
  match: any,
  league: string,
  teamIds: Set<number>,
  allTeams: Map<string, any>,
  supabase: any
) {
  try {
    const gameId = match.id.toString();

    // Check if any of our monitored teams are playing
    const isRelevant =
      teamIds.has(match.homeTeam.id) || teamIds.has(match.awayTeam.id);

    if (!isRelevant) {
      return; // Skip games we don't care about
    }

    console.log(`🏈 Processing: ${match.awayTeam.name} @ ${match.homeTeam.name} (Status: ${match.status})`);

    const teams = [
      {
        id: match.homeTeam.id,
        name: match.homeTeam.name,
        score: match.homeTeam.score || 0,
      },
      {
        id: match.awayTeam.id,
        name: match.awayTeam.name,
        score: match.awayTeam.score || 0,
      },
    ];

    const currentState: GameState = {
      gameId,
      lastScore: `${match.awayTeam.score}-${match.homeTeam.score}`,
      lastPeriod: match.period || 0,
      lastClock: match.clock || "",
      lastStatus: match.status === "half time" ? "in_progress" : match.status, // Normalize halftime status
      teams,
    };

    const previousState = await getGameState(gameId, supabase);

    // Detect changes and post updates
    // Check if game has actually started (non-zero scores)
    const homeScore = match.homeTeam?.score || 0;
    const awayScore = match.awayTeam?.score || 0;
    const hasScore = homeScore > 0 || awayScore > 0;
    
    if (!previousState) {
      if (match.status === "scheduled" && !hasScore) {
        await postPregameInfo(teams, match.startTime, league, supabase, allTeams);
      } else if (match.status === "in_progress" || hasScore) {
        await postGameStart(teams, match.startTime, league, supabase, allTeams);
        // Update pick'em games when we first discover a live game
        await updatePickEmGame(match, 'in_progress', supabase);
      } else if (match.status === "finished") {
        await postGameEnd(currentState, league, supabase, allTeams);
        // Update pick'em games when we first discover a finished game
        await updatePickEmGame(match, 'final', supabase);
      }
    } else {
      await detectAndPostChanges(previousState, currentState, league, supabase, allTeams, match);
    }

    // Always update game state
    await setGameState(currentState, supabase);

    // Clean up old finished games
    if (match.status === "finished" && previousState) {
      const { data: existingState } = await supabase
        .from("game_states")
        .select("updated_at")
        .eq("game_id", gameId)
        .single();

      if (existingState) {
        const lastUpdate = new Date(existingState.updated_at);
        const hoursSinceFinal = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);

        if (hoursSinceFinal > 24) {
          console.log(`Cleaning up game ${gameId} (final for ${hoursSinceFinal.toFixed(1)} hours)`);
          await supabase.from("game_states").delete().eq("game_id", gameId);
        }
      }
    }
  } catch (error) {
    console.error("Error processing game:", error);
  }
}

async function detectAndPostChanges(
  previous: GameState,
  current: GameState,
  league: string,
  supabase: any,
  allTeams: Map<string, any>,
  match?: any
) {
  if (previous.lastStatus === "finished") {
    return; // Game already completed
  }

  // Game start
  if (previous.lastStatus === "scheduled" && current.lastStatus === "in_progress") {
    await postGameStart(current.teams, "", league, supabase, allTeams);
    // Update pick'em games to lock picks
    if (match) {
      await updatePickEmGame(match, 'in_progress', supabase);
    }
  }

  // Halftime detection (status changes to "half time")
  if (previous.lastStatus === "in_progress" && 
      (match?.status === "half time" || match?.status === "halftime")) {
    const content = `⏰ HALFTIME\n${current.teams[1].name} ${current.teams[1].score} - ${current.teams[0].score} ${current.teams[0].name}`;
    const dedupeId = `halftime-${current.gameId}`;
    await postToTeamFeeds(current.teams, content, league, supabase, allTeams, dedupeId);
  }

  // Score change - pass matchId to fetch highlights
  if (current.lastStatus === "in_progress" && previous.lastScore !== current.lastScore) {
    await postScoreUpdate(current, league, supabase, allTeams, match?.id);
  }

  // Period change
  if (current.lastStatus === "in_progress" && current.lastPeriod > previous.lastPeriod) {
    await postPeriodChange(previous, current, league, supabase, allTeams);
  }

  // Game end
  if (previous.lastStatus !== "finished" && current.lastStatus === "finished") {
    await postGameEnd(current, league, supabase, allTeams);
    // Update pick'em games and determine winner
    if (match) {
      await updatePickEmGame(match, 'final', supabase);
    }
  }
}

// Update pick'em games based on live game data
async function updatePickEmGame(
  match: any,
  status: 'scheduled' | 'in_progress' | 'final',
  supabase: any
) {
  try {
    const matchId = match.id.toString();
    
    // Find pickem_games matching this match_id
    const { data: pickemGames, error: fetchError } = await supabase
      .from('pickem_games')
      .select('id, status, winning_team')
      .eq('match_id', matchId);
    
    if (fetchError) {
      console.error(`Error fetching pick'em games for match ${matchId}:`, fetchError);
      return;
    }
    
    if (!pickemGames || pickemGames.length === 0) {
      return; // No pick'em games for this match
    }
    
    console.log(`🎯 Updating ${pickemGames.length} pick'em game(s) for match ${matchId} to status: ${status}`);
    
    // Determine winner if game is final
    let winningTeam = null;
    if (status === 'final') {
      const homeScore = match.homeTeam?.score || 0;
      const awayScore = match.awayTeam?.score || 0;
      
      if (homeScore !== awayScore) {
        winningTeam = homeScore > awayScore 
          ? match.homeTeam.name 
          : match.awayTeam.name;
        console.log(`🏆 Winner determined: ${winningTeam} (${awayTeam.name} ${awayScore} - ${homeScore} ${homeTeam.name})`);
      } else {
        console.log(`🤝 Game ended in a tie: ${awayTeam.name} ${awayScore} - ${homeScore} ${homeTeam.name}`);
      }
    }
    
    // Update all matching pickem_games
    for (const game of pickemGames) {
      // Skip if already updated to avoid unnecessary writes
      if (game.status === status && (status !== 'final' || game.winning_team === winningTeam)) {
        console.log(`⏭️ Pick'em game ${game.id} already up to date`);
        continue;
      }
      
      const { error: updateError } = await supabase
        .from('pickem_games')
        .update({
          status,
          winning_team: winningTeam,
          updated_at: new Date().toISOString()
        })
        .eq('id', game.id);
      
      if (updateError) {
        console.error(`Error updating pick'em game ${game.id}:`, updateError);
      } else {
        console.log(`✅ Updated pick'em game ${game.id}: status=${status}, winner=${winningTeam || 'TBD'}`);
      }
    }
  } catch (error) {
    console.error('Error in updatePickEmGame:', error);
  }
}

async function postPregameInfo(
  teams: any[],
  gameDate: string,
  league: string,
  supabase: any,
  allTeams: Map<string, any>
) {
  const gameTime = new Date(gameDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  const content = `🏈 PREGAME: ${teams[1].name} vs ${teams[0].name}\nKickoff: ${gameTime} ET`;

  await postToTeamFeeds(teams, content, league, supabase, allTeams, `pregame-${teams[0].id}-${teams[1].id}`);
}

async function postGameStart(
  teams: any[],
  gameDate: string,
  league: string,
  supabase: any,
  allTeams: Map<string, any>
) {
  const content = `🏈 KICKOFF! ${teams[1].name} vs ${teams[0].name} - Game is LIVE!`;

  await postToTeamFeeds(teams, content, league, supabase, allTeams, `kickoff-${teams[0].id}-${teams[1].id}`);
}

async function postScoreUpdate(
  gameState: GameState,
  league: string,
  supabase: any,
  allTeams: Map<string, any>,
  matchId?: number
) {
  const { teams, lastPeriod, lastClock } = gameState;
  const periodText = getPeriodText(lastPeriod);

  // Try to fetch highlights to get specific scoring play details
  let scoringPlayContent = null;
  if (matchId) {
    try {
      const highlightly = createHighlightlyClient();
      const today = new Date().toISOString().split("T")[0];
      const highlights = await highlightly.getHighlights({
        date: today,
        leagueName: league as "NFL" | "NCAA",
        matchId: matchId,
        limit: 5
      });
      
      // Get the most recent highlight (likely the scoring play that just happened)
      if (highlights && highlights.length > 0) {
        const latestHighlight = highlights[0];
        const title = latestHighlight.title || '';
        
        // Determine emoji based on scoring type
        let emoji = '🔥';
        if (title.toLowerCase().includes('touchdown') || title.toLowerCase().includes('td')) {
          emoji = '🏈 TOUCHDOWN!';
        } else if (title.toLowerCase().includes('field goal') || title.toLowerCase().includes('fg')) {
          emoji = '⚡ FIELD GOAL!';
        } else if (title.toLowerCase().includes('safety')) {
          emoji = '🛡️ SAFETY!';
        } else if (title.toLowerCase().includes('interception') || title.toLowerCase().includes('int')) {
          emoji = '🎯 INTERCEPTION!';
        } else if (title.toLowerCase().includes('fumble')) {
          emoji = '💨 FUMBLE RECOVERY!';
        }
        
        scoringPlayContent = `${emoji}\n${title}\n\n${teams[1].name} ${teams[1].score} - ${teams[0].score} ${teams[0].name}\n${periodText}${lastClock ? ` | ${lastClock}` : ''}`;
        
        // Optionally include video embed
        if (latestHighlight.embedUrl) {
          scoringPlayContent += `\n\n🎥 ${latestHighlight.embedUrl}`;
        }
      }
    } catch (error) {
      console.error('Error fetching highlights for scoring play:', error);
      // Fall back to generic score update
    }
  }

  const content = scoringPlayContent || `🔥 ${teams[1].name} ${teams[1].score} - ${teams[0].score} ${teams[0].name}\n${periodText}${
    lastClock ? ` | ${lastClock}` : ""
  }`;

  await postToTeamFeeds(teams, content, league, supabase, allTeams);
}

async function postPeriodChange(
  previous: GameState,
  current: GameState,
  league: string,
  supabase: any,
  allTeams: Map<string, any>
) {
  const periodText = getPeriodEndText(previous.lastPeriod);
  const { teams } = current;

  const content = `⏰ ${periodText}\n${teams[1].name} ${teams[1].score} - ${teams[0].score} ${teams[0].name}`;

  const dedupeId = `period-${current.gameId}-${previous.lastPeriod}`;
  await postToTeamFeeds(teams, content, league, supabase, allTeams, dedupeId);
}

async function postGameEnd(gameState: GameState, league: string, supabase: any, allTeams: Map<string, any>) {
  const { teams } = gameState;
  const winner = teams[0].score > teams[1].score ? teams[0] : teams[1];

  const content = `🏆 FINAL: ${winner.name.toUpperCase()} WIN!\n${teams[1].name} ${teams[1].score} - ${
    teams[0].score
  } ${teams[0].name}`;

  await postToTeamFeeds(teams, content, league, supabase, allTeams);
}

const recentMessages = new Map<string, number>();

function cleanupCache() {
  const now = Date.now();
  const tenMinAgo = now - 10 * 60 * 1000;

  for (const [key, timestamp] of recentMessages) {
    if (timestamp < tenMinAgo) {
      recentMessages.delete(key);
    }
  }
}

async function postToTeamFeeds(
  teams: any[],
  content: string,
  league: string,
  supabase: any,
  allTeams: Map<string, any>,
  dedupeId?: string
) {
  try {
    const { data: systemUserId } = await supabase.rpc("get_or_create_system_user");

    if (!systemUserId) {
      console.error("Failed to get system user ID");
      return;
    }

    for (const team of teams) {
      // Find database team by Highlightly ID
      const dbTeam = Array.from(allTeams.values()).find((t) => t.highlightly_id === team.id);

      if (!dbTeam) {
        console.log(`No DB team found for Highlightly ID ${team.id}`);
        continue;
      }

      // Find all huddles for this team
      const { data: huddles } = await supabase.from("huddles").select("id").eq("team_id", dbTeam.id);

      if (!huddles || huddles.length === 0) {
        continue;
      }

      // Post to each huddle
      for (const huddle of huddles) {
        // Check for recent duplicate
        const cacheKey = dedupeId
          ? `${huddle.id}-${dedupeId}`
          : `${huddle.id}-${content.substring(0, 50)}`;

        // Database-level deduplication check FIRST (prevents duplicates from parallel function instances)
        // Extended lookback window to 15 minutes and use substring matching
        const { data: recentMessage } = await supabase
          .from('huddle_messages')
          .select('id')
          .eq('huddle_id', huddle.id)
          .ilike('content', `${content.substring(0, 30)}%`)
          .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();

        if (recentMessage) {
          console.log(`⏭️ Skipping duplicate message (database check) for huddle ${huddle.id}`);
          continue;
        }

        // In-memory cache check (fast path for single instance)
        // Extended to 15 minutes to match database lookback
        if (recentMessages.has(cacheKey)) {
          const lastPosted = recentMessages.get(cacheKey)!;
          if (Date.now() - lastPosted < 15 * 60 * 1000) {
            console.log(`⏭️ Skipping duplicate message (in-memory cache) for huddle ${huddle.id}`);
            continue;
          }
        }

        const { error } = await supabase.from("huddle_messages").insert({
          huddle_id: huddle.id,
          user_id: systemUserId,
          content,
          is_bot_message: true,
          message_type: "text",
        });

        if (error) {
          console.error(`❌ Error posting to huddle ${huddle.id}:`, error);
        } else {
          console.log(`✅ Posted to huddle ${huddle.id}: ${content.substring(0, 50)}...`);
          recentMessages.set(cacheKey, Date.now());
        }
      }
    }
  } catch (error) {
    console.error("Error posting to team feeds:", error);
  }
}

function getPeriodText(period: number): string {
  switch (period) {
    case 1:
      return "1st Quarter";
    case 2:
      return "2nd Quarter";
    case 3:
      return "3rd Quarter";
    case 4:
      return "4th Quarter";
    default:
      return `Period ${period}`;
  }
}

function getPeriodEndText(period: number): string {
  if (period === 2) return "HALFTIME";
  if (period === 4) return "END OF REGULATION";
  return `END OF ${getPeriodText(period)}`;
}

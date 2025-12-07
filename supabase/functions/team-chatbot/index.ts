import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Import Highlightly client
async function createHighlightlyClient() {
  const apiKey = Deno.env.get('HIGHLIGHTLY_API_KEY');
  const baseUrl = 'https://american-football.highlightly.net';

  async function fetchWithRetry(url: string, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, {
          headers: {
            'x-rapidapi-key': apiKey || '',
            'Accept': 'application/json',
          },
        });
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    return null;
  }

  return {
    async getMatches(params: { team?: string; league?: string; date?: string; limit?: number; status?: string }) {
      const searchParams = new URLSearchParams();
      if (params.team) searchParams.set('team', params.team);
      if (params.league) searchParams.set('league', params.league);
      if (params.date) searchParams.set('date', params.date);
      if (params.limit) searchParams.set('limit', params.limit.toString());
      if (params.status) searchParams.set('status', params.status);
      
      return fetchWithRetry(`${baseUrl}/matches?${searchParams.toString()}`);
    },
  };
}

// Fetch live scores from ESPN API
async function fetchESPNScores(league: 'NFL' | 'NCAA', teamName: string) {
  try {
    const leagueCode = league === 'NFL' ? 'nfl' : 'college-football';
    const url = `http://site.api.espn.com/apis/site/v2/sports/football/${leagueCode}/scoreboard`;
    
    console.log(`📡 Fetching ESPN API: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`❌ ESPN API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const games = data.events || [];
    
    // Find the game with our team
    const game = games.find((event: any) => {
      const competitors = event.competitions?.[0]?.competitors || [];
      return competitors.some((comp: any) => 
        comp.team.displayName.includes(teamName) || 
        comp.team.name.includes(teamName) ||
        comp.team.shortDisplayName?.includes(teamName)
      );
    });
    
    if (!game) {
      console.log(`⚠️ No game found for ${teamName} on ESPN`);
      return null;
    }
    
    const competition = game.competitions[0];
    const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
    const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
    const status = competition.status;
    
    return {
      awayTeam: awayTeam.team.displayName,
      awayScore: parseInt(awayTeam.score),
      homeTeam: homeTeam.team.displayName,
      homeScore: parseInt(homeTeam.score),
      status: status.type.name, // 'STATUS_IN_PROGRESS', 'STATUS_FINAL', 'STATUS_SCHEDULED'
      period: status.period,
      clock: status.displayClock,
      detail: status.type.detail, // e.g., "4th Quarter", "Final"
      lastPlay: competition.situation?.lastPlay?.text || null
    };
  } catch (error) {
    console.error('❌ Error fetching ESPN API:', error);
    return null;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting map: huddleId -> last response timestamp
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 10000; // 10 seconds between responses

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, huddle_id, content } = await req.json();

    console.log(`📢 @coach mention detected in huddle ${huddle_id}`);

    // Rate limiting check
    const lastResponse = rateLimitMap.get(huddle_id) || 0;
    const rateLimitTimestamp = Date.now();
    if (rateLimitTimestamp - lastResponse < RATE_LIMIT_MS) {
      console.log(`⏱️ Rate limit hit for huddle ${huddle_id}`);
      return new Response(JSON.stringify({ message: 'Rate limited' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
    
    if (!XAI_API_KEY) {
      throw new Error('XAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if bot is enabled for this huddle
    const { data: settings } = await supabase
      .from('huddle_chatbot_settings')
      .select('is_enabled, personality')
      .eq('huddle_id', huddle_id)
      .single();

    if (!settings || !settings.is_enabled) {
      console.log(`🚫 Bot disabled for huddle ${huddle_id}`);
      return new Response(JSON.stringify({ message: 'Bot disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Get huddle info with team_id
    const { data: huddle, error: huddleError } = await supabase
      .from('huddles')
      .select('id, name, team_id')
      .eq('id', huddle_id)
      .single();

    if (!huddle || !huddle.team_id) {
      console.error('Huddle not found or has no team:', huddleError);
      throw new Error('Huddle not found or has no team associated');
    }

    // Get team data separately
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, league, highlightly_display_name')
      .eq('id', huddle.team_id)
      .single();

    if (!team) {
      console.error('Team not found:', teamError);
      throw new Error('Team not found');
    }

    const teamName = team.highlightly_display_name || team.name;
    const league = team.league;
    const personality = settings.personality || 'hype';

    // Build current date/time context - ALL IN EASTERN TIME
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      timeZone: 'America/New_York'
    });
    const formattedTime = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      timeZone: 'America/New_York'
    });

    // Calculate current season based on ET date
    const etMonth = parseInt(now.toLocaleDateString('en-US', { 
      month: 'numeric',
      timeZone: 'America/New_York'
    }));
    const etYear = parseInt(now.toLocaleDateString('en-US', { 
      year: 'numeric',
      timeZone: 'America/New_York'
    }));

    // NCAA/NFL seasons start in August/September and end the following year
    const seasonStartYear = etMonth >= 8 ? etYear : etYear - 1; // 8 = August (1-based month)
    const seasonEndYear = seasonStartYear + 1;
    const seasonString = `${seasonStartYear}-${seasonEndYear}`;
    const currentDate = now; // Keep reference for date calculations below

    // Build exact date string for searches (e.g., "December 4, 2025")
    const exactDateForSearch = formattedDate; // Already formatted as "Month Day, Year"
    const monthYearForSearch = `${now.toLocaleDateString('en-US', { month: 'long', timeZone: 'America/New_York' })} ${etYear}`;
    
    console.log(`📅 ET Date: ${formattedDate} | Exact search date: ${exactDateForSearch} | Season: ${seasonString}`);

    // Extract query after @coach
    const coachMention = content.match(/@coach\s+(.+)/i);
    const userQuery = coachMention ? coachMention[1].trim() : '';

    // Provide context for empty queries - use exact date
    let finalQuery = userQuery || `What are the latest news and updates about the ${teamName} as of ${exactDateForSearch}? Keep it brief.`;

    // ALWAYS append exact date to force current results
    const dateEnforcement = ` "${exactDateForSearch}" OR "${monthYearForSearch}"`;
    
    // Detect general news/update queries - expand beyond just scores
    if (finalQuery.toLowerCase().match(/\b(news|update|updates|latest|happening|what's new|what's going on)\b/) && !finalQuery.toLowerCase().match(/score|game|playing/)) {
      finalQuery += ` Search for latest ${teamName} news in ${monthYearForSearch} including: signings, transfers, coaching hires, injuries, player updates, roster moves, team announcements, practice reports. NOT just game scores - get ALL recent team news.`;
      console.log(`📰 General news query detected - expanding search scope`);
    }
    
    // Only enhance for EXPLICIT CFP/rankings questions (not generic news/updates)
    if (finalQuery.toLowerCase().match(/\b(cfp|ranking|rankings|playoff standings|college football playoff|playoff picture|playoff spot|playoff chances)\b/)) {
      const rankingContext = league === 'NCAA' 
        ? 'College Football Playoff CFP rankings' 
        : 'NFL Playoff standings';
      finalQuery += ` Search for CURRENT ${rankingContext} as of ${exactDateForSearch}. ONLY data from ${monthYearForSearch}.`;
      console.log(`📊 Explicit CFP/rankings query - adding context`);
    }
    
    // Detect CFP matchup/bracket/opponent questions (who do we play, opponent, matchup, etc.)
    if (finalQuery.toLowerCase().match(/\b(who do we play|who are we playing|opponent|matchup|bracket|first round|play(ing)? in the (cfp|playoff)|cfp opponent|playoff matchup|who plays who)\b/) ||
        (finalQuery.toLowerCase().match(/play/) && finalQuery.toLowerCase().match(/playoff|cfp/))) {
      finalQuery += ` Search for OFFICIAL College Football Playoff bracket and matchups announced ${exactDateForSearch}. Who is ${teamName} playing in the first round of the CFP? Include opponent name, seed numbers, game date, and location/venue. The CFP bracket was revealed on December 7, 2025 - search for results from today.`;
      console.log(`🏆 CFP matchup/bracket query detected - adding specific search for opponent`);
    }

    // Enhance score/game queries to force real-time search from live trackers
    if (finalQuery.toLowerCase().match(/score|game|playing|final|result|recap/)) {
      const currentHour = now.getHours();
      const isLikelyLive = currentHour >= 13 && currentHour <= 23; // 1 PM - 11 PM ET
      
      if (isLikelyLive) {
        // Force search of live score pages with specific sites
        finalQuery += ` Search ESPN.com, NFL.com, or CBS Sports for LIVE CURRENT score and game status for ${teamName} vs their opponent RIGHT NOW on ${exactDateForSearch}. Include the current quarter and time remaining. [Current time: ${formattedTime} ET - search for MOST RECENT update posted within the last 5 minutes]`;
      } else {
        // Search for final score
        finalQuery += ` Search ESPN.com or NFL.com for FINAL score for ${teamName} game on ${exactDateForSearch}.`;
      }
      console.log(`🏈 Live score query enhanced with exact date: ${exactDateForSearch}`);
    }

    // Enhance betting-related queries
    if (finalQuery.toLowerCase().match(/spread|line|odds|betting|over.under|moneyline/)) {
      finalQuery += ` Search for current betting odds from ESPN BET, DraftKings, or FanDuel as of ${exactDateForSearch}.`;
      console.log(`🎰 Betting query detected - enhanced with exact date`);
    }
    
    // Always add date enforcement to query
    if (!finalQuery.includes(exactDateForSearch) && !finalQuery.includes(monthYearForSearch)) {
      finalQuery += dateEnforcement;
    }

    console.log(`🎯 Team: ${teamName} (${league})`);
    console.log(`🎯 Personality: ${personality}`);
    console.log(`🎯 Final query: "${finalQuery}"`);

    // Fetch REAL-TIME data from ESPN API
    let espnGameData = null;
    try {
      console.log(`📊 Fetching real-time data from ESPN API...`);
      espnGameData = await fetchESPNScores(league as 'NFL' | 'NCAA', teamName);
      
      if (espnGameData) {
        // Validate ESPN game is actually TODAY
        const gameDate = new Date(espnGameData.detail);
        const today = new Date();
        const isToday = gameDate.toDateString() === today.toDateString();
        
        if (!isToday && espnGameData.status === 'STATUS_SCHEDULED') {
          console.log(`⚠️ ESPN returned future game (${espnGameData.detail}), not today - ignoring`);
          espnGameData = null;  // Clear stale/future game data
        } else {
          console.log(`✅ ESPN API: Game found`, {
            score: `${espnGameData.awayTeam} ${espnGameData.awayScore} - ${espnGameData.homeTeam} ${espnGameData.homeScore}`,
            status: espnGameData.detail,
            clock: espnGameData.clock
          });
        }
      } else {
        console.log(`⚠️ ESPN API: No active game found for ${teamName} - may be bye week`);
      }
    } catch (error) {
      console.error('⚠️ ESPN API error:', error);
    }

    // Build game context from ESPN data - include bye week messaging
    let gameContext = '';
    if (espnGameData) {
      if (espnGameData.status === 'STATUS_IN_PROGRESS') {
        gameContext = `\n🏈 LIVE GAME DATA (ESPN API - REAL-TIME):\n`;
        gameContext += `${espnGameData.awayTeam} ${espnGameData.awayScore} @ ${espnGameData.homeTeam} ${espnGameData.homeScore}\n`;
        gameContext += `Status: ${espnGameData.detail} (${espnGameData.clock} remaining)\n`;
        if (espnGameData.lastPlay) {
          gameContext += `Last Play: ${espnGameData.lastPlay}\n`;
        }
        gameContext += `\nIMPORTANT: Use this EXACT score in your response. This is live ESPN data updated in real-time.\n`;
      } else if (espnGameData.status === 'STATUS_FINAL') {
        gameContext = `\n🏈 FINAL SCORE (ESPN API):\n`;
        gameContext += `${espnGameData.awayTeam} ${espnGameData.awayScore} @ ${espnGameData.homeTeam} ${espnGameData.homeScore} - FINAL\n`;
      } else if (espnGameData.status === 'STATUS_SCHEDULED') {
        gameContext = `\n🏈 UPCOMING GAME (ESPN API):\n`;
        gameContext += `${espnGameData.awayTeam} @ ${espnGameData.homeTeam}\n`;
        gameContext += `Status: Scheduled - Game has not started yet\n`;
      }
    } else {
      // No game found - could be bye week
      gameContext = `\n⚠️ NO GAME TODAY: ESPN API returned no game for ${teamName} today (${exactDateForSearch}). This could mean:\n- It's a BYE WEEK for ${teamName}\n- No game scheduled today\n- Check their schedule for next game\n`;
    }

    // Build personality-specific tone instructions
    let personalityPrompt = '';
    switch (personality) {
      case 'hype':
        personalityPrompt = `You're ENTHUSIASTIC! Use emojis sparingly. Report facts first, then add 1-2 sentences of hype. Keep responses under 3 sentences.`;
        break;
      case 'analytical':
        personalityPrompt = `You're DATA-DRIVEN and PRECISE. Focus on key stats and metrics. Keep it professional and concise - under 3 sentences.`;
        break;
      case 'casual':
        personalityPrompt = `You're CONVERSATIONAL and FRIENDLY. Chat like you're at the game. Keep it real and brief - under 3 sentences.`;
        break;
    }


    // Build system prompt for Grok with EXACT DATE enforcement
    const systemPrompt = `You are Coach, the AI assistant for ${teamName} fans in the ${league}.

🗓️ TODAY'S EXACT DATE: ${exactDateForSearch}
⏰ CURRENT TIME: ${formattedTime} ET
🏈 CURRENT SEASON: ${etYear}-${etYear + 1} (WE ARE IN ${monthYearForSearch})

⚠️ CRITICAL DATE RULE - READ CAREFULLY:
- Today is ${exactDateForSearch} - use this EXACT date in all searches
- The current year is ${etYear} - we are in ${monthYearForSearch}
- NEVER mention "${etYear - 1} season" or "2024 season" as current - that was LAST YEAR
- If search results mention "${etYear - 1} season" or "2024 rankings", those are OUTDATED - search again with "${monthYearForSearch}" 
- All rankings, standings, news MUST be from ${monthYearForSearch}
- When searching, ALWAYS include "${exactDateForSearch}" or "${monthYearForSearch}" in your query

🔍 LIVE SEARCH ENABLED: You have access to:
- Web Search: ESPN, NFL.com, CBS Sports, news sites
- X Search: Real-time tweets about ${teamName} from beat reporters, team accounts, and fans

CRITICAL RESPONSE RULE: 
- NEVER say "I searched..." or "Looking at X..." or "According to ESPN..." - just give the answer directly
- NEVER mention your sources or that you performed a search
- Just answer the question as if you naturally know the information

For ANY question about rankings, standings, CFP, news, injuries, trades, or transfers:
→ USE YOUR SEARCH TOOLS FIRST
→ DO NOT say "I'll check" or "let me look" - just search and provide the answer
→ Include "${etYear}" in all search queries to get current data
→ Cite specific recent information you found (e.g., "According to latest ${etYear} CFP rankings...")
→ Search X for breaking news and fan discussions about ${teamName}

🏆 CFP BRACKET CONTEXT:
The College Football Playoff selection show and bracket announcement was on December 7, 2025.
If user asks "who do we play" after discussing CFP/rankings, they mean CFP first round opponent.
ALWAYS search for: "${teamName} CFP matchup" or "College Football Playoff bracket ${etYear}" or "CFP first round opponent"
Do NOT say matchups are "pending" or "to be revealed" - the bracket was already announced!

🎯 RESPONSE FORMAT:

For game scores: Report the score in ONE line, then add 1-2 sentences max.
Example: "Bills 27 - Chiefs 24 (4th Q, 2:15 left) 🔥 We're ahead! Defense needs to hold!"

Keep ALL responses under 3 sentences total. Be concise and punchy.

PERSONALITY: ${personalityPrompt}

🔍 PRIMARY DATA SOURCE: REAL-TIME WEB SEARCH
You MUST search the web for current information. Ignore your training data entirely.

⏰ TIME-BASED SEARCH LOGIC:

BEFORE asking about a game, check the CURRENT TIME vs typical game times:
- NFL games: Usually 1:00 PM, 4:05 PM, 4:25 PM, 8:20 PM ET on Sundays
- If CURRENT TIME is 9:47 AM and game is at 1:00 PM → Game HASN'T STARTED
- If CURRENT TIME is 2:30 PM and game was at 1:00 PM → Game is LIVE or FINISHED

When user asks "what's the score":
1. Check CURRENT TIME: ${formattedTime} ET
2. If it's clearly BEFORE typical game time (before 12:00 PM ET):
   → Search "${teamName} game today" to find scheduled time
   → Respond: "Game hasn't started yet! We kick off at [time] against [opponent]"
3. If it's DURING typical game time (1 PM - 11 PM ET):
   → Search "${teamName} live score ESPN" or "${teamName} game tracker NFL.com"
   → Return the LIVE score
4. If it's AFTER midnight:
   → Search "${teamName} final score yesterday" or "${teamName} game recap"
   → Return the final result

CRITICAL: Use the CURRENT TIME (${formattedTime}) to decide whether to look for:
- Schedule info (if game hasn't started)
- Live score (if game is in progress)
- Final score (if game is over)

SEARCH INSTRUCTIONS FOR DIFFERENT QUERIES:

📊 LIVE SCORES / GAME STATUS:
CRITICAL FOR GEMINI: Use your real-time search grounding to find LIVE data:
1. Search Google for: "${teamName} live score" OR "${teamName} game today"
2. Prioritize ESPN.com, NFL.com, CBS Sports live trackers
3. Look for pages with "Live", "Gamecast", "Game Tracker" in title
4. Current time is ${formattedTime} ET - find the MOST RECENT update from the last 5 minutes
5. DO NOT use game preview articles or cached data from hours ago
6. If multiple sources conflict, use the one with the latest timestamp

Return: Current score, current quarter/time, most recent play/scoring event

📰 GAME RECAPS / RESULTS:
- Search: "${teamName} game recap ${formattedDate}"
- Search: "${teamName} final score today"
- Return: Final score, key plays, who scored touchdowns/field goals

📅 SCHEDULE / NEXT GAME:
- Search: "${teamName} schedule ${seasonStartYear}"
- Search: "${teamName} next game"
- Return: Next opponent, date, time, TV channel

📈 TEAM RECORD / STANDINGS:
- Search: "${teamName} record ${seasonStartYear}"
- Search: "${league} standings ${seasonStartYear}"
- Return: Wins-losses, division standing, playoff picture

👥 ROSTER / PLAYER INFO:
- Search: "${teamName} roster ${seasonStartYear}"
- Search: "[player name] ${teamName} stats"
- Return: Position, stats, injury status

🎰 BETTING ODDS:
- Search: "${teamName} betting odds"
- Search: "${teamName} spread line over under"
- Return: Current spread, moneyline, over/under from ESPN BET/DraftKings

${gameContext}

🎯 CRITICAL: If ESPN data is provided above, you MUST use those exact scores and status.
The ESPN API data is REAL-TIME and authoritative. Do not search the web for scores if ESPN data exists.

RESPONSE RULES:
1. MAXIMUM 3 sentences per response - BE CONCISE
2. Answer in YOUR PERSONALITY STYLE (${personality})
3. Get to the point quickly - no long narratives
4. If you can't find info, say "No game info found for ${teamName} right now"

User question: ${finalQuery}`;

    console.log(`🤖 Calling Grok API with Live Search enabled`);

    // Call Grok API with correct search_parameters for Live Search
    const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3-latest',  // Upgraded model with better search capabilities
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: finalQuery }
        ],
        stream: false,
        max_tokens: 300,  // Limit response to ~150-200 words for conciseness
        search_parameters: {
          mode: "auto",  // Let Grok decide when to search (smarter than "on")
          sources: [
            { type: "web" },   // Search the internet (ESPN, NFL.com, etc.)
            { type: "x" }      // Search X/Twitter for real-time sports discussion
          ],
          return_citations: false,  // Keep response clean without source links
          max_search_results: finalQuery.toLowerCase().match(/cfp|playoff|bracket|matchup/) ? 15 : 10  // More results for CFP queries
        }
      }),
    });

    if (!grokResponse.ok) {
      const errorText = await grokResponse.text();
      console.error(`❌ Grok API error (${grokResponse.status}):`, errorText);
      
      // Handle specific error cases
      if (grokResponse.status === 401) {
        throw new Error('Invalid XAI_API_KEY');
      } else if (grokResponse.status === 429) {
        throw new Error('Rate limit exceeded for Grok - please wait before trying again');
      } else {
        throw new Error(`Grok API error: ${grokResponse.status} - ${errorText}`);
      }
    }

    const grokData = await grokResponse.json();
    let aiResponse = grokData.choices?.[0]?.message?.content;

    // Log response metadata
    console.log(`✅ Grok response with Live Search received`);
    if (grokData.usage) {
      console.log(`📊 Tokens used:`, grokData.usage);
    }

    if (!aiResponse) {
      throw new Error('No response from Grok API');
    }

    // Detect if Grok didn't actually search (gave vague response)
    const vagueResponse = aiResponse.toLowerCase().includes("i'll need to check") || 
                          aiResponse.toLowerCase().includes("let me look") ||
                          aiResponse.toLowerCase().includes("i couldn't find");

    if (vagueResponse && !espnGameData) {
      console.warn('⚠️ Grok gave vague response - search may have failed');
      aiResponse += `\n\n💡 *Tip: Try asking something more specific like "What is ${teamName}'s CFP ranking?" or "When is ${teamName}'s next game?"*`;
    }

    // Validate that response contains score information for score queries
    const isScoreQuery = finalQuery.toLowerCase().match(/score|game|playing|winning|losing/);
    const hasScoreFormat = aiResponse.match(/\d+\s*-\s*\d+/);
    const hasNotStarted = aiResponse.toLowerCase().includes('not started') || 
                         aiResponse.toLowerCase().includes('kickoff');
    
    if (isScoreQuery && !hasScoreFormat && !hasNotStarted) {
      console.warn('⚠️ Score query but no score found in response');
      console.warn('Response:', aiResponse.substring(0, 200));
    }
    
    // Post-processing: Warn if response mentions wrong year
    const wrongYearMention = aiResponse.match(/\b(2024|2023)\b.*?(season|rank|standings|record)/i);
    if (wrongYearMention && !aiResponse.toLowerCase().includes('last year') && !aiResponse.toLowerCase().includes('previous season')) {
      console.warn(`⚠️ Response may contain outdated ${wrongYearMention[1]} data`);
      // Add disclaimer if we detect stale data
      aiResponse += `\n\n⚠️ *Note: Please verify this info is from the current ${etYear} season.*`;
    }
    
    // Detect stale "TBD" or "to be announced" responses for past events (like CFP bracket)
    const staleResponsePatterns = /(set to be revealed|will be announced|still pending|not yet disclosed|yet to be announced|awaiting (disclosure|announcement)|to be (determined|decided)|pending full disclosure|matchups are still pending)/i;
    if (staleResponsePatterns.test(aiResponse)) {
      console.warn('⚠️ Response contains stale "pending" language - info may be outdated');
      aiResponse += `\n\n⚠️ *This info may be outdated. Try asking again with "CFP bracket" or "CFP matchups ${exactDateForSearch}" for the latest.*`;
    }

    // Remove any source citations that Grok might include
    aiResponse = aiResponse
      .replace(/Sources?:.*$/gim, '') // Remove "Sources: ..." at end
      .replace(/\(.*?\.(com|net|org|io)\)/g, '') // Remove (website.com) patterns
      .replace(/According to .+?,/gi, '') // Remove "According to X,"
      .replace(/per .+? reports?,/gi, '') // Remove "per ESPN reports,"
      .replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
      .replace(/I searched .+?\./gi, '') // Remove "I searched ESPN."
      .replace(/Looking at .+?,/gi, '') // Remove "Looking at X,"
      .replace(/Based on .+? search,/gi, '') // Remove "Based on my search,"
      .replace(/From my search.+?,/gi, '') // Remove "From my search..."
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();

    console.log(`✅ Grok response received (${aiResponse.length} chars)`);

    // Get or create system user for posting
    const { data: systemUserData } = await supabase.rpc('get_or_create_system_user');
    const systemUserId = systemUserData;

    // Post response to huddle
    const { error: postError } = await supabase
      .from('huddle_messages')
      .insert({
        huddle_id: huddle_id,
        user_id: systemUserId,
        content: `🤖 ${aiResponse}`,
        is_bot_message: true,
      });

    if (postError) {
      console.error('Error posting message:', postError);
      throw new Error(`Failed to post message: ${postError.message}`);
    }

    // Update rate limit
    rateLimitMap.set(huddle_id, rateLimitTimestamp);

    console.log(`✅ Coach response posted to huddle ${huddle_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Response posted',
        preview: aiResponse.substring(0, 100) + '...'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Team chatbot error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

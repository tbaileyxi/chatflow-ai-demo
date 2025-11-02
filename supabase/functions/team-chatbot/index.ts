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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
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

    // Get huddle and team info
    const { data: huddle } = await supabase
      .from('huddles')
      .select(`
        id,
        name,
        team:teams (
          id,
          name,
          league,
          highlightly_display_name
        )
      `)
      .eq('id', huddle_id)
      .single();

    if (!huddle || !huddle.team) {
      throw new Error('Huddle or team not found');
    }

    const teamName = huddle.team.highlightly_display_name || huddle.team.name;
    const league = huddle.team.league;
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

    console.log(`📅 ET Date: ${formattedDate} | Season: ${seasonString} (start year: ${seasonStartYear})`);

    // Extract query after @coach
    const coachMention = content.match(/@coach\s+(.+)/i);
    const userQuery = coachMention ? coachMention[1].trim() : '';

    // Provide context for empty queries
    let finalQuery = userQuery || `What are the latest news and updates about the ${teamName}? Keep it brief.`;

    // Enhance score/game queries to force real-time search from live trackers
    if (finalQuery.toLowerCase().match(/score|game|playing|final|result|recap/)) {
      const currentHour = now.getHours();
      const isLikelyLive = currentHour >= 13 && currentHour <= 23; // 1 PM - 11 PM ET
      
      if (isLikelyLive) {
        // Force search of live score pages with specific sites
        finalQuery += ` Search ESPN.com, NFL.com, or CBS Sports for LIVE CURRENT score and game status for ${teamName} vs their opponent RIGHT NOW on ${formattedDate}. Include the current quarter and time remaining. [Current time: ${formattedTime} ET - search for MOST RECENT update posted within the last 5 minutes]`;
      } else {
        // Search for final score
        finalQuery += ` Search ESPN.com or NFL.com for FINAL score for ${teamName} game on ${formattedDate}.`;
      }
      console.log(`🏈 Live score query enhanced with specific sites (likely live: ${isLikelyLive})`);
    }

    // Enhance betting-related queries
    if (finalQuery.toLowerCase().match(/spread|line|odds|betting|over.under|moneyline/)) {
      finalQuery += ` Search for current betting odds from ESPN BET, DraftKings, or FanDuel.`;
      console.log(`🎰 Betting query detected - enhanced for web search`);
    }

    console.log(`🎯 Team: ${teamName} (${league})`);
    console.log(`🎯 Personality: ${personality}`);
    console.log(`🎯 Final query: "${finalQuery}"`);

    // Query Highlightly for SUPPLEMENTAL data (odds, detailed stats)
    let liveGameContext = '';
    try {
      console.log(`📊 Attempting to fetch supplemental data from Highlightly...`);
      const highlightly = await createHighlightlyClient();
      
      const today = currentDate.toISOString().split('T')[0];
      const yesterday = new Date(currentDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const [todayGames, yesterdayGames] = await Promise.all([
        highlightly.getMatches({ team: teamName, league, date: today, limit: 5 }),
        highlightly.getMatches({ team: teamName, league, date: yesterdayStr, limit: 5 })
      ]);

      const recentGames = [
        ...(todayGames?.data || []),
        ...(yesterdayGames?.data || [])
      ].filter(Boolean);

      if (recentGames.length > 0) {
        console.log(`✅ Highlightly: Found ${recentGames.length} game(s) as backup data`);
        
        const liveGame = recentGames.find((g: any) => g.status === 'live');
        const recentGame = liveGame || recentGames[0];

        if (recentGame) {
          const homeTeam = recentGame.homeTeam?.name || 'Home';
          const awayTeam = recentGame.awayTeam?.name || 'Away';
          const homeScore = recentGame.homeTeam?.score || 0;
          const awayScore = recentGame.awayTeam?.score || 0;
          const status = recentGame.status || 'scheduled';
          const period = recentGame.period || '';

          liveGameContext = `\n📊 SUPPLEMENTAL DATA (Highlightly API):\n`;
          
          if (status === 'live') {
            liveGameContext += `${awayTeam} @ ${homeTeam} - LIVE ${period}\nScore: ${awayTeam} ${awayScore}, ${homeTeam} ${homeScore}\n`;
            liveGameContext += `Use as fallback if web search fails.`;
          } else if (status === 'finished') {
            liveGameContext += `${awayTeam} @ ${homeTeam} - FINAL\nScore: ${awayTeam} ${awayScore}, ${homeTeam} ${homeScore}\n`;
          }
        }
      } else {
        console.log(`⚠️ Highlightly: No games found (may be rate-limited)`);
      }
    } catch (error) {
      console.error('⚠️ Highlightly unavailable (not critical - using web search):', error);
      // Continue without Highlightly - Grok web search is primary
    }

    // Build personality-specific tone instructions
    let personalityPrompt = '';
    switch (personality) {
      case 'hype':
        personalityPrompt = `You're SUPER ENTHUSIASTIC and ENERGETIC! Use emojis, caps, and get fans PUMPED UP! 🔥🏈 BUT: Always report REAL scores and facts first, then add the hype. Never fabricate plays or scores.`;
        break;
      case 'analytical':
        personalityPrompt = `You're DATA-DRIVEN and PRECISE. Focus on statistics, numbers, performance metrics, and detailed analysis. Be professional and thorough. Always cite real stats.`;
        break;
      case 'casual':
        personalityPrompt = `You're CONVERSATIONAL and FRIENDLY. Talk like you're chatting with friends at a game. Keep it real, relaxed, and easy-going. Stick to the facts but keep it fun.`;
        break;
    }

    // Build system prompt for Grok
    const systemPrompt = `You are Coach, the AI assistant for ${teamName} fans in the ${league}.

🗓️ TODAY'S DATE: ${formattedDate}
⏰ CURRENT TIME: ${formattedTime} ET
🏈 CURRENT SEASON: ${seasonString}

🎯 CRITICAL INSTRUCTION: STRUCTURED DATA EXTRACTION

When the user asks about scores or game status, you MUST respond in this exact format:

**For live/finished games:**
\`\`\`
Current Score: [Away Team] [Score] - [Home Team] [Score]
Status: [Quarter/Period] ([Time Remaining] or FINAL)
Last Update: [Most recent play or scoring event]
[Then add 1-2 sentences in your personality style]
\`\`\`

**For scheduled games:**
\`\`\`
Game Status: Not started
Kickoff: [Time] ET vs [Opponent]
[Then add 1-2 sentences in your personality style]
\`\`\`

EXAMPLE (if ${teamName} trailing 10-20 in Q3):
"Current Score: ${teamName} 10 - 49ers 20
Status: 3rd Quarter (6:42 remaining)
Last Update: 49ers WR Jauan Jennings 11-yard TD
🤖 We're down but NOT out! 10 points is nothing - we've come back from worse! Defense needs to step up and our offense needs to capitalize. LET'S GO! 🔥"

DO NOT write long narratives without stating the score clearly first. The score MUST be in the first line.

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

${liveGameContext ? `${liveGameContext}\nUse this ONLY if web search fails or for additional context like odds.\n` : ''}

RESPONSE RULES:
1. Answer in YOUR PERSONALITY STYLE (${personality})
2. Keep answers conversational - NO raw stats dumps
3. If you can't find info, say "I couldn't find current game info for ${teamName} today"

User question: ${finalQuery}`;

    console.log(`🤖 Calling Lovable AI (Google Gemini 2.5 Flash) for real-time search`);

    // Call Lovable AI with Google Gemini 2.5 Flash
    const aiApiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'system', 
            content: `CRITICAL: Before responding, verify you are using REAL information from your web search with grounding, not fabricated scenarios. If the search shows ${teamName} losing 7-17, report that score exactly. Do not make up exciting plays that didn't happen. Use Google Search to find the MOST RECENT game data.` 
          },
          { role: 'user', content: finalQuery }
        ],
        temperature: 0.3,
        max_tokens: 300
        // Gemini 2.5 Flash has built-in real-time search grounding
      }),
    });

    if (!aiApiResponse.ok) {
      const errorText = await aiApiResponse.text();
      console.error(`❌ Lovable AI (Gemini) error (${aiApiResponse.status}):`, errorText);
      
      // Handle specific error cases
      if (aiApiResponse.status === 401) {
        throw new Error('Invalid LOVABLE_API_KEY');
      } else if (aiApiResponse.status === 429) {
        throw new Error('Rate limit exceeded for Lovable AI - please wait before trying again');
      } else if (aiApiResponse.status === 402) {
        throw new Error('Payment required - please add credits to your Lovable AI workspace');
      } else {
        throw new Error(`Lovable AI error: ${aiApiResponse.status} - ${errorText}`);
      }
    }

    const geminiData = await aiApiResponse.json();
    let aiResponse = geminiData.choices?.[0]?.message?.content;

    // Log response metadata
    console.log(`✅ Gemini 2.5 Flash response received`);
    if (geminiData.usage) {
      console.log(`📊 Tokens used:`, geminiData.usage);
    }

    if (!aiResponse) {
      throw new Error('No response from Lovable AI (Gemini)');
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

    // Remove any source citations that Grok might include
    aiResponse = aiResponse
      .replace(/Sources?:.*$/i, '') // Remove "Sources: ..." at end
      .replace(/\(.*?\.(com|net|org|io)\)/g, '') // Remove (website.com) patterns
      .replace(/According to .+?,/gi, '') // Remove "According to X,"
      .replace(/per .+? reports?,/gi, '') // Remove "per ESPN reports,"
      .replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
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

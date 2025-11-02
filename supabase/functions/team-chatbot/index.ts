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
    const now = Date.now();
    if (now - lastResponse < RATE_LIMIT_MS) {
      console.log(`⏱️ Rate limit hit for huddle ${huddle_id}`);
      return new Response(JSON.stringify({ message: 'Rate limited' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const xaiApiKey = Deno.env.get('XAI_API_KEY');
    
    if (!xaiApiKey) {
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

    // Extract query after @coach
    const coachMention = content.match(/@coach\s+(.+)/i);
    const userQuery = coachMention ? coachMention[1].trim() : '';

    // Provide context for empty queries or enhance betting queries
    let finalQuery = userQuery || `What are the latest news and updates about the ${teamName}? Keep it brief.`;

    // Enhance betting-related queries
    if (finalQuery.toLowerCase().match(/spread|line|odds|betting|over.under|moneyline/)) {
      finalQuery += ` Search for current betting odds from ESPN BET, DraftKings, or FanDuel.`;
      console.log(`🎰 Betting query detected - enhanced prompt`);
    }

    console.log(`🎯 Team: ${teamName} (${league})`);
    console.log(`🎯 Personality: ${personality}`);
    console.log(`🎯 Final query: "${finalQuery}"`);

    // Build current date/time context - ALL IN EASTERN TIME
    const nowUTC = new Date();
    const etDateString = nowUTC.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const currentDate = new Date(etDateString); // Now represents ET, not UTC
    
    const formattedDate = currentDate.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      timeZone: 'America/New_York'
    });
    const formattedTime = currentDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      timeZone: 'America/New_York'
    });

    // Calculate current season based on ET date
    const currentMonth = currentDate.getMonth(); // 0-11 (0=Jan, 11=Dec)
    const currentYear = currentDate.getFullYear();

    // NCAA/NFL seasons start in August/September and end the following year
    // If we're in Jan-July, we're in the previous year's season (e.g., Jan 2026 = 2025-2026 season)
    // If we're in Aug-Dec, we're in the current year's season (e.g., Nov 2025 = 2025-2026 season)
    const seasonStartYear = currentMonth >= 7 ? currentYear : currentYear - 1; // 7 = August
    const seasonEndYear = seasonStartYear + 1;
    const seasonString = `${seasonStartYear}-${seasonEndYear}`;

    console.log(`📅 ET Date: ${formattedDate} | Season: ${seasonString} (start year: ${seasonStartYear})`);

    // Query Highlightly for recent game data using ET dates
    let liveGameContext = '';
    try {
      const highlightly = await createHighlightlyClient();
      
      // Get today/yesterday in ET, not UTC
      const today = currentDate.toISOString().split('T')[0]; // ET date
      const yesterday = new Date(currentDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0]; // ET date

      // Try to get recent games (today and yesterday)
      const [todayGames, yesterdayGames] = await Promise.all([
        highlightly.getMatches({ team: teamName, league, date: today, limit: 5 }),
        highlightly.getMatches({ team: teamName, league, date: yesterdayStr, limit: 5 })
      ]);

      const recentGames = [
        ...(todayGames?.data || []),
        ...(yesterdayGames?.data || [])
      ].filter(Boolean);

      if (recentGames.length > 0) {
        console.log(`🏈 Found ${recentGames.length} recent game(s) from Highlightly`);
        
        // Find live or most recent game
        const liveGame = recentGames.find((g: any) => g.status === 'live');
        const recentGame = liveGame || recentGames[0];

        if (recentGame) {
          const homeTeam = recentGame.homeTeam?.name || 'Home';
          const awayTeam = recentGame.awayTeam?.name || 'Away';
          const homeScore = recentGame.homeTeam?.score || 0;
          const awayScore = recentGame.awayTeam?.score || 0;
          const status = recentGame.status || 'scheduled';
          const period = recentGame.period || '';

          liveGameContext = `\n\n🏈 LIVE GAME DATA FROM HIGHLIGHTLY API:\n`;
          
          if (status === 'live') {
            liveGameContext += `${awayTeam} @ ${homeTeam} - LIVE ${period}\nScore: ${awayTeam} ${awayScore}, ${homeTeam} ${homeScore}\n`;
            liveGameContext += `This is FACTUAL real-time data. Use this if the user asks about today's game or current score.`;
          } else if (status === 'finished') {
            liveGameContext += `${awayTeam} @ ${homeTeam} - FINAL\nScore: ${awayTeam} ${awayScore}, ${homeTeam} ${homeScore}\n`;
            liveGameContext += `This is the most recent completed game. Use this if asked about the last game.`;
          } else {
            liveGameContext += `Upcoming: ${awayTeam} @ ${homeTeam}\nStatus: ${status}\n`;
          }

          console.log(`✅ Live game context added: ${status}`);
        }
      } else {
        console.log(`⚠️ No recent games found in Highlightly`);
      }
    } catch (error) {
      console.error('⚠️ Failed to fetch Highlightly data:', error);
      // Continue without game data - not critical
    }

    // Build personality-specific tone instructions
    let personalityPrompt = '';
    switch (personality) {
      case 'hype':
        personalityPrompt = `You're SUPER ENTHUSIASTIC and ENERGETIC! Use emojis, caps, and get fans PUMPED UP! 🔥🏈 But stay accurate with facts.`;
        break;
      case 'analytical':
        personalityPrompt = `You're DATA-DRIVEN and PRECISE. Focus on statistics, numbers, performance metrics, and detailed analysis. Be professional and thorough.`;
        break;
      case 'casual':
        personalityPrompt = `You're CONVERSATIONAL and FRIENDLY. Talk like you're chatting with friends at a game. Keep it real, relaxed, and easy-going.`;
        break;
    }

    // Build system prompt for Grok
    const systemPrompt = `You are Coach, the AI assistant for ${teamName} fans in the ${league}.

🗓️ TODAY'S DATE: ${formattedDate}
⏰ CURRENT TIME: ${formattedTime} ET
🏈 CURRENT SEASON: ${seasonString} (search for "${seasonStartYear}" or "${seasonEndYear}")
${liveGameContext}

PERSONALITY: ${personalityPrompt}

🔍 CRITICAL SEARCH REQUIREMENTS:
- You have real-time web search enabled - USE IT for all current sports data
- TODAY IS ${formattedDate} - we are in the ${seasonString} season
- Search for "${teamName} ${seasonStartYear} schedule" or "${teamName} schedule" for game questions
- Search for "${teamName} ${seasonStartYear} roster" for player questions  
- Search for "${teamName} game ${formattedDate}" or "${teamName} next game" for game info
- Search for "${seasonStartYear} ${league} ${teamName} record standings" for record questions
- For betting questions, search "${teamName} betting odds" (current games)
- ALWAYS prioritize most recent/current information
- If asked about "today's game" or "this week", search for current date context
- NEVER use training data - ONLY use web search results
- If you can't find current information, say "I couldn't find current game information"

📅 CONTEXT FOR YOU:
- If someone asks about "today" or "this week", they mean ${formattedDate}
- Recent games would be from the past few days/weeks
- Upcoming games are in the near future
- When searching, try both "${teamName}" and "${league} ${teamName}"

CRITICAL RESPONSE RULES:
1. Keep responses SHORT: 2-3 sentences maximum
2. Do NOT mention sources, citations, or where you found the info
3. Be conversational and direct - pretend you just know the facts
4. Use emojis sparingly (1-2 max)
5. Focus on the most important info only

${personality === 'hype' ? '⚡ Be enthusiastic but concise!' : ''}
${personality === 'analytical' ? '📊 Give key stats only.' : ''}
${personality === 'casual' ? '💬 Keep it chill and brief.' : ''}

User question: ${finalQuery}`;

    console.log(`🤖 Calling Grok API with model: grok-4-fast`);

    // Call Grok API
    const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${xaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-4-fast',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: finalQuery }
        ],
        temperature: 0.7,
        max_tokens: 300,
        search_parameters: {
          mode: 'auto',              // Automatically decides when to search
          return_citations: true     // Include sources in response
        }
      }),
    });

    if (!grokResponse.ok) {
      const errorText = await grokResponse.text();
      console.error(`❌ Grok API error (${grokResponse.status}):`, errorText);
      
      // Handle specific error cases
      if (grokResponse.status === 401) {
        throw new Error('Invalid XAI API key');
      } else if (grokResponse.status === 429) {
        throw new Error('Rate limit exceeded for Grok API');
      } else {
        throw new Error(`Grok API error: ${grokResponse.status} - ${errorText}`);
      }
    }

    const grokData = await grokResponse.json();
    let aiResponse = grokData.choices?.[0]?.message?.content;

    // Log if citations were returned (indicates search was used)
    if (grokData.citations && grokData.citations.length > 0) {
      console.log(`✅ Grok used web search. Citations: ${grokData.citations.length}`);
      console.log(`📚 Sources:`, grokData.citations.slice(0, 3).map((c: any) => c.url));
    } else {
      console.log(`⚠️ No citations returned - search may not have been triggered`);
    }

    if (!aiResponse) {
      throw new Error('No response from Grok API');
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
    rateLimitMap.set(huddle_id, now);

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

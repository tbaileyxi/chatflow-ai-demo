import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: Parse temporal queries like "last night", "yesterday", "last week"
function parseTemporalQuery(query: string): string {
  const queryLower = query.toLowerCase();
  const today = new Date();
  
  if (queryLower.includes('last night') || queryLower.includes('yesterday')) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  
  if (queryLower.includes('last week')) {
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    return lastWeek.toISOString().split('T')[0];
  }
  
  // Default to today
  return today.toISOString().split('T')[0];
}

// Highlightly API client
function createHighlightlyClient() {
  const apiKey = Deno.env.get("HIGHLIGHTLY_API_KEY");
  const baseUrl = "https://api.highlightly.net";

  return {
    async getTeamInfo(teamName: string) {
      const response = await fetch(`${baseUrl}/teams/${encodeURIComponent(teamName)}`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },
    
    async getMatches(params: { team?: string; league?: string; date?: string; season?: number; limit?: number }) {
      const url = new URL(`${baseUrl}/matches`);
      if (params.team) url.searchParams.append("team", params.team);
      if (params.league) url.searchParams.append("league", params.league);
      if (params.date) url.searchParams.append("date", params.date);
      if (params.season) url.searchParams.append("season", params.season.toString());
      if (params.limit) url.searchParams.append("limit", params.limit.toString());

      const response = await fetch(url.toString(), {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },

    async getTeamStats(teamName: string, season?: number) {
      const url = new URL(`${baseUrl}/teams/${encodeURIComponent(teamName)}/stats`);
      if (season) url.searchParams.append("season", season.toString());
      
      const response = await fetch(url.toString(), {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },

    async getInjuries(teamName: string) {
      const response = await fetch(`${baseUrl}/teams/${encodeURIComponent(teamName)}/injuries`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },

    async getMatchOdds(matchId: number) {
      const response = await fetch(`${baseUrl}/matches/${matchId}/odds`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },

    async getStandings(params: { league?: string; season?: number }) {
      const url = new URL(`${baseUrl}/standings`);
      if (params.league) url.searchParams.append("league", params.league);
      if (params.season) url.searchParams.append("season", params.season.toString());
      
      const response = await fetch(url.toString(), {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },

    async getLineups(matchId: number) {
      const response = await fetch(`${baseUrl}/matches/${matchId}/lineups`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },

    async getHighlights(params: { team?: string; match?: number; limit?: number }) {
      const url = new URL(`${baseUrl}/highlights`);
      if (params.team) url.searchParams.append("team", params.team);
      if (params.match) url.searchParams.append("match", params.match.toString());
      if (params.limit) url.searchParams.append("limit", params.limit.toString());
      
      const response = await fetch(url.toString(), {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },

    async getPlayerStats(params: { team?: string; player?: string; season?: number; league?: string }) {
      const url = new URL(`${baseUrl}/players/stats`);
      if (params.team) url.searchParams.append("team", params.team);
      if (params.player) url.searchParams.append("player", params.player);
      if (params.season) url.searchParams.append("season", params.season.toString());
      if (params.league) url.searchParams.append("league", params.league);
      
      const response = await fetch(url.toString(), {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },

    async getHeadToHead(team1: string, team2: string, league?: string) {
      const url = new URL(`${baseUrl}/head-to-head`);
      url.searchParams.append("team1", team1);
      url.searchParams.append("team2", team2);
      if (league) url.searchParams.append("league", league);
      
      const response = await fetch(url.toString(), {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },
  };
}

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
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if bot is enabled for this huddle
    const { data: settings } = await supabase
      .from('huddle_chatbot_settings')
      .select('is_enabled, personality, response_max_words')
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

    // Extract query after @coach
    const coachMention = content.match(/@coach\s+(.+)/i);
    const userQuery = coachMention ? coachMention[1].trim() : '';

    console.log(`🎯 Query: "${userQuery}"`);

    // Get recent messages for context
    const { data: recentMessages } = await supabase
      .from('huddle_messages')
      .select('content, created_at, profiles:user_id (display_name)')
      .eq('huddle_id', huddle_id)
      .order('created_at', { ascending: false })
      .limit(5);

    const conversationContext = recentMessages
      ?.reverse()
      .map(m => `${m.profiles?.display_name || 'User'}: ${m.content}`)
      .join('\n') || '';

    // Determine query intent and fetch relevant data
    const queryLower = userQuery.toLowerCase();
    let highlightlyData = '';
    const highlightly = createHighlightlyClient();

    try {
      if (queryLower.includes('score') || queryLower.includes('game') || queryLower.includes('live') || queryLower.includes('won') || queryLower.includes('win')) {
        const targetDate = parseTemporalQuery(userQuery);
        const matches = await highlightly.getMatches({ team: teamName, league: league, date: targetDate, limit: 1 });
        if (matches?.length > 0) {
          highlightlyData += `\nGAME DATA:\n${JSON.stringify(matches[0], null, 2)}`;
        }
      }

      if (queryLower.includes('stat') || queryLower.includes('season')) {
        const currentYear = new Date().getFullYear();
        const stats = await highlightly.getTeamStats(teamName, currentYear);
        if (stats) {
          highlightlyData += `\nSEASON STATS:\n${JSON.stringify(stats, null, 2)}`;
        }
      }

      if (queryLower.includes('injur') || queryLower.includes('hurt') || queryLower.includes('out')) {
        const injuries = await highlightly.getInjuries(teamName);
        if (injuries) {
          highlightlyData += `\nINJURY REPORT:\n${JSON.stringify(injuries, null, 2)}`;
        }
      }

      if (queryLower.includes('odd') || queryLower.includes('bet') || queryLower.includes('line') || queryLower.includes('spread')) {
        const today = new Date().toISOString().split('T')[0];
        const matches = await highlightly.getMatches({ team: teamName, league: league, date: today, limit: 1 });
        if (matches?.length > 0 && matches[0].id) {
          const odds = await highlightly.getMatchOdds(matches[0].id);
          if (odds) {
            highlightlyData += `\nBETTING ODDS:\n${JSON.stringify(odds, null, 2)}`;
          }
        }
      }

      if (queryLower.match(/\d{4}/) || queryLower.includes('history') || queryLower.includes('past')) {
        const yearMatch = userQuery.match(/\d{4}/);
        const season = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear() - 1;
        const matches = await highlightly.getMatches({ team: teamName, league: league, season, limit: 10 });
        if (matches?.length > 0) {
          highlightlyData += `\nHISTORICAL GAMES (${season}):\n${JSON.stringify(matches, null, 2)}`;
        }
      }

      // Highlights detection
      if (queryLower.includes('highlight') || queryLower.includes('recap') || queryLower.includes('video') || queryLower.includes('clip')) {
        const targetDate = parseTemporalQuery(userQuery);
        const matches = await highlightly.getMatches({ team: teamName, league: league, date: targetDate, limit: 1 });
        if (matches?.length > 0 && matches[0].id) {
          const highlights = await highlightly.getHighlights({ match: matches[0].id, limit: 5 });
          if (highlights) {
            highlightlyData += `\nHIGHLIGHTS:\n${JSON.stringify(highlights, null, 2)}`;
          }
        }
      }

      // Standings detection
      if (queryLower.includes('standing') || queryLower.includes('rank') || queryLower.includes('position') || queryLower.includes('place') || queryLower.includes('table')) {
        const currentYear = new Date().getFullYear();
        const standings = await highlightly.getStandings({ league: league, season: currentYear });
        if (standings) {
          highlightlyData += `\nSTANDINGS:\n${JSON.stringify(standings, null, 2)}`;
        }
      }

      // Lineups detection
      if (queryLower.includes('lineup') || queryLower.includes('starting') || queryLower.includes('roster') || queryLower.includes('who is playing')) {
        const targetDate = parseTemporalQuery(userQuery);
        const matches = await highlightly.getMatches({ team: teamName, league: league, date: targetDate, limit: 1 });
        if (matches?.length > 0 && matches[0].id) {
          const lineups = await highlightly.getLineups(matches[0].id);
          if (lineups) {
            highlightlyData += `\nLINEUPS:\n${JSON.stringify(lineups, null, 2)}`;
          }
        }
      }

      // Player stats detection
      if (queryLower.includes('player') || queryLower.match(/\b(quarterback|qb|running back|rb|receiver|wr|defense|linebacker|safety|cornerback)\b/)) {
        const currentYear = new Date().getFullYear();
        const playerStats = await highlightly.getPlayerStats({ team: teamName, season: currentYear, league: league });
        if (playerStats) {
          highlightlyData += `\nPLAYER STATS:\n${JSON.stringify(playerStats, null, 2)}`;
        }
      }

      // Head to head detection
      if (queryLower.includes('vs') || queryLower.includes('versus') || queryLower.includes('against')) {
        const opponentMatch = userQuery.match(/(?:vs|versus|against)\s+([A-Za-z\s]+)/i);
        if (opponentMatch) {
          const opponent = opponentMatch[1].trim();
          const h2h = await highlightly.getHeadToHead(teamName, opponent, league);
          if (h2h) {
            highlightlyData += `\nHEAD-TO-HEAD:\n${JSON.stringify(h2h, null, 2)}`;
          }
        }
      }
    } catch (error) {
      console.error('Highlightly API error:', error);
      
      // Distinguish network/egress errors from other issues
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('dns') || errorMessage.includes('network') || errorMessage.includes('lookup')) {
        highlightlyData += '\n[Live data temporarily unavailable - network issue. Operating on cached knowledge.]';
      } else {
        highlightlyData += '\n[Some data unavailable]';
      }
    }

    // Web search fallback if no Highlightly data found
    if (!highlightlyData || highlightlyData.trim() === '' || highlightlyData.includes('[Some data unavailable]')) {
      console.log('📡 No Highlightly data found, attempting web search fallback...');
      
      try {
        const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
        
        const searchResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { 
                role: 'system', 
                content: `You are a sports data researcher. Search the web for current information about: ${teamName} ${league} football. Focus on facts, stats, and recent news. Return structured data when possible.` 
              },
              { role: 'user', content: userQuery }
            ],
          }),
        });
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const webContent = searchData.choices?.[0]?.message?.content || '';
          if (webContent) {
            highlightlyData += `\n\nWEB SEARCH RESULTS:\n${webContent}`;
          }
        }
      } catch (searchError) {
        console.error('Web search fallback error:', searchError);
      }
    }

    // Build personality-based system prompt
    const personalityPrompts = {
      hype: `You are Coach, the ultimate hype machine for ${teamName}! You're energetic, passionate, and always pumping up the fans. Use lots of energy and enthusiasm!`,
      analytical: `You are Coach, a strategic analyst for ${teamName}. You focus on stats, trends, and tactical insights. Be precise and data-driven.`,
      casual: `You are Coach, the chill sideline buddy for ${teamName} fans. You're laid-back, friendly, and conversational. Keep it relaxed and fun.`
    };

    const systemPrompt = `${personalityPrompts[settings.personality as keyof typeof personalityPrompts] || personalityPrompts.hype}

**CRITICAL CONTEXT:**
- You are the dedicated coach for ${teamName} (${league})
- This is the ${huddle.name} huddle
- ALL questions should be interpreted as being about ${teamName} unless explicitly stated otherwise
- When users ask "who won last night?" they mean "${teamName}'s game last night"
- When users ask "our team", "we", or "us" they mean ${teamName}
- When users mention just a team name without context, assume they're asking about ${teamName} vs that team

**AVAILABLE DATA SOURCES:**
- Live scores and game results
- Team statistics and season data
- Injury reports
- Betting odds and spreads
- Video highlights and game recaps
- League standings and rankings
- Player statistics and performance
- Starting lineups and rosters
- Head-to-head history
- Web search for additional context

Current Context:
- Team: ${teamName} (${league})
- Huddle: ${huddle.name}
- Recent chat:
${conversationContext}

${highlightlyData ? `Available Data:\n${highlightlyData}` : ''}

User Query: "${userQuery}"

Rules:
1. Answer the question directly in the first sentence (be specific!)
2. Add 1 fun fact, stat, or insight if relevant
3. Keep it conversational and natural - NO forced questions at the end
4. Use team slang and emojis sparingly (🏈🔥💪)
5. If data is missing, say "Checking the wires—stand by!" and suggest follow-up
6. Stay under ${settings.response_max_words} words
7. If the query is off-topic or unclear, respond playfully: "Huddle alert! Hit me with a real question about ${teamName}. What's up?"
8. This is FOOTBALL ONLY - ${league} football. Never discuss other sports.

Keep it concise and engaging. Let's coach them up!`;

    // Call Lovable AI
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('🤖 Calling Lovable AI...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery || 'Hi coach!' }
        ],
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('RATE_LIMITED');
      }
      if (aiResponse.status === 402) {
        throw new Error('PAYMENT_REQUIRED');
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const botResponse = aiData.choices?.[0]?.message?.content || 'Coach is taking a timeout—try again in a sec! 🏈';

    console.log('✅ Generated response:', botResponse);

    // Get system user for posting
    const { data: systemUser } = await supabase.rpc('get_or_create_system_user');

    // Post response to huddle
    const { error: postError } = await supabase
      .from('huddle_messages')
      .insert({
        huddle_id: huddle_id,
        user_id: systemUser,
        content: `🤖 ${botResponse}`,
        is_bot_message: true,
        message_type: 'coach_response'
      });

    if (postError) {
      console.error('Error posting message:', postError);
      throw postError;
    }

    // Update rate limit
    rateLimitMap.set(huddle_id, now);

    console.log('✅ Coach response posted successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('team-chatbot error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage === 'RATE_LIMITED') {
      return new Response(
        JSON.stringify({ error: 'Coach is catching his breath—try again in a minute! 💪' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (errorMessage === 'PAYMENT_REQUIRED') {
      return new Response(
        JSON.stringify({ error: 'Coach needs a refill—contact support!' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'The stat sheet\'s smudged—give me a sec! 📊' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

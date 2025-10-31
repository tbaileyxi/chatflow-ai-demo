import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    console.log(`🎯 Team: ${teamName} (${league})`);
    console.log(`🎯 Personality: ${personality}`);
    console.log(`🎯 Query: "${userQuery}"`);

    // Build current date/time context
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    const formattedTime = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      timeZone: 'America/New_York'
    });

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

TODAY'S DATE: ${formattedDate}
CURRENT TIME: ${formattedTime} ET
CURRENT SEASON: 2025

PERSONALITY: ${personalityPrompt}

You have access to:
- Real-time X/Twitter sports updates and breaking news
- Live web search for current information
- Team rosters, schedules, scores, and stats

CRITICAL RULES:
1. ALWAYS use your real-time search to get CURRENT 2025 season data
2. When asked about games, check X/Twitter and web for TODAY's date (${formattedDate})
3. If you can't find current info, say so clearly - NEVER make up data
4. Keep responses concise (2-4 paragraphs max)
5. Use team emojis and match the personality tone
6. Focus on FACTS from credible sources, not speculation
7. For roster questions, search for "2025 ${teamName} ${league} starting lineup roster"
8. For schedule questions, search for "2025 ${teamName} ${league} schedule upcoming game"
9. Always mention sources when providing stats or breaking news

Example searches you should use:
- "2025 ${teamName} starting quarterback"
- "2025 ${teamName} next game schedule"
- "${teamName} game today ${formattedDate}"
- "2025 ${teamName} standings record"

Current user question about ${teamName}: ${userQuery}`;

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
          { role: 'user', content: userQuery }
        ],
        temperature: 0.7,
        max_tokens: 500,
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
    const aiResponse = grokData.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response from Grok API');
    }

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

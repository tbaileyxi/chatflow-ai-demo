import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PulseItem {
  huddle_id: string;
  content: string;
  media_url?: string;
  message_type: 'pulse';
  pulse_source: 'youtube' | 'grok' | 'reddit';
  embed_code?: string;
  is_pulse_moment: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const queriesUsed: string[] = [];
  let hasYoutubeKey = false;
  let hasXaiKey = false;

  try {
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
    const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    hasYoutubeKey = !!YOUTUBE_API_KEY;
    hasXaiKey = !!XAI_API_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get request body with enhanced payload
    const { 
      huddle_id, 
      event_id,
      team1_name, 
      team2_name,
      event_name,
      league,
      search_query,
      is_live 
    } = await req.json();
    
    if (!huddle_id) {
      throw new Error('Missing huddle_id');
    }

    console.log('Pulse drop received:', { huddle_id, event_id, team1_name, team2_name, event_name, league, search_query, is_live });

    // Get system user for posting
    const { data: systemUser } = await supabase.rpc('get_or_create_system_user');
    if (!systemUser) {
      throw new Error('Could not get system user');
    }

    const pulseItems: PulseItem[] = [];

    // Build search queries in priority order
    const searchQueries: string[] = [];
    
    if (search_query) {
      searchQueries.push(search_query);
    }
    if (team1_name && team2_name) {
      searchQueries.push(`${team1_name} vs ${team2_name} highlights ${league || 'football'} live`);
    }
    if (event_name) {
      searchQueries.push(`${event_name} highlights`);
    }
    if (team1_name) {
      searchQueries.push(`${team1_name} highlights`);
    }
    if (team2_name) {
      searchQueries.push(`${team2_name} highlights`);
    }

    // 1. Fetch YouTube highlights
    if (YOUTUBE_API_KEY && searchQueries.length > 0) {
      try {
        // Use the first (best) query
        const primaryQuery = searchQueries[0];
        queriesUsed.push(primaryQuery);
        
        const searchQueryEncoded = encodeURIComponent(primaryQuery);
        const maxResults = is_live ? 5 : 3;
        
        console.log(`YouTube search: "${primaryQuery}" (maxResults: ${maxResults})`);
        
        const ytResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQueryEncoded}&type=video&order=date&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`
        );
        
        if (ytResponse.ok) {
          const ytData = await ytResponse.json();
          console.log(`YouTube returned ${ytData.items?.length || 0} videos`);
          
          for (const item of ytData.items || []) {
            const videoId = item.id.videoId;
            const title = item.snippet.title;
            const description = item.snippet.description?.slice(0, 100) || '';
            
            // Check if we already posted this video
            const { data: existing } = await supabase
              .from('huddle_messages')
              .select('id')
              .eq('huddle_id', huddle_id)
              .eq('embed_code', `youtube:${videoId}`)
              .limit(1);
            
            if (!existing || existing.length === 0) {
              pulseItems.push({
                huddle_id,
                content: `${title}\n${description}`,
                media_url: `https://www.youtube.com/watch?v=${videoId}`,
                message_type: 'pulse',
                pulse_source: 'youtube',
                embed_code: `youtube:${videoId}`,
                is_pulse_moment: true
              });
            }
          }
        } else {
          console.error('YouTube API error:', ytResponse.status, await ytResponse.text());
        }
      } catch (ytError) {
        console.error('YouTube API error:', ytError);
      }
    } else if (!YOUTUBE_API_KEY) {
      console.warn('YOUTUBE_API_KEY not set - skipping YouTube fetch');
    }

    // 2. Fetch trending content via Grok
    if (XAI_API_KEY && (team1_name || team2_name)) {
      try {
        const teamContext = team1_name && team2_name 
          ? `${team1_name} vs ${team2_name}` 
          : team1_name || team2_name;
        
        const grokQuery = `What's trending right now about ${teamContext}? Focus on breaking news, injury updates, or game highlights from the last few hours.`;
        queriesUsed.push(`Grok: ${teamContext}`);
        
        console.log(`Grok query: "${grokQuery}"`);
        
        const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${XAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'grok-3-latest',
            messages: [
              {
                role: 'system',
                content: `You are a sports news aggregator. Return ONLY a JSON array of 2-3 trending news items about the team/game. Each item should have: { "headline": "string", "body": "string (1-2 sentences)", "source_url": "optional url" }. No markdown, no explanation, just the JSON array.`
              },
              {
                role: 'user',
                content: grokQuery
              }
            ],
            temperature: 0.3
          })
        });

        if (grokResponse.ok) {
          const grokData = await grokResponse.json();
          const content = grokData.choices?.[0]?.message?.content;
          
          console.log('Grok raw response:', content?.slice(0, 200));
          
          if (content) {
            try {
              // Try to parse as JSON
              const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
              const items = JSON.parse(cleanedContent);
              
              console.log(`Grok returned ${items.length} items`);
              
              for (const item of items) {
                // Create unique identifier for deduplication
                const contentHash = btoa(item.headline.slice(0, 50)).replace(/[^a-zA-Z0-9]/g, '');
                
                // Check if we already posted this
                const { data: existing } = await supabase
                  .from('huddle_messages')
                  .select('id')
                  .eq('huddle_id', huddle_id)
                  .eq('embed_code', `grok:${contentHash}`)
                  .limit(1);
                
                if (!existing || existing.length === 0) {
                  pulseItems.push({
                    huddle_id,
                    content: `${item.headline}\n${item.body || ''}`,
                    message_type: 'pulse',
                    pulse_source: 'grok',
                    embed_code: `grok:${contentHash}`,
                    is_pulse_moment: true
                  });
                }
              }
            } catch (parseError) {
              console.error('Error parsing Grok response:', parseError);
            }
          }
        } else {
          console.error('Grok API error:', grokResponse.status, await grokResponse.text());
        }
      } catch (grokError) {
        console.error('Grok API error:', grokError);
      }
    } else if (!XAI_API_KEY) {
      console.warn('XAI_API_KEY not set - skipping Grok fetch');
    }

    // 3. Insert pulse items into huddle_messages
    let insertedCount = 0;
    for (const item of pulseItems) {
      const { error } = await supabase
        .from('huddle_messages')
        .insert({
          ...item,
          user_id: systemUser,
          is_bot_message: true
        });
      
      if (!error) {
        insertedCount++;
      } else {
        console.error('Error inserting pulse item:', error);
      }
    }

    console.log(`Pulse drop complete: ${insertedCount}/${pulseItems.length} items for huddle ${huddle_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted: insertedCount,
        total_found: pulseItems.length,
        has_youtube_key: hasYoutubeKey,
        has_xai_key: hasXaiKey,
        queries_used: queriesUsed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Pulse drop error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        has_youtube_key: hasYoutubeKey,
        has_xai_key: hasXaiKey,
        queries_used: queriesUsed
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

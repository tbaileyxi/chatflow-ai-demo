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

  try {
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
    const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get request body
    const { huddle_id, team_id, team_name, is_live } = await req.json();
    
    if (!huddle_id || !team_id) {
      throw new Error('Missing huddle_id or team_id');
    }

    // Get system user for posting
    const { data: systemUser } = await supabase.rpc('get_or_create_system_user');
    if (!systemUser) {
      throw new Error('Could not get system user');
    }

    const pulseItems: PulseItem[] = [];

    // 1. Fetch YouTube highlights
    if (YOUTUBE_API_KEY) {
      try {
        const searchQuery = encodeURIComponent(`${team_name || ''} highlights`);
        const maxResults = is_live ? 3 : 1;
        
        const ytResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&order=date&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`
        );
        
        if (ytResponse.ok) {
          const ytData = await ytResponse.json();
          
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
        }
      } catch (ytError) {
        console.error('YouTube API error:', ytError);
      }
    }

    // 2. Fetch trending content via Grok
    if (XAI_API_KEY && team_name) {
      try {
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
                content: `You are a sports news aggregator. Return ONLY a JSON array of 2-3 trending news items about the team. Each item should have: { "headline": "string", "body": "string (1-2 sentences)", "source_url": "optional url" }. No markdown, no explanation, just the JSON array.`
              },
              {
                role: 'user',
                content: `What's trending right now about ${team_name}? Focus on breaking news, injury updates, or game highlights from the last few hours.`
              }
            ],
            temperature: 0.3
          })
        });

        if (grokResponse.ok) {
          const grokData = await grokResponse.json();
          const content = grokData.choices?.[0]?.message?.content;
          
          if (content) {
            try {
              // Try to parse as JSON
              const items = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
              
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
        }
      } catch (grokError) {
        console.error('Grok API error:', grokError);
      }
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

    console.log(`Pulse drop complete: ${insertedCount} items for huddle ${huddle_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted: insertedCount,
        total_found: pulseItems.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Pulse drop error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const XAI_BASE_URL = 'https://api.x.ai/v1';

// Priority order for Responses API with tools (only grok-4 family supported)
const MODEL_PRIORITY_WITH_TOOLS = [
  'grok-4-1-fast',
  'grok-4-0709',
  'grok-4',
];

function selectBestModelForTools(modelIds: string[]): string | null {
  for (const preferred of MODEL_PRIORITY_WITH_TOOLS) {
    const exact = modelIds.find(m => m.toLowerCase() === preferred.toLowerCase());
    if (exact) return exact;
  }
  for (const preferred of MODEL_PRIORITY_WITH_TOOLS) {
    const partial = modelIds.find(m => m.toLowerCase().includes(preferred.toLowerCase()));
    if (partial) return partial;
  }
  // Must use grok-4 family for tools
  const grok4Model = modelIds.find(id => id.toLowerCase().includes('grok-4'));
  if (grok4Model) return grok4Model;
  return null;
}

async function discoverModels(apiKey: string): Promise<{ models: string[]; chosenModel: string | null; error?: string }> {
  try {
    const response = await fetch(`${XAI_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { models: [], chosenModel: null, error: `Models API ${response.status}: ${errorText.slice(0, 500)}` };
    }

    const data = await response.json();
    let modelIds: string[] = [];
    if (Array.isArray(data)) {
      modelIds = data.map((m: any) => m.id || m.name).filter(Boolean);
    } else if (data.data && Array.isArray(data.data)) {
      modelIds = data.data.map((m: any) => m.id || m.name).filter(Boolean);
    }

    const chosenModel = selectBestModelForTools(modelIds);
    return { models: modelIds, chosenModel };
  } catch (e: any) {
    return { models: [], chosenModel: null, error: e.message };
  }
}

function generateStableHash(text: string): string {
  const combined = text.slice(0, 50);
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).slice(0, 16);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const result: Record<string, any> = {
    timestamp: new Date().toISOString(),
    inserted_buzz_count: 0,
    inserted_reddit_count: 0,
    model_used: null,
    errors: [],
    debug: {}
  };

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const XAI_API_KEY = Deno.env.get('XAI_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    if (!XAI_API_KEY) {
      result.errors.push('XAI_API_KEY not configured - buzz items will fail');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request - accept team_id, event_id, or huddle_id
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({
        error: 'Missing request body',
        usage: {
          team_id: 'UUID of team (optional)',
          event_id: 'UUID of event (optional)',
          huddle_id: 'UUID of huddle (optional)',
          search_query: 'Custom search query (optional)'
        },
        example: { team_id: 'some-uuid' }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { team_id, event_id, huddle_id, search_query } = body;

    // Find the huddle to post to
    let targetHuddleId = huddle_id;
    let teamName = 'sports team';

    if (team_id && !targetHuddleId) {
      // Get team name
      const { data: team } = await supabase.from('teams').select('name').eq('id', team_id).single();
      if (team) teamName = team.name;

      // Find huddle for this team
      const { data: huddle } = await supabase
        .from('huddles')
        .select('id')
        .eq('team_id', team_id)
        .limit(1)
        .single();
      
      if (huddle) targetHuddleId = huddle.id;
    }

    if (event_id && !targetHuddleId) {
      // Find huddle for this event
      const { data: huddle } = await supabase
        .from('huddles')
        .select('id')
        .eq('event_id', event_id)
        .limit(1)
        .single();
      
      if (huddle) targetHuddleId = huddle.id;

      // Get event name for search
      const { data: event } = await supabase.from('live_events').select('name').eq('id', event_id).single();
      if (event) teamName = event.name;
    }

    if (!targetHuddleId) {
      result.errors.push('Could not find a huddle for the given team_id, event_id, or huddle_id');
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    result.debug.target_huddle_id = targetHuddleId;
    result.debug.team_name = teamName;

    // Get system user for posting
    const { data: systemUser, error: systemUserError } = await supabase.rpc('get_or_create_system_user');
    if (!systemUser || systemUserError) {
      result.errors.push('Could not get system user: ' + (systemUserError?.message || 'unknown'));
      return new Response(JSON.stringify(result), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const query = search_query || `${teamName} latest news reactions`;
    result.debug.search_query = query;

    // ==================
    // 1. BUZZ from xAI
    // ==================
    if (XAI_API_KEY) {
      console.log('[pulse-test] Discovering xAI models...');
      const { models, chosenModel, error: modelError } = await discoverModels(XAI_API_KEY);
      
      if (modelError) {
        result.errors.push(`Model discovery failed: ${modelError}`);
      } else if (!chosenModel) {
        result.errors.push('No suitable model found');
      } else {
        result.model_used = chosenModel;
        result.debug.available_models = models;
        console.log('[pulse-test] Using model:', chosenModel);

        // Use Responses API with x_search tool
        const xaiPayload = {
          model: chosenModel,
          input: [
            {
              role: 'system',
              content: 'You are a sports buzz aggregator. Use x_search to find what people are saying. Return ONLY a JSON array of 3 items, each with: {"headline":"short title","summary":"1 sentence"}. No markdown, no extra text.'
            },
            {
              role: 'user',
              content: `Find 3 things being discussed right now about: ${query}`
            }
          ],
          tools: [{ type: 'x_search' }],
          temperature: 0.3
        };

        console.log('[pulse-test] Calling xAI Responses API...');
        
        try {
          const xResponse = await fetch(`${XAI_BASE_URL}/responses`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${XAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(xaiPayload),
          });

          if (!xResponse.ok) {
            const errorText = await xResponse.text();
            console.error('[pulse-test] xAI error:', xResponse.status, errorText.slice(0, 1000));
            result.errors.push(`xAI API error ${xResponse.status}: ${errorText.slice(0, 500)}`);
            result.debug.xai_error = errorText.slice(0, 1500);
            
            // Insert error item so it's visible in room
            await supabase.from('huddle_messages').insert({
              huddle_id: targetHuddleId,
              user_id: systemUser,
              is_bot_message: true,
              content: `⚠️ Buzz temporarily unavailable (xAI error: ${xResponse.status})`,
              message_type: 'coach_content',
              is_pulse_moment: true,
              pulse_source: 'grok',
              embed_code: `buzz_error:${Date.now()}`
            });
          } else {
            const xData = await xResponse.json();
            result.debug.xai_response_keys = Object.keys(xData);

            // Extract content from Responses API format
            let rawContent: string | undefined;
            if (Array.isArray(xData?.output)) {
              for (const outputItem of xData.output) {
                if (outputItem?.type === 'message' && Array.isArray(outputItem?.content)) {
                  for (const contentItem of outputItem.content) {
                    if (contentItem?.type === 'output_text' && typeof contentItem?.text === 'string') {
                      rawContent = contentItem.text;
                      break;
                    }
                  }
                }
                if (rawContent) break;
              }
            }
            if (!rawContent && typeof xData?.output_text === 'string') {
              rawContent = xData.output_text;
            }

            result.debug.raw_content_length = rawContent?.length || 0;
            console.log('[pulse-test] Raw content:', rawContent?.slice(0, 300));

            if (rawContent) {
              // Parse JSON array
              try {
                const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const start = cleaned.indexOf('[');
                const end = cleaned.lastIndexOf(']');
                const jsonStr = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
                const items = JSON.parse(jsonStr);

                if (Array.isArray(items)) {
                  for (const item of items.slice(0, 3)) {
                    const headline = item.headline || item.title || '';
                    const summary = item.summary || item.text || '';
                    const content = headline ? `📢 ${headline}${summary ? ': ' + summary : ''}` : summary;
                    
                    if (!content) continue;

                    const embedCode = `buzz:${generateStableHash(content)}`;
                    
                    const { error: insertError } = await supabase.from('huddle_messages').insert({
                      huddle_id: targetHuddleId,
                      user_id: systemUser,
                      is_bot_message: true,
                      content: content.slice(0, 280),
                      message_type: 'coach_content',
                      is_pulse_moment: true,
                      pulse_source: 'x',
                      embed_code: embedCode
                    });

                    if (!insertError) {
                      result.inserted_buzz_count++;
                    } else {
                      console.error('[pulse-test] Insert error:', insertError);
                    }
                  }
                }
              } catch (parseError: any) {
                result.errors.push(`JSON parse error: ${parseError.message}`);
                result.debug.parse_error_content = rawContent.slice(0, 300);
              }
            }
          }
        } catch (fetchError: any) {
          result.errors.push(`Network error: ${fetchError.message}`);
        }
      }
    }

    // ==================
    // 2. REDDIT backup
    // ==================
    if (result.inserted_buzz_count < 2) {
      try {
        console.log('[pulse-test] Fetching Reddit backup...');
        const redditQuery = encodeURIComponent(query);
        const redditResponse = await fetch(
          `https://www.reddit.com/search.json?q=${redditQuery}&sort=new&t=day&limit=3`,
          {
            headers: {
              'User-Agent': 'web:sidehuddle:v1.0 (by /u/sidehuddle_app)',
              'Accept': 'application/json'
            }
          }
        );

        if (redditResponse.ok) {
          const redditData = await redditResponse.json();
          const posts = redditData.data?.children || [];
          
          for (const post of posts.slice(0, 2)) {
            const title = post.data?.title || '';
            if (!title) continue;

            const embedCode = `reddit:${post.data.id}`;
            
            const { error: insertError } = await supabase.from('huddle_messages').insert({
              huddle_id: targetHuddleId,
              user_id: systemUser,
              is_bot_message: true,
              content: title.slice(0, 200),
              message_type: 'coach_content',
              is_pulse_moment: true,
              pulse_source: 'reddit',
              embed_code: embedCode
            });

            if (!insertError) {
              result.inserted_reddit_count++;
            }
          }
        } else {
          result.errors.push(`Reddit API error: ${redditResponse.status}`);
        }
      } catch (redditError: any) {
        result.errors.push(`Reddit error: ${redditError.message}`);
      }
    }

    console.log('[pulse-test] Complete:', {
      buzz: result.inserted_buzz_count,
      reddit: result.inserted_reddit_count,
      errors: result.errors.length
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[pulse-test] Fatal error:', error);
    result.errors.push(`Fatal: ${error.message}`);
    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

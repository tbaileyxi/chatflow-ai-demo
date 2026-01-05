import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const XAI_BASE_URL = 'https://api.x.ai/v1';

// Priority order for model selection
// For Responses API with tools (x_search), only grok-4 family is supported
const MODEL_PRIORITY_WITH_TOOLS = [
  'grok-4-1-fast',
  'grok-4-0709',
  'grok-4',
];

// For chat completions without tools
const MODEL_PRIORITY = [
  'grok-3.1-fast',
  'grok-3.1',
  'grok-3-fast',
  'grok-3',
];

interface PulseItem {
  huddle_id: string;
  content: string;
  media_url?: string;
  message_type: string;
  pulse_source: 'x' | 'reddit' | 'grok';
  embed_code: string;
  is_pulse_moment: boolean;
  origin_team_id?: string;
}

interface InsertedBySource {
  x: number;
  reddit: number;
  grok: number;
}

// Model selection with priority (for tools, prefer grok-4 family)
function selectBestModel(modelIds: string[], forTools: boolean = false): string | null {
  const priorityList = forTools ? MODEL_PRIORITY_WITH_TOOLS : MODEL_PRIORITY;
  
  for (const preferred of priorityList) {
    const exact = modelIds.find(m => m.toLowerCase() === preferred.toLowerCase());
    if (exact) return exact;
  }
  for (const preferred of priorityList) {
    const partial = modelIds.find(m => m.toLowerCase().includes(preferred.toLowerCase()));
    if (partial) return partial;
  }
  
  // For tools, must use grok-4 family
  if (forTools) {
    const grok4Model = modelIds.find(id => id.toLowerCase().includes('grok-4'));
    if (grok4Model) return grok4Model;
    return null; // Cannot use tools without grok-4
  }
  
  const grokModel = modelIds.find(id => id.toLowerCase().includes('grok'));
  if (grokModel) return grokModel;
  return modelIds.length > 0 ? modelIds[0] : null;
}

// In-memory cache for models
let cachedModels: { models: string[]; chosenModel: string | null; timestamp: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function discoverModels(apiKey: string, forTools: boolean = false): Promise<{ models: string[]; chosenModel: string | null; error?: string }> {
  // Check cache
  if (cachedModels && (Date.now() - cachedModels.timestamp) < CACHE_TTL_MS) {
    const chosenModel = selectBestModel(cachedModels.models, forTools);
    return { models: cachedModels.models, chosenModel };
  }

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
      console.error('[pulse-drop] Models API error:', response.status, errorText.slice(0, 1000));
      return { models: [], chosenModel: null, error: `Models API ${response.status}: ${errorText.slice(0, 500)}` };
    }

    const data = await response.json();
    let modelIds: string[] = [];
    if (Array.isArray(data)) {
      modelIds = data.map((m: any) => m.id || m.name).filter(Boolean);
    } else if (data.data && Array.isArray(data.data)) {
      modelIds = data.data.map((m: any) => m.id || m.name).filter(Boolean);
    }

    const chosenModel = selectBestModel(modelIds, forTools);
    cachedModels = { models: modelIds, chosenModel, timestamp: Date.now() };
    console.log('[pulse-drop] Discovered models:', modelIds.length, 'Chosen:', chosenModel, 'forTools:', forTools);
    return { models: modelIds, chosenModel };
  } catch (e: any) {
    console.error('[pulse-drop] Model discovery error:', e);
    return { models: [], chosenModel: null, error: e.message };
  }
}

// Detect if content is about a specific team
function detectTeamTarget(content: string, team1Name: string, team2Name: string, team1Id?: string, team2Id?: string): string | undefined {
  const contentLower = content.toLowerCase();
  const t1Lower = team1Name.toLowerCase();
  const t2Lower = team2Name.toLowerCase();
  
  const mentionsT1 = contentLower.includes(t1Lower) || contentLower.includes(t1Lower.split(' ').pop() || '');
  const mentionsT2 = contentLower.includes(t2Lower) || contentLower.includes(t2Lower.split(' ').pop() || '');
  
  if (mentionsT1 && !mentionsT2 && team1Id) return team1Id;
  if (mentionsT2 && !mentionsT1 && team2Id) return team2Id;
  
  return undefined;
}

// Generate stable hash for deduplication
function generateStableHash(text: string, mediaUrl?: string): string {
  const combined = `${text.slice(0, 50)}${mediaUrl || ''}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).slice(0, 16);
}

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// Truncate text to max chars
function truncateText(text: string, maxLength: number = 180): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function safeParseJsonArray(raw: string): unknown[] | null {
  const cleaned = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const queriesUsed: string[] = [];
  let hasXaiKey = false;
  let xaiModel: string | null = null;
  let xaiToolCallsTotal = 0;
  let xaiXSearchCalls = 0;
  let xaiWebSearchCalls = 0;
  let xaiDebug: Record<string, unknown> = {};
  const insertedBySource: InsertedBySource = { x: 0, reddit: 0, grok: 0 };

  try {
    const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    hasXaiKey = !!XAI_API_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { 
      huddle_id, 
      event_id,
      team1_name, 
      team2_name,
      team1_id,
      team2_id,
      event_name,
      league,
      queries,
      search_query,
      is_live,
      bypass_rate_limit
    } = await req.json();
    
    if (!huddle_id) {
      throw new Error('Missing huddle_id');
    }

    console.log('[pulse-drop] Received:', { huddle_id, event_id, team1_name, team2_name, is_live });

    // Rate limiting check (unless bypassed by admin)
    if (!bypass_rate_limit && event_id) {
      const { data: lastRun } = await supabase
        .from('pulse_runs')
        .select('ran_at')
        .eq('event_id', event_id)
        .order('ran_at', { ascending: false })
        .limit(1)
        .single();

      if (lastRun) {
        const lastRunTime = new Date(lastRun.ran_at).getTime();
        const now = Date.now();
        const threeMinutes = 3 * 60 * 1000;
        
        if (now - lastRunTime < threeMinutes) {
          console.log('[pulse-drop] Rate limited');
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Rate limited - wait 3 minutes between auto-runs',
              inserted: 0,
              inserted_by_source: insertedBySource,
              has_xai_key: hasXaiKey
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: dailyRuns } = await supabase
        .from('pulse_runs')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event_id)
        .gte('ran_at', today.toISOString());

      if ((dailyRuns || 0) >= 20) {
        console.log('[pulse-drop] Daily limit reached');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Daily limit reached (20 runs per event)',
            inserted: 0,
            inserted_by_source: insertedBySource,
            has_xai_key: hasXaiKey
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get system user for posting
    const { data: systemUser } = await supabase.rpc('get_or_create_system_user');
    if (!systemUser) {
      throw new Error('Could not get system user');
    }

    const pulseItems: PulseItem[] = [];

    // Build search query
    const searchQueries: string[] = queries || [];
    
    if (searchQueries.length === 0) {
      if (search_query) {
        searchQueries.push(search_query);
      }
      if (team1_name && team2_name) {
        searchQueries.push(`${team1_name} vs ${team2_name} ${event_name || ''} live`);
        searchQueries.push(`${team1_name} ${team2_name} highlights`);
      }
      if (event_name) {
        searchQueries.push(`${event_name} ${team1_name || ''} ${team2_name || ''}`);
      }
    }

    const primaryQuery = searchQueries[0] || `${team1_name || 'sports'} ${team2_name || 'game'}`;
    console.log('[pulse-drop] Primary query:', primaryQuery);

    // ============================================
    // 1. FETCH BUZZ via xAI (dynamic model selection)
    // ============================================
    if (XAI_API_KEY) {
      // Discover models dynamically - use forTools=true for Responses API with x_search
      const { models, chosenModel, error: modelError } = await discoverModels(XAI_API_KEY, true);
      
      if (modelError) {
        console.error('[pulse-drop] Model discovery failed:', modelError);
        xaiDebug = { model_error: modelError };
      } else if (!chosenModel) {
        console.error('[pulse-drop] No suitable model found');
        xaiDebug = { model_error: 'No suitable model', available_models: models };
      } else {
        xaiModel = chosenModel;
        console.log('[pulse-drop] Using model:', chosenModel);

        try {
          queriesUsed.push(`X: ${primaryQuery}`);

          // Use Responses API with x_search tool
          const xaiPayload = {
            model: chosenModel,
            input: [
              {
                role: 'system',
                content: 'You are a sports content aggregator. Use x_search to fetch recent/trending X posts for the query. Return ONLY a valid JSON array (no markdown, no prose). Each item must have exactly: {"text":"max 180 chars","media_url":null|"url"}. Return 6-10 items. Do NOT include author, url, created_at, or citations in the JSON.',
              },
              {
                role: 'user',
                content: `Pull the freshest X buzz (takes, memes, reactions) about: ${primaryQuery}`,
              },
            ],
            tools: [{ type: 'x_search' }],
            temperature: 0.3,
          };

          console.log('[pulse-drop] Calling xAI Responses API...');
          
          const xResponse = await fetch(`${XAI_BASE_URL}/responses`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${XAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(xaiPayload),
          });

          if (!xResponse.ok) {
            const errorText = await xResponse.text();
            console.error('[pulse-drop] xAI API error:', xResponse.status, errorText.slice(0, 1000));
            xaiDebug = { 
              error: xResponse.status, 
              error_text: errorText.slice(0, 1500),
              model_used: chosenModel 
            };

            // Insert error item if live room
            if (is_live) {
              await supabase.from('huddle_messages').insert({
                huddle_id,
                user_id: systemUser,
                is_bot_message: true,
                content: `⚠️ Buzz temporarily unavailable (xAI error: ${xResponse.status})`,
                message_type: 'coach_content',
                is_pulse_moment: true,
                pulse_source: 'grok',
                embed_code: `buzz_error:${Date.now()}`
              });
              insertedBySource.grok++;
            }
          } else {
            const xData = await xResponse.json();
            console.log('[pulse-drop] xAI response keys:', Object.keys(xData || {}));

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
            
            if (!rawContent && xData?.choices?.[0]?.message?.content) {
              rawContent = xData.choices[0].message.content;
            }

            const sourcesUsed = xData?.usage?.num_sources_used ?? 0;
            
            xaiDebug = {
              response_keys: xData && typeof xData === 'object' ? Object.keys(xData) : [],
              model: chosenModel,
              status: xData?.status ?? 'unknown',
              has_content: !!rawContent,
              content_length: rawContent?.length ?? 0,
              num_sources_used: sourcesUsed,
              usage: xData?.usage ?? null,
            };
            
            if (sourcesUsed > 0) {
              xaiXSearchCalls = 1;
              xaiToolCallsTotal = 1;
            }

            if (rawContent) {
              console.log('[pulse-drop] Raw content length:', rawContent.length);
              const items = safeParseJsonArray(rawContent);

              if (items) {
                console.log(`[pulse-drop] X returned ${items.length} items`);

                for (const item of items.slice(0, 10)) {
                  const text = truncateText(decodeHtmlEntities(String((item as any)?.text || '')), 180);
                  if (!text) continue;

                  const mediaUrl = (item as any)?.media_url ? String((item as any).media_url) : undefined;
                  const embedCode = `x:${generateStableHash(text, mediaUrl)}`;

                  const { data: existing } = await supabase
                    .from('huddle_messages')
                    .select('id')
                    .eq('huddle_id', huddle_id)
                    .eq('embed_code', embedCode)
                    .limit(1);

                  if (!existing || existing.length === 0) {
                    pulseItems.push({
                      huddle_id,
                      content: text,
                      media_url: mediaUrl,
                      message_type: 'coach_content',
                      pulse_source: 'x',
                      embed_code: embedCode,
                      is_pulse_moment: true,
                      origin_team_id: detectTeamTarget(text, team1_name || '', team2_name || '', team1_id, team2_id),
                    });
                  }
                }
              } else {
                console.error('[pulse-drop] JSON parse failed. First 400 chars:', rawContent.slice(0, 400));
                xaiDebug.parse_error = rawContent.slice(0, 400);
              }
            } else {
              console.error('[pulse-drop] No content in response');
              xaiDebug.no_content = true;
            }
          }
        } catch (xError: any) {
          console.error('[pulse-drop] xAI fetch error:', xError);
          xaiDebug = { fetch_error: xError.message, model_used: chosenModel };
        }
      }
    } else {
      console.log('[pulse-drop] XAI_API_KEY not configured');
      xaiDebug = { error: 'XAI_API_KEY not configured' };
    }

    // ============================================
    // 2. FETCH REDDIT CONTENT (backup source)
    // ============================================
    if (pulseItems.length < 4) {
      try {
        const redditQuery = encodeURIComponent(primaryQuery);
        queriesUsed.push(`Reddit: ${primaryQuery}`);
        
        console.log(`[pulse-drop] Reddit search: "${primaryQuery}"`);
        
        const redditResponse = await fetch(
          `https://www.reddit.com/search.json?q=${redditQuery}&sort=new&t=day&limit=5`,
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
          
          console.log(`[pulse-drop] Reddit returned ${posts.length} posts`);
          
          for (const post of posts.slice(0, 3)) {
            const p = post.data;
            const title = decodeHtmlEntities(p.title || '');
            if (!title) continue;
            
            const embedCode = `reddit:${p.id}`;
            
            const { data: existing } = await supabase
              .from('huddle_messages')
              .select('id')
              .eq('huddle_id', huddle_id)
              .eq('embed_code', embedCode)
              .limit(1);
            
            if (!existing || existing.length === 0) {
              let mediaUrl = undefined;
              if (p.post_hint === 'image' && p.url) {
                mediaUrl = p.url;
              } else if (p.preview?.images?.[0]?.source?.url) {
                mediaUrl = p.preview.images[0].source.url.replace(/&amp;/g, '&');
              }
              
              pulseItems.push({
                huddle_id,
                content: truncateText(title, 180),
                media_url: mediaUrl,
                message_type: 'coach_content',
                pulse_source: 'reddit',
                embed_code: embedCode,
                is_pulse_moment: true,
                origin_team_id: detectTeamTarget(title, team1_name || '', team2_name || '', team1_id, team2_id)
              });
            }
          }
        } else {
          console.error('[pulse-drop] Reddit API error:', redditResponse.status);
        }
      } catch (redditError) {
        console.error('[pulse-drop] Reddit error:', redditError);
      }
    }

    // ============================================
    // 3. INSERT AS @COACH MESSAGES
    // ============================================
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
        insertedBySource[item.pulse_source]++;
      } else {
        console.error('[pulse-drop] Insert error:', error);
      }
    }

    // ============================================
    // 4. FALLBACK: Post hype message if no content
    // ============================================
    if (pulseItems.length === 0 && is_live) {
      console.log('[pulse-drop] No external content - posting fallback');
      
      const fallbackMessage = event_name 
        ? `🔥 ${event_name} is LIVE! What are you seeing? Drop your takes!`
        : `🔥 Game is LIVE! What are you seeing? Drop your hot takes!`;
      
      await supabase.from('huddle_messages').insert({
        huddle_id,
        user_id: systemUser,
        is_bot_message: true,
        message_type: 'coach_content',
        content: fallbackMessage,
        is_pulse_moment: true,
        pulse_source: 'grok',
        embed_code: `fallback:${Date.now()}`
      });
      
      insertedCount = 1;
      insertedBySource.grok = 1;
    }

    // Log the run
    await supabase.from('pulse_runs').insert({
      huddle_id,
      event_id: event_id || null,
      source: bypass_rate_limit ? 'admin' : 'auto',
      items_inserted: insertedCount,
      items_found: pulseItems.length,
      queries_used: queriesUsed,
      xai_model: xaiModel,
      xai_tool_calls_total: xaiToolCallsTotal,
      xai_x_search_calls: xaiXSearchCalls,
      xai_web_search_calls: xaiWebSearchCalls,
      xai_has_key: hasXaiKey,
      xai_debug: xaiDebug,
    });

    console.log('[pulse-drop] Complete:', { 
      inserted: insertedCount, 
      by_source: insertedBySource,
      model: xaiModel 
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted: insertedCount,
        inserted_by_source: insertedBySource,
        has_xai_key: hasXaiKey,
        model_used: xaiModel,
        xai_debug: xaiDebug
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[pulse-drop] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        inserted: 0,
        inserted_by_source: insertedBySource,
        has_xai_key: hasXaiKey,
        xai_debug: xaiDebug
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

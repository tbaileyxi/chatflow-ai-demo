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

// Detect if content is about a specific team (for sponsorship)
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
    // Try extracting the first JSON array in the string
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
  const xaiModel = 'grok-4-1-fast';
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

    console.log('Pulse drop received:', { huddle_id, event_id, team1_name, team2_name, is_live });

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
          console.log('Rate limited - last run was less than 3 minutes ago');
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
        console.log('Rate limited - max 20 runs per day reached');
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
    console.log('Primary search query:', primaryQuery);

    // ============================================
    // 1. FETCH X CONTENT via xAI Agent Tools (server-side)
    // - Use grok-4-1-fast
    // - Enable built-in x_search (optionally web_search)
    // - No client-side tool loop, no fake tool ACKs
    // - Final output must be ONLY a JSON array:
    //   [{"text":"max 180 chars","media_url":null|"url"}]
    // ============================================
    if (XAI_API_KEY) {
      try {
        queriesUsed.push(`X: ${primaryQuery}`);
        console.log(`Calling xAI Agent Tools (server-side x_search) for: "${primaryQuery}"`);

        const input: any[] = [
          {
            role: 'system',
            content:
              'You are a sports content aggregator. Use x_search to fetch recent/trending X posts for the query. Return ONLY a valid JSON array (no markdown, no prose). Each item must have exactly: {"text":"max 180 chars","media_url":null|"url"}. Return 6-10 items. Do NOT include author, url, created_at, or citations in the JSON.',
          },
          {
            role: 'user',
            content: `Pull the freshest X buzz (takes, memes, reactions) about: ${primaryQuery}`,
          },
        ];

        // Built-in server-side tools (Agent Tools)
        const tools: any[] = [{ type: 'x_search' }];

        // NOTE: x_search is supported on the Responses API (Agent Tools), not legacy chat completions.
        const xResponse = await fetch('https://api.x.ai/v1/responses', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${XAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: xaiModel,
            input,
            tools,
            temperature: 0.3,
          }),
        });

        if (!xResponse.ok) {
          const errorText = await xResponse.text();
          console.error('xAI API error:', xResponse.status, errorText);
          xaiDebug = { error: xResponse.status, error_text: errorText.slice(0, 500) };
        } else {
          const xData = await xResponse.json();
          console.log('xAI raw response keys:', Object.keys(xData || {}));

          // Responses API structure: output[].content[].text (type="output_text")
          // Also check for legacy output_text and choices format
          let rawContent: string | undefined;
          
          // Try Responses API format first
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
          
          // Fallback to direct output_text
          if (!rawContent && typeof xData?.output_text === 'string') {
            rawContent = xData.output_text;
          }
          
          // Fallback to legacy chat completions format
          if (!rawContent && xData?.choices?.[0]?.message?.content) {
            rawContent = xData.choices[0].message.content;
          }

          // Count sources used from usage
          const sourcesUsed = xData?.usage?.num_sources_used ?? 0;
          
          // Best-effort: log whatever the API returns so we can prove tool usage
          xaiDebug = {
            response_keys: xData && typeof xData === 'object' ? Object.keys(xData) : [],
            model: xData?.model ?? xaiModel,
            status: xData?.status ?? 'unknown',
            has_content: !!rawContent,
            content_length: rawContent?.length ?? 0,
            num_sources_used: sourcesUsed,
            usage: xData?.usage ?? null,
            has_output_array: Array.isArray(xData?.output),
            output_types: Array.isArray(xData?.output) ? xData.output.map((o: any) => o?.type) : [],
          };
          
          // The Responses API executes x_search server-side automatically
          // We can infer tool usage from num_sources_used > 0
          if (sourcesUsed > 0) {
            xaiXSearchCalls = 1; // At least one x_search was executed
            xaiToolCallsTotal = 1;
          }

          if (rawContent) {
            console.log('xAI debug:', JSON.stringify(xaiDebug));
            const items = safeParseJsonArray(rawContent);

            if (items) {
              console.log(`X returned ${items.length} items`);

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
              console.error('xAI JSON parse failed. First 400 chars:', rawContent.slice(0, 400));
            }
          } else {
            console.error('xAI response missing message.content');
          }
        }
      } catch (xError) {
        console.error('xAI fetch error:', xError);
      }
    }

    // ============================================
    // 2. FETCH REDDIT CONTENT (backup source)
    // Keep it simple, prioritize X
    // ============================================
    if (pulseItems.length < 4) {
      try {
        const redditQuery = encodeURIComponent(primaryQuery);
        queriesUsed.push(`Reddit: ${primaryQuery}`);
        
        console.log(`Reddit search: "${primaryQuery}"`);
        
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
          
          console.log(`Reddit returned ${posts.length} posts`);
          
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
          console.error('Reddit API error:', redditResponse.status);
        }
      } catch (redditError) {
        console.error('Reddit API error:', redditError);
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
        console.error('Error inserting pulse item:', error);
      }
    }

    // ============================================
    // 4. FALLBACK: Post hype message if no content
    // ============================================
    if (pulseItems.length === 0 && is_live) {
      console.log('No external content found - posting fallback hype message');
      
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

    console.log(`Pulse drop complete: ${insertedCount}/${pulseItems.length} items`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertedCount,
        inserted_by_source: insertedBySource,
        total_found: pulseItems.length,
        has_xai_key: hasXaiKey,
        queries_used: queriesUsed,
        debug: {
          xai_model: xaiModel,
          xai_tool_calls_total: xaiToolCallsTotal,
          xai_x_search_calls: xaiXSearchCalls,
          xai_web_search_calls: xaiWebSearchCalls,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Pulse drop error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        inserted: 0,
        inserted_by_source: insertedBySource,
        has_xai_key: hasXaiKey,
        queries_used: queriesUsed
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

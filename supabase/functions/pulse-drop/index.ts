import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const XAI_BASE_URL = 'https://api.x.ai/v1';

// Priority order for Responses API with tools (grok-4 family)
const MODEL_PRIORITY_WITH_TOOLS = ['grok-4-1-fast', 'grok-4-0709', 'grok-4'];

interface InsertedBySource { x: number; reddit: number; grok: number }

function selectBestModel(modelIds: string[]): string | null {
  for (const preferred of MODEL_PRIORITY_WITH_TOOLS) {
    const found = modelIds.find(m => m.toLowerCase().includes(preferred.toLowerCase()));
    if (found) return found;
  }
  const grok4 = modelIds.find(id => id.toLowerCase().includes('grok-4'));
  return grok4 || null;
}

let cachedModels: { models: string[]; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

async function discoverModels(apiKey: string): Promise<{ models: string[]; chosenModel: string | null; error?: string }> {
  if (cachedModels && (Date.now() - cachedModels.timestamp) < CACHE_TTL) {
    return { models: cachedModels.models, chosenModel: selectBestModel(cachedModels.models) };
  }
  try {
    const res = await fetch(`${XAI_BASE_URL}/models`, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
    if (!res.ok) {
      const txt = await res.text();
      return { models: [], chosenModel: null, error: `${res.status}: ${txt.slice(0, 500)}` };
    }
    const data = await res.json();
    let ids: string[] = Array.isArray(data) ? data.map((m: any) => m.id) : (data.data || []).map((m: any) => m.id);
    cachedModels = { models: ids, timestamp: Date.now() };
    return { models: ids, chosenModel: selectBestModel(ids) };
  } catch (e: any) {
    return { models: [], chosenModel: null, error: e.message };
  }
}

function generateStableHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(text.length, 50); i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).slice(0, 16);
}

function truncate(text: string, max = 180): string {
  return text.length <= max ? text : text.slice(0, max - 3) + '...';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const insertedBySource: InsertedBySource = { x: 0, reddit: 0, grok: 0 };
  let xaiModel: string | null = null;
  const debug: Record<string, unknown> = {};

  try {
    const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase credentials');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: 'Missing body',
          example: { huddle_id: 'uuid', team_id: 'uuid', team_name: 'Bears', is_live: false }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let { huddle_id, team_id, team_name, is_live, event_id, debug: requestDebug } = body;

    if (!huddle_id) {
      console.error('[pulse-drop] Missing huddle_id in request');
      return new Response(JSON.stringify({ error: 'huddle_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[pulse-drop] Received:', { huddle_id, team_id, team_name, is_live, event_id });
    debug.huddle_id = huddle_id;
    debug.team_id = team_id;
    debug.is_live = is_live;

    // Resolve team name (prevents generic queries + cross-team content)
    let resolvedTeamName = typeof team_name === 'string' && team_name.trim() ? team_name.trim() : undefined;
    if (!resolvedTeamName && team_id) {
      const { data: teamRow } = await supabase
        .from('teams')
        .select('name')
        .eq('id', team_id)
        .maybeSingle();
      if (teamRow?.name) resolvedTeamName = teamRow.name;
    }
    debug.team_name = resolvedTeamName ?? null;

    // Get system user
    const { data: systemUser } = await supabase.rpc('get_or_create_system_user');
    if (!systemUser) throw new Error('Could not get system user');

    // Throttle pulse frequency per huddle
    // - live: frequent, to feel real-time
    // - non-live: at least hourly to keep feeds fresh
    const minIntervalMinutes = is_live ? 10 : 60;
    debug.min_interval_minutes = minIntervalMinutes;
    const { data: lastPulse } = await supabase
      .from('huddle_messages')
      .select('created_at')
      .eq('huddle_id', huddle_id)
      .eq('is_pulse_moment', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastPulse?.created_at) {
      const last = new Date(lastPulse.created_at).getTime();
      const now = Date.now();
      const elapsedMinutes = (now - last) / 60000;
      debug.elapsed_minutes_since_last_pulse = elapsedMinutes;

      if (elapsedMinutes < minIntervalMinutes) {
        return new Response(JSON.stringify({
          success: true,
          inserted: 0,
          skipped: true,
          reason: 'throttled',
          min_interval_minutes: minIntervalMinutes
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const searchQuery = resolvedTeamName ? `${resolvedTeamName} football` : 'sports game';
    debug.search_query = searchQuery;

    const samplePostIds: string[] = [];

    // ========== xAI Buzz ==========
    if (XAI_API_KEY) {
      const { models, chosenModel, error: modelErr } = await discoverModels(XAI_API_KEY);
      if (modelErr) {
        console.error('[pulse-drop] Model discovery failed:', modelErr);
        debug.xai_error = modelErr;
      } else if (!chosenModel) {
        console.error('[pulse-drop] No grok-4 model available');
        debug.xai_error = 'No grok-4 model';
      } else {
        xaiModel = chosenModel;
        debug.model_used = chosenModel;

        try {
          const xaiRes = await fetch(`${XAI_BASE_URL}/responses`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${XAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: chosenModel,
              input: [
                 { role: 'system', content: `You are a sports content aggregator. Use x_search to pull recent takes/memes/reactions.

CRITICAL: Only include items that are clearly about "${resolvedTeamName || searchQuery}". If it seems about a different team/player/topic, SKIP it.

Return ONLY a JSON array (no markdown). Each item: {"text":"max 180 chars","media_url":null|"url"}. Return up to 8 items.` },
                { role: 'user', content: `Find the freshest buzz about: ${searchQuery}` }
              ],
              tools: [{ type: 'x_search' }],
              temperature: 0.3,
            })
          });

          if (!xaiRes.ok) {
            const errTxt = await xaiRes.text();
            console.error('[pulse-drop] xAI error:', xaiRes.status, errTxt.slice(0, 1000));
            debug.xai_error = { status: xaiRes.status, details: errTxt.slice(0, 1500) };
            // Insert fallback if live
            if (is_live) {
              await supabase.from('huddle_messages').insert({
                huddle_id,
                user_id: systemUser,
                is_bot_message: true,
                content: `⚠️ Buzz temporarily unavailable (xAI error: ${xaiRes.status})`,
                message_type: 'pulse',
                is_pulse_moment: true,
                pulse_source: 'grok',
                embed_code: `buzz_error:${Date.now()}`
              });
              insertedBySource.grok++;
            }
          } else {
            const xData = await xaiRes.json();
            let rawContent: string | undefined;
            if (Array.isArray(xData?.output)) {
              for (const o of xData.output) {
                if (o?.type === 'message' && Array.isArray(o?.content)) {
                  for (const c of o.content) {
                    if (c?.type === 'output_text' && c?.text) { rawContent = c.text; break; }
                  }
                }
                if (rawContent) break;
              }
            }
            if (!rawContent && xData?.output_text) rawContent = xData.output_text;

            debug.raw_content_length = rawContent?.length || 0;
            if (rawContent) {
              try {
                const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const start = cleaned.indexOf('[');
                const end = cleaned.lastIndexOf(']');
                const jsonStr = (start !== -1 && end > start) ? cleaned.slice(start, end + 1) : cleaned;
                const items = JSON.parse(jsonStr);

                if (Array.isArray(items)) {
                  for (const item of items.slice(0, 8)) {
                    const text = truncate(String(item?.text || ''), 180);
                    if (!text) continue;
                    const embedCode = `x:${generateStableHash(text)}`;
                    const { data: existing } = await supabase.from('huddle_messages').select('id').eq('huddle_id', huddle_id).eq('embed_code', embedCode).limit(1);
                    if (!existing || existing.length === 0) {
                      const { data: inserted } = await supabase.from('huddle_messages').insert({
                        huddle_id,
                        user_id: systemUser,
                        is_bot_message: true,
                        content: text,
                        message_type: 'pulse',
                        is_pulse_moment: true,
                        pulse_source: 'x',
                        embed_code: embedCode,
                        media_url: item?.media_url || null
                      }).select('id').single();
                      if (inserted) { samplePostIds.push(inserted.id); insertedBySource.x++; }
                    }
                  }
                }
              } catch (parseErr: any) {
                console.error('[pulse-drop] JSON parse error:', parseErr);
                debug.parse_error = rawContent?.slice(0, 300);
              }
            }
          }
        } catch (fetchErr: any) {
          console.error('[pulse-drop] xAI fetch error:', fetchErr);
          debug.xai_fetch_error = fetchErr.message;
        }
      }
    } else {
      debug.xai_error = 'XAI_API_KEY not configured';
    }

    // ========== Reddit Backup ==========
    if (insertedBySource.x < 3) {
      try {
        const redditQuery = encodeURIComponent(searchQuery);
        const redditRes = await fetch(`https://www.reddit.com/search.json?q=${redditQuery}&sort=new&t=day&limit=5`, {
          headers: { 'User-Agent': 'web:sidehuddle:v1.0', Accept: 'application/json' }
        });
        if (redditRes.ok) {
          const redditData = await redditRes.json();
          const posts = redditData.data?.children || [];
          for (const post of posts.slice(0, 3)) {
            const title = truncate(String(post.data?.title || ''), 180);
            if (!title) continue;
            const embedCode = `reddit:${post.data.id}`;
            const { data: existing } = await supabase.from('huddle_messages').select('id').eq('huddle_id', huddle_id).eq('embed_code', embedCode).limit(1);
            if (!existing || existing.length === 0) {
              const { data: inserted } = await supabase.from('huddle_messages').insert({
                huddle_id,
                user_id: systemUser,
                is_bot_message: true,
                content: title,
                message_type: 'pulse',
                is_pulse_moment: true,
                pulse_source: 'reddit',
                embed_code: embedCode
              }).select('id').single();
              if (inserted) { samplePostIds.push(inserted.id); insertedBySource.reddit++; }
            }
          }
        }
      } catch (redditErr: any) {
        console.error('[pulse-drop] Reddit error:', redditErr);
      }
    }

    console.log('[pulse-drop] Complete:', { inserted: insertedBySource.x + insertedBySource.reddit + insertedBySource.grok, by_source: insertedBySource, model: xaiModel });

    const responsePayload: Record<string, unknown> = {
      success: true,
      inserted: insertedBySource.x + insertedBySource.reddit + insertedBySource.grok,
      inserted_by_source: insertedBySource,
      model_used: xaiModel,
    };

    if (requestDebug) {
      responsePayload.sample_post_ids = samplePostIds;
      responsePayload.debug = debug;
    }

    return new Response(JSON.stringify(responsePayload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[pulse-drop] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message, inserted_by_source: insertedBySource }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

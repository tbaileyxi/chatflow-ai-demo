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
  pulse_source: 'youtube' | 'grok' | 'reddit' | 'x';
  embed_code?: string;
  is_pulse_moment: boolean;
}

interface InsertedBySource {
  youtube: number;
  x: number;
  reddit: number;
  grok: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const queriesUsed: string[] = [];
  let hasYoutubeKey = false;
  let hasXaiKey = false;
  const insertedBySource: InsertedBySource = { youtube: 0, x: 0, reddit: 0, grok: 0 };

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
      queries,
      search_query,
      is_live,
      bypass_rate_limit
    } = await req.json();
    
    if (!huddle_id) {
      throw new Error('Missing huddle_id');
    }

    console.log('Pulse drop received:', { huddle_id, event_id, team1_name, team2_name, event_name, league, is_live });

    // Rate limiting check (unless bypassed by admin)
    if (!bypass_rate_limit && event_id) {
      // Check last run time
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
              has_youtube_key: hasYoutubeKey,
              has_xai_key: hasXaiKey
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Check daily run count
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
            has_youtube_key: hasYoutubeKey,
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

    // Build search queries in priority order (use provided queries or build our own)
    const searchQueries: string[] = queries || [];
    
    if (searchQueries.length === 0) {
      if (search_query) {
        searchQueries.push(search_query);
      }
      if (team1_name && team2_name) {
        searchQueries.push(`${team1_name} vs ${team2_name} ${event_name || ''} highlights ${league || 'football'} live`);
        searchQueries.push(`${team1_name} ${team2_name} ${event_name || ''} live`);
        searchQueries.push(`${team1_name} ${team2_name} big play OR touchdown OR interception OR highlight`);
      }
      if (event_name) {
        searchQueries.push(`${event_name} ${team1_name || ''} ${team2_name || ''} highlights`);
      }
      if (team1_name) {
        searchQueries.push(`${team1_name} highlights`);
      }
    }

    console.log('Search queries:', searchQueries);

    // 1. Fetch X content via xAI Live Search (lowest cost - X only)
    if (XAI_API_KEY && searchQueries.length > 0) {
      try {
        const xQuery = searchQueries[0];
        queriesUsed.push(`X: ${xQuery}`);
        
        console.log(`X search via xAI: "${xQuery}"`);
        
        const xResponse = await fetch('https://api.x.ai/v1/chat/completions', {
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
                content: `You are a sports content aggregator with access to X (Twitter) search. Search for the latest tweets about the query. Return ONLY a JSON array of 5-8 posts. Each item must have: { "headline": "the tweet text (max 100 chars)", "body": "full tweet if longer", "author": "username without @", "url": "tweet url if known or null", "media_url": "image url if any or null", "created_at": "ISO date string" }. No markdown, no explanation, just the JSON array.`
              },
              {
                role: 'user',
                content: `Search X/Twitter for: ${xQuery}`
              }
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "x_search",
                  description: "Search X/Twitter for recent posts",
                  parameters: {
                    type: "object",
                    properties: {
                      query: { type: "string", description: "Search query" }
                    },
                    required: ["query"]
                  }
                }
              }
            ],
            tool_choice: "auto",
            temperature: 0.2
          })
        });

        if (xResponse.ok) {
          const xData = await xResponse.json();
          const content = xData.choices?.[0]?.message?.content;
          
          console.log('X/xAI raw response:', content?.slice(0, 300));
          
          if (content) {
            try {
              const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
              const items = JSON.parse(cleanedContent);
              
              console.log(`X returned ${items.length} posts`);
              
              for (const item of items.slice(0, 5)) {
                const uniqueId = btoa(`${item.author || 'anon'}-${item.headline?.slice(0, 30) || ''}`).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
                
                // Check if we already posted this
                const { data: existing } = await supabase
                  .from('huddle_messages')
                  .select('id')
                  .eq('huddle_id', huddle_id)
                  .eq('embed_code', `x:${uniqueId}`)
                  .limit(1);
                
                if (!existing || existing.length === 0) {
                  pulseItems.push({
                    huddle_id,
                    content: `@${item.author || 'anon'}: ${item.headline}\n${item.body || ''}`.trim(),
                    media_url: item.media_url || item.url || undefined,
                    message_type: 'pulse',
                    pulse_source: 'x',
                    embed_code: `x:${uniqueId}`,
                    is_pulse_moment: true
                  });
                }
              }
            } catch (parseError) {
              console.error('Error parsing X response:', parseError);
            }
          }
        } else {
          console.error('X/xAI API error:', xResponse.status, await xResponse.text());
        }
      } catch (xError) {
        console.error('X API error:', xError);
      }
    }

    // 2. Fetch Reddit content
    if (searchQueries.length > 0) {
      try {
        const redditQuery = encodeURIComponent(searchQueries[0]);
        queriesUsed.push(`Reddit: ${searchQueries[0]}`);
        
        console.log(`Reddit search: "${searchQueries[0]}"`);
        
        const redditResponse = await fetch(
          `https://www.reddit.com/search.json?q=${redditQuery}&sort=new&t=day&limit=10`,
          {
            headers: {
              'User-Agent': 'SideHuddle/1.0'
            }
          }
        );

        if (redditResponse.ok) {
          const redditData = await redditResponse.json();
          const posts = redditData.data?.children || [];
          
          console.log(`Reddit returned ${posts.length} posts`);
          
          for (const post of posts.slice(0, 5)) {
            const p = post.data;
            const postId = p.id;
            
            // Check if we already posted this
            const { data: existing } = await supabase
              .from('huddle_messages')
              .select('id')
              .eq('huddle_id', huddle_id)
              .eq('embed_code', `reddit:${postId}`)
              .limit(1);
            
            if (!existing || existing.length === 0) {
              // Determine media URL (prefer images/videos)
              let mediaUrl = p.url;
              if (p.preview?.images?.[0]?.source?.url) {
                mediaUrl = p.preview.images[0].source.url.replace(/&amp;/g, '&');
              }
              
              pulseItems.push({
                huddle_id,
                content: `${p.title}\n${p.selftext?.slice(0, 100) || ''}`.trim(),
                media_url: mediaUrl,
                message_type: 'pulse',
                pulse_source: 'reddit',
                embed_code: `reddit:${postId}`,
                is_pulse_moment: true
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

    // 3. Fetch YouTube highlights (query ladder - stop once we have 3+ items)
    if (YOUTUBE_API_KEY && searchQueries.length > 0) {
      let ytInserted = 0;
      
      for (const query of searchQueries) {
        if (ytInserted >= 3) break;
        
        try {
          queriesUsed.push(`YT: ${query}`);
          
          const searchQueryEncoded = encodeURIComponent(query);
          const maxResults = is_live ? 5 : 3;
          
          console.log(`YouTube search: "${query}" (maxResults: ${maxResults})`);
          
          const ytResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQueryEncoded}&type=video&order=date&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`
          );
          
          if (ytResponse.ok) {
            const ytData = await ytResponse.json();
            console.log(`YouTube returned ${ytData.items?.length || 0} videos for query "${query}"`);
            
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
                ytInserted++;
              }
            }
          } else {
            console.error('YouTube API error:', ytResponse.status, await ytResponse.text());
          }
        } catch (ytError) {
          console.error('YouTube API error:', ytError);
        }
      }
    } else if (!YOUTUBE_API_KEY) {
      console.warn('YOUTUBE_API_KEY not set - skipping YouTube fetch');
    }

    // 4. Insert pulse items into huddle_messages
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

    // Log the run to pulse_runs
    await supabase.from('pulse_runs').insert({
      huddle_id,
      event_id: event_id || null,
      source: bypass_rate_limit ? 'admin' : 'auto',
      items_inserted: insertedCount,
      items_found: pulseItems.length,
      queries_used: queriesUsed
    });

    console.log(`Pulse drop complete: ${insertedCount}/${pulseItems.length} items for huddle ${huddle_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted: insertedCount,
        inserted_by_source: insertedBySource,
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
        inserted: 0,
        inserted_by_source: insertedBySource,
        has_youtube_key: hasYoutubeKey,
        has_xai_key: hasXaiKey,
        queries_used: queriesUsed
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

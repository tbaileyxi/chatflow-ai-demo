import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Extract list ID from X List URL
function extractListId(url: string): string | null {
  const patterns = [
    /\/i\/lists\/(\d+)/,
    /lists\/(\d+)/,
    /list_id=(\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Calculate engagement score with time decay
function calculateRankScore(metrics: any, createdAt: string): number {
  const likes = metrics.like_count || 0;
  const retweets = metrics.retweet_count || 0;
  const replies = metrics.reply_count || 0;
  const quotes = metrics.quote_count || 0;
  
  // Base score: weighted engagement
  const baseScore = likes + (retweets * 3) + (replies * 2) + (quotes * 2);
  
  // Time decay: newer posts get bonus
  const tweetTime = new Date(createdAt).getTime();
  const now = Date.now();
  const hoursOld = (now - tweetTime) / (1000 * 60 * 60);
  const timeFactor = Math.max(0.1, 1 - (hoursOld / 24)); // Decay over 24 hours
  
  return Math.round(baseScore * timeFactor);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const twitterBearerToken = Deno.env.get('TWITTER_BEARER_TOKEN');
    if (!twitterBearerToken) {
      throw new Error('Twitter Bearer Token not configured');
    }

    // Get active social sources
    const { data: sources, error: sourcesError } = await supabaseClient
      .from('social_sources')
      .select('*, teams(id, name)')
      .eq('is_active', true)
      .eq('source_type', 'x_list');

    if (sourcesError) {
      throw new Error(`Failed to fetch sources: ${sourcesError.message}`);
    }

    if (!sources || sources.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No active X List sources found',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalProcessed = 0;
    const results = [];

    for (const source of sources) {
      const listId = extractListId(source.source_url);
      if (!listId) {
        console.error(`Invalid X List URL: ${source.source_url}`);
        continue;
      }

      try {
        // Fetch tweets from X List
        const twitterUrl = `https://api.twitter.com/2/lists/${listId}/tweets?max_results=25&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=username`;
        
        const twitterResponse = await fetch(twitterUrl, {
          headers: {
            'Authorization': `Bearer ${twitterBearerToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!twitterResponse.ok) {
          console.error(`Twitter API Error for list ${listId}:`, await twitterResponse.text());
          continue;
        }

        const twitterData = await twitterResponse.json();
        
        if (!twitterData.data || twitterData.data.length === 0) {
          console.log(`No tweets found for list ${listId}`);
          continue;
        }

        // Create users map
        const usersMap = new Map();
        if (twitterData.includes?.users) {
          twitterData.includes.users.forEach((user: any) => {
            usersMap.set(user.id, user);
          });
        }

        // Process tweets
        const listResults = [];
        for (const tweet of twitterData.data) {
          const user = usersMap.get(tweet.author_id);
          
          // Phase A: Generate blockquote embed code for inline video playback
          const embedUrl = `<blockquote class="twitter-tweet"><a href="https://twitter.com/${user?.username || 'user'}/status/${tweet.id}"></a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`;
          
          const metrics = tweet.public_metrics || {};
          const rankScore = calculateRankScore(metrics, tweet.created_at);

          // Phase B: Detect media attachments
          const hasMedia = tweet.attachments?.media_keys?.length > 0;
          let mediaType = null;
          if (hasMedia && twitterData.includes?.media) {
            const media = twitterData.includes.media.find((m: any) => 
              tweet.attachments.media_keys.includes(m.media_key)
            );
            mediaType = media?.type || 'unknown'; // 'video', 'photo', 'animated_gif'
          }

          // Phase B: Call Grok AI for content analysis
          let grokAnalysis = null;
          let qualityScore = 30; // Default low score
          let topics: string[] = [];
          let highlightWorthy = false;
          let autoApprove = false;

          try {
            const grokResponse = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-x-content-grok`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
                },
                body: JSON.stringify({
                  tweetContent: tweet.text.replace(/https?:\/\/t\.co\/\w+/gi, '').trim(),
                  tweetUrl: `https://twitter.com/${user?.username}/status/${tweet.id}`,
                  authorUsername: user?.username || 'unknown',
                  hasMedia,
                  mediaType,
                  metrics: {
                    likes: metrics.like_count || 0,
                    retweets: metrics.retweet_count || 0,
                    replies: metrics.reply_count || 0
                  },
                  createdAt: tweet.created_at
                })
              }
            );

            if (grokResponse.ok) {
              grokAnalysis = await grokResponse.json();
              qualityScore = grokAnalysis.quality_score || 30;
              topics = grokAnalysis.topics || [];
              highlightWorthy = grokAnalysis.highlight_worthy || false;
              
              // Auto-approve high-quality content (70+)
              autoApprove = qualityScore >= 70;
              
              console.log(`[Tweet ${tweet.id}] Grok score: ${qualityScore}, highlight: ${highlightWorthy}, auto-approve: ${autoApprove}`);
            }
          } catch (grokError) {
            console.error(`[Tweet ${tweet.id}] Grok analysis failed:`, grokError);
          }

          // Phase B: Filter out low-quality content (<50)
          if (qualityScore < 50) {
            console.log(`[Tweet ${tweet.id}] Filtered out (quality ${qualityScore} < 50)`);
            continue; // Skip this tweet
          }

          // Strip t.co URLs from content since we're using embed codes
          const cleanContent = tweet.text.replace(/https?:\/\/t\.co\/\w+/gi, '').trim();

          const trendingData = {
            team_id: source.team_id,
            post_id: tweet.id,
            embed_url: embedUrl,
            content: cleanContent,
            author_username: user?.username || null,
            likes: metrics.like_count || 0,
            retweets: metrics.retweet_count || 0,
            replies: metrics.reply_count || 0,
            rank_score: rankScore,
            status: autoApprove ? 'approved' : 'pending',
            created_at: tweet.created_at || new Date().toISOString(),
            fetched_at: new Date().toISOString(),
            // Phase B: Grok metadata
            grok_analysis: grokAnalysis,
            quality_score: qualityScore,
            has_media: hasMedia,
            media_type: mediaType,
            topics,
            highlight_worthy: highlightWorthy
          };

          // Insert with upsert to avoid duplicates
          const { data, error } = await supabaseClient
            .from('team_trending')
            .upsert(trendingData, { 
              onConflict: 'post_id,team_id',
              ignoreDuplicates: false 
            })
            .select();

          if (error) {
            console.error(`Database error for tweet ${tweet.id}:`, error);
          } else {
            listResults.push(data);
            totalProcessed++;
          }
        }

        results.push({
          team: source.teams?.name,
          list_id: listId,
          processed: listResults.length,
          total_found: twitterData.data.length
        });

      } catch (error) {
        console.error(`Error processing list ${listId}:`, error);
      }
    }

    return new Response(JSON.stringify({ 
      message: 'X List ingestion completed',
      total_processed: totalProcessed,
      sources_processed: results.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ingest-x-sources function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Check function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
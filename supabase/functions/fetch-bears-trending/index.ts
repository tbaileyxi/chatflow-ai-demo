import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    // Search for Bears-related tweets
    const searchQuery = 'Bears OR #DaBears OR #ChicagoBears -is:retweet';
    const twitterUrl = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(searchQuery)}&max_results=10&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=username`;

    const twitterResponse = await fetch(twitterUrl, {
      headers: {
        'Authorization': `Bearer ${twitterBearerToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!twitterResponse.ok) {
      const errorText = await twitterResponse.text();
      console.error('Twitter API Error:', errorText);
      throw new Error(`Twitter API error: ${twitterResponse.status}`);
    }

    const twitterData = await twitterResponse.json();
    console.log('Twitter API Response:', JSON.stringify(twitterData, null, 2));

    if (!twitterData.data || twitterData.data.length === 0) {
      return new Response(JSON.stringify({ message: 'No tweets found', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a map of users for easy lookup
    const usersMap = new Map();
    if (twitterData.includes?.users) {
      twitterData.includes.users.forEach((user: any) => {
        usersMap.set(user.id, user);
      });
    }

    // Process and store tweets
    const processed = [];
    for (const tweet of twitterData.data) {
      const user = usersMap.get(tweet.author_id);
      const embedUrl = `https://twitter.com/${user?.username || 'twitter'}/status/${tweet.id}`;
      
      // Calculate a simple rank score based on engagement
      const metrics = tweet.public_metrics || {};
      const rankScore = (metrics.like_count || 0) + (metrics.retweet_count || 0) * 2 + (metrics.reply_count || 0);

      const postData = {
        post_id: tweet.id,
        embed_url: embedUrl,
        likes: metrics.like_count || 0,
        retweets: metrics.retweet_count || 0,
        rank_score: rankScore,
        content: tweet.text,
        author_username: user?.username || null,
        created_at: tweet.created_at || new Date().toISOString(),
        fetched_at: new Date().toISOString()
      };

      // Insert or update the tweet data
      const { data, error } = await supabaseClient
        .from('bears_trending')
        .upsert(postData, { 
          onConflict: 'post_id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        console.error('Database error:', error);
      } else {
        processed.push(data);
      }
    }

    return new Response(JSON.stringify({ 
      message: 'Bears trending posts fetched successfully',
      processed: processed.length,
      total_found: twitterData.data.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-bears-trending function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Check function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
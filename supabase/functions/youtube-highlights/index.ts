import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface YouTubeSearchResult {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      high: { url: string };
      medium: { url: string };
    };
    channelTitle: string;
    publishedAt: string;
  };
}

// Trusted highlight channels (fast uploads, embeddable)
const TRUSTED_CHANNELS = [
  'NFL', 'NBA', 'ESPN', 'CBS Sports', 'Fox Sports',
  'Highlight Heaven', 'Harris Highlights', 'Ding Productions',
  'SEC Network', 'ACC Network', 'Big Ten Network'
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
  if (!YOUTUBE_API_KEY) {
    console.error('YOUTUBE_API_KEY not configured');
    return new Response(JSON.stringify({ error: 'YouTube API not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { team_name, opponent_name, huddle_id, is_live_game = false }: {
      team_name: string;
      opponent_name?: string;
      huddle_id: string;
      is_live_game?: boolean;
    } = await req.json();

    console.log(`🎬 Searching YouTube highlights for ${team_name}${opponent_name ? ` vs ${opponent_name}` : ''}`);

    // Build search queries
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    const queries = [
      `${team_name}${opponent_name ? ` vs ${opponent_name}` : ''} highlights ${dateStr}`,
      `${team_name} highlights today`,
      `${team_name} game highlights`
    ];

    let foundVideo: YouTubeSearchResult | null = null;

    for (const query of queries) {
      console.log(`🔍 Searching: "${query}"`);
      
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
      searchUrl.searchParams.set('part', 'snippet');
      searchUrl.searchParams.set('q', query);
      searchUrl.searchParams.set('type', 'video');
      searchUrl.searchParams.set('order', 'date');
      searchUrl.searchParams.set('maxResults', '10');
      searchUrl.searchParams.set('videoEmbeddable', 'true');
      searchUrl.searchParams.set('publishedAfter', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      searchUrl.searchParams.set('key', YOUTUBE_API_KEY);

      const response = await fetch(searchUrl.toString());
      if (!response.ok) {
        console.error(`YouTube API error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const videos = data.items as YouTubeSearchResult[];

      if (!videos || videos.length === 0) continue;

      // Prioritize trusted channels
      const trusted = videos.find(v => 
        TRUSTED_CHANNELS.some(ch => 
          v.snippet.channelTitle.toLowerCase().includes(ch.toLowerCase())
        )
      );
      
      foundVideo = trusted || videos[0];
      
      if (foundVideo) {
        console.log(`✅ Found video: "${foundVideo.snippet.title}" by ${foundVideo.snippet.channelTitle}`);
        break;
      }
    }

    if (!foundVideo) {
      console.log('⚠️ No suitable highlights found');
      return new Response(JSON.stringify({
        success: false,
        message: 'No highlights found',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if we've already posted this video to this huddle
    const { data: existingPost } = await supabase
      .from('huddle_messages')
      .select('id')
      .eq('huddle_id', huddle_id)
      .ilike('content', `%${foundVideo.id.videoId}%`)
      .single();

    if (existingPost) {
      console.log('⏭️ Video already posted to this huddle');
      return new Response(JSON.stringify({
        success: false,
        message: 'Video already posted',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get system user
    const { data: systemUserId } = await supabase.rpc('get_or_create_system_user');

    // Create embed URL with playsinline for PWA compatibility
    const embedUrl = `https://www.youtube.com/embed/${foundVideo.id.videoId}?playsinline=1`;
    
    // Truncate title for cleaner display
    const shortTitle = foundVideo.snippet.title.length > 80 
      ? foundVideo.snippet.title.substring(0, 77) + '...'
      : foundVideo.snippet.title;

    // Post the highlight to the huddle
    const { error: postError } = await supabase
      .from('huddle_messages')
      .insert({
        huddle_id,
        user_id: systemUserId,
        content: `🎬 Fresh highlight just dropped!\n\n${shortTitle}`,
        embed_code: `<iframe width="100%" height="315" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`,
        is_bot_message: true,
        message_type: 'youtube_highlight',
      });

    if (postError) {
      console.error('Error posting highlight:', postError);
      throw postError;
    }

    console.log('✅ Posted YouTube highlight to huddle');

    // Post follow-up @coach prompt if during live game
    if (is_live_game) {
      setTimeout(async () => {
        await supabase
          .from('huddle_messages')
          .insert({
            huddle_id,
            user_id: systemUserId,
            content: `👀 Did you catch that play? What's your take?`,
            is_bot_message: true,
            message_type: 'coach_prompt',
          });
      }, 3000);
    }

    return new Response(JSON.stringify({
      success: true,
      video_id: foundVideo.id.videoId,
      title: foundVideo.snippet.title,
      channel: foundVideo.snippet.channelTitle,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ YouTube highlights error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

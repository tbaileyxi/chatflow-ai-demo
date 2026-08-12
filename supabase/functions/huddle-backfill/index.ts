import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  huddle_id: string;
  team_id: string;
  team_name: string;
  is_new_huddle?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { huddle_id, team_id, team_name, is_new_huddle = true }: BackfillRequest = await req.json();

    console.log(`🔄 Backfilling huddle ${huddle_id} for team ${team_name}`);

    // Get system user for bot messages
    const { data: systemUserId, error: systemUserError } = await supabase.rpc('get_or_create_system_user');
    if (systemUserError) throw systemUserError;

    // Fetch recent Reddit posts from the log for this team (last 48 hours)
    const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    const { data: recentPosts, error: postsError } = await supabase
      .from('reddit_posts_log')
      .select('*')
      .eq('team_id', team_id)
      .gte('created_at', cutoffTime)
      .order('created_at', { ascending: false })
      .limit(15);

    if (postsError) {
      console.error('Error fetching recent posts:', postsError);
    }

    // Also try to get spotlight posts for this team
    const { data: spotlightPosts, error: spotlightError } = await supabase
      .from('posts')
      .select('id, content, media_url, message_type, embeds, created_at')
      .or(`team_id.eq.${team_id},origin_team_id.eq.${team_id}`)
      .eq('is_spotlight', true)
      .gte('created_at', cutoffTime)
      .order('created_at', { ascending: false })
      .limit(10);

    if (spotlightError) {
      console.error('Error fetching spotlight posts:', spotlightError);
    }

    // Check which posts haven't been added to this huddle yet
    const { data: existingMessages } = await supabase
      .from('huddle_messages')
      .select('content')
      .eq('huddle_id', huddle_id)
      .eq('is_bot_message', true)
      .limit(50);

    const existingContentHashes = new Set(
      existingMessages?.map(m => m.content.substring(0, 100)) || []
    );

    let messagesAdded = 0;
    const contentRecap: string[] = [];

    // Add spotlight posts that aren't already in the huddle
    if (spotlightPosts && spotlightPosts.length > 0) {
      for (const post of spotlightPosts.slice(0, 10)) {
        const contentHash = post.content.substring(0, 100);
        if (existingContentHashes.has(contentHash)) continue;

        const embedsData = post.embeds && typeof post.embeds === 'object' && !Array.isArray(post.embeds)
          ? post.embeds as Record<string, unknown>
          : null;

        const { error: insertError } = await supabase
          .from('huddle_messages')
          .insert({
            huddle_id,
            user_id: systemUserId,
            content: post.content,
            media_url: post.media_url,
            media_type: post.message_type === 'reddit_video' ? 'reddit_video' : post.media_url ? 'image' : null,
            message_type: 'social_buzz',
            embeds: embedsData,
            is_bot_message: true,
            origin_team_id: team_id,
          });

        if (!insertError) {
          messagesAdded++;
          existingContentHashes.add(contentHash);
          
          // Extract a snippet for the recap
          const snippet = post.content
            .replace(/🔗\s*\[Source\]\([^)]+\)/gi, '')
            .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
            .replace(/https?:\/\/[^\s]+/g, '')
            .trim()
            .substring(0, 60);
          if (snippet) contentRecap.push(snippet);
        }

        if (messagesAdded >= 15) break;
      }
    }

    console.log(`✅ Backfilled ${messagesAdded} messages to huddle ${huddle_id}`);

    // If this is a new huddle, post the Coach welcome message.
    // NOTE: do not tell users to type "@coach" here. The mention trigger is a
    // no-op stub (see 20260607000003_bot_engine_v2.sql) — the Coach posts news
    // and live plays on its own, but it does not answer questions yet.
    // Only promise what the bot actually does today.
    if (is_new_huddle) {
      // Build a brief recap of the content
      const recapItems = contentRecap.slice(0, 4).map((s, i) => `${i + 1}. ${s}...`).join('\n');

      const welcomeMessage = messagesAdded > 0
        ? `🏟️ Welcome to the ${team_name} huddle!\n\nHere's what's been buzzing:\n${recapItems || "Fresh content loading..."}\n\n🔥 Early take: This ${team_name} season is heating up. What's your prediction?`
        : `🏟️ Welcome to the ${team_name} huddle — your private home for everything ${team_name}!\n\n📰 Team news and updates land here as they break.\n🏟️ I'll be in here calling the game with you — live scores and plays, right in the thread.\n🗣️ Your space, your voice!\n\n🔥 What's your take on ${team_name} this season?`;

      const { error: welcomeError } = await supabase
        .from('huddle_messages')
        .insert({
          huddle_id,
          user_id: systemUserId,
          content: welcomeMessage,
          is_bot_message: true,
          message_type: 'coach_welcome',
        });

      if (welcomeError) {
        console.error('Error posting welcome message:', welcomeError);
      } else {
        console.log('✅ Posted @coach welcome message');
      }
    }

    return new Response(JSON.stringify({
      success: true,
      messages_added: messagesAdded,
      welcome_sent: is_new_huddle,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Huddle backfill error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

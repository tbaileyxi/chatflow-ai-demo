import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Processing scheduled broadcasts...');

    // Get overdue scheduled posts
    const { data: scheduledPosts, error: fetchError } = await supabaseClient
      .from('posts')
      .select(`
        id,
        content,
        media_url,
        message_type,
        poll_data,
        embed_code,
        team_id,
        author_id,
        target_audience,
        is_spotlight,
        is_team_agent_message,
        is_agent_post
      `)
      .eq('delivery_status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching scheduled posts:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${scheduledPosts?.length || 0} overdue scheduled posts`);

    if (!scheduledPosts || scheduledPosts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No overdue scheduled posts found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processedPosts = [];
    const failedPosts = [];

    for (const post of scheduledPosts) {
      try {
        console.log(`Processing post ${post.id}...`);
        
        // If this is supposed to go to spotlight, create a new spotlight post
        if (post.is_spotlight) {
          const { error: spotlightError } = await supabaseClient
            .from('posts')
            .insert({
              content: post.content,
              media_url: post.media_url,
              message_type: post.message_type,
              poll_data: post.poll_data,
              embed_code: post.embed_code,
              team_id: post.team_id,
              author_id: post.author_id,
              is_spotlight: true,
              is_team_agent_message: post.is_team_agent_message,
              is_agent_post: post.is_agent_post,
              delivery_status: 'sent'
            });

          if (spotlightError) {
            console.error(`Error creating spotlight post for ${post.id}:`, spotlightError);
            throw spotlightError;
          }
          console.log(`Created spotlight post for ${post.id}`);
        }

        // Broadcast to huddles if team_feed is in target_audience
        if (post.target_audience?.includes('team_feed') && post.team_id) {
          console.log(`Broadcasting to huddles for team ${post.team_id}...`);
          
          // Get team huddles
          const { data: huddles, error: huddlesError } = await supabaseClient
            .from('huddles')
            .select('id')
            .eq('team_id', post.team_id);

          if (huddlesError) {
            console.error(`Error fetching huddles for team ${post.team_id}:`, huddlesError);
            throw huddlesError;
          }

          console.log(`Found ${huddles?.length || 0} huddles for team ${post.team_id}`);

          // Insert message into each huddle
          if (huddles && huddles.length > 0) {
            const huddleMessages = huddles.map(huddle => ({
              huddle_id: huddle.id,
              user_id: post.author_id,
              content: post.content,
              media_url: post.media_url,
              media_type: post.message_type || 'text',
              embed_code: post.embed_code,
              poll_data: post.poll_data,
              is_team_agent_message: post.is_team_agent_message || post.is_agent_post || false
            }));

            const { error: messagesError } = await supabaseClient
              .from('huddle_messages')
              .insert(huddleMessages);

            if (messagesError) {
              console.error(`Error inserting huddle messages for post ${post.id}:`, messagesError);
              throw messagesError;
            }
            console.log(`Broadcasted to ${huddles.length} huddles for post ${post.id}`);
          }
        }

        // Update the post delivery status to sent
        const { error: updateError } = await supabaseClient
          .from('posts')
          .update({ 
            delivery_status: 'sent',
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id);

        if (updateError) {
          console.error(`Error updating post ${post.id}:`, updateError);
          throw updateError;
        }

        processedPosts.push(post.id);
        console.log(`Successfully processed post ${post.id}`);

      } catch (error) {
        console.error(`Failed to process post ${post.id}:`, error);
        failedPosts.push({ id: post.id, error: error.message });
        
        // Update post status to failed
        await supabaseClient
          .from('posts')
          .update({ 
            delivery_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id);
      }
    }

    const result = {
      processed: processedPosts.length,
      failed: failedPosts.length,
      processedPosts,
      failedPosts
    };

    console.log('Broadcast processing complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-scheduled-broadcasts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
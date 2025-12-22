import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Subject line rotation - feels personal, not system-generated
const SUBJECT_TEMPLATES = [
  (teamName: string) => `${teamName} huddle is heating up 👀`,
  (teamName: string) => `Someone posted in your ${teamName} huddle`,
  (teamName: string) => `You missed a few ${teamName} takes`,
  () => `New chatter in your huddles`,
  () => `This popped off while you were away`,
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('📧 Send Activity Email - Starting...');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  if (!resendApiKey) {
    console.error('❌ RESEND_API_KEY not configured');
    return new Response(JSON.stringify({ error: 'Email service not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const resend = new Resend(resendApiKey);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get users who haven't received an email in 48 hours (or never)
    const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    // Get all users with their huddle memberships
    const { data: eligibleUsers, error: usersError } = await supabase
      .from('profiles')
      .select(`
        user_id,
        display_name,
        username
      `)
      .neq('status', 'banned')
      .not('user_id', 'is', null);

    if (usersError) throw usersError;

    console.log(`👥 Found ${eligibleUsers?.length || 0} potential users`);

    let emailsSent = 0;
    let skipped = 0;

    for (const user of eligibleUsers || []) {
      try {
        // Check when user last received email
        const { data: emailRecord } = await supabase
          .from('user_email_notifications')
          .select('last_email_sent_at')
          .eq('user_id', user.user_id)
          .single();

        // Skip if emailed within 48 hours
        if (emailRecord?.last_email_sent_at) {
          const lastSent = new Date(emailRecord.last_email_sent_at);
          if (lastSent.getTime() > Date.now() - 48 * 60 * 60 * 1000) {
            skipped++;
            continue;
          }
        }

        // Get user's email from auth
        const { data: authUser } = await supabase.auth.admin.getUserById(user.user_id);
        const userEmail = authUser?.user?.email;

        if (!userEmail) {
          console.log(`⏭️ No email for user ${user.user_id}`);
          continue;
        }

        // Get user's huddle memberships
        const { data: memberships } = await supabase
          .from('huddle_members')
          .select(`
            huddle_id,
            huddles!inner (
              id,
              name,
              last_message_at,
              team_id,
              teams (
                name,
                city
              )
            )
          `)
          .eq('user_id', user.user_id);

        if (!memberships || memberships.length === 0) {
          continue;
        }

        // Check for new activity since last email (or last 48h)
        const checkSince = emailRecord?.last_email_sent_at || cutoffTime;
        
        // Get message counts per huddle since last email
        const huddleActivity: Array<{
          huddleId: string;
          huddleName: string;
          teamName: string;
          messageCount: number;
          latestMessage: string;
          lastActivity: Date;
        }> = [];

        for (const membership of memberships) {
          const huddle = membership.huddles as any;
          
          // Count new messages in this huddle
          const { count } = await supabase
            .from('huddle_messages')
            .select('*', { count: 'exact', head: true })
            .eq('huddle_id', huddle.id)
            .gt('created_at', checkSince)
            .neq('user_id', user.user_id); // Exclude user's own messages

          if (count && count > 0) {
            // Get a teaser from the latest message
            const { data: latestMsg } = await supabase
              .from('huddle_messages')
              .select('content')
              .eq('huddle_id', huddle.id)
              .gt('created_at', checkSince)
              .neq('user_id', user.user_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            const teamName = huddle.teams?.name || 'Team';
            const cityName = huddle.teams?.city || '';
            const displayTeam = cityName ? `${cityName} ${teamName}` : teamName;

            huddleActivity.push({
              huddleId: huddle.id,
              huddleName: huddle.name,
              teamName: displayTeam,
              messageCount: count,
              latestMessage: latestMsg?.content?.substring(0, 80) || 'New activity',
              lastActivity: new Date(huddle.last_message_at)
            });
          }
        }

        // Skip if no new activity
        if (huddleActivity.length === 0) {
          continue;
        }

        // Sort by most recent activity
        huddleActivity.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
        const mostActiveHuddle = huddleActivity[0];

        // Pick a random subject line template
        const templateIndex = Math.floor(Math.random() * SUBJECT_TEMPLATES.length);
        const subject = SUBJECT_TEMPLATES[templateIndex](mostActiveHuddle.teamName);

        // Build the email body - clean, casual tone
        const teaser = mostActiveHuddle.latestMessage
          .replace(/<[^>]*>/g, '')
          .substring(0, 60);

        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; padding: 32px 24px;">
    
    <h1 style="font-size: 22px; font-weight: 600; color: #1a1a1a; margin: 0 0 20px 0;">
      New chatter in your huddles
    </h1>
    
    <p style="font-size: 15px; color: #666666; line-height: 1.5; margin: 0 0 24px 0;">
      A few new posts came through since your last visit.
    </p>
    
    <div style="background-color: #fafafa; border-left: 3px solid #facc15; padding: 16px; margin: 0 0 24px 0;">
      <p style="font-size: 13px; font-weight: 600; color: #1a1a1a; margin: 0 0 8px 0;">
        ${mostActiveHuddle.teamName} Huddle
      </p>
      <p style="font-size: 14px; color: #666666; font-style: italic; margin: 0;">
        "${teaser}..."
      </p>
    </div>
    
    <p style="font-size: 14px; color: #666666; margin: 0 0 24px 0;">
      Jump back in to see the full conversation.
    </p>
    
    <a href="https://sidehuddle.io" 
       style="display: inline-block; background-color: #facc15; color: #1a1a1a; font-weight: 600; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 15px;">
      Open Side Huddle
    </a>
    
    <p style="font-size: 12px; color: #999999; margin: 32px 0 0 0;">
      You'll only get emails when there's real activity.
    </p>
    
  </div>
</body>
</html>
        `;

        // Send the email
        const { error: sendError } = await resend.emails.send({
          from: 'Side Huddle <updates@sidehuddle.io>',
          to: [userEmail],
          subject: subject,
          html: htmlBody,
        });

        if (sendError) {
          console.error(`❌ Failed to send email to ${userEmail}:`, sendError);
          continue;
        }

        // Update last email sent timestamp
        await supabase
          .from('user_email_notifications')
          .upsert({
            user_id: user.user_id,
            last_email_sent_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        emailsSent++;
        console.log(`✅ Email sent to ${userEmail} - ${mostActiveHuddle.teamName} huddle`);

      } catch (userError) {
        console.error(`❌ Error processing user ${user.user_id}:`, userError);
      }
    }

    console.log(`\n📊 Summary: ${emailsSent} emails sent, ${skipped} skipped (within 48h window)`);

    return new Response(JSON.stringify({
      success: true,
      emailsSent,
      skipped,
      processedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Send Activity Email Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

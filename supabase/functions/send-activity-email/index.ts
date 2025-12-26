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
    const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    // Step 1: Get all huddles with recent activity
    const { data: activeHuddles, error: huddlesError } = await supabase
      .from('huddles')
      .select(`
        id,
        name,
        last_message_at,
        team_id,
        teams!huddles_team_id_fkey (
          name,
          city
        )
      `)
      .gt('last_message_at', cutoffTime);

    if (huddlesError) {
      console.error('❌ Error fetching active huddles:', huddlesError);
      throw huddlesError;
    }

    console.log(`📊 Found ${activeHuddles?.length || 0} huddles with recent activity`);

    // Step 2: Get all members of those huddles
    const huddleIds = (activeHuddles || []).map(h => h.id);
    
    if (huddleIds.length === 0) {
      console.log('📭 No active huddles found');
      return new Response(JSON.stringify({
        success: true,
        emailsSent: 0,
        skipped: 0,
        noEmail: 0,
        noNewMessages: 0,
        message: 'No active huddles',
        processedAt: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: memberships, error: membersError } = await supabase
      .from('huddle_members')
      .select('user_id, huddle_id')
      .in('huddle_id', huddleIds);

    if (membersError) {
      console.error('❌ Error fetching memberships:', membersError);
      throw membersError;
    }

    // Step 3: Get profiles for those users
    const userIds = [...new Set((memberships || []).map(m => m.user_id))];
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, display_name, status')
      .in('user_id', userIds)
      .neq('status', 'banned');

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      throw profilesError;
    }

    // Create lookup maps
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    const huddleMap = new Map((activeHuddles || []).map(h => [h.id, h]));

    console.log(`👥 Found ${profileMap.size} eligible users in active huddles`);

    // Group by user to process each user once
    const userMap = new Map<string, {
      userId: string;
      displayName: string;
      huddles: Array<{
        huddleId: string;
        huddleName: string;
        teamName: string;
        lastActivity: Date;
      }>;
    }>();

    for (const membership of memberships || []) {
      const userId = membership.user_id;
      const huddleId = membership.huddle_id;
      
      const profile = profileMap.get(userId);
      const huddle = huddleMap.get(huddleId);
      
      if (!profile || !huddle) continue;
      
      // Skip system users (UUIDs starting with 00000000)
      if (userId.startsWith('00000000')) continue;
      
      const teamName = huddle.teams 
        ? `${(huddle.teams as any).city || ''} ${(huddle.teams as any).name || ''}`.trim() 
        : 'Team';

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          displayName: profile.display_name || 'User',
          huddles: []
        });
      }

      userMap.get(userId)!.huddles.push({
        huddleId: huddle.id,
        huddleName: huddle.name,
        teamName,
        lastActivity: new Date(huddle.last_message_at!)
      });
    }

    console.log(`👥 Processing ${userMap.size} unique users with huddle activity`);

    let emailsSent = 0;
    let skipped = 0;
    let noEmail = 0;
    let noNewMessages = 0;

    for (const [userId, userData] of userMap) {
      try {
        // Check when user last received email
        const { data: emailRecord } = await supabase
          .from('user_email_notifications')
          .select('last_email_sent_at')
          .eq('user_id', userId)
          .single();

        // Skip if emailed within 48 hours
        if (emailRecord?.last_email_sent_at) {
          const lastSent = new Date(emailRecord.last_email_sent_at);
          if (lastSent.getTime() > Date.now() - 48 * 60 * 60 * 1000) {
            console.log(`⏭️ Skipping ${userData.displayName} - emailed ${Math.round((Date.now() - lastSent.getTime()) / 3600000)}h ago`);
            skipped++;
            continue;
          }
        }

        // Get user's email from auth
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
        
        if (authError) {
          console.log(`⚠️ Auth error for ${userId}: ${authError.message}`);
          noEmail++;
          continue;
        }
        
        const userEmail = authUser?.user?.email;

        if (!userEmail) {
          console.log(`⏭️ No email for user ${userId} (${userData.displayName})`);
          noEmail++;
          continue;
        }

        // Check for ACTUAL new messages (not just huddle activity timestamp)
        const checkSince = emailRecord?.last_email_sent_at || cutoffTime;
        let hasNewMessages = false;
        let mostActiveHuddle: {
          huddleId: string;
          huddleName: string;
          teamName: string;
          messageCount: number;
          latestMessage: string;
        } | null = null;

        for (const huddle of userData.huddles) {
          // Count new messages NOT from this user
          const { count, error: countError } = await supabase
            .from('huddle_messages')
            .select('*', { count: 'exact', head: true })
            .eq('huddle_id', huddle.huddleId)
            .gt('created_at', checkSince)
            .neq('user_id', userId);

          if (countError) {
            console.log(`⚠️ Error counting messages for huddle ${huddle.huddleId}: ${countError.message}`);
            continue;
          }

          if (count && count > 0) {
            hasNewMessages = true;
            
            // Get latest message teaser
            const { data: latestMsg } = await supabase
              .from('huddle_messages')
              .select('content')
              .eq('huddle_id', huddle.huddleId)
              .gt('created_at', checkSince)
              .neq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (!mostActiveHuddle || count > mostActiveHuddle.messageCount) {
              mostActiveHuddle = {
                huddleId: huddle.huddleId,
                huddleName: huddle.huddleName,
                teamName: huddle.teamName,
                messageCount: count,
                latestMessage: latestMsg?.content?.substring(0, 80) || 'New activity'
              };
            }
          }
        }

        if (!hasNewMessages || !mostActiveHuddle) {
          console.log(`⏭️ No new messages for ${userData.displayName} (${userEmail})`);
          noNewMessages++;
          continue;
        }

        console.log(`📬 Sending email to ${userEmail} - ${mostActiveHuddle.teamName} huddle (${mostActiveHuddle.messageCount} new msgs)`);

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
    
    <a href="https://sidehuddle.io/huddle/${mostActiveHuddle.huddleId}" 
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

        // Send the email - use verified Resend domain
        const emailFrom = Deno.env.get('EMAIL_FROM') || 'Side Huddle <updates@updates.sidehuddlesports.com>';
        const { data: emailData, error: sendError } = await resend.emails.send({
          from: emailFrom,
          to: [userEmail],
          subject: subject,
          html: htmlBody,
        });

        if (sendError) {
          console.error(`❌ Failed to send email to ${userEmail}:`, sendError);
          continue;
        }

        console.log(`✅ Email sent to ${userEmail} - Resend ID: ${emailData?.id}`);

        // Update last email sent timestamp
        await supabase
          .from('user_email_notifications')
          .upsert({
            user_id: userId,
            last_email_sent_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        emailsSent++;

      } catch (userError) {
        console.error(`❌ Error processing user ${userId}:`, userError);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✉️  Emails sent: ${emailsSent}`);
    console.log(`  ⏭️  Skipped (48h window): ${skipped}`);
    console.log(`  📭 No email address: ${noEmail}`);
    console.log(`  💤 No new messages: ${noNewMessages}`);

    return new Response(JSON.stringify({
      success: true,
      emailsSent,
      skipped,
      noEmail,
      noNewMessages,
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

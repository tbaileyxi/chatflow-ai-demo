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
    
    // Step 1: Find huddles with ACTUAL recent messages (not relying on stale last_message_at)
    const { data: recentMessages, error: messagesError } = await supabase
      .from('huddle_messages')
      .select('huddle_id')
      .gt('created_at', cutoffTime)
      .limit(1000);

    if (messagesError) {
      console.error('❌ Error fetching recent messages:', messagesError);
      throw messagesError;
    }

    // Get unique huddle IDs with recent messages
    const huddleIdsWithActivity = [...new Set((recentMessages || []).map(m => m.huddle_id))];
    
    console.log(`📊 Found ${huddleIdsWithActivity.length} huddles with recent messages`);

    if (huddleIdsWithActivity.length === 0) {
      console.log('📭 No huddles with recent activity');
      return new Response(JSON.stringify({
        success: true,
        emailsSent: 0,
        skipped: 0,
        noEmail: 0,
        noNewMessages: 0,
        message: 'No huddles with recent activity',
        processedAt: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Get huddle details for those with activity
    const { data: activeHuddles, error: huddlesError } = await supabase
      .from('huddles')
      .select(`
        id,
        name,
        team_id,
        teams!huddles_team_id_fkey (
          name,
          city
        )
      `)
      .in('id', huddleIdsWithActivity);

    if (huddlesError) {
      console.error('❌ Error fetching huddles:', huddlesError);
      throw huddlesError;
    }

    // Step 3: Get all members of those huddles
    const { data: memberships, error: membersError } = await supabase
      .from('huddle_members')
      .select('user_id, huddle_id')
      .in('huddle_id', huddleIdsWithActivity);

    if (membersError) {
      console.error('❌ Error fetching memberships:', membersError);
      throw membersError;
    }

    console.log(`👥 Found ${memberships?.length || 0} memberships in active huddles`);

    // Step 4: Get profiles for those users
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
        lastActivity: new Date() // We know it's active since we found messages
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

        // Check for ACTUAL new messages (not just huddle activity timestamp).
        //
        // This used to collect every room the person had missed and then throw
        // all but the busiest one away — one email, about one room, while the
        // other nine rooms they belong to went unmentioned. The whole point of
        // belonging to several rooms is that the digest covers them.
        const checkSince = emailRecord?.last_email_sent_at || cutoffTime;
        const rooms: Array<{
          huddleId: string;
          huddleName: string;
          teamName: string;
          messageCount: number;
          latestMessage: string;
        }> = [];

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
          if (!count || count === 0) continue;

          const { data: latestMsg } = await supabase
            .from('huddle_messages')
            .select('content')
            .eq('huddle_id', huddle.huddleId)
            .gt('created_at', checkSince)
            .neq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          rooms.push({
            huddleId: huddle.huddleId,
            huddleName: huddle.huddleName,
            teamName: huddle.teamName,
            messageCount: count,
            latestMessage: latestMsg?.content?.substring(0, 120) || 'New activity',
          });
        }

        if (rooms.length === 0) {
          console.log(`⏭️ No new messages for ${userData.displayName} (${userEmail})`);
          noNewMessages++;
          continue;
        }

        // Busiest first — if only the top of the email gets read, it should be
        // the room that actually did something.
        rooms.sort((a, b) => b.messageCount - a.messageCount);
        const busiest = rooms[0];
        const totalNew = rooms.reduce((n, r) => n + r.messageCount, 0);

        console.log(`📬 Sending email to ${userEmail} - ${rooms.length} room(s), ${totalNew} new msgs`);

        // Pick a random subject line template
        const subject =
          rooms.length === 1
            ? SUBJECT_TEMPLATES[Math.floor(Math.random() * SUBJECT_TEMPLATES.length)](
                busiest.teamName,
              )
            : `${totalNew} new posts across ${rooms.length} of your rooms`;

        // Build the email body - clean, casual tone.
        // One block per room, so the digest says what it is: everything you
        // missed, everywhere you belong.
        const esc = (t: string) =>
          t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
           .replace(/"/g, '&quot;');

        const roomBlocks = rooms
          .map((r) => {
            const teaser = esc(r.latestMessage.replace(/<[^>]*>/g, '').substring(0, 90));
            const label = r.messageCount === 1 ? '1 new post' : `${r.messageCount} new posts`;
            return `
    <a href="https://www.sidehuddlesports.com/h/${r.huddleId}"
       style="display: block; text-decoration: none; background-color: #fafafa; border-left: 3px solid #facc15; padding: 16px; margin: 0 0 12px 0;">
      <p style="font-size: 13px; font-weight: 600; color: #1a1a1a; margin: 0 0 4px 0;">
        ${esc(r.huddleName)}
      </p>
      <p style="font-size: 12px; color: #999999; margin: 0 0 8px 0;">
        ${label}
      </p>
      <p style="font-size: 14px; color: #666666; font-style: italic; margin: 0;">
        "${teaser}..."
      </p>
    </a>`;
          })
          .join('');

        const heading =
          rooms.length === 1
            ? 'New chatter in your huddle'
            : `While you were out: ${rooms.length} rooms`;

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
      ${heading}
    </h1>

    <p style="font-size: 15px; color: #666666; line-height: 1.5; margin: 0 0 24px 0;">
      ${totalNew} new ${totalNew === 1 ? 'post' : 'posts'} since your last visit.
    </p>

    ${roomBlocks}

    <a href="https://www.sidehuddlesports.com/h/${busiest.huddleId}"
       style="display: inline-block; background-color: #facc15; color: #1a1a1a; font-weight: 600; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 15px; margin-top: 12px;">
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

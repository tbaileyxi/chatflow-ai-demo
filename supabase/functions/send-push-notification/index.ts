import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
}

async function sendExpoPush(messages: PushMessage[]) {
  if (messages.length === 0) return;

  // Expo accepts batches of up to 100
  const batches = [];
  for (let i = 0; i < messages.length; i += 100) {
    batches.push(messages.slice(i, i + 100));
  }

  for (const batch of batches) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });
    } catch (err) {
      console.error('Expo push error:', err);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { type } = body;

    let sent = 0;

    // ─── TYPE 1: New message in a huddle ───
    // Only notify members who haven't had the huddle open in 30+ minutes
    if (type === 'new_message') {
      const { huddleId, senderId, senderName, content, huddleName } = body;

      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      // Get members who haven't read the huddle in the last 30 minutes
      const { data: members } = await supabase
        .from('huddle_members')
        .select('user_id, last_read_at')
        .eq('huddle_id', huddleId)
        .neq('user_id', senderId)
        .lt('last_read_at', thirtyMinAgo);

      if (!members || members.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const userIds = members.map((m) => m.user_id);

      // Get push tokens for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, expo_push_token')
        .in('user_id', userIds)
        .not('expo_push_token', 'is', null);

      if (!profiles) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const messages: PushMessage[] = profiles
        .filter((p) => p.expo_push_token)
        .map((p) => ({
          to: p.expo_push_token!,
          title: huddleName || 'New message',
          body: `${senderName}: ${content.slice(0, 100)}`,
          data: { type: 'new_message', huddleId },
          sound: 'default',
        }));

      await sendExpoPush(messages);
      sent = messages.length;
    }

    // ─── TYPE 2: Someone joined a Side Huddle ───
    // Notify the huddle captain/owner only
    if (type === 'member_joined') {
      const { huddleId, memberName } = body;

      // Get the huddle owner
      const { data: huddle } = await supabase
        .from('huddles')
        .select('owner_id, name')
        .eq('id', huddleId)
        .single();

      if (!huddle?.owner_id) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get captain's push token
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('expo_push_token')
        .eq('user_id', huddle.owner_id)
        .single();

      if (!ownerProfile?.expo_push_token) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const messages: PushMessage[] = [{
        to: ownerProfile.expo_push_token,
        title: huddle.name || 'Your Huddle',
        body: `${memberName} just joined your huddle.`,
        data: { type: 'member_joined', huddleId },
        sound: 'default',
      }];

      await sendExpoPush(messages);
      sent = 1;
    }

    // ─── TYPE 3: Someone entered (became active in) a huddle ───
    // Notify other members, throttled to 1 notification per user per hour
    if (type === 'presence_active') {
      const { huddleId, userId, displayName } = body;

      // Check throttle: was a presence notification already sent for this user
      // in this huddle within the last hour?
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data: recentNotif } = await supabase
        .from('presence_notification_log')
        .select('id')
        .eq('huddle_id', huddleId)
        .eq('user_id', userId)
        .gte('notified_at', oneHourAgo)
        .limit(1);

      if (recentNotif && recentNotif.length > 0) {
        // Throttled — skip
        return new Response(JSON.stringify({ sent: 0, throttled: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get all other members of this huddle
      const { data: members } = await supabase
        .from('huddle_members')
        .select('user_id')
        .eq('huddle_id', huddleId)
        .neq('user_id', userId);

      if (!members || members.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const userIds = members.map((m) => m.user_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, expo_push_token')
        .in('user_id', userIds)
        .not('expo_push_token', 'is', null);

      if (!profiles || profiles.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const messages: PushMessage[] = profiles
        .filter((p) => p.expo_push_token)
        .map((p) => ({
          to: p.expo_push_token!,
          title: 'Huddle Activity',
          body: `${displayName} is in the huddle \u{1F3DF}\u{FE0F}`,
          data: { type: 'presence_active', huddleId },
          sound: 'default',
        }));

      await sendExpoPush(messages);
      sent = messages.length;

      // Log for throttle
      await supabase
        .from('presence_notification_log')
        .insert({ huddle_id: huddleId, user_id: userId });
    }

    // ─── TYPE 4: Game going live ───
    if (type === 'game_live') {
      const { teamId, teamName, opponentName, gameId } = body;

      // Find all huddles for this team
      const { data: huddles } = await supabase
        .from('huddles')
        .select('id')
        .eq('team_id', teamId);

      if (!huddles || huddles.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const huddleIds = huddles.map((h) => h.id);

      // Get all members of these huddles
      const { data: members } = await supabase
        .from('huddle_members')
        .select('user_id')
        .in('huddle_id', huddleIds);

      if (!members) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Deduplicate user IDs
      const uniqueUserIds = [...new Set(members.map((m) => m.user_id))];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, expo_push_token')
        .in('user_id', uniqueUserIds)
        .not('expo_push_token', 'is', null);

      if (!profiles) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const messages: PushMessage[] = profiles
        .filter((p) => p.expo_push_token)
        .map((p) => ({
          to: p.expo_push_token!,
          title: `${teamName} game is LIVE!`,
          body: `${teamName} vs ${opponentName} — jump into your huddle`,
          data: {
            type: 'game_live',
            teamId,
            gameId,
            huddleId: huddleIds[0],
          },
          sound: 'default',
        }));

      await sendExpoPush(messages);
      sent = messages.length;
    }

    // ─── TYPE 5: Kalshi market closing within 1 hour ───
    if (type === 'kalshi_closing') {
      const now = new Date();
      const oneHourOut = new Date(now.getTime() + 60 * 60 * 1000);

      // Find markets closing in the next hour that haven't been notified
      const { data: closingMarkets } = await supabase
        .from('kalshi_markets')
        .select('id, question, team_id, event_start_time')
        .eq('is_resolved', false)
        .gte('event_start_time', now.toISOString())
        .lte('event_start_time', oneHourOut.toISOString())
        .not('team_id', 'is', null);

      if (!closingMarkets || closingMarkets.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get unique team IDs
      const teamIds = [...new Set(closingMarkets.map((m) => m.team_id).filter(Boolean))] as string[];

      // Get team names
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);
      const teamNameMap = new Map((teams ?? []).map((t) => [t.id, t.name]));

      // Get users who follow these teams
      const { data: follows } = await supabase
        .from('user_follows')
        .select('user_id, team_id')
        .in('team_id', teamIds);

      if (!follows || follows.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const uniqueUserIds = [...new Set(follows.map((f) => f.user_id))];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, expo_push_token')
        .in('user_id', uniqueUserIds)
        .not('expo_push_token', 'is', null);

      if (!profiles) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Build user -> followed teams map
      const userTeams = new Map<string, string[]>();
      for (const f of follows) {
        const list = userTeams.get(f.user_id) ?? [];
        list.push(f.team_id);
        userTeams.set(f.user_id, list);
      }

      const messages: PushMessage[] = [];
      for (const p of profiles) {
        if (!p.expo_push_token) continue;
        const userFollowedTeams = userTeams.get(p.user_id) ?? [];
        const relevantMarkets = closingMarkets.filter(
          (m) => m.team_id && userFollowedTeams.includes(m.team_id),
        );
        if (relevantMarkets.length === 0) continue;

        const teamName = teamNameMap.get(relevantMarkets[0].team_id!) ?? 'Your team';
        messages.push({
          to: p.expo_push_token,
          title: 'Predictions closing soon!',
          body: `${relevantMarkets.length} ${teamName} market${relevantMarkets.length > 1 ? 's' : ''} closing in < 1 hour — place your bets`,
          data: { type: 'kalshi_closing' },
          sound: 'default',
        });
      }

      await sendExpoPush(messages);
      sent = messages.length;
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('send-push-notification error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

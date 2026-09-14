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
    // Only notify members who haven't had the huddle open in 30+ minutes.
    // Skips bot messages and public huddles.
    if (type === 'new_message') {
      const { huddleId, senderId, senderName, content, huddleName, isBot } = body;

      // Skip bot-generated messages entirely
      if (isBot) {
        return new Response(JSON.stringify({ sent: 0, skipped: 'bot' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Only notify for private huddles
      const { data: huddle } = await supabase
        .from('huddles')
        .select('is_private, is_dm')
        .eq('id', huddleId)
        .single();

      if (!huddle?.is_private) {
        return new Response(JSON.stringify({ sent: 0, skipped: 'public_huddle' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      // Members who haven't read the huddle in the last 30 minutes.
      //
      // `.lt('last_read_at', …)` ALONE DROPS NULLS, and a member who has never
      // opened the room has a null last_read_at. So the one person guaranteed
      // not to know about a message — somebody who has never been in the room
      // at all — was the one person excluded from being told. That is why a
      // brand-new DM notified nobody: its recipient had never read it, because
      // it had only just been created.
      const { data: members } = await supabase
        .from('huddle_members')
        .select('user_id, last_read_at')
        .eq('huddle_id', huddleId)
        .neq('user_id', senderId)
        .or(`last_read_at.is.null,last_read_at.lt.${thirtyMinAgo}`);

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
          // A DM IS NOT ROOM TRAFFIC, and it must not read like it.
          //
          // The title was the huddle's name, and a DM huddle is named after
          // the other person from the CREATOR's side — so the recipient got a
          // notification titled with their own name. Say who it is from and
          // that it was sent to them.
          title: huddle.is_dm
            ? `${senderName} sent you a message`
            : huddleName || 'New message',
          body: huddle.is_dm
            ? content.slice(0, 140)
            : `${senderName}: ${content.slice(0, 100)}`,
          data: { type: 'new_message', huddleId, isDm: !!huddle.is_dm },
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
    // Notify other members, throttled to 1 notification per user per hour.
    // Private huddles only.
    if (type === 'presence_active') {
      const { huddleId, userId, displayName } = body;

      // Two dead gates lived here before.
      //
      // 1. `if (!is_private) skip` — but every room is created is_private:false,
      //    so this skipped 100% of rooms and the feature never fired for anyone.
      // 2. A member-count cap that skipped team rooms — but the team room is
      //    where every uninvited signup lands, so it turned the feature off in
      //    exactly the room most people are actually sitting in.
      //
      // Neither was really about room size. What makes this notification worth
      // sending is that you KNOW the person who walked in, and that is now
      // answerable: the recipient filter below keeps it to their friends. A
      // 500-person team room pings your three friends, not 500 strangers, so
      // room size stops mattering at all.
      const { data: presenceHuddle } = await supabase
        .from('huddles')
        .select('is_private, name, team_id, member_count, is_official_team_huddle, is_dm')
        .eq('id', huddleId)
        .single();

      if (!presenceHuddle) {
        return new Response(JSON.stringify({ sent: 0, skipped: 'no_huddle' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // A DM IS NOT A ROOM YOU WALKED INTO.
      //
      // DMs are huddles underneath, named after the other person, so opening
      // one fired "Johnny Utah is watching the game in 'JOE'" at JOE. The
      // notification is about finding people to watch with; there is nobody to
      // find in a conversation between two people who are already talking.
      if (presenceHuddle.is_dm) {
        return new Response(JSON.stringify({ sent: 0, skipped: 'dm' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

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

      let allMemberIds = members.map((m) => m.user_id);

      // Only tell people who actually know whoever just walked in. "Someone is
      // in the room" is noise; "your friend is in the room" is the whole point.
      const { data: connections } = await supabase
        .from('friend_connections')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

      const knows = new Set(
        (connections ?? []).map((c) =>
          c.requester_id === userId ? c.addressee_id : c.requester_id,
        ),
      );
      allMemberIds = allMemberIds.filter((id) => knows.has(id));

      if (allMemberIds.length === 0) {
        return new Response(JSON.stringify({ sent: 0, skipped: 'no_friends_here' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Per-recipient throttle: at most one "friend watching" ping per person
      // per room per hour, no matter how many people walk in. Without this, a
      // 20-person room on game day pushes 15 times to everyone.
      const { data: recentlyTold } = await supabase
        .from('presence_notification_log')
        .select('recipient_id')
        .eq('huddle_id', huddleId)
        .in('recipient_id', allMemberIds)
        .gte('notified_at', oneHourAgo);

      const alreadyTold = new Set(
        (recentlyTold ?? []).map((r) => r.recipient_id).filter(Boolean),
      );
      // Reassigned below once opt-outs are known.
      let userIds = allMemberIds.filter((id) => !alreadyTold.has(id));

      if (userIds.length === 0) {
        await supabase
          .from('presence_notification_log')
          .insert({ huddle_id: huddleId, user_id: userId });

        return new Response(JSON.stringify({ sent: 0, throttled: 'all_recipients' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let teamLabel = 'the game';
      if (presenceHuddle.team_id) {
        const { data: team } = await supabase
          .from('teams')
          .select('name, city')
          .eq('id', presenceHuddle.team_id)
          .maybeSingle();

        if (team?.name) {
          teamLabel = team.city ? `${team.city} ${team.name}` : team.name;
        }
      }

      const huddleName = presenceHuddle.name || 'a room';
      const notificationTitle = 'Friend watching now';
      const notificationBody = `${displayName} is watching ${teamLabel} in "${huddleName}".`;

      const { data: preferences } = await supabase
        .from('notification_preferences')
        .select('user_id, in_app_notifications, presence_active_enabled')
        .in('user_id', userIds);

      // Anyone who turned "Friend watching now" off gets nothing at all —
      // not a push, not an in-app row. Without this the only way to stop it
      // was disabling Side Huddle notifications wholesale in iOS.
      const optedOut = new Set(
        (preferences ?? [])
          .filter((p) => (p as any).presence_active_enabled === false)
          .map((p) => p.user_id),
      );
      userIds = userIds.filter((id) => !optedOut.has(id));

      if (userIds.length === 0) {
        await supabase
          .from('presence_notification_log')
          .insert({ huddle_id: huddleId, user_id: userId });

        return new Response(JSON.stringify({ sent: 0, skipped: 'all_opted_out' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const inAppAllowed = new Map(
        (preferences ?? []).map((p) => [p.user_id, p.in_app_notifications !== false]),
      );
      const inAppNotifications = userIds
        .filter((memberUserId) => inAppAllowed.get(memberUserId) !== false)
        .map((memberUserId) => ({
          user_id: memberUserId,
          type: 'presence_active',
          title: notificationTitle,
          body: notificationBody,
          huddle_id: huddleId,
          team_id: presenceHuddle.team_id ?? null,
          data: {
            type: 'presence_active',
            huddleId,
            watcherId: userId,
            watcherName: displayName,
            huddleName,
            teamLabel,
          },
        }));

      if (inAppNotifications.length > 0) {
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert(inAppNotifications);

        if (notificationError) {
          console.error('presence in-app notification error:', notificationError);
        }
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, expo_push_token')
        .in('user_id', userIds)
        .not('expo_push_token', 'is', null);

      if (!profiles || profiles.length === 0) {
        await supabase
          .from('presence_notification_log')
          .insert({ huddle_id: huddleId, user_id: userId });

        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const messages: PushMessage[] = profiles
        .filter((p) => p.expo_push_token)
        .map((p) => ({
          to: p.expo_push_token!,
          title: notificationTitle,
          body: notificationBody,
          data: {
            type: 'presence_active',
            huddleId,
            watcherId: userId,
            watcherName: displayName,
            huddleName,
            teamLabel,
          },
          sound: 'default',
        }));

      await sendExpoPush(messages);
      sent = messages.length;

      // Log for throttle: one row marking this person announced, plus one per
      // recipient we actually reached. Recipients are logged even when they had
      // no push token — they still got the in-app notification, and that counts
      // as having been told.
      await supabase
        .from('presence_notification_log')
        .insert([
          { huddle_id: huddleId, user_id: userId },
          ...userIds.map((recipientId) => ({
            huddle_id: huddleId,
            user_id: userId,
            recipient_id: recipientId,
          })),
        ]);
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

    // ─── TYPE 6: Direct sends ───
    // Two callers were posting payloads no branch handled (so they silently
    // notified nobody):
    //   PullInFriendsModal:  { user_ids: [...], title, body, url }
    //   bot publisher v2:    { huddle_ids: [...], title, body, source: 'bot_v2' }
    if (!type && (Array.isArray(body.user_ids) || Array.isArray(body.huddle_ids))) {
      const { title, body: messageBody, url, source } = body;
      // Callers can name the type (friend_joined, huddle_ping, ...) so the
      // in-app row is filed correctly. Anything unrecognised falls back to the
      // old defaults rather than tripping the CHECK constraint and losing the
      // whole insert.
      const ALLOWED_DIRECT_TYPES = [
        'friend_joined', 'huddle_ping', 'room_invite', 'bot_drop', 'join_request',
      ];
      const requestedType = typeof body.notification_type === 'string'
        ? body.notification_type
        : null;
      const notifType = requestedType && ALLOWED_DIRECT_TYPES.includes(requestedType)
        ? requestedType
        : source === 'bot_v2' ? 'bot_drop' : 'room_invite';

      let targetUserIds: string[] = [];
      let huddleId: string | null = null;
      if (Array.isArray(body.user_ids)) {
        targetUserIds = body.user_ids as string[];
      } else {
        huddleId = (body.huddle_ids as string[])[0] ?? null;
        const { data: members } = await supabase
          .from('huddle_members')
          .select('user_id')
          .in('huddle_id', body.huddle_ids as string[]);
        targetUserIds = [...new Set((members ?? []).map((m) => m.user_id))];
      }

      if (targetUserIds.length === 0 || !title) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // In-app notifications (respect preferences) so the invite/drop is
      // visible even when push permission is denied.
      const { data: preferences } = await supabase
        .from('notification_preferences')
        .select(
          'user_id, in_app_notifications, friend_joined_enabled, room_invite_enabled',
        )
        .in('user_id', targetUserIds);

      // Per-type opt-out. Only the types that have a switch are filtered here;
      // bot drops are governed elsewhere.
      const prefColumn: Record<string, string> = {
        friend_joined: 'friend_joined_enabled',
        room_invite: 'room_invite_enabled',
      };
      const column = prefColumn[notifType];
      if (column) {
        const optedOut = new Set(
          (preferences ?? [])
            .filter((p) => (p as any)[column] === false)
            .map((p) => p.user_id),
        );
        targetUserIds = targetUserIds.filter((id) => !optedOut.has(id));

        if (targetUserIds.length === 0) {
          return new Response(JSON.stringify({ sent: 0, skipped: 'opted_out' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const inAppAllowed = new Map(
        (preferences ?? []).map((p) => [p.user_id, p.in_app_notifications !== false]),
      );
      const inAppRows = targetUserIds
        .filter((uid) => inAppAllowed.get(uid) !== false)
        .map((uid) => ({
          user_id: uid,
          type: notifType,
          title,
          body: messageBody ?? '',
          huddle_id: huddleId,
          data: { type: notifType, url: url ?? null },
        }));
      if (inAppRows.length > 0) {
        const { error: inAppErr } = await supabase
          .from('notifications')
          .insert(inAppRows);
        if (inAppErr) console.error('direct in-app notification error:', inAppErr);
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, expo_push_token')
        .in('user_id', targetUserIds)
        .not('expo_push_token', 'is', null);

      const messages: PushMessage[] = (profiles ?? [])
        .filter((p) => p.expo_push_token)
        .map((p) => ({
          to: p.expo_push_token!,
          title,
          body: messageBody ?? '',
          data: { type: notifType, url: url ?? null, huddleId },
          sound: 'default',
        }));

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

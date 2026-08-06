// huddle-ping — a member rallies their huddle to come watch. Abuse controls:
//   • game-gated: only works when the team has a game in the window
//     (~90 min before first pitch → during → ~4h start window covering postgame)
//   • one ping per huddle per game (DB unique index on huddle_pings)
//   • membership required
//   • recipients who turned off game pings (profiles.game_pings_enabled=false)
//     are skipped; the sender never pings themselves.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// The client shows "Rally the huddle" for any pregame game (getGameState only
// checks status, not clock), so a 90-min-ahead cap meant tapping in the morning
// for a night game silently failed — the button just vanished. Allow rallying
// any same-day upcoming game so the button always does what it says. The
// one-ping-per-huddle-per-game cap still prevents spam.
const WINDOW_AHEAD_MS = 12 * 60 * 60 * 1000;  // up to 12h before first pitch
const WINDOW_BEHIND_MS = 4 * 60 * 60 * 1000;  // up to 4h after start (covers postgame)

function err(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ ok: false, code, message }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Expected, non-error outcomes (button shows a friendly state) — return 200 so
// the client reads { ok:false, code } from data instead of an HTTP error.
function soft(code: string, message: string) {
  return new Response(JSON.stringify({ ok: false, code, message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Identify the caller.
    const asUser = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return err(401, "auth", "Not authenticated");
    const uid = user.id;

    const { huddleId } = await req.json().catch(() => ({}));
    if (!huddleId) return err(400, "bad_request", "Missing huddleId");

    const admin = createClient(url, serviceKey);

    // Membership + the huddle's team/name.
    const { data: huddle } = await admin
      .from("huddles")
      .select("id, name, team_id, teams(name, city)")
      .eq("id", huddleId)
      .maybeSingle();
    if (!huddle?.team_id) return err(404, "no_huddle", "Huddle not found");

    const { data: membership } = await admin
      .from("huddle_members").select("user_id")
      .eq("huddle_id", huddleId).eq("user_id", uid).maybeSingle();
    if (!membership) return err(403, "not_member", "You're not in this huddle");

    // A game for this team within the window — pick the one nearest to now.
    const now = Date.now();
    const lo = new Date(now - WINDOW_BEHIND_MS).toISOString();
    const hi = new Date(now + WINDOW_AHEAD_MS).toISOString();
    const { data: games } = await admin
      .from("games")
      .select("id, status, start_time, home_score, away_score, home_team_id, away_team_id")
      .or(`home_team_id.eq.${huddle.team_id},away_team_id.eq.${huddle.team_id}`)
      .gte("start_time", lo).lte("start_time", hi);
    let game: any = null, best = Infinity;
    for (const g of games ?? []) {
      const d = Math.abs(Date.parse(g.start_time) - now);
      if (d < best) { best = d; game = g; }
    }
    if (!game) return soft("no_game", "No game right now to rally around");

    // The cap: one ping per huddle per game. Insert first — a unique violation
    // means it's already been rallied for this game.
    const { error: insErr } = await admin
      .from("huddle_pings")
      .insert({ huddle_id: huddleId, game_id: game.id, sender_id: uid });
    if (insErr) {
      if (insErr.code === "23505") return soft("already_pinged", "This huddle was already rallied for this game");
      return err(500, "db", insErr.message);
    }

    // Build the human copy.
    const teamName = (huddle as any).teams?.name || "the";
    const { data: senderProfile } = await admin
      .from("profiles").select("display_name, username").eq("user_id", uid).maybeSingle();
    const senderName = senderProfile?.display_name || senderProfile?.username || "Someone";

    const startMs = Date.parse(game.start_time);
    let context: string;
    if (startMs > now) {
      const mins = Math.max(1, Math.round((startMs - now) / 60000));
      context = `first pitch in ${mins} min`;
    } else if (game.status === "final") {
      context = "the game just wrapped";
    } else {
      context = "the game's on";
    }
    const title = huddle.name || `${teamName} huddle`;
    const body = `${senderName} is in the huddle — ${context}. Jump in 🟢`;

    // Recipients: members with a push token, pings on, not the sender.
    const { data: members } = await admin
      .from("huddle_members").select("user_id").eq("huddle_id", huddleId);
    const memberIds = (members ?? []).map((m) => m.user_id).filter((id) => id !== uid);
    let pushed = 0;
    if (memberIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, expo_push_token, game_pings_enabled")
        .in("user_id", memberIds)
        .not("expo_push_token", "is", null);
      const messages = (profiles ?? [])
        .filter((p) => p.game_pings_enabled !== false && p.expo_push_token)
        .map((p) => ({
          to: p.expo_push_token, title, body, sound: "default",
          data: { type: "huddle_ping", huddleId },
        }));
      if (messages.length > 0) {
        try {
          await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(messages),
          });
          pushed = messages.length;
        } catch (e) {
          console.error("expo push:", e);
        }
      }
    }

    // Leave a trace in the room so it's social, not silent.
    const { data: sysUser } = await admin.rpc("get_or_create_system_user");
    if (sysUser) {
      await admin.from("huddle_messages").insert({
        huddle_id: huddleId, user_id: sysUser,
        content: `📣 ${senderName} rallied the huddle — ${context}.`,
        is_bot_message: true, message_type: "ping",
      });
    }

    return new Response(JSON.stringify({ ok: true, pushed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return err(500, "error", e.message);
  }
});

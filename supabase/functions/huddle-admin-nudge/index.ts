// huddle-admin-nudge — one nudge to the admin of a room that is still one person.
//
// The admin is the only person who can turn a 1-person room into a 40-person
// room, so a room sitting at one member 48 hours after creation is the highest
// value message in the product. This is not spam: it is addressed to the one
// person who asked for the room, and huddle_admin_nudge_log's unique constraint
// means it fires exactly once, ever.
//
// Runs hourly on pg_cron.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AGE_HOURS = Number(Deno.env.get("ADMIN_NUDGE_AFTER_HOURS") || 48);
const BATCH = Number(Deno.env.get("ADMIN_NUDGE_BATCH") || 50);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "missing supabase env" }, 500);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const summary = { candidates: 0, nudged: 0, errors: [] as string[] };

  try {
    const cutoff = new Date(Date.now() - AGE_HOURS * 3600 * 1000).toISOString();

    const { data: huddles } = await supabase
      .from("huddles")
      .select("id, name, team_id, created_at")
      .lte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(500);
    if (!huddles || huddles.length === 0) return json({ ok: true, ...summary });

    // Already nudged? The unique constraint would reject the insert anyway, but
    // filtering here saves the member-count queries.
    const { data: nudged } = await supabase
      .from("huddle_admin_nudge_log")
      .select("huddle_id")
      .in("huddle_id", huddles.map((h) => h.id));
    const already = new Set((nudged ?? []).map((r) => r.huddle_id));

    for (const huddle of huddles) {
      if (summary.nudged >= BATCH) break;
      if (already.has(huddle.id)) continue;

      const { count } = await supabase
        .from("huddle_members")
        .select("user_id", { count: "exact", head: true })
        .eq("huddle_id", huddle.id);
      if ((count ?? 0) !== 1) continue;

      summary.candidates++;
      try {
        await postNudge(supabase, huddle.id, huddle.team_id);
        summary.nudged++;
      } catch (err) {
        console.error(`[admin-nudge] ${huddle.id} failed`, err);
        summary.errors.push(`${huddle.id}: ${err}`);
      }
    }

    return json({ ok: true, ...summary });
  } catch (err) {
    console.error("[admin-nudge] fatal", err);
    return json({ error: String(err) }, 500);
  }
});

async function postNudge(
  supabase: SupabaseClient,
  huddleId: string,
  teamId: string | null,
): Promise<void> {
  const { data: systemUserId } = await supabase.rpc("get_or_create_system_user");
  if (!systemUserId) throw new Error("no system user");

  const content = await nudgeCopy(supabase, teamId);

  const { error } = await supabase.from("huddle_messages").insert({
    huddle_id: huddleId,
    user_id: systemUserId,
    content,
    is_bot_message: true,
    // Renders with the "Add your crew" button — same treatment as the admin
    // welcome. See mobile/src/components/huddle/ChatMessage.tsx.
    message_type: "admin_welcome",
  });
  if (error) throw error;

  await supabase.from("huddle_admin_nudge_log").insert({ huddle_id: huddleId });
}

/**
 * Gameday copy beats generic copy, so if there's a game on the schedule we lead
 * with it. That's the version that actually converts during a season.
 */
async function nudgeCopy(
  supabase: SupabaseClient,
  teamId: string | null,
): Promise<string> {
  if (teamId) {
    const { data: game } = await supabase
      .from("games")
      .select("start_time, home_team_id, away_team_id")
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq("status", "scheduled")
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (game) {
      const oppId = game.home_team_id === teamId ? game.away_team_id : game.home_team_id;
      const { data: opp } = await supabase
        .from("teams")
        .select("name, city")
        .eq("id", oppId)
        .maybeSingle();
      const oppName = opp
        ? ([opp.city, opp.name].filter(Boolean).join(" ").trim() || opp.name)
        : "them";
      const when = new Date(game.start_time).toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: "America/New_York",
      });

      return `We're on ${when} against ${oppName} — and right now it's just you and me in here. 👀\n\nI'll call the game either way, but it hits different with a few people to argue with.\n\n**→ Add your crew**`;
    }
  }

  return `Still just us in here. 👀\n\nI can call the whole game, but it's a lot better with a section behind you. Two or three friends is all it takes.\n\n**→ Add your crew**`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

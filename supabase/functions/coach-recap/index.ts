// coach-recap — the proactive "here's what you missed" post.
//
// This is the discovery mechanism for the whole answerable-Coach feature.
// Mention-based features get found by roughly nobody; a recap that lands
// unasked teaches the room that the Coach can do this, and it converts the
// biggest churn driver in group chat (400 unread messages = a reason NOT to
// open the app) into a reason to open it.
//
// Economics note: a POSTED recap is one model call for the whole room. A
// private answer is one call per person. Same content, wildly different bill —
// which is why the proactive post is the primary form and @coach is the
// follow-up.
//
// Runs every 30 minutes on pg_cron.
//   • postgame — a tracked team's game went final; recap the game AND the room.
//   • daily    — once per day per room, for rooms with real activity.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getGameBeats,
  getGameSnapshot,
  getHuddleContext,
  getLedger,
  getRoomTranscript,
  getTeamRecord,
} from "../_shared/coach/retrieve.ts";
import { composeRecap } from "../_shared/coach/answer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENABLED = (Deno.env.get("COACH_RECAP_ENABLED") || "true").toLowerCase() === "true";

// Gated rollout. Kickoff week is simultaneously the best moment and the worst
// possible day to discover a cost bug and a latency bug at the same time. Set
// COACH_RECAP_HUDDLES to a comma-separated list to limit the blast radius;
// leave it empty for all rooms.
const HUDDLE_ALLOWLIST = (Deno.env.get("COACH_RECAP_HUDDLES") || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

// UTC hour for the daily pass.
const DAILY_HOUR_UTC = Number(Deno.env.get("COACH_DAILY_RECAP_HOUR_UTC") || 15);

// A game counts as "just finished" for this long after we see it go final.
const POSTGAME_WINDOW_MIN = Number(Deno.env.get("COACH_POSTGAME_WINDOW_MIN") || 120);

// Don't recap a room where nobody said anything and nothing happened.
const MIN_HUMAN_LINES_FOR_DAILY = Number(Deno.env.get("COACH_DAILY_MIN_LINES") || 5);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!ENABLED) return json({ skipped: "disabled" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "missing supabase env" }, 500);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Allow a manual kick: { kind: "daily" | "postgame", huddle_id?: "..." }
  let force: { kind?: string; huddle_id?: string } = {};
  try { force = await req.json(); } catch { /* cron sends {} */ }

  const summary = {
    postgame_candidates: 0,
    daily_candidates: 0,
    posted: 0,
    skipped_no_content: 0,
    errors: [] as string[],
  };

  try {
    const jobs: { huddleId: string; kind: "postgame" | "daily" }[] = [];

    if (force.huddle_id) {
      jobs.push({
        huddleId: force.huddle_id,
        kind: force.kind === "daily" ? "daily" : "postgame",
      });
    } else {
      const postgame = await findPostgameHuddles(supabase);
      summary.postgame_candidates = postgame.length;
      jobs.push(...postgame.map((h) => ({ huddleId: h, kind: "postgame" as const })));

      if (new Date().getUTCHours() === DAILY_HOUR_UTC) {
        const daily = await findDailyHuddles(supabase);
        summary.daily_candidates = daily.length;
        jobs.push(...daily.map((h) => ({ huddleId: h, kind: "daily" as const })));
      }
    }

    for (const job of jobs) {
      if (HUDDLE_ALLOWLIST.length > 0 && !HUDDLE_ALLOWLIST.includes(job.huddleId)) continue;
      try {
        const posted = await recapOne(supabase, job.huddleId, job.kind);
        if (posted) summary.posted++;
        else summary.skipped_no_content++;
      } catch (err) {
        console.error(`[coach-recap] ${job.huddleId} failed`, err);
        summary.errors.push(`${job.huddleId}: ${err}`);
      }
    }

    return json({ ok: true, ...summary });
  } catch (err) {
    console.error("[coach-recap] fatal", err);
    return json({ error: String(err) }, 500);
  }
});

// ---------------------------------------------------------------------------
// Candidate selection
// ---------------------------------------------------------------------------

/** Huddles whose team just had a game go final and haven't been recapped for it. */
async function findPostgameHuddles(supabase: SupabaseClient): Promise<string[]> {
  const windowStart = new Date(Date.now() - POSTGAME_WINDOW_MIN * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: games } = await supabase
    .from("games")
    .select("id, home_team_id, away_team_id, last_synced_at, start_time")
    .eq("status", "final")
    .gte("start_time", dayAgo)
    .gte("last_synced_at", windowStart);

  if (!games || games.length === 0) return [];

  const teamIds = [...new Set(
    games.flatMap((g) => [g.home_team_id, g.away_team_id]).filter(Boolean),
  )] as string[];
  if (teamIds.length === 0) return [];

  const { data: huddles } = await supabase
    .from("huddles")
    .select("id")
    .in("team_id", teamIds);
  if (!huddles) return [];

  const ids = huddles.map((h) => h.id);
  const already = await recentlyRecapped(supabase, ids, "postgame", POSTGAME_WINDOW_MIN * 60 * 1000);
  return ids.filter((id) => !already.has(id));
}

/** Rooms with real conversation in the last day, not yet recapped today. */
async function findDailyHuddles(supabase: SupabaseClient): Promise<string[]> {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: msgs } = await supabase
    .from("huddle_messages")
    .select("huddle_id")
    .eq("is_bot_message", false)
    .gte("created_at", dayAgo)
    .limit(5000);
  if (!msgs) return [];

  const counts = new Map<string, number>();
  for (const m of msgs) counts.set(m.huddle_id, (counts.get(m.huddle_id) ?? 0) + 1);

  const active = [...counts.entries()]
    .filter(([, n]) => n >= MIN_HUMAN_LINES_FOR_DAILY)
    .map(([id]) => id);
  if (active.length === 0) return [];

  const already = await recentlyRecapped(supabase, active, "daily", 20 * 3600 * 1000);
  return active.filter((id) => !already.has(id));
}

async function recentlyRecapped(
  supabase: SupabaseClient,
  huddleIds: string[],
  kind: string,
  windowMs: number,
): Promise<Set<string>> {
  if (huddleIds.length === 0) return new Set();
  const since = new Date(Date.now() - windowMs).toISOString();
  const { data } = await supabase
    .from("coach_recap_log")
    .select("huddle_id")
    .eq("kind", kind)
    .in("huddle_id", huddleIds)
    .gte("created_at", since);
  return new Set((data ?? []).map((r) => r.huddle_id));
}

// ---------------------------------------------------------------------------
// Compose + post one recap
// ---------------------------------------------------------------------------

async function recapOne(
  supabase: SupabaseClient,
  huddleId: string,
  kind: "postgame" | "daily",
): Promise<boolean> {
  const ctx = await getHuddleContext(supabase, huddleId);
  if (!ctx) return false;

  // A postgame recap looks back over the game; a daily one over the day.
  const hours = kind === "postgame" ? 8 : 24;
  const sinceIso = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  const [transcript, gameBeats, newsBeats, ledger, game, record] = await Promise.all([
    getRoomTranscript(supabase, huddleId, sinceIso),
    ctx.teamId ? getGameBeats(supabase, ctx.teamId, sinceIso, "in_game") : Promise.resolve([]),
    ctx.teamId ? getGameBeats(supabase, ctx.teamId, sinceIso, "news") : Promise.resolve([]),
    getLedger(supabase, huddleId),
    ctx.teamId ? getGameSnapshot(supabase, ctx.teamId) : Promise.resolve(null),
    ctx.teamId ? getTeamRecord(supabase, ctx.teamId) : Promise.resolve(null),
  ]);

  const text = await composeRecap({
    ctx, kind, transcript, gameBeats, newsBeats, ledger, game, record,
  });
  // composeRecap returns null when every lane is empty — post nothing rather
  // than "it was quiet in here", which trains people to ignore the Coach.
  if (!text) return false;

  const { data: systemUserId } = await supabase.rpc("get_or_create_system_user");
  if (!systemUserId) return false;

  const { data: inserted, error } = await supabase
    .from("huddle_messages")
    .insert({
      huddle_id: huddleId,
      user_id: systemUserId,
      content: text,
      is_bot_message: true,
      message_type: "coach_recap",
    })
    .select("id")
    .single();
  if (error) {
    console.error("[coach-recap] insert failed", error);
    return false;
  }

  await supabase.from("coach_recap_log").insert({
    huddle_id: huddleId,
    kind,
    message_id: inserted?.id ?? null,
  });

  // Postgame is genuinely push-worthy: the game ended, you weren't watching,
  // here is the whole thing in three lines. The daily one is not — it can wait
  // for the next app open.
  if (kind === "postgame") {
    await triggerPush(ctx.teamName ?? ctx.huddleName, [huddleId], text.slice(0, 140));
  }

  return true;
}

async function triggerPush(title: string, huddleIds: string[], preview: string): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  try {
    await fetch(`${url}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${title} — what you missed`,
        body: preview,
        huddle_ids: huddleIds,
        source: "coach_recap",
      }),
    });
  } catch (err) {
    console.warn("[coach-recap] push failed", err);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// coach-ask — the Coach answers a question asked in a huddle.
//
// Fired by the notify_coach_mention trigger on huddle_messages when a member
// either types "@coach" or replies to one of the Coach's own messages. The
// reply path matters: it is the Grok-in-X affordance, attached to the post
// instead of the nav bar, and it costs zero pixels of chrome.
//
// Cost control is the thing that bites here. The news bot is capped by cron;
// this is user-triggered and unbounded, and the Anthropic balance has already
// gone dry once (June 2026). Every answer is rate limited per huddle and per
// user and logged, in the same spirit as bot_emit_log.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getEspnStandings,
  getGameBeats,
  getGameSnapshot,
  getHuddleContext,
  getLedger,
  getRoomTranscript,
  getTeamRecord,
} from "../_shared/coach/retrieve.ts";
import { answerQuestion, routeQuestion, type Lane } from "../_shared/coach/answer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Answers per huddle per hour, and per user per hour. Forty people in a room
// during a rivalry game will absolutely spam this.
const HUDDLE_HOURLY_CAP = Number(Deno.env.get("COACH_HUDDLE_HOURLY_CAP") || 20);
const USER_HOURLY_CAP = Number(Deno.env.get("COACH_USER_HOURLY_CAP") || 6);

// How far back the Coach reads the room when answering.
const TRANSCRIPT_HOURS = Number(Deno.env.get("COACH_TRANSCRIPT_HOURS") || 24);

interface AskPayload {
  message_id: string;
  huddle_id: string;
  user_id: string;
  content: string;
  reply_to_id?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "missing supabase env" }, 500);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let payload: AskPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (!payload.huddle_id || !payload.content) {
    return json({ error: "huddle_id and content required" }, 400);
  }

  try {
    // --- 1. Coach enabled for this room? -----------------------------------
    const { data: settings } = await supabase
      .from("huddle_chatbot_settings")
      .select("is_enabled")
      .eq("huddle_id", payload.huddle_id)
      .maybeSingle();
    if (settings && settings.is_enabled === false) {
      return json({ skipped: "coach disabled for huddle" });
    }

    // --- 2. Rate limits -----------------------------------------------------
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count: huddleCount } = await supabase
      .from("coach_ask_log")
      .select("id", { count: "exact", head: true })
      .eq("huddle_id", payload.huddle_id)
      .gte("created_at", hourAgo);
    if ((huddleCount ?? 0) >= HUDDLE_HOURLY_CAP) {
      console.log(`[coach-ask] huddle ${payload.huddle_id} over hourly cap`);
      return json({ skipped: "huddle rate limited" });
    }

    const { count: userCount } = await supabase
      .from("coach_ask_log")
      .select("id", { count: "exact", head: true })
      .eq("huddle_id", payload.huddle_id)
      .eq("user_id", payload.user_id)
      .gte("created_at", hourAgo);
    if ((userCount ?? 0) >= USER_HOURLY_CAP) {
      console.log(`[coach-ask] user ${payload.user_id} over hourly cap`);
      return json({ skipped: "user rate limited" });
    }

    // --- 3. Room context ----------------------------------------------------
    const ctx = await getHuddleContext(supabase, payload.huddle_id);
    if (!ctx) return json({ error: "huddle not found" }, 404);

    // --- 4. Build the question ---------------------------------------------
    let question = payload.content.replace(/@coach/gi, "").trim();

    // Replying to a Coach message with no text of your own is itself a
    // question: "tell me more about this". Give the model the message being
    // replied to so "wait, what?" resolves to something.
    if (payload.reply_to_id) {
      const { data: parent } = await supabase
        .from("huddle_messages")
        .select("content, is_bot_message")
        .eq("id", payload.reply_to_id)
        .maybeSingle();
      if (parent?.is_bot_message && parent.content) {
        const quoted = String(parent.content).slice(0, 300);
        question = question
          ? `(replying to your message: "${quoted}") ${question}`
          : `(replying to your message: "${quoted}") — say more about this`;
      }
    }
    if (!question) return json({ skipped: "empty question" });

    const asker = await askerName(supabase, payload.user_id);

    // --- 5. Route, then retrieve ONLY what that lane needs -------------------
    const lane: Lane = await routeQuestion(question);

    const sinceIso = new Date(Date.now() - TRANSCRIPT_HOURS * 3600 * 1000).toISOString();
    const needsRoom = lane === "room" || lane === "mixed";
    const needsGame = lane === "game" || lane === "mixed" || lane === "ledger";
    const teamId = ctx.teamId;

    const [transcript, gameBeats, newsBeats, ledger, game, record] = await Promise.all([
      needsRoom ? getRoomTranscript(supabase, payload.huddle_id, sinceIso) : Promise.resolve([]),
      needsGame && teamId ? getGameBeats(supabase, teamId, sinceIso, "in_game") : Promise.resolve([]),
      needsGame && teamId ? getGameBeats(supabase, teamId, sinceIso, "news") : Promise.resolve([]),
      lane === "ledger" || lane === "mixed"
        ? getLedger(supabase, payload.huddle_id)
        : Promise.resolve([]),
      needsGame && teamId ? getGameSnapshot(supabase, teamId) : Promise.resolve(null),
      needsGame && teamId ? getTeamRecord(supabase, teamId) : Promise.resolve(null),
    ]);

    // Standings is best-effort and must never block or throw into the answer.
    const standings = lane === "game"
      ? await getEspnStandings(ctx.league, ctx.teamName).catch(() => null)
      : null;

    // --- 6. Answer -----------------------------------------------------------
    const text = await answerQuestion({
      ctx,
      question,
      asker,
      lane,
      transcript,
      gameBeats,
      newsBeats,
      ledger,
      game,
      record,
      standings,
    });

    if (!text.trim()) return json({ skipped: "empty answer" });

    // --- 7. Post it back, threaded to the question ---------------------------
    const { data: systemUserId } = await supabase.rpc("get_or_create_system_user");
    if (!systemUserId) return json({ error: "no system user" }, 500);

    const { data: inserted, error: insertErr } = await supabase
      .from("huddle_messages")
      .insert({
        huddle_id: payload.huddle_id,
        user_id: systemUserId,
        content: text,
        is_bot_message: true,
        message_type: "coach_answer",
        reply_to_id: payload.message_id ?? null,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[coach-ask] insert failed", insertErr);
      return json({ error: "insert failed" }, 500);
    }

    // --- 8. Audit + rate-limit ledger ---------------------------------------
    await supabase.from("coach_ask_log").insert({
      huddle_id: payload.huddle_id,
      user_id: payload.user_id,
      question: question.slice(0, 500),
      lane,
      answer_message_id: inserted?.id ?? null,
    });

    return json({ ok: true, lane, message_id: inserted?.id });
  } catch (err) {
    console.error("[coach-ask] failed", err);
    return json({ error: String(err) }, 500);
  }
});

async function askerName(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.display_name || data?.username || "Someone";
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

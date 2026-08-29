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
import { searchX } from "../_shared/coach/xsearch.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getBoxScore,
  getEspnStanding,
  getGameBeats,
  getGameSnapshot,
  getHuddleContext,
  getLedger,
  getNextGame,
  getRoomTranscript,
  getSeasonResults,
  getTeamRecord,
} from "../_shared/coach/retrieve.ts";
import {
  answerQuestion,
  composeRecap,
  isRecapQuestion,
  routeQuestion,
  type Lane,
} from "../_shared/coach/answer.ts";

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
  // SCAN MODE — an empty body means "find anything unanswered and answer it".
  //
  // The on_coach_mention trigger calls this over pg_net and those calls have
  // never landed: verified 2026-08-12/13, the function answers in ~5s when
  // called directly, yet not one trigger-originated answer exists. Rather than
  // keep chasing the HTTP layer, cron drives it — the same mechanism that runs
  // bot-live-poller every minute without trouble. The trigger can stay; this
  // is simply a net that catches whatever it drops.
  if (!payload.huddle_id && !payload.content) {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: asks } = await supabase
      .from("huddle_messages")
      .select("id, huddle_id, user_id, content, created_at")
      .eq("is_bot_message", false)
      .ilike("content", "%@coach%")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(10);

    // Skip anything already answered — the reply carries reply_to_id.
    const ids = (asks ?? []).map((a: any) => a.id);
    const answered = new Set<string>();
    if (ids.length) {
      const { data: replies } = await supabase
        .from("huddle_messages")
        .select("reply_to_id")
        .in("reply_to_id", ids);
      for (const r of replies ?? []) answered.add((r as any).reply_to_id);
    }

    const pending = (asks ?? []).filter((a: any) => !answered.has(a.id));
    const handled: string[] = [];
    for (const a of pending) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/coach-ask`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            message_id: a.id, huddle_id: a.huddle_id,
            user_id: a.user_id, content: a.content, reply_to_id: null,
          }),
        });
        if (res.ok) handled.push(a.id);
      } catch { /* next tick retries it */ }
    }
    return json({ mode: "scan", found: asks?.length ?? 0, pending: pending.length, answered: handled.length });
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
    // "knowledge" gets game context too. History questions constantly turn on
    // something current ("are we better than the '90 team?"), and handing over
    // the real numbers is what stops the model reaching for remembered ones.
    const needsGame =
      lane === "game" || lane === "mixed" || lane === "ledger" || lane === "knowledge";
    const needsLedger = lane === "ledger" || lane === "mixed";
    const teamId = ctx.teamId;

    // The game is fetched first, alone, because its sport scopes the record and
    // the season results. One team row covers football and basketball alike, so
    // without it a football question is answered with a basketball record.
    const gameSnap = needsGame && teamId ? await getGameSnapshot(supabase, teamId) : null;
    const game = gameSnap;

    const [transcript, gameBeats, newsBeats, ledger, record, boxScore, seasonResults, nextGame] =
      await Promise.all([
        // ALWAYS fetch the recent turns, whatever lane the router picked.
        //
        // "@coach pull up his bio" is unanswerable without the message two
        // above it that said Richard Young — and that question does not look
        // like a "room" question, so the router sent it down a lane that
        // dropped the transcript. The Coach then asked who "he" was, in a
        // thread where it had just been told. A follow-up is the most natural
        // thing a person types; losing the thread is the worst thing to do
        // with it.
        getRoomTranscript(supabase, payload.huddle_id, sinceIso),
        needsGame && teamId ? getGameBeats(supabase, teamId, sinceIso, "in_game") : Promise.resolve([]),
        needsGame && teamId ? getGameBeats(supabase, teamId, sinceIso, "news") : Promise.resolve([]),
        needsLedger ? getLedger(supabase, payload.huddle_id) : Promise.resolve([]),
        needsGame && teamId ? getTeamRecord(supabase, teamId, gameSnap?.sportKey) : Promise.resolve(null),
        // Box score answers "how many hits do the Yankees have". Best-effort —
        // never let an ESPN hiccup fail the whole answer.
        needsGame && teamId
          ? getBoxScore(supabase, teamId, ctx.league).catch(() => null)
          : Promise.resolve(null),
        needsGame && teamId ? getSeasonResults(supabase, teamId, 30, gameSnap?.sportKey) : Promise.resolve([]),
        // "What time is the next game" is one of the two most likely questions
        // in the whole product. It gets its own query rather than sharing the
        // snapshot, which prefers a just-finished game over an upcoming one.
        needsGame && teamId ? getNextGame(supabase, teamId) : Promise.resolve(null),
      ]);

    // Standings: the OTHER most likely question. Try ESPN for table position,
    // but our own W-L (getTeamRecord, computed from our games rows) is the
    // reliable half and is always present. Best-effort, never throws.
    const standings = needsGame
      ? await getEspnStanding(ctx.league, ctx.teamName).catch(() => null)
      : null;

    // --- 5b. Live X, only when the database cannot possibly answer -----------
    // Gated deliberately. Every call costs a tool fee plus ~8k tokens, and most
    // questions ("what's the score", "who's up") are already answered by rows
    // we hold. This is for the ones that are not: camp reports, practice notes,
    // beat-writer chatter — the class where the Coach previously had nothing
    // and either deflected or invented.
    const LIVE_X = (Deno.env.get("COACH_X_SEARCH") || "true").toLowerCase() !== "false";
    // Keyword lists fail on the obvious. "who's gonna start at quarterback"
    // missed because the list had "starter" and \bstarter\b does not match
    // "start" — so the Coach said the QB battle "hasn't been reported out to
    // me yet" while four named contenders were being written about daily.
    //
    // Two ways in now: subject words (people, roles, roster movement) OR
    // recency words (today, latest, camp). Either alone is enough, because
    // the failure mode we care about is missing a real question, and a
    // needless search costs ~2 cents while a wrong answer costs trust.
    const SUBJECT = /\b(start(s|ed|ing|er|ers)?|qb|quarterback|lineup|line-?up|roster|depth|snap|rep(s)?|injur\w*|hurt|healthy|return|back|sign(s|ed|ing)?|trade(d|s)?|cut|waive\w*|draft|recruit\w*|commit\w*|transfer|portal|coach|coordinator|battle|competition|who'?s?)\b/i;
    const RECENCY = /\b(camp|practice|today|tonight|yesterday|this week|latest|recent|news|report(s|ed|ing)?|hear(d|ing)?|saying|buzz|rumou?r|update|so far|right now|this year|this season)\b/i;
    const wantsLive = SUBJECT.test(question) || RECENCY.test(question);
    // NOTE: there used to be a "skip if the room already has fresh news" guard
    // here. It was wrong. Tulane had news — uniform reveals — so a question
    // about the QB battle skipped the search and answered "no name attached to
    // who's taking snaps" while four contenders were being written about daily.
    // Having SOME news is not having THE answer. The keyword gate is the cost
    // control; at ~2 cents a call, a needless search is far cheaper than a
    // wrong answer.
    // The keyword gate above catches the questions we THOUGHT of. It cannot
    // catch the long tail, and the long tail is most of what people ask:
    // "who is number 34", "who's their best reliever", "is he any good".
    //
    // Building a retrieval function per question shape is a losing game — a
    // roster endpoint answers exactly one of those three. So any question in a
    // CURRENT-facts lane searches, whether or not a keyword matched. The lanes
    // that are answered entirely from our own data (room chatter, the group's
    // ledger) still skip it, and the per-huddle/per-user caps still bound the
    // spend. A needless search costs ~2 cents; "I don't have that" costs a user.
    const currentLane = lane === "game" || lane === "mixed" || lane === "knowledge";
    let liveSearch = "";
    if (LIVE_X && (wantsLive || currentLane) && ctx.teamName) {
      const r = await searchX(`${ctx.teamName} ${question}`);
      if (r.ok && r.text) liveSearch = r.text.slice(0, 1200);
    }

    // --- 6. Answer -----------------------------------------------------------
    // "what did I miss" asked out loud is the SAME question the proactive recap
    // answers, so it gets the same two-lane shape. Without this the format
    // depended on whether a cron or a human triggered it.
    const wantsRecap = lane === "mixed" && isRecapQuestion(question);

    const text = wantsRecap
      ? (await composeRecap({
          ctx,
          kind: "daily",
          transcript,
          gameBeats,
          newsBeats,
          ledger,
          game,
          record,
        })) ?? ""
      : await answerQuestion({
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
          boxScore,
          seasonResults,
          nextGame,
          liveSearch,
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
      lane: wantsRecap ? "recap" : lane,
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

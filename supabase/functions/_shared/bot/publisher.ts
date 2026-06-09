// Bot Engine v2 — publisher. Fans out one bot message to ALL huddles for a team,
// writes audit log, and triggers a push when excitement clears the high threshold.
// Transport is hidden behind this module so the engine never touches Supabase
// inserts directly outside of dedupe/scheduling logic.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { BotMode, InGameFacts, NewsFacts } from "./types.ts";

export interface PublishInput {
  client: SupabaseClient;
  teamId: string;
  teamName: string;
  mode: BotMode;
  sourceRef?: string;                       // seen_events.id or seen_news.id
  message: string;
  facts: InGameFacts | NewsFacts;
  excitementScore?: number;
  shouldPush?: boolean;
  newsLink?: string;                        // appended outside the model (news mode)
}

export interface PublishResult {
  huddleIdsPosted: string[];
  pushed: boolean;
}

export async function publish(input: PublishInput): Promise<PublishResult> {
  const { client, teamId, mode, facts, excitementScore, sourceRef, shouldPush } = input;

  // 1. Resolve every huddle attached to this team. One bot output -> N huddles.
  const { data: huddles, error: huddlesErr } = await client
    .from("huddles")
    .select("id")
    .eq("team_id", teamId);
  if (huddlesErr) {
    console.error("[publisher] huddle lookup failed", huddlesErr);
    return { huddleIdsPosted: [], pushed: false };
  }
  if (!huddles || huddles.length === 0) {
    console.log(`[publisher] no huddles for team ${teamId} — skip`);
    return { huddleIdsPosted: [], pushed: false };
  }

  // 2. System user for the bot.
  const { data: systemUserId, error: sysErr } = await client.rpc("get_or_create_system_user");
  if (sysErr || !systemUserId) {
    console.error("[publisher] system user lookup failed", sysErr);
    return { huddleIdsPosted: [], pushed: false };
  }

  // 3. Build the final message body. News mode appends the link OUTSIDE the model
  //    so the model can never miscopy it (mouth-not-eyes).
  // Body is JUST the message — no raw URL appended. The link goes in
  // a structured embed_url field for the chat UI to render as a preview
  // card (B11). Until then, the link is invisible to users but logged.
  const body = input.message;
  const embedUrl = input.newsLink && mode === "news" ? input.newsLink : null;

  // 4. Fan-out insert into huddle_messages.
  const rows = huddles.map((h) => ({
    huddle_id: h.id,
    user_id: systemUserId,
    content: body,
    embed_code: embedUrl,
    is_bot_message: true,
    message_type: mode === "in_game" ? "live_play" : "news",
  }));

  const { data: inserted, error: insertErr } = await client
    .from("huddle_messages")
    .insert(rows)
    .select("id, huddle_id");
  if (insertErr) {
    console.error("[publisher] huddle_messages insert failed", insertErr);
    return { huddleIdsPosted: [], pushed: false };
  }

  // 5. Audit log — one row per emission (not per huddle).
  await client.from("bot_emit_log").insert({
    team_id: teamId,
    huddle_id: inserted?.[0]?.huddle_id ?? null,
    mode,
    source_ref: sourceRef,
    facts,
    message_text: body,
    excitement_score: excitementScore ?? null,
    pushed: !!shouldPush,
  });

  // 6. Push notification — delegate to existing send-push-notification edge function.
  //    Only fire when shouldPush is true AND there's a real huddle audience.
  let pushed = false;
  if (shouldPush && inserted && inserted.length > 0) {
    pushed = await triggerPush({
      teamName: input.teamName,
      huddleIds: inserted.map((r) => r.huddle_id),
      preview: body.slice(0, 140),
    });
  }

  return {
    huddleIdsPosted: (inserted ?? []).map((r) => r.huddle_id),
    pushed,
  };
}

async function triggerPush(input: { teamName: string; huddleIds: string[]; preview: string }): Promise<boolean> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.teamName,
        body: input.preview,
        huddle_ids: input.huddleIds,
        source: "bot_v2",
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn("[publisher] push trigger failed", err);
    return false;
  }
}

// ---------------------------------------------------------------
// Daily cap helper. Returns true if we still have headroom to emit a news
// item for this team today. Reads bot_emit_log.
// ---------------------------------------------------------------
export async function newsCapRemaining(client: SupabaseClient, teamId: string): Promise<number> {
  const cap = Number(Deno.env.get("NEWS_DAILY_CAP_PER_TEAM") || 5);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await client
    .from("bot_emit_log")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("mode", "news")
    .gte("created_at", since);
  return Math.max(0, cap - (count ?? 0));
}

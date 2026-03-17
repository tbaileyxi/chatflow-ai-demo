/**
 * discover-event-sources
 *
 * Given an event_id, uses the Claude API to auto-discover relevant
 * X (Twitter) accounts/hashtags and subreddits, then upserts them
 * into event_content_sources.
 *
 * Invoke via POST /functions/v1/discover-event-sources
 * Body: { event_id: string }
 * Auth: service_role key (called by admin or cron)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.3";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { event_id } = await req.json();
  if (!event_id) {
    return new Response(JSON.stringify({ error: "event_id required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch the event
  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("*")
    .eq("id", event_id)
    .single();

  if (eventErr || !event) {
    return new Response(JSON.stringify({ error: "Event not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Ask Claude to generate sources
  const prompt = `You are a sports social media expert. Given a major sporting event, list the most relevant X (Twitter) accounts, hashtags, and subreddits that fans follow for live coverage and discussion.

Event: ${event.name}
Sport: ${event.sport}
League: ${event.league ?? "N/A"}
Dates: ${event.starts_at} to ${event.ends_at}

Respond with ONLY valid JSON in this exact shape (no markdown, no explanation):
{
  "twitter_accounts": ["@handle1", "@handle2"],
  "twitter_hashtags": ["#tag1", "#tag2"],
  "subreddits": ["r/sub1", "r/sub2"]
}

Include:
- Official team/league/event accounts
- Top sports journalists covering this event
- The main subreddit for this sport/event
- Game-specific or event-specific subreddits if they exist
- Up to 8 Twitter accounts, 6 hashtags, 4 subreddits`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  let discovered: {
    twitter_accounts: string[];
    twitter_hashtags: string[];
    subreddits: string[];
  };

  try {
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    discovered = JSON.parse(text);
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to parse Claude response" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build rows to upsert
  const rows: Array<{
    event_id: string;
    platform: string;
    source_type: string;
    source_value: string;
    auto_discovered: boolean;
    confidence: number;
  }> = [];

  for (const handle of discovered.twitter_accounts ?? []) {
    rows.push({ event_id, platform: "twitter", source_type: "account", source_value: handle, auto_discovered: true, confidence: 0.9 });
  }
  for (const tag of discovered.twitter_hashtags ?? []) {
    rows.push({ event_id, platform: "twitter", source_type: "hashtag", source_value: tag, auto_discovered: true, confidence: 0.85 });
  }
  for (const sub of discovered.subreddits ?? []) {
    rows.push({ event_id, platform: "reddit", source_type: "subreddit", source_value: sub, auto_discovered: true, confidence: 0.9 });
  }

  if (rows.length === 0) {
    return new Response(
      JSON.stringify({ message: "No sources discovered", event_id }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const { error: upsertErr } = await supabase
    .from("event_content_sources")
    .upsert(rows, { onConflict: "event_id,platform,source_value" });

  if (upsertErr) {
    return new Response(
      JSON.stringify({ error: upsertErr.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, sources_added: rows.length, event_id }),
    { headers: { "Content-Type": "application/json" } }
  );
});

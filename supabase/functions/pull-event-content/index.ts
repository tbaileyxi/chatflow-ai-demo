/**
 * pull-event-content
 *
 * Pulls fresh content from X/Reddit for all live or upcoming events.
 * Called by pg_cron:
 *   - Every 20 min during live events (pulse mode)
 *   - Once daily (06:00 UTC) for upcoming events (pre-event mode)
 *
 * Uses Twitter API v2 (Bearer token) and Reddit JSON API (no auth needed).
 *
 * POST /functions/v1/pull-event-content
 * Body: { mode: "pulse" | "daily" }  — defaults to "pulse"
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const TWITTER_BEARER = Deno.env.get("TWITTER_BEARER_TOKEN");

// ── Twitter helpers ─────────────────────────────────────────────────────────

async function searchTwitter(query: string, maxResults = 10): Promise<ContentRow[]> {
  if (!TWITTER_BEARER) return [];

  const url = new URL("https://api.twitter.com/2/tweets/search/recent");
  url.searchParams.set("query", `${query} -is:retweet lang:en`);
  url.searchParams.set("max_results", String(Math.min(maxResults, 100)));
  url.searchParams.set("tweet.fields", "created_at,public_metrics,author_id");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "username");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${TWITTER_BEARER}` },
  });

  if (!res.ok) return [];

  const json = await res.json();
  const users: Record<string, string> = {};
  for (const u of json.includes?.users ?? []) {
    users[u.id] = u.username;
  }

  return (json.data ?? []).map((t: any) => ({
    platform: "twitter",
    external_id: t.id,
    author: users[t.author_id] ? `@${users[t.author_id]}` : null,
    content: t.text,
    url: `https://x.com/i/web/status/${t.id}`,
    engagement_score: (t.public_metrics?.like_count ?? 0) + (t.public_metrics?.retweet_count ?? 0),
  }));
}

// ── Reddit helpers ──────────────────────────────────────────────────────────

async function searchReddit(subreddit: string, query: string, limit = 10): Promise<ContentRow[]> {
  const sub = subreddit.replace(/^r\//, "");
  const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&sort=new&limit=${limit}&restrict_sr=1`;

  const res = await fetch(url, { headers: { "User-Agent": "SideHuddleBot/1.0" } });
  if (!res.ok) return [];

  const json = await res.json();

  return (json.data?.children ?? []).map((c: any) => {
    const p = c.data;
    return {
      platform: "reddit",
      external_id: p.id,
      author: p.author,
      content: p.title + (p.selftext ? `\n${p.selftext.slice(0, 500)}` : ""),
      url: `https://reddit.com${p.permalink}`,
      engagement_score: p.score,
    };
  });
}

// ── Types ───────────────────────────────────────────────────────────────────

interface ContentRow {
  platform: string;
  external_id: string;
  author: string | null;
  content: string;
  url: string;
  engagement_score: number;
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json().catch(() => ({}));
  const mode: "pulse" | "daily" = body.mode ?? "pulse";

  // Fetch events we should pull for
  const statusFilter = mode === "pulse" ? ["live"] : ["upcoming", "live"];
  const { data: events, error: eventsErr } = await supabase
    .from("events")
    .select("id, name, short_name")
    .in("status", statusFilter);

  if (eventsErr || !events?.length) {
    return new Response(
      JSON.stringify({ message: "No events to pull", mode }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  let totalInserted = 0;

  for (const event of events) {
    // Get active sources for this event
    const { data: sources } = await supabase
      .from("event_content_sources")
      .select("id, platform, source_type, source_value")
      .eq("event_id", event.id)
      .eq("active", true);

    if (!sources?.length) continue;

    const contentRows: Array<ContentRow & { event_id: string; source_id: string }> = [];

    for (const src of sources) {
      let results: ContentRow[] = [];

      if (src.platform === "twitter") {
        const q = src.source_type === "account"
          ? `from:${src.source_value.replace("@", "")}`
          : src.source_value;
        results = await searchTwitter(q, mode === "pulse" ? 5 : 10);
      } else if (src.platform === "reddit" && src.source_type === "subreddit") {
        results = await searchReddit(src.source_value, event.short_name ?? event.name, mode === "pulse" ? 5 : 10);
      }

      for (const r of results) {
        contentRows.push({ ...r, event_id: event.id, source_id: src.id });
      }
    }

    if (!contentRows.length) continue;

    // Upsert — skip duplicates by (platform, external_id)
    const { count } = await supabase
      .from("event_content")
      .upsert(contentRows, { onConflict: "platform,external_id", ignoreDuplicates: true })
      .select("id", { count: "exact" });

    totalInserted += count ?? 0;
  }

  return new Response(
    JSON.stringify({ success: true, mode, events_processed: events.length, content_inserted: totalInserted }),
    { headers: { "Content-Type": "application/json" } }
  );
});

// creator-mirror — a room that fills itself from its owner's X account.
//
// THE PITCH THIS EXISTS TO MAKE GOOD ON: a creator will not post twice. They
// have a voice on X and no spare effort, so any room that asks them to author
// content again is dead before the first DM. Their posts land here on their own;
// they keep doing exactly what they already do.
//
// HOW IT READS THEM. The user-timeline endpoint sits behind a $200/month tier,
// but recent search does not on this account: `from:handle -is:reply -is:retweet`
// returns exactly the posts worth mirroring, with X doing the filtering before
// we are billed for it. An earlier version routed this through xAI to avoid a
// cost that turned out not to apply, and got prose with no post ids back.
//
// Actions:
//   {}                        mirror every huddle that has an x_handle
//   { handle, huddle_id }     mirror one, for testing before anyone is contacted
//   { probe_lists: "handle" } report whether this API tier can read X Lists

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchPosts, postIdFromUrl } from "../_shared/x/media.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// A creator posts thirty times a day: replies, reposts, jokes about lunch.
// Mirroring all of it turns their room into a feed dump and they would be the
// first to hate it. These are the only three knobs that matter.
const MIN_LIKES   = Number(Deno.env.get("MIRROR_MIN_LIKES") || 5);
const PER_RUN     = Number(Deno.env.get("MIRROR_PER_RUN") || 3);
const LOOKBACK_H  = Number(Deno.env.get("MIRROR_LOOKBACK_HOURS") || 12);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let body: { handle?: string; huddle_id?: string; probe_lists?: string; list_members?: string; dry?: boolean; probe_search?: string; lookback_hours?: number } = {};
  try { body = await req.json(); } catch { /* no body is the normal case */ }

  // ── Probe: can this API tier read Lists? ──────────────────────────────────
  // Asked rather than assumed. Lists are the best source of creators per
  // fanbase — fans have already curated them — but the endpoint may sit behind
  // a paid tier, and that is a fact worth knowing before building on it.
  if (body.probe_lists) {
    const token = Deno.env.get("X_API_BEARER_TOKEN");
    if (!token) return json({ error: "X_API_BEARER_TOKEN not set" }, 500);
    const h = body.probe_lists.replace(/^@/, "");
    const out: Record<string, unknown> = { handle: h };
    try {
      const u = await fetch(`https://api.x.com/2/users/by/username/${h}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      out.user_lookup = u.status;
      const uj = await u.json();
      const id = uj?.data?.id;
      out.user_id = id ?? null;
      if (id) {
        for (const [label, path] of [
          ["owned_lists", `owned_lists`],
          ["followed_lists", `followed_lists`],
          ["list_memberships", `list_memberships`],
        ] as const) {
          const r = await fetch(`https://api.x.com/2/users/${id}/${path}?max_results=25`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const t = await r.text();
          out[label] = r.ok
            ? (JSON.parse(t)?.data ?? []).map((l: any) => ({ id: l.id, name: l.name }))
            : `${r.status}: ${t.slice(0, 160)}`;
        }
      }
    } catch (err) {
      out.error = (err as Error).message;
    }
    return json(out);
  }

  // ── Probe: native recent search ───────────────────────────────────────────
  if (body.probe_search) {
    const token = Deno.env.get("X_API_BEARER_TOKEN");
    const h = body.probe_search.replace(/^@/, "");
    const qs = new URLSearchParams({
      query: `from:${h} -is:reply -is:retweet`,
      max_results: "10",
      "tweet.fields": "text,public_metrics,created_at",
    });
    const r = await fetch(`https://api.x.com/2/tweets/search/recent?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const txt = await r.text();
    if (!r.ok) return json({ status: r.status, body: txt.slice(0, 300) });
    const j = JSON.parse(txt);
    return json({
      status: 200,
      count: (j?.data ?? []).length,
      posts: (j?.data ?? []).map((d: any) => ({
        id: d.id, likes: d?.public_metrics?.like_count ?? 0, text: d.text.slice(0, 90),
      })),
    });
  }

  // ── Who is in a list ──────────────────────────────────────────────────────
  // The creator list, already curated. Fans build these for every fanbase and
  // so has he — which means the "build a list of creators" step does not exist.
  if (body.list_members) {
    const token = Deno.env.get("X_API_BEARER_TOKEN");
    if (!token) return json({ error: "X_API_BEARER_TOKEN not set" }, 500);
    const r = await fetch(
      `https://api.x.com/2/lists/${body.list_members}/members?max_results=100&user.fields=username,name,public_metrics,description`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const txt = await r.text();
    if (!r.ok) return json({ status: r.status, body: txt.slice(0, 300) });
    const j = JSON.parse(txt);
    const members = (j?.data ?? []).map((u: any) => ({
      handle: u.username,
      name: u.name,
      followers: u?.public_metrics?.followers_count ?? 0,
    })).sort((a: any, b: any) => b.followers - a.followers);
    return json({ count: members.length, members });
  }

  // ── Which rooms to mirror ─────────────────────────────────────────────────
  let rooms: Array<{ id: string; x_handle: string; name: string | null }> = [];
  if (body.handle && body.huddle_id) {
    rooms = [{ id: body.huddle_id, x_handle: body.handle.replace(/^@/, ""), name: null }];
  } else {
    const { data, error } = await supabase
      .from("huddles")
      .select("id, name, x_handle")
      .not("x_handle", "is", null)
      .neq("x_handle", "");
    if (error) return json({ error: error.message }, 500);
    rooms = (data ?? []) as any;
  }
  if (!rooms.length) return json({ ok: true, rooms: 0, note: "no huddles have an x_handle yet" });

  const { data: botUserId } = await supabase.rpc("get_or_create_system_user");
  const summary = {
    ok: true,
    rooms: rooms.length,
    checked: 0,
    candidates: 0,
    posted: 0,
    skipped_seen: 0,
    skipped_reply_or_repost: 0,
    skipped_low: 0,
    errors: [] as string[],
    preview: [] as string[],
    candidates_kept: 0 as number | undefined,
  };

  for (const room of rooms) {
    summary.checked++;
    try {
      // X's own recent search, not an LLM.
      //
      // The first version asked xAI to find their posts, because the official
      // timeline endpoint is a $200/month tier. That worked — it described the
      // posts accurately — but returned no citation URLs, so there was no id to
      // fetch and nothing to mirror.
      //
      // Recent search turns out to be available on this tier, and it is better
      // in every way: exact rather than described, ids included, and X applies
      // -is:reply -is:retweet itself so the filtering happens before we are
      // billed for it. No LLM in this path at all now.
      const token = Deno.env.get("X_API_BEARER_TOKEN");
      if (!token) { summary.errors.push("X_API_BEARER_TOKEN not set"); break; }

      const qs = new URLSearchParams({
        query: `from:${room.x_handle} -is:reply -is:retweet`,
        max_results: "20",
        "tweet.fields": "created_at",
      });
      const sr = await fetch(`https://api.x.com/2/tweets/search/recent?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!sr.ok) {
        summary.errors.push(`${room.x_handle}: search ${sr.status}`);
        continue;
      }
      const sj = await sr.json();

      const lookback = body.lookback_hours ?? LOOKBACK_H;
      const cutoff = Date.now() - lookback * 3600 * 1000;
      const ids = (sj?.data ?? [])
        .filter((d: any) => !d.created_at || Date.parse(d.created_at) >= cutoff)
        .map((d: any) => d.id as string);
      if (!ids.length) continue;

      const posts = await fetchPosts(ids);
      summary.candidates += posts.length;

      let postedHere = 0;
      for (const p of posts) {
        if (postedHere >= PER_RUN) break;
        if (p.isReply || p.isRepost) { summary.skipped_reply_or_repost++; continue; }
        if (p.likes < MIN_LIKES)     { summary.skipped_low++; continue; }

        // Claim before posting, same as the clip puller: a unique violation
        // means another run already took this post.
        // Dry run: prove the retrieval half before writing into anyone's room.
        // Posting a test into a live room is not undoable in front of the people
        // sitting in it.
        if (body.dry) {
          postedHere++;
          summary.candidates_kept = (summary.candidates_kept ?? 0) + 1;
          summary.preview.push(`@${room.x_handle} · ${p.likes} likes · ${p.videoUrl ? "video" : p.imageUrl ? "image" : "text"} · ${p.text.slice(0, 80)}`);
          continue;
        }

        const { error: seenErr } = await supabase.from("seen_events").insert({
          game_id: `xmirror:${room.x_handle}`,
          event_id: `xmirror:${p.postId}`,
          team_id: null,
          emitted: true,
          emitted_at: new Date().toISOString(),
        });
        if (seenErr) { summary.skipped_seen++; continue; }

        const { error: insErr } = await supabase.from("huddle_messages").insert({
          huddle_id: room.id,
          user_id: botUserId,
          content: p.text.replace(/https?:\/\/t\.co\/\S+/g, "").trim(),
          embed_code: p.url,
          is_bot_message: true,
          is_team_agent_message: true,
          message_type: "creator_post",
          ...(p.videoUrl || p.imageUrl
            ? { media_url: p.videoUrl ?? p.imageUrl, media_type: p.videoUrl ? "video" : "image" }
            : {}),
        });
        if (insErr) { summary.errors.push(`${room.x_handle}: ${insErr.message}`); continue; }

        postedHere++;
        summary.posted++;
        summary.preview.push(`@${room.x_handle}: ${p.text.slice(0, 70)}`);
      }
    } catch (err) {
      summary.errors.push(`${room.x_handle}: ${(err as Error).message}`);
    }
  }

  return json(summary);
});

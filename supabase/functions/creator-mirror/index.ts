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
const MIN_LIKES   = Number(Deno.env.get("MIRROR_MIN_LIKES") || 25);
// ONE post per room per window, not a batch.
//
// Three arriving together reads as a dump, which is the opposite of the thing
// being sold: his voice showing up through the day the way it does on X. A gap
// of about ninety minutes is roughly how often an active account says something
// worth reading anyway.
const PER_RUN     = Number(Deno.env.get("MIRROR_PER_RUN") || 1);
const GAP_MIN     = Number(Deno.env.get("MIRROR_GAP_MINUTES") || 90);
const LOOKBACK_H  = Number(Deno.env.get("MIRROR_LOOKBACK_HOURS") || 12);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let body: { handle?: string; huddle_id?: string; probe_lists?: string; list_members?: string; dry?: boolean; probe_search?: string; lookback_hours?: number; gap_minutes?: number; discover?: { query: string; hours?: number; min_followers?: number; max_followers?: number }; set_handle?: { huddle_id: string; handle: string }; purge_room?: string } = {};
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

  // ── Who is actually posting about this team ───────────────────────────────
  //
  // The list problem, solved from live data instead of who you happen to follow.
  // Search the fanbase's terms, see who shows up, rank by the engagement they
  // earn rather than by follower count — a 9k account whose takes get 300 likes
  // is a better room owner than a 200k account nobody replies to.
  if (body.discover) {
    const token = Deno.env.get("X_API_BEARER_TOKEN");
    if (!token) return json({ error: "X_API_BEARER_TOKEN not set" }, 500);

    const hours = body.discover.hours ?? 48;
    const minF = body.discover.min_followers ?? 1000;
    const maxF = body.discover.max_followers ?? 250000;

    const authors = new Map<string, { handle: string; name: string; followers: number; posts: number; likes: number; best: string; bestLikes: number }>();
    let next: string | undefined;

    // Three pages is enough to rank a fanbase and keeps the read budget small.
    for (let page = 0; page < 3; page++) {
      const qs = new URLSearchParams({
        query: `(${body.discover.query}) -is:reply -is:retweet -is:quote lang:en`,
        max_results: "100",
        "tweet.fields": "public_metrics,created_at",
        expansions: "author_id",
        "user.fields": "username,name,public_metrics",
        start_time: new Date(Date.now() - hours * 3600 * 1000).toISOString(),
      });
      if (next) qs.set("next_token", next);

      const r = await fetch(`https://api.x.com/2/tweets/search/recent?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return json({ status: r.status, body: (await r.text()).slice(0, 300) });
      const j = await r.json();

      const users = new Map<string, any>();
      for (const u of j?.includes?.users ?? []) users.set(u.id, u);

      for (const d of j?.data ?? []) {
        const u = users.get(d.author_id);
        if (!u) continue;
        const f = u?.public_metrics?.followers_count ?? 0;
        if (f < minF || f > maxF) continue;
        const likes = d?.public_metrics?.like_count ?? 0;
        const cur = authors.get(u.username) ?? { handle: u.username, name: u.name, followers: f, posts: 0, likes: 0, best: "", bestLikes: -1 };
        cur.posts += 1;
        cur.likes += likes;
        // Keep their best line. Reading one real post tells you more about
        // whether someone belongs in a room than any follower count does.
        if (likes > cur.bestLikes) { cur.bestLikes = likes; cur.best = (d.text ?? "").slice(0, 120); }
        authors.set(u.username, cur);
      }
      next = j?.meta?.next_token;
      if (!next) break;
    }

    const ranked = [...authors.values()]
      .filter((a) => a.posts >= 2)                       // one viral post is luck
      .map((a) => ({ ...a, avg: Math.round(a.likes / a.posts) }))
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 30);

    return json({ query: body.discover.query, hours, found: ranked.length, creators: ranked });
  }

  // ── Clear mirrored posts from a room ──────────────────────────────────────
  // For iterating on a test room without leaving every earlier attempt in it.
  // Scoped to creator_post only: nothing a person wrote is touched.
  if (body.purge_room) {
    // Skip anything somebody has replied to — a reply pointing at a deleted
    // message is a broken thread, and the foreign key will refuse anyway.
    const { data: replied } = await supabase
      .from("huddle_messages").select("reply_to_id")
      .eq("huddle_id", body.purge_room).not("reply_to_id", "is", null);
    const keep = new Set((replied ?? []).map((r: any) => r.reply_to_id));

    const { data: mine } = await supabase
      .from("huddle_messages").select("id")
      .eq("huddle_id", body.purge_room).eq("message_type", "creator_post");
    const ids = (mine ?? []).map((m: any) => m.id).filter((id: string) => !keep.has(id));

    let deleted = 0;
    if (ids.length) {
      const { error, count } = await supabase
        .from("huddle_messages").delete({ count: "exact" }).in("id", ids);
      if (error) return json({ error: error.message }, 500);
      deleted = count ?? 0;
    }

    // Release the claims so the improved version of the same post can land.
    const { data: room } = await supabase
      .from("huddles").select("x_handle").eq("id", body.purge_room).maybeSingle();
    if (room?.x_handle) {
      await supabase.from("seen_events").delete().eq("game_id", `xmirror:${room.x_handle}`);
    }
    return json({ ok: true, deleted, kept_because_replied_to: keep.size });
  }

  // ── Wire a room to a handle ───────────────────────────────────────────────
  if (body.set_handle) {
    const h = body.set_handle.handle.replace(/^@/, "");
    const { error } = await supabase
      .from("huddles").update({ x_handle: h }).eq("id", body.set_handle.huddle_id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, huddle_id: body.set_handle.huddle_id, x_handle: h });
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
    skipped_promo: 0 as number | undefined,
    skipped_too_soon: 0 as number | undefined,
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

      // Has this room heard from him recently?
      const { data: recent } = await supabase
        .from("huddle_messages")
        .select("created_at")
        .eq("huddle_id", room.id)
        .eq("message_type", "creator_post")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const gap = body.gap_minutes ?? GAP_MIN;
      if (recent?.created_at && Date.parse(recent.created_at) > Date.now() - gap * 60000) {
        summary.skipped_too_soon = (summary.skipped_too_soon ?? 0) + 1;
        continue;
      }

      const posts = await fetchPosts(ids);
      summary.candidates += posts.length;

      // Oldest first, so the room follows his day in order rather than starting
      // with the newest and working backwards. Anything older than the lookback
      // window is simply never posted — that is what stops a newly wired room
      // dripping out yesterday's takes for the next day and a half.
      posts.sort((a, b) => Date.parse(a.createdAt ?? "0") - Date.parse(b.createdAt ?? "0"));

      // Quote tweets carry their meaning in the post they quote — and often the
      // media too. Pulled in the same batched read, so it costs one extra call
      // per run rather than one per post.
      const quotedIds = posts.map((p) => p.quotedId).filter(Boolean) as string[];
      const quoted = new Map<string, typeof posts[number]>();
      if (quotedIds.length) {
        for (const q of await fetchPosts(quotedIds)) quoted.set(q.postId, q);
      }

      let postedHere = 0;
      for (const p of posts) {
        if (postedHere >= PER_RUN) break;
        if (p.isReply || p.isRepost) { summary.skipped_reply_or_repost++; continue; }
        if (p.likes < MIN_LIKES)     { summary.skipped_low++; continue; }

        // Drop the newsletter dumps. "JHiTB! From the fine folks at @sportsmockery
        // • Contextualizing Tyson Bagent • Emails on Malik…" is a promo for
        // somebody else's site, not a take, and it filled a third of the test
        // room on its own. Bullets plus multiple links is the shape of it.
        const bullets = (p.text.match(/[•·]/g) ?? []).length;
        const links = (p.text.match(/https?:\/\//g) ?? []).length;
        if (bullets >= 2 || links >= 2) { summary.skipped_promo = (summary.skipped_promo ?? 0) + 1; continue; }

        // Strip the trailing t.co stub, then attribute.
        const strip = (v: string) => v.replace(/https?:\/\/t\.co\/\S+/g, "").replace(/\s+/g, " ").trim();
        let clean = strip(p.text);

        // A quote tweet is only worth posting WITH what it quotes.
        const q = p.quotedId ? quoted.get(p.quotedId) : null;
        if (p.quotedId && !q) { summary.skipped_promo = (summary.skipped_promo ?? 0) + 1; continue; }
        if (q) {
          const qt = strip(q.text);
          if (qt) clean = `${clean}\n\n↳ @${q.authorHandle ?? "?"}: ${qt}`;
        }

        // The media may belong to the quoted post rather than theirs — in the
        // Titans example the video is Stillman's, and without this the room gets
        // the comment and none of the clip it is about.
        const mediaVideo = p.videoUrl ?? q?.videoUrl ?? null;
        const mediaImage = p.imageUrl ?? q?.imageUrl ?? null;

        if (strip(p.text).length < 12 && !q) { summary.skipped_promo = (summary.skipped_promo ?? 0) + 1; continue; }

        // Claim before posting, same as the clip puller: a unique violation
        // means another run already took this post.
        // Dry run: prove the retrieval half before writing into anyone's room.
        // Posting a test into a live room is not undoable in front of the people
        // sitting in it.
        if (body.dry) {
          postedHere++;
          summary.candidates_kept = (summary.candidates_kept ?? 0) + 1;
          summary.preview.push(`${p.likes} likes · ${mediaVideo ? "video" : mediaImage ? "image" : "text"} · ${clean.slice(0, 100).replace(/\n/g, " | ")}`);
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
          // ATTRIBUTED, because it is not ours. In the test room these landed
          // under the Side Huddle avatar and read as though the bot had written
          // someone else's takes. Wrong in the creator's own room, and much
          // worse anywhere else it might appear.
          content: `${clean}\n— @${p.authorHandle ?? room.x_handle}`,
          embed_code: p.url,
          is_bot_message: true,
          is_team_agent_message: true,
          message_type: "creator_post",
          ...(mediaVideo || mediaImage
            ? { media_url: mediaVideo ?? mediaImage, media_type: mediaVideo ? "video" : "image" }
            : {}),
        });
        if (insErr) { summary.errors.push(`${room.x_handle}: ${insErr.message}`); continue; }

        postedHere++;
        summary.posted++;
        summary.preview.push(`${mediaVideo ? "[video] " : mediaImage ? "[image] " : "[text]  "}${clean.slice(0, 90).replace(/\n/g, " ")}`);
      }
    } catch (err) {
      summary.errors.push(`${room.x_handle}: ${(err as Error).message}`);
    }
  }

  return json(summary);
});

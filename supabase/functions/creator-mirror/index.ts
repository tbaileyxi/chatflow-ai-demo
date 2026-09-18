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
// THE RULES (Ty, 2026-09-18):
//   1. Rank the last 12h of their posts by likes + reposts + replies, best first.
//   2. At most 4 posts per room per day (Eastern), at least 90 minutes apart.
//   3. Between games only. No pulling from 6h before kickoff to 2h after the
//      final whistle for the room's team. This never stands in for the creator
//      being in the room on gameday.
//   4. Only rooms the creator owns: the room's owner is registered in
//      creator_accounts with the same handle. Never team rooms, game huddles,
//      DMs, or anyone else's room.
//
// Actions:
//   {}                        mirror every room that passes rule 4
//   { handle, huddle_id }     mirror one room, same rules
//   { huddle_id, dry: true }  preview one room's pick without posting; scope is
//                             reported but not enforced, since nothing is written
//   { probe_lists: "handle" } report whether this API tier can read X Lists

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchPostMedia, fetchPosts, postIdFromUrl } from "../_shared/x/media.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// A creator posts thirty times a day: replies, reposts, jokes about lunch.
// Mirroring all of it turns their room into a feed dump and they would be the
// first to hate it.
const DAILY_CAP   = Number(Deno.env.get("MIRROR_DAILY_CAP") || 4);
// ONE post per room per window, not a batch.
//
// Three arriving together reads as a dump, which is the opposite of the thing
// being sold: his voice showing up through the day the way it does on X. A gap
// of about ninety minutes is roughly how often an active account says something
// worth reading anyway.
const PER_RUN     = Number(Deno.env.get("MIRROR_PER_RUN") || 1);
const GAP_MIN     = Number(Deno.env.get("MIRROR_GAP_MINUTES") || 90);
const LOOKBACK_H  = Number(Deno.env.get("MIRROR_LOOKBACK_HOURS") || 12);

// Gameday blackout, per rule 3.
const PRE_GAME_H  = 6;
const POST_GAME_H = 2;
// games has no final-whistle column. A final game's recap is posted within a
// couple of minutes of the whistle, so that is used when present; otherwise the
// usual length of a game in that league.
const GAME_LEN_H: Record<string, number> = {
  americanfootball_nfl: 3.5, americanfootball_ncaaf: 3.5,
  basketball_nba: 2.5, basketball_ncaab: 2.5, basketball_wnba: 2.5,
  baseball_mlb: 3.25, icehockey_nhl: 2.75,
};

async function inBlackout(supabase: any, teamId: string | null): Promise<string | null> {
  if (!teamId) return null;
  const now = Date.now();
  const from = new Date(now - 12 * 3600e3).toISOString();
  const to = new Date(now + PRE_GAME_H * 3600e3).toISOString();
  const { data } = await supabase
    .from("games")
    .select("id, sport_key, start_time, status, recap_posted_at")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .gte("start_time", from)
    .lte("start_time", to);
  for (const g of data ?? []) {
    const kick = Date.parse(g.start_time);
    const len = (GAME_LEN_H[g.sport_key] ?? 3.5) * 3600e3;
    let end: number;
    if (g.status === "final") {
      const recap = g.recap_posted_at ? Date.parse(g.recap_posted_at) : NaN;
      end = recap > kick ? recap : kick + len;
    } else if (g.status === "in_progress") {
      end = Math.max(now, kick + len);
    } else {
      end = kick + len;
    }
    if (now >= kick - PRE_GAME_H * 3600e3 && now <= end + POST_GAME_H * 3600e3) {
      return `${g.id} (${g.status}, kickoff ${g.start_time})`;
    }
  }
  return null;
}

// Midnight today, US Eastern, as an ISO instant.
function easternMidnight(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(now);
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const sinceMidnight = ((v("hour") % 24) * 3600 + v("minute") * 60 + v("second")) * 1000;
  return new Date(now.getTime() - sinceMidnight - now.getMilliseconds()).toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let body: { handle?: string; huddle_id?: string; probe_lists?: string; probe_media?: string; seed?: any[]; chapter_stats?: boolean; list_members?: string; dry?: boolean; probe_search?: string; lookback_hours?: number; gap_minutes?: number; discover?: { query: string; hours?: number; min_followers?: number; max_followers?: number; pages?: number; sport?: string; save?: boolean; org?: string }; set_handle?: { huddle_id: string; handle: string }; purge_room?: string } = {};
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

    const authors = new Map<string, { handle: string; name: string; followers: number; posts: number; likes: number; best: string; bestLikes: number; bio: string; email: string | null; website: string | null }>();
    let next: string | undefined;

    // Three pages is enough to rank a fanbase and keeps the read budget small.
    // TWO pages by default, four maximum.
    //
    // Each page is 100 post reads. A five-page run across six schools is 3,000
    // reads, which is how the account's credits went from working to 402 in a
    // single afternoon — taking the clip puller down with it, because everything
    // shares one key. Discovery is a deliberate act, not something to run while
    // thinking out loud.
    const maxPages = Math.min(body.discover.pages ?? 2, 4);
    for (let page = 0; page < maxPages; page++) {
      const qs = new URLSearchParams({
        // Quote tweets stay. Excluding them cut out most of how creators actually
        // post — DaBearsBlog's best material is quote tweets, and the first run of
        // this search returned newspapers because only newspapers post the way the
        // query assumed.
        query: `(${body.discover.query}) -is:reply -is:retweet lang:en`,
        max_results: "100",
        "tweet.fields": "public_metrics,created_at",
        expansions: "author_id",
        "user.fields": "username,name,public_metrics,description,url,entities",
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

        // A school fields twenty teams and they all post under the same
        // hashtags. @CUBuffsVB ranked on the first run — the same wrong-sport
        // pollution that put a volleyball graphic in a football room, arriving
        // through a different door.
        const tag = `${u.username} ${u.name}`.toLowerCase();
        if (/\b(vb|volleyball|soccer|softball|wbb|w?bball|lacrosse|hockey|rowing|golf|tennis|track|swim|xc|gymnastics)\b/.test(tag)) continue;
        const likes = d?.public_metrics?.like_count ?? 0;
        const bio = u.description ?? "";
        // The reachable ones put an address in the bio. That is the difference
        // between a name and a lead, and it is the only channel here that
        // automates — bulk DMs on X are how an account gets suspended.
        const email = (bio.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) ?? [])[0] ?? null;
        const website = u?.entities?.url?.urls?.[0]?.expanded_url ?? u.url ?? null;

        const cur = authors.get(u.username) ?? { handle: u.username, name: u.name, followers: f, posts: 0, likes: 0, best: "", bestLikes: -1, bio, email, website };
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

    let saved = 0;
    if (body.discover.save) {
      for (const c of ranked) {
        const { error } = await supabase.from("creator_leads").upsert({
          handle: c.handle,
          display_name: c.name,
          org: body.discover.org ?? null,
          followers: c.followers,
          posts_seen: c.posts,
          likes_seen: c.likes,
          avg_likes: c.avg,
          best_post: c.best,
          bio: c.bio,
          email: c.email,
          website: c.website,
          last_seen: new Date().toISOString(),
        }, { onConflict: "handle" });
        if (!error) saved++;
      }
    }

    return json({
      query: body.discover.query, hours,
      found: ranked.length, saved,
      with_email: ranked.filter((c) => c.email).length,
      creators: ranked,
    });
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

  // ── How much of the chapter list is left ──────────────────────────────────
  // chapter_leads is admin-read only, so the number is invisible from anywhere
  // except a signed-in dashboard. This reads it with the service role.
  if (body.chapter_stats) {
    const count = async (q: any) => (await q).count ?? 0;
    const base = () => supabase.from("chapter_leads").select("id", { count: "exact", head: true });
    const emailable = () => base()
      .eq("contact_channel", "email").eq("bounced", false).eq("unsubscribed", false)
      .not("email", "is", null).neq("email", "");

    return json({
      total:            await count(base()),
      emailable:        await count(emailable()),
      never_emailed:    await count(emailable().eq("emailed", false)),
      had_step_1:       await count(emailable().eq("emailed", true).eq("sequence_step", 1)),
      had_step_2:       await count(emailable().eq("emailed", true).eq("sequence_step", 2)),
      had_step_3:       await count(emailable().eq("emailed", true).eq("sequence_step", 3)),
      replied:          await count(base().eq("status", "replied")),
      onboarded:        await count(base().eq("status", "onboarded")),
      bounced:          await count(base().eq("bounced", true)),
      unsubscribed:     await count(base().eq("unsubscribed", true)),
      no_email_at_all:  await count(base().or("email.is.null,email.eq.")),
    });
  }

  // ── Seed rows we already have ───────────────────────────────────────────
  // A discovery run's results outlive the API credits that produced them.
  // Writing them straight in costs no X reads at all, which is the difference
  // between having a list to work today and waiting on a top-up.
  if (body.seed) {
    let saved = 0;
    for (const c of body.seed) {
      const { error } = await supabase.from("creator_leads").upsert({
        handle: c.handle,
        display_name: c.name ?? null,
        org: c.org ?? null,
        followers: c.followers ?? 0,
        posts_seen: c.posts ?? 0,
        likes_seen: c.likes ?? 0,
        avg_likes: c.avg ?? 0,
        best_post: c.best ?? null,
        last_seen: new Date().toISOString(),
      }, { onConflict: "handle" });
      if (error) return json({ error: error.message }, 500);
      saved++;
    }
    return json({ ok: true, saved });
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

  // Does a post still resolve to playable media with the X API dead?
  if (body.probe_media) {
    const rows = await fetchPostMedia([body.probe_media]);
    return json({
      id: body.probe_media,
      found: rows.length,
      media: rows.map((r) => ({ type: r.type, handle: r.authorHandle, likes: r.likes, video: r.videoUrl?.slice(0, 70) ?? null, image: r.imageUrl.slice(0, 70) })),
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
  // Rule 4: only a room its creator owns. The owner must be registered in
  // creator_accounts under the same handle the room is wired to — an x_handle
  // on its own proves nothing, anyone could type a creator's name into it.
  type Room = { id: string; x_handle: string; name: string | null; team_id: string | null };
  let q = supabase
    .from("huddles")
    .select("id, name, x_handle, owner_id, team_id, is_official_team_huddle, is_game_room, is_dm, event_id, game_id")
    .not("x_handle", "is", null)
    .neq("x_handle", "");
  if (body.huddle_id) q = q.eq("id", body.huddle_id);
  const { data: wired, error: wiredErr } = await q;
  if (wiredErr) return json({ error: wiredErr.message }, 500);

  const owners = [...new Set((wired ?? []).map((r: any) => r.owner_id).filter(Boolean))];
  const { data: creators } = owners.length
    ? await supabase.from("creator_accounts").select("user_id, x_handle").in("user_id", owners)
    : { data: [] as any[] };
  const handleOf = new Map((creators ?? []).map((c: any) => [c.user_id, String(c.x_handle).replace(/^@/, "").toLowerCase()]));

  const rooms: Room[] = [];
  const out_of_scope: string[] = [];
  for (const r of (wired ?? []) as any[]) {
    const h = String(r.x_handle).replace(/^@/, "");
    const why =
      r.is_official_team_huddle ? "team room" :
      (r.is_game_room || r.event_id || r.game_id) ? "game huddle" :
      r.is_dm ? "DM" :
      handleOf.get(r.owner_id) !== h.toLowerCase() ? "owner is not @" + h :
      body.handle && body.handle.replace(/^@/, "").toLowerCase() !== h.toLowerCase() ? "handle does not match room" :
      null;
    if (why) out_of_scope.push(`${r.name ?? r.id}: ${why}`);
    if (!why || (body.dry && body.huddle_id)) rooms.push({ id: r.id, x_handle: h, name: r.name, team_id: r.team_id });
  }
  if (!rooms.length) return json({ ok: true, rooms: 0, out_of_scope, note: "no room passes the creator-owns-it rule" });

  const { data: botUserId } = await supabase.rpc("get_or_create_system_user");
  const summary = {
    ok: true,
    rooms: rooms.length,
    checked: 0,
    candidates: 0,
    posted: 0,
    skipped_seen: 0,
    skipped_reply_or_repost: 0,
    errors: [] as string[],
    halted: null as string | null,
    preview: [] as string[],
    candidates_kept: 0 as number | undefined,
    skipped_promo: 0 as number | undefined,
    skipped_too_soon: 0 as number | undefined,
    skipped_daily_cap: 0,
    skipped_gameday: [] as string[],
    out_of_scope,
  };

  for (const room of rooms) {
    summary.checked++;
    try {
      // Rule 3: gameday is the creator's to be in the room live. Checked before
      // the X read, so a blacked-out room costs nothing.
      const game = await inBlackout(supabase, room.team_id);
      if (game) { summary.skipped_gameday.push(`${room.name ?? room.id}: ${game}`); continue; }

      // Rule 2: four a day, ninety minutes apart.
      const { count: today } = await supabase
        .from("huddle_messages")
        .select("id", { count: "exact", head: true })
        .eq("huddle_id", room.id)
        .eq("message_type", "creator_post")
        .gte("created_at", easternMidnight());
      if ((today ?? 0) >= DAILY_CAP) { summary.skipped_daily_cap++; continue; }

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
        // 402 means the account is out of API credits, and every room after this
        // one will get the same answer. The cron runs every fifteen minutes;
        // without this it would make one doomed request per wired room, forever.
        if (sr.status === 402 || sr.status === 429) {
          summary.halted = `X API returned ${sr.status} — stopping this run`;
          break;
        }
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

      // Rule 1: their best post of the last twelve hours goes first — likes,
      // reposts and replies together. Already-posted ones fall through on the
      // seen_events claim below, so the next run takes the next best.
      const score = (p: typeof posts[number]) => p.likes + p.reposts + p.replies;
      posts.sort((a, b) => score(b) - score(a));

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
          const { data: done } = await supabase.from("seen_events").select("event_id")
            .eq("event_id", `xmirror:${p.postId}`).maybeSingle();
          if (done) { summary.skipped_seen++; continue; }
          postedHere++;
          summary.candidates_kept = (summary.candidates_kept ?? 0) + 1;
          summary.preview.push(`${score(p)} eng · ${mediaVideo ? "video" : mediaImage ? "image" : "text"} · ${clean.slice(0, 100).replace(/\n/g, " | ")}`);
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

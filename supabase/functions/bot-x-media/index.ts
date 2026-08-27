// bot-x-media — one good photo or clip from X, per room, per day.
//
// The cheap half of the plan the Coach's x_search set up. xAI finds the posts
// worth seeing and hands back their URLs as citations; we pay X only to read
// those exact posts (~3) rather than to search (~20+). $0.005 a read, so a room
// costs about a penny and a half a day.
//
// Rooms people made themselves. The 195 seeded Community rooms are excluded
// the same way news excludes them — every signup was auto-joined to one, so
// "has members" says nothing about whether anyone wants it.
//
// Modes (POST body):
//   {}                    normal run
//   {"dry_run": true}     resolve + fetch, post nothing, return what it found
//   {"in_game_only":true} only teams playing RIGHT NOW — the frequent cron
//   {"probe_ids": [...]}  read specific post ids — used to prove the token works

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { searchX } from "../_shared/coach/xsearch.ts";
import { fetchPostMedia, pickBest, postIdFromUrl } from "../_shared/x/media.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// How often a room may get a clip WHILE ITS TEAM IS PLAYING. The daily cap is
// the cost control for a quiet Tuesday; during a game it is the wrong shape —
// a highlight is worth showing the moment it lands, and there may be six of
// them in three hours.
const IN_GAME_EVERY_MIN = Number(Deno.env.get("X_MEDIA_IN_GAME_MIN") || 12);

// Is this team on the field right now? Reads `games`, the same table
// fade-settle and the live poller grade from, rather than trusting a headline.
async function liveGameFor(
  supabase: ReturnType<typeof createClient>,
  teamId: string,
): Promise<{ home_team_id: string; away_team_id: string } | null> {
  const { data } = await supabase
    .from("games")
    .select("home_team_id, away_team_id, status")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .in("status", ["in_progress", "halftime"])
    .limit(1);
  return (data && data[0]) ? data[0] as any : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;
  // The frequent in-game cron passes this. Without it, a run every 12 minutes
  // would fire every team's DAILY clip at the first tick of the day instead of
  // at 9:15, quietly replacing the schedule it was meant to sit alongside.
  const inGameOnly = body?.in_game_only === true;
  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Token check, no search, no spend beyond the ids handed in.
  if (Array.isArray(body?.probe_ids) && body.probe_ids.length > 0) {
    const media = await fetchPostMedia(body.probe_ids);
    return json({
      mode: "probe",
      token_present: !!Deno.env.get("X_API_BEARER_TOKEN"),
      requested: body.probe_ids.length,
      media_found: media.length,
      media,
    });
  }

  // Read-only look at what the bot has actually been saying in a room. Exists
  // because "which function wrote this?" was otherwise a guessing game — the
  // logs don't carry message_type and the tables aren't readable from outside.
  // Service-role only. The publishable key reaches this function, so without
  // this check anyone holding the key shipped in the app could read any room's
  // messages through it.
  if (typeof body?.debug_room === "string") {
    const auth = req.headers.get("Authorization") ?? "";
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!svc || auth !== `Bearer ${svc}`) {
      return json({ error: "debug_room requires the service role key" }, 403);
    }
    const { data: msgs } = await supabase
      .from("huddle_messages")
      .select("created_at, content, message_type, media_type, embed_code")
      .eq("huddle_id", body.debug_room)
      .order("created_at", { ascending: false })
      .limit(Number(body?.n ?? 10));
    return json({ mode: "debug_room", messages: msgs });
  }

  const summary = {
    started_at: new Date().toISOString(),
    teams_eligible: 0,
    teams_attempted: 0,
    already_posted_today: 0,
    teams_live: 0,          // playing right now — took the in-game path
    skipped_not_live: 0,    // in_game_only run, team is not playing
    in_game_posts: 0,       // clips posted during a live game
    searches_run: 0,
    widened: 0, // teams where hard news was empty and we took the wider look
    deferred_out_of_time: 0, // ran out of wall clock; first in line next run
    citations_found: 0,
    x_posts_read: 0,
    posts_made: 0,
    dry_run: dryRun,
    in_game_only: inGameOnly,
    results: [] as Record<string, unknown>[],
    errors: [] as string[],
  };

  try {
    if (!Deno.env.get("X_API_BEARER_TOKEN")) {
      return json({ ...summary, message: "X_API_BEARER_TOKEN not set" });
    }

    // Rooms somebody chose to make. Same gate as news.
    // Two queries, not an embedded join: huddles has BOTH team_id and
    // parent_team_id pointing at teams, so `teams!inner(...)` is ambiguous and
    // came back empty rather than erroring. Explicit is cheaper than clever.
    const { data: rooms, error: roomsErr } = await supabase
      .from("huddles")
      .select("id, name, team_id")
      .gte("member_count", 1)
      .not("team_id", "is", null)
      .or("is_official_team_huddle.is.false,is_official_team_huddle.is.null");
    if (roomsErr) return json({ ...summary, error: roomsErr.message }, 500);

    const teamIds = [...new Set((rooms ?? []).map((r: any) => r.team_id))];
    const { data: teamRows, error: teamsErr } = await supabase
      .from("teams")
      .select("id, name, city, league")
      .in("id", teamIds);
    if (teamsErr) return json({ ...summary, error: teamsErr.message }, 500);
    const teamById = new Map((teamRows ?? []).map((t: any) => [t.id, t]));

    // One search per TEAM, fanned out to that team's rooms — two Mets rooms
    // shouldn't cost two searches.
    const byTeam = new Map<string, { name: string; league: string; huddleIds: string[] }>();
    for (const r of (rooms ?? []) as any[]) {
      const t = teamById.get(r.team_id);
      if (!t) continue;
      const entry = byTeam.get(r.team_id) ?? {
        name: [t.city, t.name].filter(Boolean).join(" "),
        league: t.league,
        huddleIds: [],
      };
      entry.huddleIds.push(r.id);
      byTeam.set(r.team_id, entry);
    }
    summary.teams_eligible = byTeam.size;

    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);

    const { data: systemUserId } = await supabase.rpc("get_or_create_system_user");
    if (!systemUserId && !dryRun) return json({ ...summary, message: "no system user" }, 500);

    // SCALE WITHOUT BEING MANAGED.
    //
    // A fixed "first N teams" cap silently starves everyone past position N as
    // rooms are created, and the failure is invisible: the run reports success
    // and those rooms just stay empty forever. Instead:
    //
    //   - order by who has waited longest (never served first), so growth
    //     changes WHO goes first, never WHETHER a room is reachable;
    //   - work in small concurrent batches, and stop starting new ones when
    //     the wall clock runs down, so a big slate degrades into "served in
    //     turn over the next few runs" rather than a killed invocation.
    //
    // Nothing to raise as rooms are added.
    const { data: lastRuns } = await supabase
      .from("huddle_messages")
      .select("huddle_id, created_at")
      .eq("is_bot_message", true)
      .like("embed_code", "https://x.com/%")
      .order("created_at", { ascending: false })
      .limit(2000);
    const teamOfHuddle = new Map<string, string>();
    for (const [tid, t] of byTeam) for (const h of t.huddleIds) teamOfHuddle.set(h, tid);
    const lastServed = new Map<string, string>();
    for (const r of (lastRuns ?? []) as any[]) {
      const tid = teamOfHuddle.get(r.huddle_id);
      if (tid && !lastServed.has(tid)) lastServed.set(tid, r.created_at);
    }
    const queue = [...byTeam.entries()].sort(
      ([a], [b]) => (lastServed.get(a) ?? "").localeCompare(lastServed.get(b) ?? ""),
    );
    // body.limit is for testing a single team; it is NOT the coverage cap.
    const testLimit = body?.limit ? Number(body.limit) : null;
    const slate = testLimit ? queue.slice(0, testLimit) : queue;

    const CONCURRENCY = Number(Deno.env.get("XMEDIA_CONCURRENCY") || 8);
    const BUDGET_MS = Number(Deno.env.get("XMEDIA_BUDGET_MS") || 110_000);
    const startedAt = Date.now();

    // Teams run in PARALLEL. Each team costs one xAI search (~15s), two when
    // the news search comes back empty and we widen. Serially that is 2-4
    // minutes for eight teams, which overran the function's wall clock — the
    // first full run returned nothing at all because it was killed mid-flight.
    // Parallel, the whole slate finishes in about the time one team takes.
    const runTeam = async ([teamId, team]: [string, { name: string; league: string; huddleIds: string[] }]) => {
      // One per team per day. The cap is the cost control — without it a cron
      // misfire is a bill, not a bug.
      //
      // Counted from the POSTS, not from an audit log. bot_emit_log has
      // `check (mode in ('in_game','news'))`, so every x_media row was being
      // rejected — silently, because the insert error went unchecked. The cap
      // read 0 every time and the same rooms would have been served on every
      // run, all day. The message is the fact; the log was only ever a story
      // about the fact.
      // TWO CADENCES, because a game day and a Tuesday are not the same room.
      // Off the field: one clip per team per day — the cost control that keeps
      // a cron misfire from being a bill. On the field: one every dozen
      // minutes, because a highlight is worth seeing when it lands and there
      // may be six in three hours. The live poller narrates the game in text;
      // this is the picture next to it, not a replacement for it.
      const live = await liveGameFor(supabase, teamId);
      if (live) summary.teams_live++;
      if (inGameOnly && !live) {
        summary.skipped_not_live++;
        return;
      }

      const since = live
        ? new Date(Date.now() - IN_GAME_EVERY_MIN * 60_000)
        : midnight;

      const { count } = await supabase
        .from("huddle_messages")
        .select("id", { count: "exact", head: true })
        .in("huddle_id", team.huddleIds)
        .eq("is_bot_message", true)
        .like("embed_code", "https://x.com/%")
        .gte("created_at", since.toISOString());
      if ((count ?? 0) > 0) {
        summary.already_posted_today++;
        return;
      }
      summary.teams_attempted++;

      // xAI does the finding. Ask for posts that CARRY media, since a text-only
      // citation costs an X read and returns nothing to show.
      // Ask for the STORY, not for engagement.
      //
      // "Best photos and viral posts" reliably returned debate bait — a Knicks
      // room got "SHOULD THE KNICKS RAISE AN NBA CUP BANNER?" on a day whose
      // actual news was Deuce McBride not signing. Virality and newsworthiness
      // are different axes, and asking for the first gets you a poll.
      // IN-GAME: a completely different question. Asking the 24-hour question
      // during the third quarter returns this morning's roster note — true,
      // and useless next to a play that happened ninety seconds ago. Short
      // lookback, highlights only, no news: the news will still be there
      // tomorrow, the moment will not.
      const search = live
        ? await searchX(
            `Find a ${team.name} post from the LAST ${IN_GAME_EVERY_MIN + 8} MINUTES ` +
              `showing something that just happened in the game they are playing ` +
              `right now, with a video or photo.\n\n` +
              `Want: a touchdown, home run, dunk, big hit, catch, save, ejection, ` +
              `bench reaction, a call being argued, a crowd shot after a moment. ` +
              `The more recent the better — a clip from two minutes ago beats a ` +
              `better clip from an hour ago.\n\n` +
              `Do NOT return: pregame content, roster or transaction news, ` +
              `analysis, previews, betting posts, polls, or anything from before ` +
              `this game started. If nothing has happened in the last few minutes ` +
              `worth showing, return nothing at all — silence is correct here.`,
          )
        : await searchX(
        `Find the ${team.name} post from the last 24 hours that fans are actually ` +
          `talking about, and that includes a photo or video.\n\n` +
          `Rank candidates in this order:\n` +
          `1. A MOMENT — a big play, highlight, home run, dunk, catch, brawl, ` +
          `celebration, mic'd-up clip, a breakdown of a play, something funny or ` +
          `remarkable that happened on or around the field.\n` +
          `2. Real news that changes the team — a trade, a major signing, a ` +
          `significant injury, a firing, a starter or depth-chart change.\n` +
          `3. Anything else only if neither of the above exists.\n\n` +
          `NEVER lead with a minor-league signing, a minor-league game, a ` +
          `40-man roster technicality, a waiver claim, or a transaction nobody ` +
          `outside the front office cares about. A room full of fans does not ` +
          `want "we signed a reliever to a minor league deal" as the day's post.\n\n` +
          `Exclude by FORM, not by popularity: no polls, no "should they" ` +
          `questions, no debate prompts, no power rankings, no anniversary or ` +
          `throwback posts, no listicles. A widely shared HIGHLIGHT is exactly ` +
          `what we want; a widely shared ARGUMENT is not.\n\n` +
          `Accounts that break down moments well — Jomboy Media, the team's own ` +
          `account, beat writers, highlight accounts — are good sources.`,
      );
      summary.searches_run++;
      let ids = [...new Set(search.citations.map(postIdFromUrl).filter(Boolean))] as string[];

      // Second look, wider. Asking only for hard news means an offseason team
      // gets nothing for weeks — seven of eight rooms came back empty on an
      // August morning. Camp photos, a training clip or a good fan shot are
      // still worth seeing; a "should they" poll still isn't. News wins when
      // it exists, this only runs when it doesn't.
      // The widen is an OFF-DAY rescue. Mid-game it would answer "nothing just
      // happened" with a training-camp photo from Tuesday, which is precisely
      // the clutter the short lookback exists to avoid.
      if (ids.length === 0 && !live) {
        const wider = await searchX(
          `Show me the best photo or video posted about the ${team.name} in the last 2 days — ` +
            `a highlight, a funny or memorable clip, training camp, practice, players, ` +
            `the facility, fans, or uniforms. Prefer whatever got the most genuine ` +
            `reaction. Still ignore polls, debate prompts, "should they" questions, ` +
            `power rankings, and minor-league transactions.`,
        );
        summary.searches_run++;
        summary.widened++;
        ids = [...new Set(wider.citations.map(postIdFromUrl).filter(Boolean))] as string[];
      }
      summary.citations_found += ids.length;
      if (ids.length === 0) {
        summary.results.push({ team: team.name, skipped: "no citations" });
        return;
      }

      // Cap the read count per team so one chatty search can't run up the bill.
      const MAX_READS = Number(Deno.env.get("XMEDIA_MAX_READS_PER_TEAM") || 5);
      const capped = ids.slice(0, MAX_READS);
      const media = await fetchPostMedia(capped);
      summary.x_posts_read += capped.length;

      const best = pickBest(media);
      if (!best) {
        summary.results.push({ team: team.name, read: capped.length, skipped: "no media on those posts" });
        return;
      }

      // Quote briefly and attribute. The post's own words, capped hard, with
      // the handle and a link back — we're pointing at someone's post, not
      // reprinting it.
      const quote = best.text.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 140);
      const content = [quote && `"${quote}"`, best.authorHandle && `— @${best.authorHandle}`]
        .filter(Boolean)
        .join("\n");

      summary.results.push({
        team: team.name,
        read: capped.length,
        type: best.type,
        has_video: !!best.videoUrl,
        url: best.url,
        rooms: team.huddleIds.length,
      });

      if (dryRun) return;

      if (live) summary.in_game_posts++;
      const { error: insErr } = await supabase.from("huddle_messages").insert(
        team.huddleIds.map((huddleId) => ({
          huddle_id: huddleId,
          user_id: systemUserId,
          content: content || `via @${best.authorHandle ?? "X"}`,
          embed_code: best.url,
          is_bot_message: true,
          message_type: "news",
          // Clips play in-line; everything else is a still. pickBest returns
          // the post's COVER — whatever the author led with — so a clip lands
          // whenever the post was a clip, which is what the caption is about.
          // It used to force a photo to protect builds that couldn't play
          // video; clip playback shipped 2026-08-19, so that guard now only
          // cost us the better artifact.
          media_url: best.videoUrl ?? best.imageUrl,
          media_type: best.videoUrl ? "video" : "image",
        })),
      );
      if (insErr) {
        summary.errors.push(`${team.name}: ${insErr.message}`);
        return;
      }

      summary.posts_made++;
    };

    for (let i = 0; i < slate.length; i += CONCURRENCY) {
      if (Date.now() - startedAt > BUDGET_MS) {
        // Out of time. The rest keep their place at the front of the queue,
        // because they still have the oldest last-served timestamps.
        summary.deferred_out_of_time = slate.length - i;
        break;
      }
      await Promise.all(slate.slice(i, i + CONCURRENCY).map(runTeam));
    }

    return json(summary);
  } catch (err) {
    summary.errors.push(String(err));
    return json(summary, 500);
  }
});

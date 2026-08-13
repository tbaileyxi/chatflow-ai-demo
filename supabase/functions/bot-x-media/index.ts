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
//   {"probe_ids": [...]}  read specific post ids — used to prove the token works

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { searchX } from "../_shared/coach/xsearch.ts";
import { fetchPostMedia, pickBest, postIdFromUrl } from "../_shared/x/media.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;
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

  const summary = {
    started_at: new Date().toISOString(),
    teams_eligible: 0,
    teams_attempted: 0,
    already_posted_today: 0,
    searches_run: 0,
    citations_found: 0,
    x_posts_read: 0,
    posts_made: 0,
    dry_run: dryRun,
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

    // body.limit lets a test run cost one team instead of ten.
    const PER_RUN = Number(body?.limit ?? Deno.env.get("XMEDIA_TEAMS_PER_RUN") ?? 10);
    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);

    const { data: systemUserId } = await supabase.rpc("get_or_create_system_user");
    if (!systemUserId && !dryRun) return json({ ...summary, message: "no system user" }, 500);

    for (const [teamId, team] of [...byTeam.entries()].slice(0, PER_RUN)) {
      // One per team per day. The cap is the cost control — without it a cron
      // misfire is a bill, not a bug.
      const { count } = await supabase
        .from("bot_emit_log")
        .select("id", { count: "exact", head: true })
        .eq("team_id", teamId)
        .eq("mode", "x_media")
        .gte("created_at", midnight.toISOString());
      if ((count ?? 0) > 0) {
        summary.already_posted_today++;
        continue;
      }
      summary.teams_attempted++;

      // xAI does the finding. Ask for posts that CARRY media, since a text-only
      // citation costs an X read and returns nothing to show.
      const search = await searchX(
        `Best photos, highlights and viral posts about the ${team.name} from the last day. ` +
          `Prefer posts that include a photo or video.`,
      );
      summary.searches_run++;
      const ids = [...new Set(search.citations.map(postIdFromUrl).filter(Boolean))] as string[];
      summary.citations_found += ids.length;
      if (ids.length === 0) {
        summary.results.push({ team: team.name, skipped: "no citations" });
        continue;
      }

      // Cap the read count per team so one chatty search can't run up the bill.
      const MAX_READS = Number(Deno.env.get("XMEDIA_MAX_READS_PER_TEAM") || 5);
      const capped = ids.slice(0, MAX_READS);
      const media = await fetchPostMedia(capped);
      summary.x_posts_read += capped.length;

      const best = pickBest(media);
      if (!best) {
        summary.results.push({ team: team.name, read: capped.length, skipped: "no media on those posts" });
        continue;
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

      if (dryRun) continue;

      const { error: insErr } = await supabase.from("huddle_messages").insert(
        team.huddleIds.map((huddleId) => ({
          huddle_id: huddleId,
          user_id: systemUserId,
          content: content || `via @${best.authorHandle ?? "X"}`,
          embed_code: best.url,
          is_bot_message: true,
          message_type: "news",
          // Video posts still land as their still frame: the app renders
          // media_type "image" today and has no video branch yet. videoUrl is
          // carried on the log so playback can light up without a re-fetch.
          media_url: best.imageUrl,
          media_type: "image",
        })),
      );
      if (insErr) {
        summary.errors.push(`${team.name}: ${insErr.message}`);
        continue;
      }

      await supabase.from("bot_emit_log").insert({
        team_id: teamId,
        huddle_id: team.huddleIds[0],
        mode: "x_media",
        source_ref: best.url,
        facts: { post_id: best.postId, type: best.type, video_url: best.videoUrl },
        message_text: content,
        pushed: false,
      });
      summary.posts_made++;
    }

    return json(summary);
  } catch (err) {
    summary.errors.push(String(err));
    return json(summary, 500);
  }
});

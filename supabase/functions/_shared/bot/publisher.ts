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
  /** ESPN's own sentence. Used verbatim in public game rooms, which have no side. */
  plainText?: string;
  imageUrl?: string;                        // Source 2: article action photo (og:image)
}

export interface PublishResult {
  huddleIdsPosted: string[];
  pushed: boolean;
}

/**
 * Does this team have any huddle with a person in it?
 *
 * publish() already refuses to write into empty rooms, but by the time it runs
 * the LLM call has been made and paid for. Callers should check this BEFORE
 * generating a message so a team nobody is watching costs nothing at all —
 * the Anthropic balance has been drained to zero once already, and 84% of this
 * engine's fan-out was aimed at rooms with no members.
 */
export async function teamHasOccupiedHuddles(
  client: SupabaseClient,
  teamId: string,
): Promise<boolean> {
  const { data: huddles } = await client
    .from("huddles")
    .select("id")
    .eq("team_id", teamId);
  const ids = (huddles ?? []).map((h: { id: string }) => h.id);
  if (ids.length === 0) return false;

  const { count } = await client
    .from("huddle_members")
    .select("huddle_id", { count: "exact", head: true })
    .in("huddle_id", ids);

  return (count ?? 0) > 0;
}

export async function publish(input: PublishInput): Promise<PublishResult> {
  const { client, teamId, mode, facts, excitementScore, sourceRef, shouldPush } = input;

  // 1. Resolve every huddle attached to this team that somebody is actually in.
  //
  // This used to fan out to EVERY huddle carrying the team id, which includes
  // ~195 auto-created official team rooms with nobody in them — so roughly 300
  // messages a day were being written, LLM-generated and paid for, into rooms
  // no human could ever see. Ninety-four percent of all messages in the product
  // came from this loop talking to an empty house.
  //
  // Membership is checked against huddle_members rather than huddles.member_count
  // because that column is denormalised and maintained by hand in several places
  // (create sets 1, approve increments, leave decrements) — trusting it would
  // silence a real room the moment any one of those drifted.
  //
  // A room that gains its first member is furnished on the way in by
  // backfillIfEmpty() on the client, so gating here doesn't leave newcomers
  // staring at a blank screen.
  // A FIXTURE ROOM BELONGS TO BOTH TEAMS.
  //
  // A huddle carries one team_id, and a public game room has to be stamped
  // with something — last night's Denver·Kansas City was stamped Kansas City.
  // So publishing "for the Broncos" never reached the room where Broncos fans
  // were sitting, and only Chiefs plays ever appeared in it. Half the game,
  // missing from the room built for the whole game.
  //
  // Rooms for this team, PLUS the fixture rooms for games this team is in,
  // whoever they happen to be stamped with.
  const [ownRes, fixtureRes] = await Promise.all([
    client.from("huddles").select("id, is_game_room").eq("team_id", teamId),
    (async () => {
      if (mode !== "in_game") return { data: [] as any[] };
      const { data: games } = await client
        .from("games")
        .select("id")
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .gte("start_time", new Date(Date.now() - 8 * 3600_000).toISOString())
        .lte("start_time", new Date(Date.now() + 8 * 3600_000).toISOString());
      const ids = (games ?? []).map((g: any) => g.id);
      if (ids.length === 0) return { data: [] as any[] };
      return await client
        .from("huddles")
        .select("id, is_game_room")
        .in("game_id", ids)
        .eq("is_game_room", true);
    })(),
  ]);

  const huddlesErr = ownRes.error;
  const seenId = new Set<string>();
  const allHuddles = [...(ownRes.data ?? []), ...((fixtureRes as any).data ?? [])]
    .filter((h: any) => (seenId.has(h.id) ? false : (seenId.add(h.id), true)));
  if (huddlesErr) {
    console.error("[publisher] huddle lookup failed", huddlesErr);
    return { huddleIdsPosted: [], pushed: false };
  }
  if (!allHuddles || allHuddles.length === 0) {
    console.log(`[publisher] no huddles for team ${teamId} — skip`);
    return { huddleIdsPosted: [], pushed: false };
  }

  const allIds = allHuddles.map((h: { id: string }) => h.id);
  const { data: memberRows, error: memberErr } = await client
    .from("huddle_members")
    .select("huddle_id")
    .in("huddle_id", allIds);
  if (memberErr) {
    console.error("[publisher] membership lookup failed", memberErr);
    return { huddleIdsPosted: [], pushed: false };
  }

  const occupied = new Set(
    (memberRows ?? []).map((m: { huddle_id: string }) => m.huddle_id),
  );
  const huddles = allHuddles.filter((h: { id: string }) => occupied.has(h.id));

  if (huddles.length === 0) {
    console.log(
      `[publisher] team ${teamId}: ${allIds.length} huddle(s), none with members — skip`,
    );
    return { huddleIdsPosted: [], pushed: false };
  }
  if (huddles.length < allIds.length) {
    console.log(
      `[publisher] team ${teamId}: posting to ${huddles.length} of ${allIds.length} huddles (rest are empty)`,
    );
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
  let body = input.message;
  const embedUrl = input.newsLink && mode === "news" ? input.newsLink : null;

  // Sponsor whisper: append "— presented by X" to ~1 of every 5 NEWS messages
  // for this team. News-only on purpose: in-game scoring plays arrive in rapid
  // bursts (8+ in under a minute), so 1-in-5 of THOSE reads as "every other
  // bubble." News is the calm, substantial cadence where a credit lands well.
  // In-game rooms still carry the always-on header sponsor line separately.
  try {
    const sinceMidnight = new Date();
    sinceMidnight.setUTCHours(0, 0, 0, 0);
    const { count: todayCount } = await client
      .from("bot_emit_log")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("mode", "news")
      .gte("created_at", sinceMidnight.toISOString());
    if (mode === "news" && (todayCount ?? 0) % 5 === 0) {
      const { data: sponsor } = await client
        .from("team_sponsors")
        .select("brand_name, is_active, end_date")
        .eq("team_id", teamId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      const live =
        sponsor &&
        (!sponsor.end_date || new Date(sponsor.end_date).getTime() > Date.now());
      if (live && sponsor?.brand_name) {
        body = `${body}\n\n— presented by ${sponsor.brand_name}`;
      }
    }
  } catch (err) {
    console.warn("[publisher] sponsor line skipped", err);
  }

  // 4. Fan-out insert into huddle_messages.
  //
  // A GAME ROOM GETS THE NEUTRAL LINE.
  //
  // One voiced line is generated per TEAM and then fanned out to every room
  // that team has — which includes the public room for the fixture, where the
  // other team's fans are sitting. So "house money for the defense, Mahomes
  // and the offense already cashed in" landed in Denver·Kansas City, a room
  // stamped Kansas City only because a fixture room has to be stamped
  // something.
  //
  // Generating a second, neutral line would mean a second model call per play.
  // There is already a neutral line in hand — ESPN's own sentence, which is
  // what every routine play now uses anyway — so the fixture room gets that
  // and the team's own rooms keep the voice. No extra cost, and the room that
  // holds both fanbases stops taking a side.
  const neutral = (input.plainText ?? "").trim();
  const rows = huddles.map((h) => {
    const content = (h as any).is_game_room && neutral ? neutral : body;
    // FEED, OR VOICE.
    //
    // Both used to be message_type 'live_play', so the client could not tell
    // "Wil Lutz 31 Yd Field Goal" — which is the game happening — from the
    // Coach having an opinion about it. They are different things and they
    // should not look alike. A row whose content IS the plain ESPN sentence
    // is the feed; anything else came from a model.
    const isFeed = mode === "in_game" && !!neutral && content === neutral;
    return {
    huddle_id: h.id,
    user_id: systemUserId,
    content,
    embed_code: embedUrl,
    is_bot_message: true,
    message_type: mode === "in_game" ? (isFeed ? "play_feed" : "live_play") : "news",
    // Source 2: when the news item has an action photo, the client renders it
    // inline below the text (ChatMessage already handles media_url + image).
    ...(input.imageUrl
      ? { media_url: input.imageUrl, media_type: "image" }
      : {}),
    };
  });

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

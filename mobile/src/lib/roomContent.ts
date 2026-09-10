import { supabase } from "@/integrations/supabase/client";

/**
 * Furnishing a room from its team's feed.
 *
 * The bot publishes into every huddle carrying a team_id, which today includes
 * ~195 auto-created official rooms with nobody in them. Gating the bot on
 * membership stops that waste — but on its own it would also mean a room sits
 * silent until somebody talks, and almost every room is empty. Backfill is the
 * other half of that change: a room gets the team's recent feed the moment it
 * has someone in it, so "the room comes furnished" is true rather than
 * aspirational.
 *
 * Moved out of CreateSideHuddleScreen so joining can use it too — a room
 * created empty months ago should fill up when its first member arrives, not
 * stay a graveyard because the backfill only ever ran at creation.
 */

/**
 * Copy recent bot content from a team's official room into another room.
 *
 * Returns the system bot's user_id when it could be learned from the copied
 * rows, so the caller can post an admin welcome without a second lookup.
 */
export async function backfillTeamContent(
  targetHuddleId: string,
  teamId: string,
  windowHours = 24,
): Promise<string | null> {
  try {
    const { data: officialHuddle } = await supabase
      .from("huddles")
      .select("id")
      .eq("team_id", teamId)
      .eq("is_official_team_huddle", true)
      .maybeSingle();

    if (!officialHuddle) return null;
    if (officialHuddle.id === targetHuddleId) return null;

    const cutoff = new Date(
      Date.now() - windowHours * 60 * 60 * 1000,
    ).toISOString();

    const { data: botMessages } = await supabase
      .from("huddle_messages")
      .select(
        "user_id, content, media_url, media_type, message_type, is_bot_message, is_team_agent_message, created_at",
      )
      .eq("huddle_id", officialHuddle.id)
      .eq("is_bot_message", true)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(20);

    if (!botMessages || botMessages.length === 0) return null;

    // is_team_agent_message MUST be true here. The INSERT policy on
    // huddle_messages is:
    //     (is_team_agent_message = true) OR (auth.uid() = user_id AND ...)
    // These rows carry the SYSTEM bot's user_id, not ours, so the second branch
    // can never pass. Copying the source row's flag (which is false on every
    // bot-v2 post — the publisher doesn't set it) meant the whole batch was
    // silently rejected by RLS and every new room came up empty.
    const inserts = botMessages.map((m) => ({
      huddle_id: targetHuddleId,
      user_id: m.user_id,
      content: m.content,
      media_url: m.media_url,
      media_type: m.media_type,
      message_type: m.message_type,
      is_bot_message: true,
      is_team_agent_message: true,
      created_at: m.created_at,
    }));

    const { error: copyError } = await supabase
      .from("huddle_messages")
      .insert(inserts);
    if (copyError) console.warn("[backfill] insert rejected:", copyError);

    return botMessages[0]?.user_id ?? null;
  } catch (err) {
    // Never block the thing that triggered this — creating or joining a room
    // must succeed whether or not it ends up with content in it.
    console.warn("[backfill] failed:", err);
  }
  return null;
}

/**
 * Furnish a room only if it has nothing in it.
 *
 * Call after adding a member. A room that already has messages is left alone,
 * so joining a live conversation never shoves a week of bot posts underneath it.
 *
 * The window is wider than at creation on purpose: a brand-new room wants
 * today's news, but a room that has been sitting empty wants whatever exists.
 * The bot has gone quiet for days at a time before now, and a room with
 * five-day-old content still reads as a place where something happens.
 */
export async function backfillIfEmpty(
  huddleId: string,
  teamId: string | null | undefined,
): Promise<void> {
  if (!teamId) return;
  try {
    const { count, error } = await supabase
      .from("huddle_messages")
      .select("id", { count: "exact", head: true })
      .eq("huddle_id", huddleId)
      .limit(1);

    if (error) return;
    if ((count ?? 0) > 0) return;

    await backfillTeamContent(huddleId, teamId, 24 * 7);
  } catch (err) {
    console.warn("[backfill] empty-check failed:", err);
  }
}

import { supabase } from "@/integrations/supabase/client";
import { followTeam } from "@/lib/follows";
import { backfillTeamContent } from "@/lib/roomContent";

/**
 * The admin's first message.
 *
 * The admin is the only person who can turn a 1-person room into a 40-person
 * room, so this is addressed to them, promises only what the Coach actually
 * does today, and carries exactly one action.
 *
 * Deliberately does NOT say "type @coach" — the Coach answers questions now,
 * but a brand-new empty room has nothing to answer about, and an instruction
 * that produces a shrug is worse than no instruction. It offers instead: the
 * live poller genuinely does post plays into this room during a game.
 */
export async function postAdminWelcome(
  huddleId: string,
  huddleName: string,
  teamName: string | null,
  knownSystemUserId: string | null,
) {
  try {
    let systemUserId = knownSystemUserId;
    if (!systemUserId) {
      const { data } = await supabase.rpc("get_or_create_system_user");
      systemUserId = (data as string | null) ?? null;
    }
    if (!systemUserId) return;

    const team = teamName ?? "your team";
    // Say what it IS, then what to DO — with the actual button named. The
    // 48-hour nudge is useless if nobody knew where anything was on day one.
    // It opens by placing the room against the community one it replaced,
    // because that is the question a new owner actually has: what is this for
    // now that I have left the front door?
    const content =
      `**Your own ${team} huddle** — same feed as the community room, just ` +
      `your crew. I'll post news as it breaks and call it live on game days. 🏈\n\n` +
      `Your half: get your people in. Tap the **+** up top — a huddle of one ` +
      `is just me talking to myself. Ask **@Coach** (on the **+** below) ` +
      `anything: the score, who's starting, camp news!\n\n` +
      `**Room settings**, upper right, if you want this room locked, to ` +
      `manage members and more.`;

    const { error } = await supabase.from("huddle_messages").insert({
      huddle_id: huddleId,
      user_id: systemUserId,
      content,
      is_bot_message: true,
      // Same RLS reason as the backfill above — this row isn't ours.
      is_team_agent_message: true,
      message_type: "admin_welcome",
    });
    if (error) console.warn("Admin welcome rejected:", error);
  } catch (err) {
    console.warn("Admin welcome failed:", err);
  }
}


/**
 * Make somebody their own room for a team, in one tap.
 *
 * Spin-up from a community room does not ask for a name. The person already
 * said which team by being in that room, and their own name is the only other
 * thing the room needs — a form in the middle of "I want my own room" is the
 * step where people stop. It can be renamed in settings, where renaming is a
 * decision rather than a toll.
 *
 * Same path as the create screen, so a spun-up room is not a lesser room: the
 * team gets followed, the last 24h of bot content is backfilled so it doesn't
 * open empty, and the admin welcome lands last.
 */
export async function createTeamHuddle(params: {
  userId: string;
  teamId: string;
  teamName: string | null;
  /** Used to name the room. */
  displayName: string | null;
  isPrivate?: boolean;
  /** Supplied when the caller already made one, to save a round trip. */
  name?: string;
}): Promise<string | null> {
  const { userId, teamId, teamName, displayName, isPrivate = false } = params;

  const owner = (displayName ?? "").trim().split(/\s+/)[0] || "My";
  const name =
    params.name?.trim() ||
    (teamName ? `${owner}'s ${teamName} huddle` : `${owner}'s huddle`);

  await followTeam(teamId);

  const { data, error } = await supabase
    .from("huddles")
    .insert({
      name,
      owner_id: userId,
      team_id: teamId,
      is_private: isPrivate,
      is_official_team_huddle: false,
      is_verified: false,
      member_count: 1,
    })
    .select("id")
    .single();

  if (error || !data) return null;

  await supabase.from("huddle_members").insert({
    huddle_id: data.id,
    user_id: userId,
  });

  const systemUserId = await backfillTeamContent(data.id, teamId);
  await postAdminWelcome(data.id, name, teamName, systemUserId);

  return data.id;
}

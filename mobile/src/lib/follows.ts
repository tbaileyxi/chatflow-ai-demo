import { supabase } from "@/integrations/supabase/client";

/**
 * Which teams a person follows.
 *
 * Following is not membership. You can follow a team you have no room in —
 * that's how the app knows to surface its games, its news and its rooms to
 * you. But you cannot create a huddle for a team you don't follow, which is
 * what keeps a room's team meaningful instead of arbitrary.
 *
 * The mobile app never wrote this table until now: the onboarding team step
 * called join_team_huddle() and nothing else, so user_follows only ever held
 * rows from the older web flow. Anything that wanted to know "what does this
 * person care about" had nothing to read.
 */

/** Teams the signed-in user follows. Empty array rather than throwing. */
export async function getFollowedTeamIds(): Promise<string[]> {
  const { data, error } = await supabase.from("user_follows").select("team_id");
  if (error || !data) return [];
  return data.map((r: any) => r.team_id).filter(Boolean);
}

export async function isFollowing(teamId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_follows")
    .select("id")
    .eq("team_id", teamId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/**
 * Follow a team. Safe to call repeatedly.
 *
 * Checked-then-inserted rather than upserted: there is no unique index on
 * (user_id, team_id) in this schema, so onConflict has nothing to resolve
 * against and would error rather than de-duplicate.
 *
 * Returns whether the user ends up following, not whether a row was written —
 * already-following is a success.
 */
export async function followTeam(teamId: string): Promise<boolean> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return false;

    if (await isFollowing(teamId)) return true;

    const { error } = await supabase
      .from("user_follows")
      .insert({ user_id: userId, team_id: teamId });

    // A duplicate that slipped through a race is still "following".
    if (error && !/duplicate|unique/i.test(error.message)) {
      console.warn("[follows] could not follow", teamId, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[follows] follow threw", err);
    return false;
  }
}

export async function unfollowTeam(teamId: string): Promise<boolean> {
  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("team_id", teamId);
  if (error) {
    console.warn("[follows] could not unfollow", teamId, error.message);
    return false;
  }
  return true;
}

/**
 * The /sponsor slug for someone's primary team — the first team they picked,
 * which is the earliest follow. Null when they follow nothing.
 *
 * Built from city and name the same way the sponsor page and founding_partners
 * build it ("buffalo-bills"), because a slug made any other way silently misses.
 */
export async function primaryTeamSlug(): Promise<string | null> {
  // Filtered to this user explicitly: user_follows is readable by everyone
  // (SELECT USING true), so without it this returns the earliest follow in the
  // whole app rather than theirs.
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from("user_follows")
    .select("created_at, teams!team_id (city, name)")
    .eq("user_id", uid)
    .order("created_at", { ascending: true })
    .limit(1);
  const team = (data?.[0] as any)?.teams;
  if (!team?.name) return null;
  return `${team.city ?? ""} ${team.name}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

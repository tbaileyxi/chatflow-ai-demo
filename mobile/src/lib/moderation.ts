import { supabase } from "@/integrations/supabase/client";

/**
 * Report and block, in one place.
 *
 * These were written inline inside ChatMessage, which meant the only way to
 * block somebody was to find something they had said and long-press it. If
 * they deleted the message, or the problem was the profile itself, there was
 * no route at all.
 *
 * Guideline 1.2 wants a report mechanism and a block mechanism. It doesn't say
 * they have to hang off a message, and hanging them off a message is the
 * reason a reviewer can miss them.
 */

export type ReportReason =
  | "objectionable"
  | "harassment"
  | "spam"
  | "impersonation";

/** Report a specific message. */
export async function reportMessage(args: {
  messageId: string;
  huddleId: string;
  reportedUserId: string | null;
  reason?: ReportReason;
  details?: string;
}): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return false;

  const { error } = await supabase.from("message_reports").insert({
    message_id: args.messageId,
    huddle_id: args.huddleId,
    reporter_id: auth.user.id,
    reported_user_id: args.reportedUserId,
    reason: args.reason ?? "objectionable",
    details: args.details ?? null,
  });

  // The unique index makes a second report of the same message a no-op rather
  // than an error the user should ever see.
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.warn("[moderation] report failed", error.message);
    return false;
  }
  return true;
}

/** Report a person, with no particular message attached. */
export async function reportUser(args: {
  userId: string;
  reason?: ReportReason;
  details?: string;
}): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return false;

  const { error } = await supabase.from("message_reports").insert({
    message_id: null,
    reporter_id: auth.user.id,
    reported_user_id: args.userId,
    reason: args.reason ?? "objectionable",
    details: args.details ?? null,
  });

  if (error && !/duplicate|unique/i.test(error.message)) {
    console.warn("[moderation] user report failed", error.message);
    return false;
  }
  return true;
}

/**
 * Block someone. Idempotent — user_blocks has a unique index on
 * (blocker_id, blocked_id), so a second block is a success, not an error.
 */
export async function blockUser(userId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return false;
  if (auth.user.id === userId) return false; // no_self_block would reject it anyway

  const { error } = await supabase
    .from("user_blocks")
    .insert({ blocker_id: auth.user.id, blocked_id: userId });

  if (error && !/duplicate|unique/i.test(error.message)) {
    console.warn("[moderation] block failed", error.message);
    return false;
  }
  return true;
}

export async function unblockUser(userId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return false;

  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", auth.user.id)
    .eq("blocked_id", userId);

  if (error) {
    console.warn("[moderation] unblock failed", error.message);
    return false;
  }
  return true;
}

export async function isBlocked(userId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return false;

  const { data } = await supabase
    .from("user_blocks")
    .select("id")
    .eq("blocker_id", auth.user.id)
    .eq("blocked_id", userId)
    .limit(1)
    .maybeSingle();

  return !!data;
}

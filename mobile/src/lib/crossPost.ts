// One moment, several of your rooms.
//
// The media is already uploaded and already public within the app, so sending
// it on is not another upload — it is another row pointing at the same file.
// That keeps a three-room send as cheap as a one-room send and means the
// picture in each room is byte-identical to the original.
//
// SEPARATE POSTS, DELIBERATELY. Each room gets its own message row, so each
// room threads its own replies and reactions. A single row shown in three
// places would have merged three conversations into one, which is the exact
// thing people keep separate group chats to avoid.
//
// DELETE IS PER ROOM, also deliberately. You posted three things to three
// groups; taking it out of the family room should not reach into the buddies'
// room. shared_from_id is stamped anyway — it costs nothing and it is what a
// "remove it everywhere" option would need later, along with letting a room
// show where a moment came from.

import { supabase } from "@/integrations/supabase/client";

export type CrossPostSource = {
  /** The message being sent on. Becomes shared_from_id on each copy. */
  id: string;
  userId: string;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  messageType: string | null;
};

export type CrossPostResult = { sent: number; failed: number };

/**
 * Copy `source` into each of `huddleIds`.
 *
 * Rooms are written one at a time on purpose. A single multi-row insert is one
 * statement that either lands or does not, so one room refusing the write —
 * membership lapsed, room closed — would silently take the others down with
 * it. Sending three and reporting two is honest; sending none because of the
 * third is not.
 */
export async function crossPostMessage(
  source: CrossPostSource,
  huddleIds: string[],
): Promise<CrossPostResult> {
  let sent = 0;
  let failed = 0;

  for (const huddleId of huddleIds) {
    try {
      const { error } = await supabase.from("huddle_messages").insert({
        huddle_id: huddleId,
        user_id: source.userId,
        content: source.content ?? "",
        ...(source.mediaUrl
          ? { media_url: source.mediaUrl, media_type: source.mediaType }
          : {}),
        ...(source.messageType ? { message_type: source.messageType } : {}),
        shared_from_id: source.id,
      } as any);
      if (error) throw error;
      sent += 1;
    } catch (err) {
      console.warn("[cross-post] room refused the copy", huddleId, err);
      failed += 1;
    }
  }

  return { sent, failed };
}

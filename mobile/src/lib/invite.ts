import { Share } from "react-native";
import { supabase } from "@/integrations/supabase/client";
import { getFollowedTeamIds } from "@/lib/follows";
import { backfillTeamContent } from "@/lib/roomContent";

/**
 * Inviting is what creates a room.
 *
 * A person with nobody in their contacts has nothing to invite anyone TO, and
 * the old cold-start screen said "invite someone with a link" while offering
 * only a Continue button. Sending the bare homepage instead — which an earlier
 * version did — is why nobody ever joined from an invite: a link to a product
 * is not a link to a place.
 *
 * So the room is a side effect of sending. You never decide to create one, you
 * decide to bring somebody, and the room exists because of that. It is named
 * from your own name rather than asked for, because a naming prompt at this
 * moment is a question standing between a person and the only action that
 * changes anything for them.
 */

export type InviteResult =
  | { ok: true; huddleId: string; code: string; shared: boolean }
  | { ok: false; reason: string };

export async function createRoomAndShare(
  displayName?: string | null,
): Promise<InviteResult> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return { ok: false, reason: "not signed in" };

    // A huddle's team_id is NOT NULL, so the room needs one. Whatever they
    // just followed is the honest answer — they picked it a screen ago.
    const followed = await getFollowedTeamIds();
    const teamId = followed[0];
    if (!teamId) {
      return { ok: false, reason: "no team followed" };
    }

    const first = (displayName ?? "").trim().split(/\s+/)[0];
    const name = first ? `${first}'s huddle` : "Game night";

    const { data: room, error: roomError } = await supabase
      .from("huddles")
      .insert({
        name,
        owner_id: userId,
        team_id: teamId,
        is_private: false,
        is_official_team_huddle: false,
        is_verified: false,
        member_count: 1,
      })
      .select("id")
      .single();

    if (roomError || !room) {
      return { ok: false, reason: roomError?.message ?? "could not create" };
    }

    await supabase
      .from("huddle_members")
      .insert({ huddle_id: room.id, user_id: userId });

    // Whoever accepts this link should land somewhere with something in it.
    await backfillTeamContent(room.id, teamId);

    const { data: codeRow, error: codeError } = await (supabase.rpc as any)(
      "create_room_invite_code",
      { p_huddle_id: room.id },
    );
    if (codeError) {
      return { ok: false, reason: codeError.message };
    }
    const row = Array.isArray(codeRow) ? codeRow[0] : codeRow;
    const code: string | undefined = row?.invite_code;
    if (!code) return { ok: false, reason: "no code" };

    // Message and URL passed SEPARATELY, and the link is not repeated in the
    // text — both together is what breaks the iMessage preview card.
    const result = await Share.share({
      message: "Watch the game with me on Side Huddle.",
      url: `https://www.sidehuddlesports.com/i/${code}`,
    });

    return {
      ok: true,
      huddleId: room.id,
      code,
      shared: result.action === Share.sharedAction,
    };
  } catch (err: any) {
    return { ok: false, reason: err?.message ?? "unknown" };
  }
}

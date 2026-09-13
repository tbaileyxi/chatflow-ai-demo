import { Alert } from "react-native";
import { supabase } from "@/integrations/supabase/client";

/**
 * Open the huddle for a game — the public one, that nobody creates.
 *
 * TAPPING A LIVE SCORE USED TO OPEN A FORM. If you had no huddle for either
 * team, the app sent you to "Start a huddle" and asked you to name something,
 * which is not an answer to "I want to watch this game". For a new user every
 * single tap on the slate did that.
 *
 * There is a huddle for every fixture now. It is made on first entry and it
 * is open, so you never walk into an empty one — the game is what fills it,
 * which is the whole reason public rooms failed the first time we tried them.
 *
 * See RUN_THIS_SIDE_HUDDLES.sql. The function is SECURITY DEFINER because
 * entering a public huddle is allowed while inserting huddles generally is
 * not.
 */
export async function openGameRoom(
  gameId: string,
  navigation: { navigate: (screen: string, params?: any) => void },
): Promise<boolean> {
  const { data, error } = await (supabase.rpc as any)("get_or_create_game_room", {
    p_game_id: gameId,
  });

  if (error || !data) {
    // A build that predates the migration has no such function. Say the true
    // thing rather than dropping somebody into a naming form again.
    const missing = /function .* does not exist|schema cache/i.test(error?.message ?? "");
    Alert.alert(
      "Can't open that game",
      missing
        ? "This game's huddle isn't set up on the server yet."
        : (error?.message ?? "Try again in a moment."),
    );
    return false;
  }

  navigation.navigate("Huddle", { huddleId: data as string });
  return true;
}

/**
 * Pull a few people out of a game huddle into one of your own.
 *
 * Everyone named comes with you — you spun off BECAUSE of them, so asking
 * again on the next screen is a form for a decision already made. It closes
 * at 2am; nothing is deleted, and keeping it is one tap.
 */
export async function spinUpSideHuddle(
  gameId: string,
  userIds: string[],
  navigation: { navigate: (screen: string, params?: any) => void },
): Promise<boolean> {
  const { data, error } = await (supabase.rpc as any)("spin_up_side_huddle", {
    p_game_id: gameId,
    p_user_ids: userIds,
  });

  if (error || !data) {
    Alert.alert("Couldn't spin that up", error?.message ?? "Try again in a moment.");
    return false;
  }

  navigation.navigate("Huddle", { huddleId: data as string });
  return true;
}

import { Alert } from "react-native";
import { supabase } from "@/integrations/supabase/client";

/**
 * Open the direct thread with somebody, making it if it does not exist.
 *
 * A DM is a huddle with two people in it — see RUN_THIS_DMS.sql. That is not
 * a shortcut: a thread between two people is what a huddle already is, so it
 * inherits the composer, the camera, presence, delete, report and realtime
 * rather than having them rebuilt badly somewhere else.
 *
 * CONNECTED PEOPLE ONLY, enforced in the function rather than here. A client
 * check is a suggestion; the whole point is that a stranger from a public
 * game huddle cannot open one.
 */
export async function openDm(
  otherUserId: string,
  navigation: { navigate: (screen: string, params?: any) => void },
): Promise<boolean> {
  const { data, error } = await (supabase.rpc as any)("open_dm", {
    p_other_user: otherUserId,
  });

  if (error || !data) {
    const connected = /connected/i.test(error?.message ?? "");
    const missing = /function .* does not exist|schema cache/i.test(error?.message ?? "");
    Alert.alert(
      connected ? "Not connected yet" : "Couldn't open that",
      connected
        ? "You can message people you're connected to. Add them first."
        : missing
          ? "Direct messages aren't set up on the server yet."
          : (error?.message ?? "Try again in a moment."),
    );
    return false;
  }

  navigation.navigate("Huddle", { huddleId: data as string });
  return true;
}

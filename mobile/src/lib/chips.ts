import { Alert } from "react-native";
import { supabase } from "@/integrations/supabase/client";

// Running out of chips used to end the session: every stake path raises
// "OUT_OF_CHIPS: ... Upgrade to Premium to keep playing!", and this build has
// no Premium to upgrade to. Worse, reset_weekly_chips() — the refill that was
// supposed to catch this — is scheduled on nothing and has never run.
//
// So the wall was real and permanent. This turns it into a tap.

export function isOutOfChips(err: unknown): boolean {
  return /OUT_OF_CHIPS/i.test(String((err as Error)?.message ?? err ?? ""));
}

/** Strips the "OUT_OF_CHIPS:" marker the RPCs prefix onto the message. */
export function chipErrorText(err: unknown): string {
  return String((err as Error)?.message ?? err ?? "")
    .replace(/^.*OUT_OF_CHIPS:\s*/i, "")
    .trim() || "You're out of chips.";
}

/**
 * Offer the free top-up. Returns true when chips were actually added, so the
 * caller can refresh and let the player retry the thing they just tried.
 */
export async function offerFreeChips(err: unknown): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Out of chips",
      `${chipErrorText(err)}\n\nGrab 500 free chips and keep going.`,
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Add 500 chips",
          onPress: async () => {
            // Cast: generated types are regenerated from the schema, and this
            // RPC ships in FREE_CHIPS_TOPUP.sql rather than a checked-in migration.
            const { data, error } = await (supabase as any).rpc("claim_free_chips");
            const res = data as { ok?: boolean; reason?: string; total_chips?: number } | null;
            if (error || !res?.ok) {
              Alert.alert(
                "Couldn't add chips",
                res?.reason === "too_soon"
                  ? "You've already topped up today. Try again tomorrow."
                  : res?.reason === "not_needed"
                    ? "You've still got chips to play with."
                    : error?.message ?? "Try again in a moment.",
              );
              resolve(false);
              return;
            }
            Alert.alert("Chips added", `You're back to ${res.total_chips} chips.`);
            resolve(true);
          },
        },
      ],
    );
  });
}

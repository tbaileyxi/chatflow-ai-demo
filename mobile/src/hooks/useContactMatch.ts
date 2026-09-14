// useContactMatch — "who that I know is already here?"
//
// Flow: ask permission → read the address book → hash phones + emails ON DEVICE
// → send only hashes → get back the profiles that matched. The raw address book
// never leaves the phone and the hashes are not stored server-side; they are
// query parameters, nothing more.

import { useCallback, useState } from "react";
import * as Contacts from "expo-contacts";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { hashContacts } from "@/lib/contactMatch";
import { rememberContactNames, CONTACT_NAMES_QK } from "@/lib/personName";

export type ContactMatch = {
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  alreadyConnected: boolean;
  // What YOU have this person saved as. This is the name to lead with — their
  // Side Huddle name can be anything ("burnsyny2000") and often identifies
  // nobody. Null only if the contact had no name on it.
  contactName: string | null;
};

export type MatchState =
  | "idle"
  | "requesting"
  | "scanning"
  | "done"
  | "denied"
  | "error";

export function useContactMatch() {
  const [state, setState] = useState<MatchState>("idle");
  const [matches, setMatches] = useState<ContactMatch[]>([]);
  const queryClient = useQueryClient();

  const run = useCallback(async (): Promise<ContactMatch[]> => {
    setState("requesting");
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        setState("denied");
        return [];
      }

      setState("scanning");
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
      });

      const entries = (data ?? []).map((c) => ({
        name: c.name ?? null,
        phones: (c.phoneNumbers ?? [])
          .map((p) => p.number ?? "")
          .filter(Boolean),
        emails: (c.emails ?? []).map((e) => e.email ?? "").filter(Boolean),
      }));

      const { hashes, nameByHash } = await hashContacts(entries);
      if (hashes.length === 0) {
        setMatches([]);
        setState("done");
        return [];
      }

      const { data: rows, error } = await (supabase.rpc as any)(
        "match_contacts",
        { p_hashes: hashes },
      );
      if (error) throw error;

      const found: ContactMatch[] = ((rows ?? []) as any[]).map((r) => ({
        userId: r.user_id,
        displayName: r.display_name ?? null,
        username: r.username ?? null,
        avatarUrl: r.avatar_url ?? null,
        alreadyConnected: !!r.already_connected,
        contactName: r.matched_hash
          ? (nameByHash.get(r.matched_hash) ?? null)
          : null,
      }));

      // Same as the daily sweep: keep what you have these people saved as, on
      // this device, so every list can lead with it.
      await rememberContactNames(
        found.map((f) => ({ userId: f.userId, contactName: f.contactName })),
      );
      queryClient.invalidateQueries({ queryKey: CONTACT_NAMES_QK });

      setMatches(found);
      setState("done");
      return found;
    } catch (err) {
      console.warn("[contacts] match failed", err);
      setState("error");
      return [];
    }
  }, [queryClient]);

  // Add someone to your graph. Idempotent server-side, so double-taps are safe.
  const connect = useCallback(
    async (userId: string) => {
      const { error } = await (supabase.rpc as any)("connect_to", {
        p_user_id: userId,
        p_source: "contact",
      });
      if (error) {
        console.warn("[contacts] connect failed", error);
        return false;
      }
      setMatches((prev) =>
        prev.map((m) =>
          m.userId === userId ? { ...m, alreadyConnected: true } : m,
        ),
      );
      queryClient.invalidateQueries({ queryKey: ["known-people"] });

      // Tell them someone they know showed up. This is the signal that was
      // missing entirely — people joined and nobody who knew them found out.
      // Best-effort: a failed notification must never fail the connection.
      const { data: me } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .maybeSingle();
      const myName = me?.display_name || me?.username || "Someone you know";

      supabase.functions
        .invoke("send-push-notification", {
          body: {
            user_ids: [userId],
            notification_type: "friend_joined",
            title: "Someone you know is here",
            body: `${myName} just joined Side Huddle.`,
          },
        })
        .catch(() => {});

      return true;
    },
    [queryClient],
  );

  return { state, matches, run, connect };
}

// useAutoContactMatch — "who that I know is here?", asked on its own.
//
// Contact matching compares your address book against the people who exist AT
// THAT MOMENT. Run once, and everyone who signs up afterwards is invisible to
// you forever — which is exactly what happened: eight people joined in a day
// and nobody who knew them found out, because the match lived behind a button
// on the profile tab that nobody presses twice.
//
// So it runs itself. On app open, at most once a day, silently.
//
// Two rules it must not break:
//   • Never ASK for contacts permission here. If the answer is not already yes
//     this does nothing at all — a permission sheet that appears unprompted on
//     launch is how an app gets deleted.
//   • Never connect anyone automatically. Matching is a lookup; connecting is
//     a social act, and it stays a tap.

import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Contacts from "expo-contacts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { hashContacts } from "@/lib/contactMatch";
import { rememberContactNames, CONTACT_NAMES_QK } from "@/lib/personName";
import type { ContactMatch } from "@/hooks/useContactMatch";

const LAST_RUN_KEY = "contacts:lastAutoMatch";
const EVERY_MS = 24 * 60 * 60 * 1000;

export function useAutoContactMatch() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newPeople, setNewPeople] = useState<ContactMatch[]>([]);
  // Whether the sweep is allowed to run at all. The caller needs this to decide
  // whether to offer a manual "find friends" — somebody who tapped "Not now" at
  // onboarding never granted, so this hook does nothing for them forever, and
  // they need a way back in that is not buried on another tab.
  const [granted, setGranted] = useState<boolean | null>(null);

  const sweep = useCallback(async (force = false) => {
    if (!user?.id) return;
    try {
      // getPermissionsAsync, never request — see the note above.
      const { status } = await Contacts.getPermissionsAsync();
      setGranted(status === "granted");
      if (status !== "granted") return;

      if (!force) {
        const last = await AsyncStorage.getItem(LAST_RUN_KEY);
        if (last && Date.now() - Number(last) < EVERY_MS) return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
      });
      const entries = (data ?? []).map((c) => ({
        name: c.name ?? null,
        phones: (c.phoneNumbers ?? []).map((p) => p.number ?? "").filter(Boolean),
        emails: (c.emails ?? []).map((e) => e.email ?? "").filter(Boolean),
      }));

      const { hashes, nameByHash } = await hashContacts(entries);
      await AsyncStorage.setItem(LAST_RUN_KEY, String(Date.now()));
      if (hashes.length === 0) return;

      const { data: rows, error } = await (supabase.rpc as any)("match_contacts", {
        p_hashes: hashes,
      });
      if (error) throw error;

      // BEFORE the filter below, and deliberately.
      //
      // This is the only moment the app can learn what you have somebody saved
      // as, and the people it matters most for are the ones already in your
      // list — they are who you see every day. Filtering first would cache
      // names only for strangers.
      await rememberContactNames(
        ((rows ?? []) as any[]).map((r) => ({
          userId: r.user_id,
          contactName: r.matched_hash ? (nameByHash.get(r.matched_hash) ?? null) : null,
        })),
      );
      queryClient.invalidateQueries({ queryKey: CONTACT_NAMES_QK });

      setNewPeople(
        ((rows ?? []) as any[])
          // Already in your list is not news.
          .filter((r) => !r.already_connected)
          .map((r) => ({
            userId: r.user_id,
            displayName: r.display_name ?? null,
            username: r.username ?? null,
            avatarUrl: r.avatar_url ?? null,
            alreadyConnected: false,
            contactName: r.matched_hash ? (nameByHash.get(r.matched_hash) ?? null) : null,
          })),
      );
    } catch (err) {
      // Silent by design. This runs without the user asking for it, so a
      // failure must never produce an alert or block anything.
      console.warn("[contacts] auto match failed", err);
    }
  }, [user?.id, queryClient]);

  useEffect(() => {
    void sweep();
  }, [sweep]);

  // Drop someone from the suggestion list once they've been added or dismissed,
  // so the row disappears on tap instead of waiting for the next sweep.
  const forget = useCallback((userId: string) => {
    setNewPeople((prev) => prev.filter((p) => p.userId !== userId));
  }, []);

  // Let a manual run hand its results back here, so matches found by tapping a
  // button land in the same list as matches found by the sweep.
  const offer = useCallback((found: ContactMatch[]) => {
    setNewPeople(found.filter((m) => !m.alreadyConnected));
    setGranted(true);
  }, []);

  return { newPeople, forget, granted, offer, resweep: () => sweep(true) };
}

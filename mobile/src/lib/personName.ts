// What to call somebody.
//
// The app had three names for a person and led with the worst one. Usernames
// here are GENERATED — "tbaileyxi_d844fb6c", "ttybailey_7576d07a" — so an
// invite list showing @username was showing a string that identifies nobody to
// anybody. And display names are whatever the person typed: "Broseph" is a
// real answer, and it is not what their name is in your phone.
//
// The name you know them by is the one in your address book. We already have
// it — match_contacts returns which of your hashes matched, and hashContacts
// keeps the name that made each hash — but it was computed during a scan and
// thrown away. So: keep it, ON THIS DEVICE, and lead with it.
//
// Nothing here ever goes to the server. The contact name is a local label for
// a row, which is the whole reason the matching is done with hashes.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const KEY = "contacts:namesByUserId";
export const CONTACT_NAMES_QK = ["contact-names"];

// "User" is what the trigger names a profile at signup. Onboarding is supposed
// to replace it and plainly does not always — 25 profiles are still called this
// and one of them has onboarding_completed = true, which is why the filter that
// tried to hide them by that flag never worked. Treat it as "no name given"
// wherever it appears rather than printing it at people.
const PLACEHOLDER = /^\s*user\s*$/i;

export type NameParts = {
  contactName?: string | null;
  displayName?: string | null;
  username?: string | null;
};

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
}

/**
 * The name to show. In order: what YOU have them saved as, then the name they
 * chose, then an honest shrug.
 *
 * Username is deliberately NOT in this chain. It is generated, so falling back
 * to it trades one unreadable label for another.
 */
export function personName(p: NameParts): string {
  const contact = clean(p.contactName);
  if (contact) return contact;
  const display = clean(p.displayName);
  if (display && !PLACEHOLDER.test(display)) return display;
  return "Someone you know";
}

/**
 * Their Side Huddle name, for the second line — but only when it adds
 * something. If we are already showing it, or it is the placeholder, there is
 * nothing to say.
 */
export function personAka(p: NameParts): string | null {
  const display = clean(p.displayName);
  if (!display || PLACEHOLDER.test(display)) return null;
  if (personName(p) === display) return null;
  return display;
}

/** First word, for a tile too narrow for more. */
export function personShortName(p: NameParts): string {
  return personName(p).split(/\s+/)[0];
}

/**
 * Search. Matches every name a person has, INCLUDING username — someone who
 * knows the handle should still find them, it just should not be what they
 * are shown.
 */
export function personMatches(p: NameParts, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const needle = q.startsWith("@") ? q.slice(1) : q;
  return [p.contactName, p.displayName, p.username].some(
    (v) => clean(v)?.toLowerCase().includes(needle) ?? false,
  );
}

// ── the cache ───────────────────────────────────────────────────────────────

/**
 * MERGE, never replace. A scan only sees the contacts on this phone right now;
 * overwriting would drop a name every time somebody's address book was
 * temporarily missing an entry.
 */
export async function rememberContactNames(
  pairs: { userId: string; contactName: string | null }[],
): Promise<void> {
  try {
    const keep = pairs.filter((p) => clean(p.contactName));
    if (keep.length === 0) return;
    const raw = await AsyncStorage.getItem(KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    for (const p of keep) map[p.userId] = p.contactName!.trim();
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch (err) {
    console.warn("[names] could not cache contact names", err);
  }
}

export function useContactNames(): Map<string, string> {
  const { data } = useQuery({
    queryKey: CONTACT_NAMES_QK,
    staleTime: Infinity,
    queryFn: async (): Promise<Record<string, string>> => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    },
  });
  return useMemo(() => new Map(Object.entries(data ?? {})), [data]);
}

/** Call after a scan has written new names, so lists relabel without a reload. */
export function useRefreshContactNames() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: CONTACT_NAMES_QK });
}

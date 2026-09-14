// "At the game" — the check-in side, and the reading side.
//
// WHAT THIS DELIBERATELY IS NOT: a tracker. There is no background location,
// no geofence registered with iOS, no history. The app looks once when it
// comes to the front, works out on-device whether that is inside a stadium,
// and tells the server a venue id or nothing at all. Between foregrounds it
// knows nothing, which is why the server row carries a three-hour expiry
// instead of pretending to be current.

import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { nearestVenue, useVenues } from "@/lib/venues";

// Don't ask iOS for a position more than once every few minutes. Foregrounding
// is a frequent event — every notification tap, every app switch — and a fix
// per switch is a battery complaint with no upside, since nobody walks in or
// out of a stadium in five minutes.
const MIN_GAP_MS = 5 * 60 * 1000;

// Turning the switch on in Profile has to check in NOW. Without this the gate
// above would swallow it and you would stand in the stadium watching nothing
// happen for five minutes, which reads as broken.
let forceCheck: (() => void) | null = null;
export function recheckAtVenue() { forceCheck?.(); }

/**
 * Drives your own check-in. Mount ONCE, high in the tree.
 */
export function useAtVenueReporter() {
  const { user } = useAuth();
  const { data: venues } = useVenues();
  const queryClient = useQueryClient();
  const lastLook = useRef(0);

  const look = useCallback(async (force = false) => {
    if (!user?.id || !venues || venues.length === 0) return;
    if (!force && Date.now() - lastLook.current < MIN_GAP_MS) return;
    // Stamped HERE, not after the checks below. Stamping it late meant a
    // person with the switch off, or with location denied, re-read their
    // profile on every single foreground — every notification tap, every app
    // switch — to be told the same no.
    lastLook.current = Date.now();

    // The switch first, before touching location at all. Someone who turned
    // this off should not have their phone asked where it is, never mind the
    // answer being thrown away afterwards.
    const { data: prof } = await supabase
      .from("profiles")
      .select("share_at_venue")
      .eq("user_id", user.id)
      .maybeSingle();
    if (prof && (prof as any).share_at_venue === false) return;

    // ASK, don't wait to be asked.
    //
    // This used to only READ the permission and leave the asking to the switch
    // in Profile. But the switch ships ON, so it never changed, so the request
    // never fired — the feature was on for everyone and did nothing for
    // anyone. Nobody opens Profile to turn on a thing they have not seen yet.
    //
    // So: if the switch is on and iOS has never asked, ask. UNDETERMINED is
    // the only state this fires in, and iOS shows that dialog exactly once in
    // the life of an install, so this cannot nag — after the first answer the
    // status is granted or denied and we fall straight through.
    let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.UNDETERMINED && canAskAgain) {
      ({ status } = await Location.requestForegroundPermissionsAsync());
    }
    if (status !== Location.PermissionStatus.GRANTED) return;

    let pos;
    try {
      pos = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 });
      if (!pos) {
        pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // ~100m. A kilometre fence needs no better.
        });
      }
    } catch (err) {
      console.warn("[at-venue] no fix", err);
      return;
    }

    const hit = nearestVenue(venues, pos.coords.latitude, pos.coords.longitude);
    try {
      if (hit) {
        await (supabase.rpc as any)("check_in_at_venue", { p_venue_id: hit.venue.id });
      } else {
        // Leaving matters as much as arriving. Without this you would sit at
        // "At Lambeau" for three hours after driving home.
        await (supabase.rpc as any)("check_out_of_venue");
      }
      queryClient.invalidateQueries({ queryKey: ["venue-presence"] });
    } catch (err) {
      console.warn("[at-venue] could not report", err);
    }
  }, [user?.id, venues, queryClient]);

  useEffect(() => {
    void look();
    forceCheck = () => void look(true);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void look();
    });
    return () => {
      sub.remove();
      forceCheck = null;
    };
  }, [look]);
}

/**
 * Who is at a stadium right now: you, and the people you are connected to.
 *
 * The friend filter is NOT here. It is the row-level policy on
 * venue_presence, so this select returns exactly what you are allowed to see
 * whatever the client asks for. Venue names come from the cached list rather
 * than an embed — a select that joins is a select that can fail whole.
 */
export function useVenuePresence() {
  const { user } = useAuth();
  const { data: venues } = useVenues();

  return useQuery({
    queryKey: ["venue-presence", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<Map<string, { venueId: string; venueName: string }>> => {
      // See the note in lib/venues.ts — generated types predate this table.
      const { data, error } = await (supabase as any)
        .from("venue_presence")
        .select("user_id, venue_id, until")
        .gt("until", new Date().toISOString());
      if (error) {
        console.warn("[at-venue] could not read", error);
        return new Map();
      }
      const byId = new Map((venues ?? []).map((v) => [v.id, v.name]));
      const out = new Map<string, { venueId: string; venueName: string }>();
      for (const row of (data ?? []) as any[]) {
        out.set(row.user_id, {
          venueId: row.venue_id,
          venueName: byId.get(row.venue_id) ?? "the game",
        });
      }
      return out;
    },
  });
}

// The stadium list, and the arithmetic that decides you are at one.
//
// All of this runs ON THE PHONE. That is the point: the position goes into
// nearestVenue() and a venue id comes out, and only the id is ever sent. There
// are 106 venues and the list barely changes, so downloading the whole thing
// once a day is cheaper than asking a server "where am I" — and it means the
// server is never told.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Venue = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  teamId: string | null;
};

// A TAILGATE, not a turnstile.
//
// The lots, the surrounding streets and the bars across from them are where
// people actually are for most of the hours around a game, and a fence drawn
// tight around the bowl would call all of that "not at the game". A kilometre
// covers Lambeau's lots and the Superdome's whole block.
//
// It is also honest about the data: the stored coordinates are stadium centres
// good to roughly a hundred metres, so anything much tighter than this would
// be claiming a precision the seed does not have.
export const AT_VENUE_METERS = 1000;

export function metersBetween(
  aLat: number, aLng: number,
  bLat: number, bLng: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Nearest venue within the fence, or null. Nearest matters because MetLife
// and SoFi each host two teams and share a row's worth of coordinates — and
// because a few campuses sit close enough to another school's ground that
// "the first one within a kilometre" would pick the wrong one.
export function nearestVenue(
  venues: Venue[],
  lat: number,
  lng: number,
): { venue: Venue; meters: number } | null {
  let best: { venue: Venue; meters: number } | null = null;
  for (const v of venues) {
    const m = metersBetween(lat, lng, v.lat, v.lng);
    if (m <= AT_VENUE_METERS && (!best || m < best.meters)) best = { venue: v, meters: m };
  }
  return best;
}

export function useVenues() {
  return useQuery({
    queryKey: ["venues"],
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<Venue[]> => {
      // `as any` because src/integrations/supabase/types.ts is generated and
      // predates this table. That file is badly stale in general — it is
      // missing dozens of tables the app already uses — and regenerating it is
      // its own change with its own blast radius, not something to fold into a
      // feature. The cast is the idiom the rest of this codebase uses for the
      // same reason.
      const { data, error } = await (supabase as any)
        .from("venues")
        .select("id, name, lat, lng, team_id");
      if (error) {
        console.warn("[venues] could not load", error);
        return [];
      }
      return (data ?? []).map((v: any) => ({
        id: v.id,
        name: v.name,
        lat: v.lat,
        lng: v.lng,
        teamId: v.team_id ?? null,
      }));
    },
  });
}

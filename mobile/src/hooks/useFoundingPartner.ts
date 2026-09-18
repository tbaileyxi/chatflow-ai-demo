import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * The team's founding partner, if it has one this season.
 *
 * Returns null for every room that is not eligible to show a sponsor, and the
 * caller passes those conditions in rather than the component working them out
 * in three places:
 *   - game rooms belong to both teams, so one team's partner would be putting
 *     their name in front of the other team's fans;
 *   - locked rooms are somebody's closed door;
 *   - DMs are two people.
 */
export function useFoundingPartner(params: {
  /** The team's city — "Buffalo". Required: see the slug note below. */
  teamCity: string | null | undefined;
  /** The team's name — "Bills". */
  teamName: string | null | undefined;
  eligible: boolean;
}): string | null {
  // ONE SLUG FORMAT, BUILT IN ONE PLACE.
  //
  // This used to take teamName alone, which is "Bills", and looked up "bills".
  // The rows are keyed "buffalo-bills" — city and name — which is what the
  // pregame card function builds and what /sponsor?team= uses. So the card
  // found its partner and the caption never did, on every team, for photos and
  // video alike. The two halves of one feature disagreed about the key.
  const slug = [params.teamCity, params.teamName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { data } = useQuery({
    queryKey: ["founding-partner", slug],
    enabled: params.eligible && slug.length > 0,
    // A partnership lasts a season; this does not need re-asking often.
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await (supabase as any)
        .from("founding_partners")
        .select("partner_name")
        .eq("team_slug", slug)
        .eq("season", new Date().getFullYear())
        .maybeSingle();
      if (error) return null;
      return (data?.partner_name as string | undefined) ?? null;
    },
  });

  return params.eligible ? data ?? null : null;
}

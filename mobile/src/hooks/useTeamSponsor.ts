// The team's sponsors — up to six — for the scoreboard strip in HuddleHeader.
//
// It used to fetch exactly one, because the schema allowed exactly one. That
// pairing of "exclusive" with $100 told a buyer the exclusive was worthless, so
// the offer became one of six at the same price. Six is a scoreboard; unlimited
// would be worth nothing again.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TeamSponsor = {
  id: string;
  teamId: string;
  brandName: string;
  logoUrl: string | null;
  linkUrl: string;
};

export function useTeamSponsors(teamId: string | null | undefined) {
  return useQuery({
    queryKey: ["team-sponsors", teamId],
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,                     // 5 min
    queryFn: async (): Promise<TeamSponsor[]> => {
      if (!teamId) return [];
      const { data, error } = await (supabase as any)
        .from("team_sponsors")
        .select("id, team_id, brand_name, logo_url, link_url, end_date, is_active, slot")
        .eq("team_id", teamId)
        .eq("is_active", true)
        .order("slot", { ascending: true })
        .limit(6);
      if (error || !data) return [];
      const now = Date.now();
      return (data as any[])
        // Calendar expiry is checked here rather than in the index, which has
        // to stay immutable.
        .filter((d) => !d.end_date || new Date(d.end_date).getTime() >= now)
        .map((d) => ({
          id: d.id,
          teamId: d.team_id,
          brandName: d.brand_name,
          logoUrl: d.logo_url ?? null,
          linkUrl: d.link_url,
        }));
    },
  });
}

/** One sponsor, for callers that only need something to show. */
export function useTeamSponsor(teamId: string | null | undefined) {
  const q = useTeamSponsors(teamId);
  return { ...q, data: q.data?.[0] ?? null } as const;
}

export async function logSponsorTap(opts: {
  sponsorId: string;
  huddleId?: string | null;
  userId?: string | null;
}): Promise<void> {
  try {
    await (supabase as any).from("sponsor_impressions").insert({
      sponsor_id: opts.sponsorId,
      huddle_id: opts.huddleId ?? null,
      user_id: opts.userId ?? null,
      kind: "tap",
    });
  } catch (err) {
    // Never block UX on impression logging.
    console.warn("[sponsor] tap log failed", err);
  }
}

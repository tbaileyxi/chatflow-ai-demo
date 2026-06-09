// Fetch the single active sponsor for a team, if any. Used by HuddleHeader to
// render the "Presented by X" whisper line.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TeamSponsor = {
  id: string;
  teamId: string;
  brandName: string;
  logoUrl: string | null;
  linkUrl: string;
};

export function useTeamSponsor(teamId: string | null | undefined) {
  return useQuery({
    queryKey: ["team-sponsor", teamId],
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,                     // 5 min
    queryFn: async (): Promise<TeamSponsor | null> => {
      if (!teamId) return null;
      // team_sponsors added in 20260608000007. Cast through any for now.
      const { data, error } = await (supabase as any)
        .from("team_sponsors")
        .select("id, team_id, brand_name, logo_url, link_url, end_date, is_active")
        .eq("team_id", teamId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      // Calendar expiry check (kept out of the index for immutability).
      if (data.end_date && new Date(data.end_date).getTime() < Date.now()) {
        return null;
      }
      return {
        id: data.id,
        teamId: data.team_id,
        brandName: data.brand_name,
        logoUrl: data.logo_url ?? null,
        linkUrl: data.link_url,
      };
    },
  });
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

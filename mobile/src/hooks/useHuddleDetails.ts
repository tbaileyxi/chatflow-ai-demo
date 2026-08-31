import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type HuddleDetails = {
  id: string;
  name: string;
  bio: string | null;
  memberCount: number;
  isPrivate: boolean;
  isOfficialTeam: boolean;          // system-created auto team huddle
  isVerified: boolean;              // blue-check
  officialStatus: "inactive" | "active" | "past_due" | "cancelled";
  isOfficial: boolean;              // computed: official_status='active' OR is_official_team_huddle
  websiteUrl: string | null;
  ownerId: string;
  teamId: string;
  teamName: string | null;
  teamCity: string | null;
  teamLogoUrl: string | null;
  /** Full-bleed picture behind the chat. Null = plain theme background. */
  photoUrl: string | null;
  isMember: boolean;
};

export function useHuddleDetails(huddleId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["huddle-details", huddleId],
    queryFn: async (): Promise<HuddleDetails | null> => {
      // Selecting columns added by recent migrations (official_status, website_url)
      // — generated types lag. Cast the response after the call.
      // Split in two on purpose. Returning null from here puts HuddleScreen in
      // `huddleLoading || !huddle` forever — an endless spinner with no error
      // anywhere — so ONE unreadable column takes the whole room down. That is
      // exactly what happened when photo_url was added: the column existed, but
      // PostgREST had not reloaded its schema cache yet, and every room in the
      // app hung.
      //
      // CORE is what the screen cannot render without. EXTRA is everything that
      // has been bolted on since and may not be readable yet on a given
      // environment. If EXTRA fails we still show the room.
      const CORE = `
          id, name, bio, member_count, is_private,
          is_official_team_huddle, is_verified, owner_id, team_id,
          teams!team_id (name, city, logo_url)
        `;
      const EXTRA = `official_status, website_url, photo_url`;

      let { data: rawData, error } = await (supabase as any)
        .from("huddles")
        .select(`${CORE}, ${EXTRA}`)
        .eq("id", huddleId)
        .single();

      if (error) {
        console.warn("[huddle-details] falling back to core columns:", error.message);
        ({ data: rawData, error } = await (supabase as any)
          .from("huddles")
          .select(CORE)
          .eq("id", huddleId)
          .single());
      }
      const data: any = rawData;

      if (error || !data) return null;

      let isMember = false;
      if (user) {
        const { data: membership } = await supabase
          .from("huddle_members")
          .select("id")
          .eq("huddle_id", huddleId)
          .eq("user_id", user.id)
          .maybeSingle();
        isMember = !!membership;
      }

      const team = (data as any).teams;
      const officialStatus = ((data as any).official_status ??
        "inactive") as HuddleDetails["officialStatus"];
      const isOfficialTeam = (data as any).is_official_team_huddle ?? false;
      return {
        id: data.id,
        name: data.name,
        bio: data.bio,
        memberCount: data.member_count ?? 0,
        isPrivate: data.is_private ?? false,
        isOfficialTeam,
        isVerified: data.is_verified ?? false,
        officialStatus,
        isOfficial: officialStatus === "active" || isOfficialTeam,
        websiteUrl: (data as any).website_url ?? null,
        ownerId: data.owner_id,
        teamId: data.team_id,
        teamName: team?.name ?? null,
        teamCity: team?.city ?? null,
        teamLogoUrl: team?.logo_url ?? null,
        photoUrl: (data as any).photo_url ?? null,
        isMember,
      };
    },
  });
}

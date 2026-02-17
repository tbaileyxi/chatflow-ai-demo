import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type HuddleDetails = {
  id: string;
  name: string;
  bio: string | null;
  memberCount: number;
  isPrivate: boolean;
  isOfficialTeam: boolean;
  isVerified: boolean;
  ownerId: string;
  teamId: string;
  teamName: string | null;
  teamCity: string | null;
  teamLogoUrl: string | null;
  isMember: boolean;
};

export function useHuddleDetails(huddleId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["huddle-details", huddleId],
    queryFn: async (): Promise<HuddleDetails | null> => {
      const { data, error } = await supabase
        .from("huddles")
        .select(
          `
          id, name, bio, member_count, is_private,
          is_official_team_huddle, is_verified, owner_id, team_id,
          teams!team_id (name, city, logo_url)
        `,
        )
        .eq("id", huddleId)
        .single();

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
      return {
        id: data.id,
        name: data.name,
        bio: data.bio,
        memberCount: data.member_count ?? 0,
        isPrivate: data.is_private ?? false,
        isOfficialTeam: data.is_official_team_huddle ?? false,
        isVerified: data.is_verified ?? false,
        ownerId: data.owner_id,
        teamId: data.team_id,
        teamName: team?.name ?? null,
        teamCity: team?.city ?? null,
        teamLogoUrl: team?.logo_url ?? null,
        isMember,
      };
    },
  });
}

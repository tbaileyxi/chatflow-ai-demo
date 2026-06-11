import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type FollowedTeam = {
  id: string;
  name: string;
  city: string;
  logoUrl: string | null;
  league: string | null;
};

// The user's followed teams straight from user_follows. Screens that show
// "your teams" must use this — deriving the team list from feed posts makes
// follows invisible on quiet days.
export function useFollowedTeams() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["followed-teams", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<FollowedTeam[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("user_follows")
        .select("team_id, teams!team_id (id, name, city, logo_url, league)")
        .eq("user_id", user.id);

      if (error || !data) return [];

      return data
        .map((row) => (row as any).teams)
        .filter(Boolean)
        .map((t: any) => ({
          id: t.id,
          name: t.name,
          city: t.city ?? "",
          logoUrl: t.logo_url ?? null,
          league: t.league ?? null,
        }));
    },
  });
}

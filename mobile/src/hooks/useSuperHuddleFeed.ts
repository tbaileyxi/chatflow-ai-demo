import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SuperHuddlePost = {
  id: string;
  content: string;
  mediaUrl: string | null;
  teamName: string;
  teamCity: string;
  teamLogoUrl: string | null;
  teamId: string;
  createdAt: string;
};

export function useSuperHuddleFeed() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["super-huddle-feed", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<SuperHuddlePost[]> => {
      if (!user) return [];

      // Get followed team IDs
      const { data: follows, error: followError } = await supabase
        .from("user_follows")
        .select("team_id")
        .eq("user_id", user.id);

      if (followError || !follows || follows.length === 0) return [];

      const teamIds = follows.map((f) => f.team_id);

      // Get posts from followed teams with team info
      const { data: posts, error: postsError } = await supabase
        .from("posts")
        .select(
          `
          id, content, media_url, created_at, team_id,
          teams!team_id (name, city, logo_url)
        `,
        )
        .in("team_id", teamIds)
        .eq("delivery_status", "sent")
        .order("created_at", { ascending: false })
        .limit(50);

      if (postsError || !posts) return [];

      return posts.map((p) => {
        const team = (p as any).teams;
        return {
          id: p.id,
          content: p.content ?? "",
          mediaUrl: p.media_url,
          teamName: team?.name ?? "",
          teamCity: team?.city ?? "",
          teamLogoUrl: team?.logo_url ?? null,
          teamId: p.team_id ?? "",
          createdAt: p.created_at,
        };
      });
    },
  });
}

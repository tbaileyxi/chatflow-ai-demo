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
  // Trending / embed fields
  embedUrl: string | null;
  authorUsername: string | null;
  source: "post" | "trending";
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

      // Fetch both sources in parallel
      const twentyFourHoursAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();

      const [postsResult, trendingResult] = await Promise.all([
        // 1. Regular posts
        supabase
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
          .limit(30),

        // 2. Trending X posts (approved/broadcasted, last 24h)
        supabase
          .from("team_trending")
          .select(
            `
            id, content, embed_url, author_username, created_at, team_id,
            teams!team_id (name, city, logo_url)
          `,
          )
          .in("team_id", teamIds)
          .in("status", ["approved", "broadcasted"])
          .gte("created_at", twentyFourHoursAgo)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const posts: SuperHuddlePost[] = (postsResult.data ?? []).map((p) => {
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
          embedUrl: null,
          authorUsername: null,
          source: "post" as const,
        };
      });

      const trending: SuperHuddlePost[] = (trendingResult.data ?? []).map(
        (t: any) => {
          const team = t.teams;
          return {
            id: `trending-${t.id}`,
            content: t.content ?? "",
            mediaUrl: null,
            teamName: team?.name ?? "",
            teamCity: team?.city ?? "",
            teamLogoUrl: team?.logo_url ?? null,
            teamId: t.team_id ?? "",
            createdAt: t.created_at,
            embedUrl: t.embed_url,
            authorUsername: t.author_username,
            source: "trending" as const,
          };
        },
      );

      // Merge and sort by date, newest first
      return [...posts, ...trending].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
  });
}

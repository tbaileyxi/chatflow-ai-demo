import { useInfiniteQuery as useTanstackInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Post {
  id: string;
  content: string;
  media_url?: string;
  poll_data?: any;
  created_at: string;
  author_id?: string;
  is_team_agent_message?: boolean;
  is_agent_post?: boolean;
  team: {
    id: string;
    name: string;
    logo_url?: string;
    sponsor?: string;
  };
  origin_teams?: {
    name: string;
    logo_url?: string;
  };
  author?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  };
  post_reactions: Array<{
    reaction_type: string;
  }>;
}

const POSTS_PER_PAGE = 10;

export const useSpotlightPosts = () => {
  return useTanstackInfiniteQuery({
    queryKey: ['spotlight-posts'],
    queryFn: async ({ pageParam = 0 }) => {
      // Calculate 48 hours ago for decay/removal
      const cutoffDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from("posts")
        .select(`
          id,
          content,
          media_url,
          embed_code,
          embeds,
          message_type,
          poll_data,
          created_at,
          is_team_agent_message,
          is_agent_post,
          team:teams!team_id(id, name, logo_url, sponsor),
          origin_teams:teams!origin_team_id(name, logo_url),
          post_reactions(reaction_type)
        `)
        .eq('is_spotlight', true)
        .eq("delivery_status", "sent")
        .gte("created_at", cutoffDate) // Only posts from last 48 hours
        .order("created_at", { ascending: false })
        .range(pageParam * POSTS_PER_PAGE, (pageParam + 1) * POSTS_PER_PAGE - 1);

      if (error) throw error;
      
      // Apply team diversity: no more than 2 consecutive posts from same team
      const posts = data || [];
      const diversifiedPosts: typeof posts = [];
      const teamBuffer: Map<string, number> = new Map(); // Track consecutive count per team
      
      for (const post of posts) {
        const teamId = post.team?.id;
        if (!teamId) {
          diversifiedPosts.push(post);
          teamBuffer.clear();
          continue;
        }
        
        // Check if this team already has 2 consecutive posts
        const consecutiveCount = teamBuffer.get(teamId) || 0;
        
        if (consecutiveCount < 2) {
          diversifiedPosts.push(post);
          // Reset all other teams, increment this team's count
          teamBuffer.clear();
          teamBuffer.set(teamId, consecutiveCount + 1);
        } else {
          // Skip this post for now - will be picked up later if there's room
          // For simplicity, we just skip (the post won't appear consecutively)
          teamBuffer.clear();
        }
      }
      
      // Apply priority boost: broadcast (is_team_agent_message) posts get slight priority
      // Sort by: recency first, then broadcast posts get a small boost
      const sortedPosts = diversifiedPosts.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        
        // Broadcast posts get 5 minute effective boost
        const boostA = a.is_team_agent_message ? 5 * 60 * 1000 : 0;
        const boostB = b.is_team_agent_message ? 5 * 60 * 1000 : 0;
        
        return (dateB + boostB) - (dateA + boostA);
      });
      
      return sortedPosts;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < POSTS_PER_PAGE) return undefined;
      return allPages.length;
    },
    initialPageParam: 0,
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useYourFeedPosts = (followedTeams: string[]) => {
  return useTanstackInfiniteQuery({
    queryKey: ['your-feed-posts', followedTeams],
    queryFn: async ({ pageParam = 0 }) => {
      if (followedTeams.length === 0) return [];
      
      const { data, error } = await supabase
        .from("posts")
        .select(`
          id,
          content,
          media_url,
          embed_code,
          embeds,
          message_type,
          poll_data,
          created_at,
          target_audience,
          is_team_agent_message,
          is_agent_post,
          team:teams!team_id(id, name, logo_url, sponsor),
          origin_teams:teams!origin_team_id(name, logo_url),
          post_reactions(reaction_type)
        `)
        .in("team_id", followedTeams)
        .contains("target_audience", ["team_feed"])
        .eq("delivery_status", "sent")
        .order("created_at", { ascending: false })
        .range(pageParam * POSTS_PER_PAGE, (pageParam + 1) * POSTS_PER_PAGE - 1);

      if (error) throw error;
      return data || [];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < POSTS_PER_PAGE) return undefined;
      return allPages.length;
    },
    enabled: followedTeams.length > 0,
    initialPageParam: 0,
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 8 * 60 * 1000, // 8 minutes
  });
};
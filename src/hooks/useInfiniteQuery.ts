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
        .order("created_at", { ascending: false })
        .range(pageParam * POSTS_PER_PAGE, (pageParam + 1) * POSTS_PER_PAGE - 1);

      if (error) throw error;
      return data || [];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < POSTS_PER_PAGE) return undefined;
      return allPages.length;
    },
    initialPageParam: 0,
    refetchInterval: 10000, // Refresh every 10 seconds for real-time updates
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000, // 30 seconds - more aggressive refresh
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
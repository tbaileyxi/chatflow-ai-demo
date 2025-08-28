import { useMemo, useCallback, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VirtualizedChat } from "@/components/chat/VirtualizedChat";
import { ModernPostCard } from "@/components/modern/ModernPostCard";
import { FeedSkeleton } from "./PostSkeleton";
import { useYourFeedPosts } from "@/hooks/useInfiniteQuery";
import { useQuery } from "@tanstack/react-query";

interface Post {
  id: string;
  content: string;
  media_url: string;
  embed_code: string;
  poll_data: any;
  created_at: string;
  target_audience: string[];
  is_team_agent_message: boolean;
  is_agent_post: boolean;
  team: {
    id: string;
    name: string;
    logo_url: string;
    sponsor: string;
  };
  origin_teams: any;
  post_reactions: any[];
}

const MemoizedPostCard = memo(({ post, index }: { post: Post; index: number }) => (
  <div className="px-4 py-2">
    <ModernPostCard 
      post={post} 
      index={index}
      disableReply={true}
    />
  </div>
));

export const VirtualizedOptimizedYourFeed = memo(() => {
  const { data: followedTeamsData, isLoading: loadingTeams } = useQuery({
    queryKey: ['followed-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_follows')
        .select('team_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;
      return data?.map(follow => follow.team_id) || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const followedTeams = followedTeamsData || [];

  const {
    data,
    isLoading: loadingPosts,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useYourFeedPosts(followedTeams);

  const allPosts = useMemo(() => {
    return data?.pages.flat() || [];
  }, [data]);

  const handleLoadMore = useCallback(async () => {
    if (hasNextPage && !isFetchingNextPage) {
      await fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const itemContent = useCallback((index: number, post: Post) => (
    <MemoizedPostCard post={post} index={index} />
  ), []);

  const getItemKey = useCallback((post: Post) => post.id, []);

  const isLoading = loadingTeams || loadingPosts;

  if (isLoading) {
    return <FeedSkeleton count={3} />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h3 className="text-xl font-semibold mb-2">Error loading your feed</h3>
        <p className="text-muted-foreground">Please try refreshing the page</p>
      </div>
    );
  }

  if (followedTeams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h3 className="text-xl font-semibold mb-4">Your feed is empty</h3>
        <p className="text-sm text-muted-foreground">
          Use the + button next to "Your Feed" to follow teams and see their posts
        </p>
      </div>
    );
  }

  if (allPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h3 className="text-xl font-semibold mb-2">No posts from followed teams</h3>
        <p className="text-muted-foreground">Check back soon for new content!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0">
      <VirtualizedChat
        items={allPosts}
        loadMoreTop={hasNextPage ? handleLoadMore : undefined}
        itemContent={itemContent}
        getItemKey={getItemKey}
        defaultItemHeight={200}
        overscan={100}
      />
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Loading more...
          </div>
        </div>
      )}
    </div>
  );
});
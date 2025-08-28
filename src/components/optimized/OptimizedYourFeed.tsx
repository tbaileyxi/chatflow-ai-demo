import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VirtualizedChat } from "@/components/chat/VirtualizedChat";
import { ModernPostCard } from "@/components/modern/ModernPostCard";
import { FeedSkeleton } from "./PostSkeleton";
import { useYourFeedPosts } from "@/hooks/useInfiniteQuery";
import { useQuery } from "@tanstack/react-query";

export const OptimizedYourFeed = () => {
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

  const handleLoadMore = async () => {
    if (hasNextPage && !isFetchingNextPage) {
      await fetchNextPage();
    }
  };

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
        loadMoreTop={handleLoadMore}
        itemContent={(index, post) => (
          <div className="px-4 py-2">
            <ModernPostCard 
              key={`post-${post.id}`} 
              post={post} 
              index={index}
            />
            {index === allPosts.length - 1 && isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Loading more...
                </div>
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
};
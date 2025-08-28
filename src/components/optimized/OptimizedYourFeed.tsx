import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VirtualizedChat } from "@/components/chat/VirtualizedChat";
import { ModernPostCard } from "@/components/modern/ModernPostCard";
import { FeedSkeleton } from "./PostSkeleton";
import { useYourFeedPosts } from "@/hooks/useInfiniteQuery";
import { useQuery } from "@tanstack/react-query";

export const OptimizedYourFeed = () => {
  const containerRef = useRef<HTMLDivElement>(null);
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
  
  // Auto-scroll to top when posts load/update (newest posts are at top)
  useEffect(() => {
    if (allPosts.length > 0 && containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [allPosts.length]);

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
    <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto">
      <div className="space-y-1">
        {allPosts.map((post, index) => (
          <div key={`post-${post.id}`} className="px-4 py-2">
            <ModernPostCard 
              post={post} 
              index={index}
              disableReply={true}
            />
          </div>
        ))}
        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Loading more...
            </div>
          </div>
        )}
        {hasNextPage && !isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <button
              onClick={handleLoadMore}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Load more posts
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
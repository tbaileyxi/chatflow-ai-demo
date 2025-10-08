import { useMemo, useEffect, useRef } from "react";
import { VirtualizedChat } from "@/components/chat/VirtualizedChat";
import { ModernPostCard } from "@/components/modern/ModernPostCard";
import { FeedSkeleton } from "./PostSkeleton";
import { useSpotlightPosts } from "@/hooks/useInfiniteQuery";
import { supabase } from "@/integrations/supabase/client";

export const OptimizedSpotlightFeed = () => {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch
  } = useSpotlightPosts();
  
  const containerRef = useRef<HTMLDivElement>(null);

  const allPosts = useMemo(() => {
    return data?.pages.flat() || [];
  }, [data]);
  
  // Set up real-time subscription for new spotlight posts
  useEffect(() => {
    const channel = supabase
      .channel('spotlight-posts-optimized')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'posts',
        filter: 'is_spotlight=eq.true'
      }, () => {
        console.log('New spotlight post detected, refetching...');
        refetch();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);
  
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

  if (isLoading) {
    return <FeedSkeleton count={3} />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h3 className="text-xl font-semibold mb-2">Error loading spotlight</h3>
        <p className="text-muted-foreground">Please try refreshing the page</p>
      </div>
    );
  }

  if (allPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h3 className="text-xl font-semibold mb-2">No spotlight content yet</h3>
        <p className="text-muted-foreground">Spotlight posts will appear here!</p>
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
              isSpotlight 
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
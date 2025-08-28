import { useMemo } from "react";
import { VirtualizedChat } from "@/components/chat/VirtualizedChat";
import { ModernPostCard } from "@/components/modern/ModernPostCard";
import { FeedSkeleton } from "./PostSkeleton";
import { useSpotlightPosts } from "@/hooks/useInfiniteQuery";

export const OptimizedSpotlightFeed = () => {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useSpotlightPosts();

  const allPosts = useMemo(() => {
    return data?.pages.flat() || [];
  }, [data]);

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
    <div className="flex-1 min-h-0">
      <VirtualizedChat
        items={allPosts}
        loadMoreTop={handleLoadMore}
        itemContent={(index, post) => (
          <div className="px-4 py-2">
            <ModernPostCard 
              key={`post-${post.id}`} 
              post={post} 
              isSpotlight 
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
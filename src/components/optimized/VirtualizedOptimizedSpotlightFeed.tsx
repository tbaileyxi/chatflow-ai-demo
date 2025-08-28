import { useMemo, useCallback } from "react";
import { VirtualizedChat } from "@/components/chat/VirtualizedChat";
import { ModernPostCard } from "@/components/modern/ModernPostCard";
import { FeedSkeleton } from "./PostSkeleton";
import { useSpotlightPosts } from "@/hooks/useInfiniteQuery";
import { memo } from "react";

interface Post {
  id: string;
  content: string;
  media_url: string;
  embed_code: string;
  poll_data: any;
  created_at: string;
  team: {
    id: string;
    name: string;
    logo_url: string;
    sponsor: string;
  };
  post_reactions: any[];
}

const MemoizedPostCard = memo(({ post, index }: { post: Post; index: number }) => (
  <div className="px-4 py-2">
    <ModernPostCard 
      post={post} 
      isSpotlight 
      index={index}
      disableReply={true}
    />
  </div>
));

export const VirtualizedOptimizedSpotlightFeed = memo(() => {
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

  const handleLoadMore = useCallback(async () => {
    if (hasNextPage && !isFetchingNextPage) {
      await fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const itemContent = useCallback((index: number, post: Post) => (
    <MemoizedPostCard post={post} index={index} />
  ), []);

  const getItemKey = useCallback((post: Post) => post.id, []);

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
import React, { useEffect, useRef, useLayoutEffect } from "react";

interface SimpleChatProps<T> {
  items: T[];
  loadMoreTop?: () => Promise<void> | void;
  itemContent: (index: number, item: T) => React.ReactNode;
  getItemKey?: (item: T) => React.Key;
  defaultItemHeight?: number;
  overscan?: number;
  alignToBottom?: boolean;
  initialIndex?: number;
  followOutput?: boolean | 'smooth' | 'auto';
}

export function VirtualizedChat<T>({ 
  items, 
  loadMoreTop, 
  itemContent, 
  getItemKey
}: SimpleChatProps<T>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wasAtBottomRef = useRef(true);
  const isFirstLoadRef = useRef(true);

  // Scroll to bottom on first load and when new messages arrive (if user was at bottom)
  useLayoutEffect(() => {
    if (!scrollRef.current) return;

    const scrollElement = scrollRef.current;
    
    if (isFirstLoadRef.current) {
      // First load - always scroll to bottom
      scrollElement.scrollTop = scrollElement.scrollHeight;
      isFirstLoadRef.current = false;
      wasAtBottomRef.current = true;
    } else if (wasAtBottomRef.current) {
      // New message and user was at bottom - follow
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, [items.length]);

  // Track if user is at bottom
  const handleScroll = () => {
    if (!scrollRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const threshold = 50;
    wasAtBottomRef.current = scrollHeight - scrollTop - clientHeight <= threshold;
  };

  // Load more on scroll to top
  const handleScrollToTop = () => {
    if (!scrollRef.current || !loadMoreTop) return;
    
    if (scrollRef.current.scrollTop === 0) {
      const oldScrollHeight = scrollRef.current.scrollHeight;
      const result = loadMoreTop();
      if (result && typeof result.then === 'function') {
        result.then(() => {
          // Maintain scroll position after loading more
          if (scrollRef.current) {
            const newScrollHeight = scrollRef.current.scrollHeight;
            scrollRef.current.scrollTop = newScrollHeight - oldScrollHeight;
          }
        });
      }
    }
  };

  return (
    <div className="flex-1 min-h-0">
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto"
        onScroll={(e) => {
          handleScroll();
          handleScrollToTop();
        }}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}
      >
        <div className="flex flex-col">
          {items.map((item, index) => (
            <div key={getItemKey ? getItemKey(item) : index}>
              {itemContent(index, item)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
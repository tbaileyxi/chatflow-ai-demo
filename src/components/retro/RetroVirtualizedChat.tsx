import React, { useEffect, useRef, useLayoutEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { RetroMessageBubble } from './RetroMessageBubble';
import { useRetroTheme } from '@/hooks/useRetroTheme';
import { cn } from '@/lib/utils';

interface RetroVirtualizedChatProps<T> {
  items: T[];
  loadMoreTop?: () => Promise<void> | void;
  getItemKey?: (item: T) => React.Key;
  currentUserId?: string;
  isAdmin?: boolean;
  onMegaphone?: (messageId: string) => void;
  onHighlight?: (messageId: string) => void;
  onCopyCallout?: (messageId: string, content: string) => void;
  teamName?: string;
  className?: string;
}

export function RetroVirtualizedChat<T>({ 
  items, 
  loadMoreTop, 
  getItemKey,
  currentUserId,
  isAdmin,
  onMegaphone,
  onHighlight,
  onCopyCallout,
  teamName,
  className
}: RetroVirtualizedChatProps<T>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wasAtBottomRef = useRef(true);
  const isFirstLoadRef = useRef(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const theme = useRetroTheme(teamName);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

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
      // New message and user was at bottom - follow with smooth animation
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [items.length]);

  // Track if user is at bottom
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const threshold = 100;
    wasAtBottomRef.current = scrollHeight - scrollTop - clientHeight <= threshold;
    
    // Visual scrolling indicator
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, []);

  // Load more on scroll to top
  const handleScrollToTop = useCallback(() => {
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
  }, [loadMoreTop]);

  // Memoized message components for performance
  const messageComponents = useMemo(() => {
    return items.map((item: any, index) => {
      const previousMessage = index > 0 ? items[index - 1] : null;
      
      return (
        <motion.div
          key={getItemKey ? getItemKey(item) : item.id || index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.3, 
            delay: index < 5 ? index * 0.05 : 0,
            ease: "easeOut" 
          }}
          className="relative"
        >
          <RetroMessageBubble
            message={item}
            user={item.profiles}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onMegaphone={onMegaphone}
            onHighlight={onHighlight}
            onCopyCallout={onCopyCallout}
          />
        </motion.div>
      );
    });
  }, [items, currentUserId, isAdmin, onMegaphone, onHighlight, onCopyCallout, getItemKey]);

  return (
    <div className={cn("flex-1 min-h-0 relative", className)}>
      {/* Scrolling indicator */}
      <AnimatePresence>
        {isScrolling && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="absolute top-4 right-4 z-10 px-2 py-1 bg-team-primary/20 border border-team-primary/40 rounded-full"
          >
            <div className="w-2 h-2 bg-team-primary rounded-full animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>
      
      <div
        ref={scrollRef}
        className={cn(
          "h-full overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-team-primary/30",
          "hover:scrollbar-thumb-team-primary/50 transition-colors"
        )}
        onScroll={() => {
          handleScroll();
          handleScrollToTop();
        }}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}
      >
        {/* Chat messages container */}
        <div className="flex flex-col max-w-4xl mx-auto px-2 py-4 space-y-1">
          <AnimatePresence initial={false}>
            {messageComponents}
          </AnimatePresence>
          
          {/* Bottom spacer for better UX */}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}
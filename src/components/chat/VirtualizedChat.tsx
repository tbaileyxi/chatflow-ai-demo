import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Virtuoso } from "react-virtuoso";
import { useIOSKeyboard } from "@/hooks/useIOSKeyboard";

// Simple debounce for scroll events
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Static item height to prevent flashing
const ESTIMATED_ITEM_HEIGHT = 150;

interface VirtualizedChatProps<T> {
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
  getItemKey, 
  defaultItemHeight = ESTIMATED_ITEM_HEIGHT, 
  overscan = 300, 
  alignToBottom = true, 
  initialIndex, 
  followOutput = 'auto' 
}: VirtualizedChatProps<T>) {
  const data = useMemo(() => items, [items]);
  const { isOpen: isKeyboardOpen, height: keyboardHeight } = useIOSKeyboard();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const virtuosoRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  // Prevent auto-follow while user is scrolling away from bottom
  const userHoldRef = useRef(false);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Simple at-bottom check
  const checkIfAtBottom = useCallback(() => {
    if (!scrollRef.current) return false;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const threshold = 100; // Larger threshold for reliability
    const atBottom = scrollHeight - scrollTop - clientHeight <= threshold;
    
    if (atBottom !== isAtBottom) {
      setIsAtBottom(atBottom);
    }
    
    return atBottom;
  }, [isAtBottom]);

  // Debounced scroll handler that also toggles user hold
  const handleScroll = useMemo(
    () => debounce(() => {
      const atBottom = checkIfAtBottom();
      if (!atBottom) {
        userHoldRef.current = true;
        if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = setTimeout(() => {
          userHoldRef.current = false;
        }, 1500);
      }
    }, 100),
    [checkIfAtBottom]
  );

  // Height calculation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateHeight = () => {
      let baseHeight = el.clientHeight;
      
      if (baseHeight < 100) {
        baseHeight = Math.max(Math.floor(window.innerHeight * 0.7), 320);
      }
      
      if (isKeyboardOpen && keyboardHeight > 0) {
        baseHeight = Math.max(baseHeight - keyboardHeight, 200);
      }
      
      setHeight(baseHeight);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(el);

    window.addEventListener("resize", updateHeight);
    
    return () => {
      window.removeEventListener("resize", updateHeight);
      resizeObserver.disconnect();
    };
  }, [isKeyboardOpen, keyboardHeight]);

  // Scroll event setup
  useEffect(() => {
    if (!scrollRef.current) return;
    
    const scrollElement = scrollRef.current;
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    // Initial check
    checkIfAtBottom();
    
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll, checkIfAtBottom]);

  // iOS keyboard handling
  useEffect(() => {
    if (!isKeyboardOpen || !isAtBottom) return;

    const timer = setTimeout(() => {
      if (scrollRef.current && isAtBottom) {
        const { scrollHeight, clientHeight } = scrollRef.current;
        scrollRef.current.scrollTop = scrollHeight - clientHeight;
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isKeyboardOpen, isAtBottom]);

  return (
    <div 
      ref={containerRef} 
      className="flex-1 min-h-0"
      style={{
        height: isKeyboardOpen ? `calc(100dvh - ${keyboardHeight}px)` : '100%'
      }}
    >
      <Virtuoso
        ref={virtuosoRef}
        style={{
          height: height ?? 400,
        }}
        data={data}
        itemContent={itemContent}
        computeItemKey={getItemKey ? (index, item) => getItemKey(item) : undefined}
        defaultItemHeight={defaultItemHeight}
        increaseViewportBy={{ top: overscan, bottom: overscan }}
        initialTopMostItemIndex={alignToBottom ? Math.max(0, data.length - 1) : (initialIndex ?? 0)}
        followOutput={(bottom) => bottom && !userHoldRef.current}
        atBottomStateChange={(bottom) => {
          setIsAtBottom(bottom);
          if (bottom) {
            userHoldRef.current = false;
            if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
          }
        }}
        startReached={loadMoreTop}
        scrollerRef={(ref) => {
          scrollRef.current = ref as HTMLDivElement;
        }}
        components={{
          Scroller: React.forwardRef<HTMLDivElement, any>((props, ref) => (
            <div
              {...props}
              ref={ref}
              style={{
                ...(props.style || {}),
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain'
              }}
            />
          ))
        }}
      />
    </div>
  );
}
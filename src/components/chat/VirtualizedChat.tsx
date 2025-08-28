import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Virtuoso } from "react-virtuoso";
import { useIOSKeyboard } from "@/hooks/useIOSKeyboard";

// Debounce utility for scroll state updates
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Dynamic size estimation for embeds
const estimateItemSize = (): number => {
  const embedContainers = document.querySelectorAll('.x-embed-container');
  let maxHeight = 120; // default
  
  embedContainers.forEach(container => {
    const height = (container as HTMLElement).offsetHeight;
    if (height > maxHeight && height <= 700) { // cap at 700px
      maxHeight = height;
    }
  });
  
  console.log('[VirtualizedChat] Estimated item size:', maxHeight);
  return maxHeight;
};

interface VirtualizedChatProps<T> {
  items: T[];
  loadMoreTop?: () => Promise<void> | void;
  itemContent: (index: number, item: T) => React.ReactNode;
  getItemKey?: (item: T) => React.Key; // stable key to prevent re-renders
  defaultItemHeight?: number; // helps Virtuoso estimate before measurement
  overscan?: number; // control how much extra content to render
  alignToBottom?: boolean; // when true, stick to bottom like chat
  initialIndex?: number; // starting index (default 0 for feeds, last for chat)
  followOutput?: boolean | 'smooth' | 'auto'; // control auto-follow behavior
}

export function VirtualizedChat<T>({ items, loadMoreTop, itemContent, getItemKey, defaultItemHeight, overscan, alignToBottom = true, initialIndex, followOutput = 'auto' }: VirtualizedChatProps<T>) {
  const data = useMemo(() => items, [items]);
  const { isOpen: isKeyboardOpen, height: keyboardHeight, isTyping } = useIOSKeyboard();

  // State management for scroll behavior
  const containerRef = useRef<HTMLDivElement | null>(null);
  const virtuosoRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [shouldFollowOutput, setShouldFollowOutput] = useState(true);
  const lastItemCountRef = useRef(data.length);
  
  // Debounced follow output function to prevent flashing
  const debouncedSetShouldFollow = useMemo(
    () => debounce((shouldFollow: boolean) => {
      console.log('[VirtualizedChat] Setting follow output:', shouldFollow);
      setShouldFollowOutput(shouldFollow);
    }, 300),
    []
  );

  // Monitor scroll position to determine if user is at bottom
  const checkIfAtBottom = useCallback(() => {
    if (!scrollRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const threshold = 50; // pixels from bottom
    const atBottom = scrollHeight - scrollTop - clientHeight < threshold;
    
    if (atBottom !== isAtBottom) {
      setIsAtBottom(atBottom);
      debouncedSetShouldFollow(atBottom);
      console.log('[VirtualizedChat] At bottom:', atBottom);
    }
  }, [isAtBottom, debouncedSetShouldFollow]);

  // Handle scroll events with throttling
  const handleScroll = useMemo(
    () => debounce(checkIfAtBottom, 100),
    [checkIfAtBottom]
  );

  // Effect to handle height calculations and scroll event listeners
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const setMeasuredHeight = () => {
      let baseHeight = el.clientHeight;
      
      // Fallback if the container isn't sized by layout yet
      if (baseHeight < 100) {
        baseHeight = Math.max(Math.floor(window.innerHeight * 0.7), 320);
      }
      
      // Adjust for iOS keyboard if open
      if (isKeyboardOpen && keyboardHeight > 0) {
        baseHeight = Math.max(baseHeight - keyboardHeight, 200);
      }
      
      setHeight(baseHeight);
    };

    setMeasuredHeight();

    const ResizeObserverImpl = (window as any).ResizeObserver as typeof ResizeObserver | undefined;
    let ro: ResizeObserver | undefined;
    if (ResizeObserverImpl) {
      ro = new ResizeObserverImpl(() => setMeasuredHeight());
      ro.observe(el);
    }

    const onResize = () => setMeasuredHeight();
    window.addEventListener("resize", onResize);
    
    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [isKeyboardOpen, keyboardHeight]);

  // Effect to attach scroll listener
  useEffect(() => {
    if (!scrollRef.current) return;
    
    const scrollElement = scrollRef.current;
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // iOS keyboard focus handling
  useEffect(() => {
    if (!isKeyboardOpen || !scrollRef.current) return;

    const handleInputFocus = () => {
      setTimeout(() => {
        if (scrollRef.current && isAtBottom) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 300);
    };

    window.addEventListener('focusin', handleInputFocus);
    return () => window.removeEventListener('focusin', handleInputFocus);
  }, [isKeyboardOpen, isAtBottom]);

  // Removed dynamic default item height estimation to avoid re-render churn
  // This prevents flashing during embed height changes


  return (
    <div 
      ref={containerRef} 
      className="flex-1 min-h-0"
      style={{
        position: 'relative',
        touchAction: 'manipulation',
        // iOS-specific viewport height handling
        height: isKeyboardOpen ? `calc(100dvh - ${keyboardHeight}px)` : '100%'
      }}
    >
      <Virtuoso
        ref={virtuosoRef}
        style={{
          height: height ?? Math.max(Math.floor(window.innerHeight * 0.7), 320),
          scrollBehavior: 'smooth'
        }}
        data={data}
        itemContent={itemContent}
        computeItemKey={getItemKey ? (index, item) => getItemKey(item) : undefined}
        defaultItemHeight={defaultItemHeight ?? estimateItemSize()}
        increaseViewportBy={{ top: 600, bottom: 600 }}
        initialTopMostItemIndex={alignToBottom ? Math.max(0, data.length - 1) : (initialIndex ?? 0)}
        followOutput={shouldFollowOutput ? "auto" : false}
        atBottomStateChange={(atBottom) => {
          console.log('[VirtualizedChat] Virtuoso atBottom:', atBottom);
          setIsAtBottom(atBottom);
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

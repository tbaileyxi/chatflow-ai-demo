import React, { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect } from "react";
import { Virtuoso } from "react-virtuoso";
import { useIOSKeyboard } from "@/hooks/useIOSKeyboard";

// Optimized debounce for 60fps (16ms)
const debounce = (func: Function, wait: number = 16) => {
  let timeout: NodeJS.Timeout;
  let rafId: number;
  return (...args: any[]) => {
    clearTimeout(timeout);
    cancelAnimationFrame(rafId);
    timeout = setTimeout(() => {
      rafId = requestAnimationFrame(() => func(...args));
    }, wait);
  };
};

// Dynamic size estimation for embeds (cached to prevent recalculation)
const estimateItemSize = (): number => {
  const embedContainers = document.querySelectorAll('.x-embed-container');
  let maxHeight = 120; // default
  
  embedContainers.forEach(container => {
    const height = (container as HTMLElement).offsetHeight;
    if (height > maxHeight && height <= 700) { // cap at 700px
      maxHeight = height;
    }
  });
  
  return maxHeight;
};

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
  defaultItemHeight, 
  overscan, 
  alignToBottom = true, 
  initialIndex, 
  followOutput = 'auto' 
}: VirtualizedChatProps<T>) {
  const data = useMemo(() => items, [items]);
  const { isOpen: isKeyboardOpen, height: keyboardHeight } = useIOSKeyboard();

  // Refs for anti-flashing optimization
  const containerRef = useRef<HTMLDivElement | null>(null);
  const virtuosoRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const rafIdRef = useRef<number>();
  
  // State management optimized for no flashing
  const [height, setHeight] = useState<number | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [shouldFollowOutput, setShouldFollowOutput] = useState(true);
  
  // Cached item height to prevent re-estimation flashing
  const estimatedItemHeight = useMemo(() => {
    return Math.max(defaultItemHeight ?? estimateItemSize(), 120);
  }, [defaultItemHeight]);

  // Simplified at-bottom detection using scroll events only
  const checkAtBottom = useCallback(() => {
    if (!scrollRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const threshold = 50;
    const atBottom = scrollHeight - scrollTop - clientHeight <= threshold;
    
    if (atBottom !== isAtBottom) {
      setIsAtBottom(atBottom);
      setShouldFollowOutput(atBottom);
    }
  }, [isAtBottom]);

  // Debounced scroll handler
  const debouncedScrollHandler = useMemo(
    () => debounce(checkAtBottom, 50),
    [checkAtBottom]
  );

  // Height calculation effect
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const setMeasuredHeight = () => {
      requestAnimationFrame(() => {
        let baseHeight = el.clientHeight;
        
        if (baseHeight < 100) {
          baseHeight = Math.max(Math.floor(window.innerHeight * 0.7), 320);
        }
        
        if (isKeyboardOpen && keyboardHeight > 0) {
          baseHeight = Math.max(baseHeight - keyboardHeight, 200);
        }
        
        setHeight(baseHeight);
      });
    };

    setMeasuredHeight();

    const ResizeObserverImpl = (window as any).ResizeObserver as typeof ResizeObserver | undefined;
    let ro: ResizeObserver | undefined;
    if (ResizeObserverImpl) {
      ro = new ResizeObserverImpl(setMeasuredHeight);
      ro.observe(el);
    }

    const onResize = debounce(setMeasuredHeight, 100);
    window.addEventListener("resize", onResize, { passive: true });
    
    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [isKeyboardOpen, keyboardHeight]);

  // Scroll event listener setup
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    
    const scrollElement = scrollRef.current;
    scrollElement.addEventListener('scroll', debouncedScrollHandler, { passive: true });

    // Initial check
    setTimeout(checkAtBottom, 0);
    
    return () => {
      scrollElement.removeEventListener('scroll', debouncedScrollHandler);
    };
  }, [debouncedScrollHandler, checkAtBottom, data.length]);

  // iOS keyboard focus handling with smooth positioning
  useLayoutEffect(() => {
    if (!isKeyboardOpen || !scrollRef.current || !isAtBottom) return;

    const handleInputFocus = () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      
      rafIdRef.current = requestAnimationFrame(() => {
        if (scrollRef.current && isAtBottom) {
          const { scrollHeight, clientHeight } = scrollRef.current;
          scrollRef.current.scrollTo({
            top: scrollHeight - clientHeight,
            behavior: 'smooth'
          });
        }
      });
    };

    const timeoutId = setTimeout(handleInputFocus, 100);
    window.addEventListener('focusin', handleInputFocus, { passive: true });
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('focusin', handleInputFocus);
    };
  }, [isKeyboardOpen, isAtBottom]);

  return (
    <div 
      ref={containerRef} 
      className="flex-1 min-h-0"
      style={{
        position: 'relative',
        contain: 'layout style paint',
        willChange: 'scroll-position',
        transform: 'translate3d(0,0,0)', // GPU acceleration
        touchAction: 'pan-y manipulation',
        WebkitOverflowScrolling: 'touch',
        height: isKeyboardOpen ? `calc(100dvh - ${keyboardHeight}px)` : '100%'
      }}
    >
      <Virtuoso
        ref={virtuosoRef}
        style={{
          height: height ?? Math.max(Math.floor(window.innerHeight * 0.7), 320),
          scrollBehavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        }}
        data={data}
        itemContent={itemContent}
        computeItemKey={getItemKey ? (index, item) => getItemKey(item) : undefined}
        defaultItemHeight={estimatedItemHeight}
        increaseViewportBy={{ 
          top: Math.max(overscan ?? 400, 400), 
          bottom: Math.max(overscan ?? 400, 400) 
        }}
        initialTopMostItemIndex={alignToBottom ? Math.max(0, data.length - 1) : (initialIndex ?? 0)}
        followOutput={shouldFollowOutput ? 'auto' : false}
        atBottomStateChange={(atBottom) => {
          // Use requestAnimationFrame for smooth state updates
          requestAnimationFrame(() => {
            setIsAtBottom(atBottom);
            setShouldFollowOutput(atBottom);
          });
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
                overscrollBehavior: 'contain',
                scrollSnapType: 'y proximity',
                contain: 'layout style paint',
                willChange: 'scroll-position',
                transform: 'translate3d(0,0,0)'
              }}
            />
          ))
        }}
      />
    </div>
  );
}
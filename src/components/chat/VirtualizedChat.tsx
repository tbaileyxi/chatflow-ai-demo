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

  // Ensure the list always has a real height even if parents aren't sized correctly
  const containerRef = useRef<HTMLDivElement | null>(null);
  const virtuosoRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const lastScrollStateRef = useRef<boolean>(false);
  const scrollDebounceRef = useRef<any>();
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Aggressively throttled scroll state handler with debugging
  const handleScrollStateChange = useCallback((isScrolling: boolean) => {
    // Completely disable scroll state updates to prevent flashing
    return;
  }, []);

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
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isKeyboardOpen, keyboardHeight]);

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
          height: height ?? Math.max(Math.floor(window.innerHeight * 0.7), 320)
        }}
        data={data}
        itemContent={itemContent}
        computeItemKey={getItemKey ? (index, item) => getItemKey(item) : undefined}
        defaultItemHeight={defaultItemHeight ?? 120}
        increaseViewportBy={{ top: 100, bottom: 100 }}
        initialTopMostItemIndex={data.length > 0 ? data.length - 1 : 0}
        followOutput={false}
        startReached={loadMoreTop}
        scrollerRef={(ref) => {
          scrollRef.current = ref as HTMLDivElement;
        }}
      />
    </div>
  );
}

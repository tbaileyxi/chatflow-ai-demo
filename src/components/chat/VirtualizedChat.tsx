import React, { useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";

interface VirtualizedChatProps<T> {
  items: T[];
  loadMoreTop?: () => Promise<void> | void;
  itemContent: (index: number, item: T) => React.ReactNode;
  getItemKey?: (item: T) => React.Key; // stable key to prevent re-renders
  defaultItemHeight?: number; // helps Virtuoso estimate before measurement
  overscan?: number; // control how much extra content to render
}

export function VirtualizedChat<T>({ items, loadMoreTop, itemContent, getItemKey, defaultItemHeight, overscan }: VirtualizedChatProps<T>) {
  const data = useMemo(() => items, [items]);

  // Ensure the list always has a real height even if parents aren't sized correctly
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const setMeasuredHeight = () => {
      const h = el.clientHeight;
      // Fallback if the container isn't sized by layout yet
      if (h < 100) {
        setHeight(Math.max(Math.floor(window.innerHeight * 0.7), 320));
      } else {
        setHeight(h);
      }
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
  }, []);

  return (
    <div ref={containerRef} className="flex-1 min-h-0">
      <Virtuoso
        style={{
          height: height ?? Math.max(Math.floor(window.innerHeight * 0.7), 320),
          willChange: 'scroll-position',
          contain: 'content'
        }}
        data={data}
        computeItemKey={(index, item) => (getItemKey ? getItemKey(item) : index)}
        defaultItemHeight={defaultItemHeight}
        increaseViewportBy={{ top: 200, bottom: 400 }}
        initialTopMostItemIndex={Math.max(0, data.length - 1)}
        itemContent={(index, item) => itemContent(index, item)}
        startReached={async () => {
          if (loadMoreTop) await loadMoreTop();
        }}
        followOutput="auto"
        overscan={overscan ?? 400}
        scrollSeekConfiguration={{
          enter: (v) => Math.abs(v) > 1200,
          exit: (v) => Math.abs(v) < 30,
        }}
      />
    </div>
  );
}

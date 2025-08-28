import { useCallback, useRef } from 'react';

// Debounce hook for performance optimization
export const useDebounce = (callback: (...args: any[]) => void, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

// Throttle hook for real-time updates
export const useThrottle = (callback: (...args: any[]) => void, delay: number) => {
  const lastRan = useRef<number>(0);

  return useCallback((...args: any[]) => {
    const now = Date.now();
    if (now - lastRan.current >= delay) {
      callback(...args);
      lastRan.current = now;
    }
  }, [callback, delay]);
};

// Batch update utility for real-time messages
export class BatchUpdater {
  private batch: any[] = [];
  private timeoutId: NodeJS.Timeout | null = null;
  private callback: (items: any[]) => void;
  private batchSize: number;
  private delay: number;

  constructor(callback: (items: any[]) => void, batchSize = 10, delay = 200) {
    this.callback = callback;
    this.batchSize = batchSize;
    this.delay = delay;
  }

  add(item: any) {
    this.batch.push(item);

    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => this.flush(), this.delay);
    }
  }

  flush() {
    if (this.batch.length > 0) {
      this.callback([...this.batch]);
      this.batch = [];
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  destroy() {
    this.flush();
  }
}

// Performance monitoring utility
export const measurePerformance = (name: string, fn: () => void) => {
  if (typeof window !== 'undefined' && window.performance) {
    const start = performance.now();
    fn();
    const end = performance.now();
    console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
  } else {
    fn();
  }
};

// Intersection Observer hook for lazy loading
export const useIntersectionObserver = (
  callback: (entry: IntersectionObserverEntry) => void,
  options: IntersectionObserverInit = {}
) => {
  const elementRef = useRef<Element | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setElement = useCallback((element: Element | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    elementRef.current = element;

    if (element) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry) {
            callback(entry);
          }
        },
        {
          rootMargin: '200px',
          threshold: 0.1,
          ...options,
        }
      );
      observerRef.current.observe(element);
    }
  }, [callback, options]);

  const cleanup = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);

  return { setElement, cleanup };
};
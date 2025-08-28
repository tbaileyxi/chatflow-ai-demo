import { useRef, useCallback } from 'react';

export const useScrollLock = () => {
  const savedScrollPositionRef = useRef<number>(0);
  const containerRef = useRef<HTMLElement | null>(null);

  const lockScroll = useCallback((container?: HTMLElement | null) => {
    const element = container || containerRef.current;
    if (element) {
      savedScrollPositionRef.current = element.scrollTop;
      element.style.overflow = 'hidden';
      element.style.position = 'relative';
    }
  }, []);

  const unlockScroll = useCallback((container?: HTMLElement | null) => {
    const element = container || containerRef.current;
    if (element) {
      element.style.overflow = '';
      element.style.position = '';
      // Restore scroll position after a frame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (element) {
          element.scrollTop = savedScrollPositionRef.current;
        }
      });
    }
  }, []);

  const saveScrollPosition = useCallback((container?: HTMLElement | null) => {
    const element = container || containerRef.current;
    if (element) {
      savedScrollPositionRef.current = element.scrollTop;
    }
  }, []);

  const restoreScrollPosition = useCallback((container?: HTMLElement | null) => {
    const element = container || containerRef.current;
    if (element) {
      element.scrollTop = savedScrollPositionRef.current;
    }
  }, []);

  const setContainer = useCallback((element: HTMLElement | null) => {
    containerRef.current = element;
  }, []);

  return {
    lockScroll,
    unlockScroll,
    saveScrollPosition,
    restoreScrollPosition,
    setContainer,
    savedScrollPosition: savedScrollPositionRef.current
  };
};
import { useCallback, useRef, useState } from 'react';

export const useAutoScroll = () => {
  const [isNearTop, setIsNearTop] = useState(true);
  const [showJumpToNewest, setShowJumpToNewest] = useState(false);
  const scrollRef = useRef<{ scrollToTop: (behavior?: 'smooth' | 'auto') => void } | null>(null);

  // For top-down layout: track if user is near the TOP (newest messages)
  const handleScrollPosition = useCallback((scrollTop: number) => {
    const nearTop = scrollTop < 300;
    setIsNearTop(nearTop);
    setShowJumpToNewest(!nearTop);
  }, []);

  const scrollToTop = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
    scrollRef.current?.scrollToTop(behavior);
  }, []);

  const jumpToNewest = useCallback(() => {
    scrollToTop('smooth');
  }, [scrollToTop]);

  return {
    isNearTop,
    showJumpToNewest,
    scrollRef,
    handleScrollPosition,
    scrollToTop,
    jumpToNewest
  };
};
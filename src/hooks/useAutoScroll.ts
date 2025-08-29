import { useCallback, useRef, useState } from 'react';

export const useAutoScroll = () => {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const scrollRef = useRef<{ scrollToBottom: (behavior?: 'smooth' | 'auto') => void } | null>(null);

  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    setIsAtBottom(atBottom);
    setShowJumpToLatest(!atBottom);
  }, []);

  const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
    scrollRef.current?.scrollToBottom(behavior);
  }, []);

  const jumpToLatest = useCallback(() => {
    scrollToBottom('smooth');
  }, [scrollToBottom]);

  return {
    isAtBottom,
    showJumpToLatest,
    scrollRef,
    handleAtBottomStateChange,
    scrollToBottom,
    jumpToLatest
  };
};
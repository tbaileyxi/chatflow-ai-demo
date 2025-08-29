import { useRef, useCallback, useEffect } from 'react';

interface ScrollAnchorOptions {
  threshold?: number; // Distance from bottom to consider "at bottom"
  enableWhenAtBottom?: boolean; // Whether to auto-scroll when at bottom
}

export const useScrollAnchor = (options: ScrollAnchorOptions = {}) => {
  const { threshold = 100, enableWhenAtBottom = true } = options;
  const containerRef = useRef<HTMLElement | null>(null);
  const anchorElementRef = useRef<Element | null>(null);
  const anchorOffsetRef = useRef<number>(0);
  const isAtBottomRef = useRef<boolean>(true);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);

  // Check if user is at bottom
  const checkIfAtBottom = useCallback(() => {
    if (!containerRef.current) return false;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const atBottom = distanceFromBottom <= threshold;
    isAtBottomRef.current = atBottom;
    return atBottom;
  }, [threshold]);

  // Set scroll anchor to current visible element
  const setScrollAnchor = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const children = container.querySelectorAll('[data-message-id]');
    
    if (children.length === 0) return;

    // Find the first visible element in the viewport
    const containerRect = container.getBoundingClientRect();
    let anchorElement = null;
    
    for (const child of children) {
      const childRect = child.getBoundingClientRect();
      if (childRect.bottom > containerRect.top && childRect.top < containerRect.bottom) {
        anchorElement = child;
        break;
      }
    }

    if (anchorElement) {
      anchorElementRef.current = anchorElement;
      const anchorRect = anchorElement.getBoundingClientRect();
      anchorOffsetRef.current = anchorRect.top - containerRect.top;
    }
  }, []);

  // Restore scroll position to anchor
  const restoreScrollPosition = useCallback(() => {
    if (!containerRef.current || !anchorElementRef.current) return;

    const container = containerRef.current;
    const anchorElement = anchorElementRef.current;
    
    // Check if anchor element still exists
    if (!container.contains(anchorElement)) {
      anchorElementRef.current = null;
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const anchorRect = anchorElement.getBoundingClientRect();
    const currentOffset = anchorRect.top - containerRect.top;
    const offsetDifference = currentOffset - anchorOffsetRef.current;

    if (Math.abs(offsetDifference) > 1) {
      container.scrollTop -= offsetDifference;
    }
  }, []);

  // Handle content changes that might affect scroll position
  const handleContentChange = useCallback(() => {
    if (isAtBottomRef.current && enableWhenAtBottom) {
      // If at bottom, scroll to maintain bottom position
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      });
    } else {
      // Otherwise, maintain anchor position
      requestAnimationFrame(() => {
        restoreScrollPosition();
      });
    }
  }, [enableWhenAtBottom, restoreScrollPosition]);

  // Set up observers for content changes
  const setupObservers = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // ResizeObserver for element size changes (like images/embeds loading)
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }

    resizeObserverRef.current = new ResizeObserver((entries) => {
      // Debounce resize events
      setTimeout(() => {
        handleContentChange();
      }, 10);
    });

    // Observe all message elements and their children
    const messages = container.querySelectorAll('[data-message-id]');
    messages.forEach(message => {
      resizeObserverRef.current!.observe(message);
      
      // Also observe images, videos, and iframes within messages
      const media = message.querySelectorAll('img, video, iframe, blockquote');
      media.forEach(el => {
        resizeObserverRef.current!.observe(el);
      });
    });

    // MutationObserver for DOM changes (new elements, attribute changes)
    if (mutationObserverRef.current) {
      mutationObserverRef.current.disconnect();
    }

    mutationObserverRef.current = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // New elements added, observe them for size changes
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (resizeObserverRef.current) {
                resizeObserverRef.current.observe(element);
                
                // Also observe media within new elements
                const media = element.querySelectorAll('img, video, iframe, blockquote');
                media.forEach(el => {
                  resizeObserverRef.current!.observe(el);
                });
              }
              shouldUpdate = true;
            }
          });
        }
      });

      if (shouldUpdate) {
        setTimeout(() => {
          handleContentChange();
        }, 10);
      }
    });

    mutationObserverRef.current.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }, [handleContentChange]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    checkIfAtBottom();
    setScrollAnchor();
  }, [checkIfAtBottom, setScrollAnchor]);

  // Initialize
  const initialize = useCallback((element: HTMLElement | null) => {
    if (containerRef.current) {
      containerRef.current.removeEventListener('scroll', handleScroll);
    }

    containerRef.current = element;

    if (element) {
      element.addEventListener('scroll', handleScroll, { passive: true });
      checkIfAtBottom();
      setScrollAnchor();
      setupObservers();
    }
  }, [handleScroll, checkIfAtBottom, setScrollAnchor, setupObservers]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener('scroll', handleScroll);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
      }
    };
  }, [handleScroll]);

  // Force scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior
      });
      isAtBottomRef.current = true;
    }
  }, []);

  return {
    initialize,
    scrollToBottom,
    isAtBottom: () => isAtBottomRef.current
  };
};

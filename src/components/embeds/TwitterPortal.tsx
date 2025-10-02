import React, { useEffect, useRef, useState } from 'react';

interface TwitterPortalProps {
  tweetId: string;
  theme?: 'light' | 'dark';
  onLoad?: () => void;
  onError?: (error: string) => void;
}

// Simple, reliable Twitter embed using widgets.js
export const TwitterPortal: React.FC<TwitterPortalProps> = ({
  tweetId,
  theme = 'light',
  onLoad,
  onError
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const loadedRef = useRef(false);

  // Load Twitter widget script once
  useEffect(() => {
    if ((window as any).twttr?.widgets) {
      setScriptLoaded(true);
      return;
    }

    const existingScript = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]');
    
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.onload = () => setScriptLoaded(true);
      script.onerror = () => onError?.('Failed to load Twitter widget script');
      document.body.appendChild(script);
    } else {
      // Script exists, wait for it to load
      const checkInterval = setInterval(() => {
        if ((window as any).twttr?.widgets) {
          setScriptLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        if (!(window as any).twttr?.widgets) {
          onError?.('Twitter widget timeout');
        }
      }, 5000);
    }
  }, [onError]);

  // Render tweet when script is loaded
  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || loadedRef.current) return;

    loadedRef.current = true;

    (window as any).twttr.widgets
      .createTweet(tweetId, containerRef.current, {
        theme,
        conversation: 'none',
        cards: 'visible',
        align: 'center',
        dnt: true
      })
      .then((element: HTMLElement | undefined) => {
        if (element) {
          onLoad?.();
        } else {
          onError?.('Tweet not found or unavailable');
        }
      })
      .catch((error: Error) => {
        console.error('Twitter embed error:', error);
        onError?.('Failed to load tweet');
      });
  }, [scriptLoaded, tweetId, theme, onLoad, onError]);

  return <div ref={containerRef} className="w-full min-h-[200px]" />;
};

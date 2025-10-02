import React, { useEffect, useRef } from 'react';

interface TwitterPortalProps {
  tweetId: string;
  theme?: 'light' | 'dark';
  onLoad?: () => void;
  onError?: (error: string) => void;
}

/**
 * TwitterPortal - Renders Twitter embed using a simple ref-based approach
 * This avoids DOM conflicts by letting Twitter's script manage its own DOM
 * React only creates the container and never tries to manage what's inside it
 */
export const TwitterPortal: React.FC<TwitterPortalProps> = ({
  tweetId,
  theme = 'light',
  onLoad,
  onError
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);
  const currentTweetIdRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Prevent concurrent loads
    if (isLoadingRef.current) {
      console.log('[TwitterPortal] Load already in progress, skipping');
      return;
    }

    const loadTwitterWidget = async () => {
      console.log('[TwitterPortal] Starting to load tweet:', tweetId, 'theme:', theme);
      
      // Don't reload if same tweet is already loaded
      if (currentTweetIdRef.current === tweetId && containerRef.current?.hasChildNodes()) {
        console.log('[TwitterPortal] Tweet already loaded:', tweetId);
        onLoad?.();
        return;
      }
      
      isLoadingRef.current = true;
      
      try {
        // Ensure Twitter widgets script is loaded
        if (!(window as any).twttr?.widgets) {
          console.log('[TwitterPortal] Loading Twitter widgets script...');
          
          if (!document.querySelector('script[src="https://platform.twitter.com/widgets.js"]')) {
            const script = document.createElement('script');
            script.src = 'https://platform.twitter.com/widgets.js';
            script.async = true;
            script.charset = 'utf-8';
            document.head.appendChild(script);

            await new Promise<void>((resolve, reject) => {
              script.onload = () => {
                console.log('[TwitterPortal] Twitter widgets script loaded');
                resolve();
              };
              script.onerror = () => reject(new Error('Failed to load Twitter widgets'));
              setTimeout(() => reject(new Error('Twitter widget load timeout')), 10000);
            });
          } else {
            // Wait for existing script
            let attempts = 0;
            while (!(window as any).twttr?.widgets && attempts < 50) {
              await new Promise(resolve => setTimeout(resolve, 100));
              attempts++;
            }
            if (!(window as any).twttr?.widgets) {
              throw new Error('Twitter widgets not available');
            }
          }
        }

        if (!isMountedRef.current || !containerRef.current) {
          console.warn('[TwitterPortal] Component unmounted or container not ready');
          return;
        }

        // Clear previous content - let the container empty itself naturally
        // Don't use innerHTML or removeChild - just let Twitter's script replace it
        console.log('[TwitterPortal] Creating tweet widget for:', tweetId);
        
        const tweetElement = await (window as any).twttr.widgets.createTweet(
          tweetId,
          containerRef.current,
          {
            theme,
            width: '100%',
            cards: 'visible',
            conversation: 'none',
            align: 'center',
            dnt: true
          }
        );

        if (isMountedRef.current) {
          if (tweetElement) {
            console.log('[TwitterPortal] Tweet loaded successfully:', tweetId);
            currentTweetIdRef.current = tweetId;
            onLoad?.();
          } else {
            console.error('[TwitterPortal] Tweet could not be loaded (may be deleted or private):', tweetId);
            onError?.('Tweet could not be loaded');
          }
        }
      } catch (error) {
        console.error('[TwitterPortal] Error loading tweet:', error);
        if (isMountedRef.current) {
          onError?.('Failed to load tweet. It may be unavailable or deleted.');
        }
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadTwitterWidget();

    return () => {
      console.log('[TwitterPortal] Cleanup for tweet:', tweetId);
      isMountedRef.current = false;
      // Don't try to clean up the DOM - Twitter manages it
      // Just reset our tracking refs
      currentTweetIdRef.current = null;
      isLoadingRef.current = false;
    };
  }, [tweetId, theme, onLoad, onError]);

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%',
        minHeight: '200px',
        // Let Twitter's embed manage its own layout
        display: 'block'
      }}
    />
  );
};

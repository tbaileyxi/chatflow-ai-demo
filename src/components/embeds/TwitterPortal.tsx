import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TwitterPortalProps {
  tweetId: string;
  theme?: 'light' | 'dark';
  onLoad?: () => void;
  onError?: (error: string) => void;
}

/**
 * TwitterPortal - Renders Twitter embed in a React Portal to isolate from React's reconciliation
 * This prevents DOM conflicts between React and Twitter's widget.js
 */
export const TwitterPortal: React.FC<TwitterPortalProps> = ({
  tweetId,
  theme = 'light',
  onLoad,
  onError
}) => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const portalMountRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);
  const currentTweetIdRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    const loadTwitterWidget = async () => {
      console.log('[TwitterPortal] Starting to load tweet:', tweetId, 'theme:', theme);
      try {
        // Wait for Twitter widgets to be available
        if (!(window as any).twttr?.widgets) {
          console.log('[TwitterPortal] Twitter widgets not loaded, loading script...');
          // Check if script already exists
          if (!document.querySelector('script[src="https://platform.twitter.com/widgets.js"]')) {
            console.log('[TwitterPortal] Adding Twitter widgets script to DOM');
            const script = document.createElement('script');
            script.src = 'https://platform.twitter.com/widgets.js';
            script.async = true;
            script.charset = 'utf-8';
            document.head.appendChild(script);

            await new Promise<void>((resolve, reject) => {
              script.onload = () => {
                console.log('[TwitterPortal] Twitter widgets script loaded successfully');
                resolve();
              };
              script.onerror = () => reject(new Error('Failed to load Twitter widgets'));
              
              // Timeout after 10 seconds
              setTimeout(() => reject(new Error('Twitter widget load timeout')), 10000);
            });
          } else {
            console.log('[TwitterPortal] Twitter widgets script already in DOM, waiting...');
            // Wait for existing script to load
            let attempts = 0;
            while (!(window as any).twttr?.widgets && attempts < 50) {
              await new Promise(resolve => setTimeout(resolve, 100));
              attempts++;
            }
            if (!(window as any).twttr?.widgets) {
              throw new Error('Twitter widgets not available');
            }
            console.log('[TwitterPortal] Twitter widgets now available');
          }
        }

        if (!isMountedRef.current || !portalMountRef.current) {
          console.warn('[TwitterPortal] Component unmounted before tweet load');
          return;
        }

        // Don't reload if same tweet
        if (currentTweetIdRef.current === tweetId) {
          console.log('[TwitterPortal] Tweet already loaded:', tweetId);
          onLoad?.();
          return;
        }

        // Clear previous content safely
        if (portalMountRef.current) {
          try {
            portalMountRef.current.innerHTML = '';
          } catch (e) {
            console.debug('[TwitterPortal] Error clearing: DOM already modified', e);
          }
        }

        if (!isMountedRef.current) return;

        // Create tweet widget
        console.log('[TwitterPortal] Calling createTweet for:', tweetId);
        const tweetElement = await (window as any).twttr.widgets.createTweet(
          tweetId,
          portalMountRef.current,
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
            console.log('[TwitterPortal] Tweet widget created successfully:', tweetId);
            currentTweetIdRef.current = tweetId;
            onLoad?.();
          } else {
            console.error('[TwitterPortal] createTweet returned null for:', tweetId);
            onError?.('Tweet could not be loaded');
          }
        }
      } catch (error) {
        console.error('[TwitterPortal] Error loading tweet:', tweetId, error);
        if (isMountedRef.current) {
          onError?.('Failed to load tweet. It may be unavailable or deleted.');
        }
      }
    };

    loadTwitterWidget();

    return () => {
      isMountedRef.current = false;
      currentTweetIdRef.current = null;
      
      // Safely clear portal content using innerHTML to avoid DOM conflicts
      if (portalMountRef.current) {
        try {
          portalMountRef.current.innerHTML = '';
        } catch (e) {
          // Ignore errors if Twitter has already manipulated the DOM
          console.debug('TwitterPortal cleanup: DOM already modified', e);
        }
      }
    };
  }, [tweetId, theme, onLoad, onError]);

  // Create portal mount point
  useEffect(() => {
    const container = document.createElement('div');
    container.style.cssText = 'display: contents;';
    portalMountRef.current = container;
    
    return () => {
      portalMountRef.current = null;
    };
  }, []);

  return (
    <div 
      ref={portalContainerRef}
      style={{ 
        display: 'contents',
        contain: 'layout style'
      }}
    >
      {portalMountRef.current && createPortal(
        <div style={{ width: '100%' }} />,
        portalMountRef.current
      )}
    </div>
  );
};

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
      try {
        // Wait for Twitter widgets to be available
        if (!(window as any).twttr?.widgets) {
          // Check if script already exists
          if (!document.querySelector('script[src="https://platform.twitter.com/widgets.js"]')) {
            const script = document.createElement('script');
            script.src = 'https://platform.twitter.com/widgets.js';
            script.async = true;
            script.charset = 'utf-8';
            document.head.appendChild(script);

            await new Promise<void>((resolve, reject) => {
              script.onload = () => resolve();
              script.onerror = () => reject(new Error('Failed to load Twitter widgets'));
              
              // Timeout after 10 seconds
              setTimeout(() => reject(new Error('Twitter widget load timeout')), 10000);
            });
          } else {
            // Wait for existing script to load
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

        if (!isMountedRef.current || !portalMountRef.current) return;

        // Don't reload if same tweet
        if (currentTweetIdRef.current === tweetId) {
          onLoad?.();
          return;
        }

        // Clear previous content
        if (portalMountRef.current) {
          while (portalMountRef.current.firstChild) {
            portalMountRef.current.removeChild(portalMountRef.current.firstChild);
          }
        }

        if (!isMountedRef.current) return;

        // Create tweet widget
        await (window as any).twttr.widgets.createTweet(
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
          currentTweetIdRef.current = tweetId;
          onLoad?.();
        }
      } catch (error) {
        console.error('Failed to load tweet:', error);
        if (isMountedRef.current) {
          onError?.('Failed to load tweet. It may be unavailable or deleted.');
        }
      }
    };

    loadTwitterWidget();

    return () => {
      isMountedRef.current = false;
      currentTweetIdRef.current = null;
      
      // Cleanup portal content
      if (portalMountRef.current) {
        setTimeout(() => {
          if (portalMountRef.current) {
            while (portalMountRef.current.firstChild) {
              try {
                portalMountRef.current.removeChild(portalMountRef.current.firstChild);
              } catch (e) {
                // Twitter may have already removed it
              }
            }
          }
        }, 0);
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

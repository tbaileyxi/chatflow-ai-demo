import React, { memo, useEffect, useRef, useState } from 'react';

interface XPostEmbedProps {
  embedCode: string;
}

export const XPostEmbed = memo<XPostEmbedProps>(({ embedCode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    // Prevent double loading
    if (loadedRef.current) return;
    
    const loadTwitterWidgets = () => {
      return new Promise<void>((resolve, reject) => {
        if ((window as any).twttr?.widgets) {
          resolve();
          return;
        }

        // Check if script already exists
        const existingScript = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]');
        if (existingScript) {
          // Wait for existing script to load with timeout
          let attempts = 0;
          const maxAttempts = 50;
          const checkLoaded = () => {
            if ((window as any).twttr?.widgets) {
              resolve();
            } else if (attempts < maxAttempts) {
              attempts++;
              setTimeout(checkLoaded, 100);
            } else {
              reject(new Error('Timeout waiting for Twitter widgets'));
            }
          };
          checkLoaded();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        script.charset = 'utf-8';
        script.onload = () => setTimeout(() => resolve(), 100);
        script.onerror = () => reject(new Error('Failed to load Twitter widgets script'));
        document.head.appendChild(script);
      });
    };

    const processEmbed = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        await loadTwitterWidgets();
        
        if (!containerRef.current) return;

        // Extract tweet ID from blockquote HTML or direct URL
        let tweetId: string | null = null;
        let username: string | null = null;

        // Try to extract from blockquote format first
        const blockquoteMatch = embedCode.match(/<blockquote[^>]*class="twitter-tweet"[^>]*>(.*?)<\/blockquote>/is);
        if (blockquoteMatch) {
          const urlMatch = embedCode.match(/href="https:\/\/(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/i);
          if (urlMatch) {
            username = urlMatch[1];
            tweetId = urlMatch[2];
          }
        }

        // If not found, try direct URL format
        if (!tweetId) {
          const directUrlMatch = embedCode.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(?:@)?(\w+)\/status\/(\d+)/);
          if (directUrlMatch) {
            username = directUrlMatch[1];
            tweetId = directUrlMatch[2];
          }
        }

        if (tweetId && (window as any).twttr?.widgets) {
          try {
            // Clear container before rendering
            containerRef.current.innerHTML = '';
            
            await (window as any).twttr.widgets.createTweet(tweetId, containerRef.current, {
              theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
              width: '100%',
              cards: 'visible',
              conversation: 'none',
              align: 'center',
              dnt: true
            });
            
            loadedRef.current = true;
            setIsLoading(false);
          } catch (createError) {
            console.error('createTweet failed:', createError);
            setError('Failed to load tweet. It may be unavailable or deleted.');
            setIsLoading(false);
          }
        } else {
          setError('Invalid tweet URL format');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading Twitter embed:', error);
        setError('Failed to load tweet');
        setIsLoading(false);
      }
    };

    processEmbed();

    // Cleanup - properly clear Twitter widgets before React unmounts
    return () => {
      if (containerRef.current) {
        // Clear the container to prevent React from trying to remove Twitter's DOM nodes
        try {
          containerRef.current.innerHTML = '';
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
      loadedRef.current = false;
    };
  }, [embedCode]);

  // Extract URL for fallback link
  const tweetUrlMatch = embedCode.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(?:@)?(\w+)\/status\/(\d+)/);
  const normalizedUrl = tweetUrlMatch 
    ? `https://twitter.com/${tweetUrlMatch[1]}/status/${tweetUrlMatch[2]}`
    : null;

  return (
    <div 
      ref={containerRef}
      className="rounded-xl overflow-hidden w-full my-2 relative"
      style={{ 
        pointerEvents: 'auto',
        contain: 'layout style',
        minHeight: isLoading ? '200px' : 'auto'
      }}
    >
      {isLoading && !error && (
        <div className="flex items-center justify-center p-8 bg-muted/50 rounded-xl min-h-[200px]">
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <div className="text-sm text-muted-foreground">Loading tweet...</div>
          </div>
        </div>
      )}
      {error && normalizedUrl && (
        <div className="flex flex-col items-center justify-center p-6 bg-muted/50 rounded-xl min-h-[150px] space-y-3">
          <div className="text-sm font-medium text-muted-foreground">{error}</div>
          <a 
            href={normalizedUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            View on X/Twitter →
          </a>
        </div>
      )}
    </div>
  );
});

XPostEmbed.displayName = 'XPostEmbed';

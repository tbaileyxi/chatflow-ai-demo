import React, { memo, useEffect, useRef, useState } from 'react';

interface XPostEmbedProps {
  embedCode: string;
}

export const XPostEmbed = memo<XPostEmbedProps>(({ embedCode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Create abort controller for cleanup
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const loadTwitterWidgets = () => {
      return new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
          reject(new Error('Aborted'));
          return;
        }

        if ((window as any).twttr?.widgets) {
          resolve();
          return;
        }

        // Check if script already exists
        const existingScript = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]');
        if (existingScript) {
          // Wait for existing script to load
          const checkLoaded = () => {
            if ((window as any).twttr?.widgets) {
              resolve();
            } else {
              setTimeout(checkLoaded, 100);
            }
          };
          checkLoaded();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        script.onload = () => {
          if (!signal.aborted) resolve();
        };
        script.onerror = () => {
          if (!signal.aborted) {
            setError('Failed to load Twitter widgets');
            setIsLoading(false);
            resolve();
          }
        };
        document.head.appendChild(script);
      });
    };

    const processEmbed = async () => {
      try {
        if (signal.aborted) return;
        
        await loadTwitterWidgets();
        
        if (signal.aborted) return;
        
        if (containerRef.current && (window as any).twttr?.widgets) {
          // Extract tweet ID and use createTweet for better inline control
          const tweetUrlMatch = embedCode.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
          
          if (tweetUrlMatch) {
            const tweetId = tweetUrlMatch[1];
            
            try {
              if (signal.aborted) return;
              
              await (window as any).twttr.widgets.createTweet(tweetId, containerRef.current, {
                theme: 'auto',
                width: '100%',
                cards: 'visible',
                conversation: 'none',
                align: 'left',
                dnt: true
              });
              
              if (!signal.aborted) {
                setIsLoading(false);
                setIsLoaded(true);
              }
            } catch (createError) {
              if (!signal.aborted) {
                console.warn('createTweet failed, falling back to load:', createError);
                setError('Failed to load embed');
                setIsLoading(false);
              }
            }
          } else if (!signal.aborted) {
            setError('Invalid tweet URL');
            setIsLoading(false);
          }
        } else if (!signal.aborted) {
          setError('Twitter widgets not available');
          setIsLoading(false);
        }
      } catch (error) {
        if (!signal.aborted) {
          console.error('Error loading Twitter widgets:', error);
          setError('Failed to load embed');
          setIsLoading(false);
        }
      }
    };

    processEmbed();

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Let React handle DOM cleanup naturally, don't manipulate innerHTML
      if (containerRef.current) {
        // Remove any event listeners added by Twitter widgets
        const container = containerRef.current;
        const twitterElements = container.querySelectorAll('[data-twitter-event-id]');
        twitterElements.forEach(el => {
          const clone = el.cloneNode(true);
          el.parentNode?.replaceChild(clone, el);
        });
      }
    };
  }, [embedCode]);

  // Check if embedCode is a Twitter/X URL and normalize it
  const tweetUrlMatch = embedCode.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  
  if (tweetUrlMatch) {
    const tweetId = tweetUrlMatch[1];
    const normalizedUrl = `https://twitter.com/user/status/${tweetId}`;
    
    return (
      <div 
        ref={containerRef}
        className="rounded-xl overflow-hidden shadow w-full my-1 relative"
        style={{ 
          pointerEvents: 'auto',
          contain: 'layout style'
        }}
      >
        <blockquote 
          className="twitter-tweet" 
          data-theme="auto" 
          data-width="100%" 
          data-cards="visible"
          data-conversation="none"
        >
          <a href={normalizedUrl}>Loading tweet...</a>
        </blockquote>
        {isLoading && (
          <div className="flex items-center justify-center p-6 bg-muted rounded-xl min-h-[200px]">
            <div className="text-sm text-muted-foreground animate-pulse">Loading tweet...</div>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center p-6 bg-muted rounded-xl min-h-[200px] space-y-2">
            <div className="text-sm text-muted-foreground">{error}</div>
            <a 
              href={normalizedUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm"
            >
              View on X/Twitter
            </a>
          </div>
        )}
      </div>
    );
  }

  // Handle oEmbed HTML - aggressively clean to prevent double rendering
  const sanitizedHtml = embedCode
    .replace(/<script[^>]*src="https:\/\/platform\.twitter\.com\/widgets\.js"[^>]*><\/script>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove any other scripts
    .replace(/data-tweet-id="[^"]*"/gi, '') // Clean up duplicate tweet markers
    .trim();

  return (
    <div 
      ref={containerRef}
      className="rounded-xl overflow-hidden shadow w-full my-2"
      style={{ 
        pointerEvents: 'auto', 
        minHeight: '200px',
        contain: 'layout style'
      }}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
});

XPostEmbed.displayName = 'XPostEmbed';
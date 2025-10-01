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
  const loadedRef = useRef(false);

  useEffect(() => {
    // Prevent double loading
    if (loadedRef.current) return;
    
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
            if (signal.aborted) {
              reject(new Error('Aborted'));
              return;
            }
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
        script.charset = 'utf-8';
        script.onload = () => {
          if (!signal.aborted) resolve();
        };
        script.onerror = () => {
          if (!signal.aborted) {
            reject(new Error('Failed to load Twitter widgets script'));
          }
        };
        document.head.appendChild(script);
      });
    };

    const processEmbed = async () => {
      try {
        if (signal.aborted) return;
        
        setIsLoading(true);
        setError(null);
        
        await loadTwitterWidgets();
        
        if (signal.aborted) return;
        
        if (containerRef.current && (window as any).twttr?.widgets) {
          // Extract tweet ID from various URL formats
          const tweetUrlMatch = embedCode.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(?:@)?(\w+)\/status\/(\d+)/);
          
          if (tweetUrlMatch) {
            const tweetId = tweetUrlMatch[2];
            
            try {
              if (signal.aborted) return;
              
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
              
              if (!signal.aborted) {
                loadedRef.current = true;
                setIsLoading(false);
                setIsLoaded(true);
              }
            } catch (createError) {
              if (!signal.aborted) {
                console.error('createTweet failed:', createError);
                setError('Failed to load tweet. It may be unavailable or deleted.');
                setIsLoading(false);
              }
            }
          } else if (!signal.aborted) {
            setError('Invalid tweet URL format');
            setIsLoading(false);
          }
        } else if (!signal.aborted) {
          setError('Twitter widgets unavailable');
          setIsLoading(false);
        }
      } catch (error) {
        if (!signal.aborted) {
          console.error('Error loading Twitter embed:', error);
          setError('Failed to load tweet');
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
    };
  }, [embedCode]);

  // Check if embedCode is a Twitter/X URL and normalize it
  const tweetUrlMatch = embedCode.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(?:@)?(\w+)\/status\/(\d+)/);
  
  if (tweetUrlMatch) {
    const tweetId = tweetUrlMatch[2];
    const username = tweetUrlMatch[1];
    const normalizedUrl = `https://twitter.com/${username}/status/${tweetId}`;
    
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
        {isLoading && !isLoaded && !error && (
          <div className="flex items-center justify-center p-8 bg-muted/50 rounded-xl min-h-[200px]">
            <div className="flex flex-col items-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <div className="text-sm text-muted-foreground">Loading tweet...</div>
            </div>
          </div>
        )}
        {error && (
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
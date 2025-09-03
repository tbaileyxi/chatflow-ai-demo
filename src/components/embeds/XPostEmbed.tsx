import React, { memo, useEffect, useRef, useState } from 'react';

interface XPostEmbedProps {
  embedCode: string;
}

export const XPostEmbed = memo<XPostEmbedProps>(({ embedCode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const loadTwitterWidgets = () => {
      return new Promise<void>((resolve) => {
        if ((window as any).twttr?.widgets) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        script.onload = () => {
          resolve();
        };
        script.onerror = () => {
          setError('Failed to load Twitter widgets');
          setIsLoading(false);
          resolve();
        };
        document.head.appendChild(script);
      });
    };

    const processEmbed = async () => {
      try {
        await loadTwitterWidgets();
        
        if (containerRef.current && (window as any).twttr?.widgets) {
          // Clear container to prevent duplicates
          containerRef.current.innerHTML = '';
          
          // Extract tweet ID and use createTweet for better inline control
          const tweetUrlMatch = embedCode.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
          
          if (tweetUrlMatch) {
            const tweetId = tweetUrlMatch[1];
            
            try {
              await (window as any).twttr.widgets.createTweet(tweetId, containerRef.current, {
                theme: 'auto',
                width: '100%',
                cards: 'visible',
                conversation: 'none',
                align: 'left',
                dnt: true // Do not track for better privacy
              });
              
              setIsLoading(false);
              setIsLoaded(true);
            } catch (createError) {
              console.warn('createTweet failed, falling back to load:', createError);
              await (window as any).twttr.widgets.load(containerRef.current);
              setIsLoading(false);
              setIsLoaded(true);
            }
          } else {
            // Fallback to standard load for non-URL embeds
            await (window as any).twttr.widgets.load(containerRef.current);
            setIsLoading(false);
            setIsLoaded(true);
          }
        } else {
          setError('Twitter widgets not available');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading Twitter widgets:', error);
        setError('Failed to load embed');
        setIsLoading(false);
      }
    };

    processEmbed();
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
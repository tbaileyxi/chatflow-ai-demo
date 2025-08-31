import React, { memo, useEffect, useRef, useState } from 'react';

interface XPostEmbedProps {
  embedCode: string;
}

export const XPostEmbed = memo<XPostEmbedProps>(({ embedCode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
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
          await (window as any).twttr.widgets.load(containerRef.current);
          
          // Poll for iframe to appear and be stable
          let pollCount = 0;
          const pollForIframe = () => {
            const iframe = containerRef.current?.querySelector('iframe');
            if (iframe && iframe.offsetHeight > 0) {
              setIsLoading(false);
              setIsLoaded(true);
            } else if (pollCount < 50) {
              pollCount++;
              setTimeout(pollForIframe, 100);
            } else {
              setIsLoading(false);
            }
          };
          
          setTimeout(pollForIframe, 200);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading Twitter widgets:', error);
        setIsLoading(false);
      }
    };

    processEmbed();
  }, [embedCode]);

  // Check if embedCode is a Twitter/X URL
  const tweetUrlMatch = embedCode.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  
  if (tweetUrlMatch) {
    const tweetUrl = embedCode.startsWith('http') ? embedCode : `https://${embedCode}`;
    
    return (
      <div 
        ref={containerRef}
        className="rounded-xl overflow-hidden shadow w-full my-2"
        style={{ pointerEvents: 'auto', minHeight: isLoading ? '200px' : 'auto' }}
      >
        <blockquote className="twitter-tweet" data-theme="auto" data-width="100%">
          <a href={tweetUrl}>Loading tweet...</a>
        </blockquote>
        {isLoading && (
          <div className="flex items-center justify-center p-4 bg-muted rounded-xl h-48">
            <div className="text-sm text-muted-foreground">Loading tweet...</div>
          </div>
        )}
      </div>
    );
  }

  // Handle oEmbed HTML
  const sanitizedHtml = embedCode.replace(
    /<script[^>]*src="https:\/\/platform\.twitter\.com\/widgets\.js"[^>]*><\/script>/gi,
    ''
  );

  return (
    <div 
      ref={containerRef}
      className="rounded-xl overflow-hidden shadow w-full my-2"
      style={{ pointerEvents: 'auto', minHeight: '200px' }}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
});

XPostEmbed.displayName = 'XPostEmbed';
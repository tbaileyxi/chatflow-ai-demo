import React, { useEffect, useRef, useState, memo } from "react";

interface XPostEmbedProps {
  embedCode: string; // oEmbed HTML or tweet URL
}

export const XPostEmbed = memo(function XPostEmbed({ embedCode }: XPostEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadedKeyRef = useRef<string | null>(null);
  const loadCalledRef = useRef(false);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTwitterWidgets = async () => {
      try {
        // Avoid duplicate loads for the same embedCode
        if (loadedKeyRef.current === embedCode && loadCalledRef.current) {
          return;
        }
        loadedKeyRef.current = embedCode;
        loadCalledRef.current = true;
        setIsLoading(true);

        // Load Twitter widgets script if not already loaded
        if (!(window as any).twttr) {
          let script = document.querySelector('script[src*="platform.twitter.com/widgets.js"]') as HTMLScriptElement | null;
          if (!script) {
            script = document.createElement('script');
            script.src = 'https://platform.twitter.com/widgets.js';
            script.async = true;
            document.head.appendChild(script);
          }
          await new Promise((resolve) => {
            if ((window as any).twttr?.ready) return resolve(null);
            script!.onload = resolve as any;
            setTimeout(resolve, 3000); // fallback resolve to avoid hanging
          });
        }

        // Process widgets in container once
        if (!cancelled && (window as any).twttr?.widgets && containerRef.current) {
          await (window as any).twttr.widgets.load(containerRef.current);

          // Observe for the rendered tweet to stabilize height, then stop
          if (observerRef.current) observerRef.current.disconnect();
          observerRef.current = new MutationObserver(() => {
            if (!containerRef.current) return;
            const rendered = containerRef.current.querySelector('.twitter-tweet-rendered, iframe');
            if (rendered) {
              setIsLoading(false);
              observerRef.current?.disconnect();
            }
          });
          observerRef.current.observe(containerRef.current, { childList: true, subtree: true });

          // Safety timeout in case MutationObserver misses
          setTimeout(() => !cancelled && setIsLoading(false), 2000);
        }
      } catch (e) {
        !cancelled && setIsLoading(false);
      }
    };

    loadTwitterWidgets();

    return () => {
      cancelled = true;
      observerRef.current?.disconnect();
    };
  }, [embedCode]);

  // Check if it's a Twitter/X URL and convert to blockquote
  if (embedCode.includes('twitter.com') || embedCode.includes('x.com')) {
    const urlMatch = embedCode.match(/https?:\/\/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/);
    if (urlMatch) {
      const tweetUrl = urlMatch[0];
      return (
        <div ref={containerRef} className="twitter-embed x-embed-container w-full overflow-hidden">
          {isLoading && (
            <div className="flex items-center justify-center p-4 text-muted-foreground">
              <div className="text-sm">Loading tweet...</div>
            </div>
          )}
          <blockquote 
            className="twitter-tweet" 
            data-conversation="none" 
            data-theme="auto"
            style={{ 
              maxWidth: '100%',
              width: '100%',
              minWidth: 0,
              WebkitBoxSizing: 'border-box',
              boxSizing: 'border-box'
            }}
          >
            <a href={tweetUrl}></a>
          </blockquote>
        </div>
      );
    }
  }

  // For oEmbed HTML, render the provided blockquote and process with widgets.js
  const sanitized = embedCode.replace(/<script[^>]*platform\.twitter\.com\/widgets\.js[^<]*<\/script>/gi, '');
  return (
    <div 
      ref={containerRef}
      className="embed-content x-embed-container w-full overflow-hidden"
      style={{ 
        maxWidth: '100%', 
        minWidth: 0,
        WebkitOverflowScrolling: 'auto',
        overflowX: 'auto'
      }}
      dangerouslySetInnerHTML={{ __html: sanitized }} 
    />
  );
});

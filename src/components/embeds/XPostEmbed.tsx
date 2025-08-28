import React, { useEffect, useRef, useState, memo } from "react";

interface XPostEmbedProps {
  embedCode: string; // oEmbed HTML or tweet URL
}

export const XPostEmbed = memo(function XPostEmbed({ embedCode }: XPostEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    // Only load once - prevent all re-renders
    if (loadedRef.current) return;
    loadedRef.current = true;

    let cancelled = false;

    const loadTwitterWidgets = async () => {
      try {
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
            setTimeout(resolve, 3000); // fallback resolve
          });
        }

        // Process widgets once only
        if (!cancelled && (window as any).twttr?.widgets && containerRef.current) {
          await (window as any).twttr.widgets.load(containerRef.current);
          if (!cancelled) {
            setIsLoaded(true);
          }
        }
      } catch (e) {
        console.error(`[XPostEmbed] Error loading:`, e);
        if (!cancelled) {
          setIsLoaded(true); // Show static version
        }
      }
    };

    loadTwitterWidgets();

    return () => {
      cancelled = true;
    };
  }, []); // Remove embedCode dependency to prevent re-runs

  // Check if it's a Twitter/X URL and convert to blockquote
  if (embedCode.includes('twitter.com') || embedCode.includes('x.com')) {
    const urlMatch = embedCode.match(/https?:\/\/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/);
    if (urlMatch) {
      const tweetUrl = urlMatch[0];
      return (
        <div 
          ref={containerRef} 
          className="twitter-embed x-embed-container w-full"
          style={{
            contain: 'strict',
            position: 'relative',
            minHeight: '200px',
            WebkitTransform: 'translateZ(0)',
            transform: 'translateZ(0)',
            overflow: 'hidden'
          }}
        >
          {!isLoaded && (
            <div className="flex items-center justify-center p-4 text-muted-foreground bg-muted/20 absolute inset-0">
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
              minWidth: 0
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
      className="embed-content x-embed-container w-full"
      style={{ 
        maxWidth: '100%', 
        minWidth: 0,
        contain: 'strict',
        position: 'relative',
        minHeight: '200px',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
        overflow: 'hidden'
      }}
    >
      {!isLoaded && (
        <div className="flex items-center justify-center p-4 text-muted-foreground bg-muted/20 absolute inset-0">
          <div className="text-sm">Loading tweet...</div>
        </div>
      )}
      <div dangerouslySetInnerHTML={{ __html: sanitized }} />
    </div>
  );
}, (prevProps, nextProps) => {
  // Never re-render after first render
  return true;
});

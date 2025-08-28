import React, { useEffect, useRef, useState, memo, useCallback } from "react";

interface XPostEmbedProps {
  embedCode: string; // oEmbed HTML or tweet URL
}

export const XPostEmbed = memo(function XPostEmbed({ embedCode }: XPostEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadedKeyRef = useRef<string | null>(null);
  const loadCalledRef = useRef(false);
  const observerRef = useRef<MutationObserver | null>(null);
  const heightStabilityRef = useRef<{ height: number; timestamp: number } | null>(null);
  const renderCountRef = useRef(0);

  // Enhanced height stability check
  const checkHeightStability = useCallback(() => {
    if (!containerRef.current) return false;
    
    const currentHeight = containerRef.current.offsetHeight;
    const now = Date.now();
    
    if (!heightStabilityRef.current) {
      heightStabilityRef.current = { height: currentHeight, timestamp: now };
      return false;
    }
    
    // Check if height hasn't changed for 750ms
    if (heightStabilityRef.current.height === currentHeight) {
      return now - heightStabilityRef.current.timestamp > 750;
    } else {
      heightStabilityRef.current = { height: currentHeight, timestamp: now };
      return false;
    }
  }, []);

  useEffect(() => {
    renderCountRef.current++;
    console.log(`[XPostEmbed] Render ${renderCountRef.current}, embedCode: ${embedCode.substring(0, 50)}...`);

    if (renderCountRef.current > 3) {
      console.warn('[XPostEmbed] Render count exceeded 3, using static fallback');
      setIsLoading(false);
      document.body.classList.remove('embed-loading');
      return;
    }
    
    let cancelled = false;
    let fallbackTimeout: NodeJS.Timeout;

    const loadTwitterWidgets = async () => {
      try {
        // Avoid duplicate loads for the same embedCode
        if (loadedKeyRef.current === embedCode && loadCalledRef.current) {
          console.log(`[XPostEmbed] Skip duplicate load for: ${embedCode.substring(0, 30)}...`);
          return;
        }
        loadedKeyRef.current = embedCode;
        loadCalledRef.current = true;
        setIsLoading(true);
        document.body.classList.add('embed-loading');

        console.log(`[XPostEmbed] Loading widgets for: ${embedCode.substring(0, 30)}...`);

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
          console.log(`[XPostEmbed] Calling twttr.widgets.load`);
          await (window as any).twttr.widgets.load(containerRef.current);

          // Enhanced observer for height stability
          if (observerRef.current) observerRef.current.disconnect();
          observerRef.current = new MutationObserver(() => {
            if (!containerRef.current || cancelled) return;
            
            const rendered = containerRef.current.querySelector('.twitter-tweet-rendered, iframe');
            if (rendered && checkHeightStability()) {
              console.log(`[XPostEmbed] Height stabilized, stopping loading`);
              setIsLoading(false);
              document.body.classList.remove('embed-loading');
              observerRef.current?.disconnect();
            }
          });
          observerRef.current.observe(containerRef.current, { 
            childList: true, 
            subtree: true, 
            attributes: true,
            attributeFilter: ['style']
          });

          // Safety timeout with fallback static render
          fallbackTimeout = setTimeout(() => {
            if (!cancelled) {
              console.log(`[XPostEmbed] Fallback timeout reached`);
              setIsLoading(false);
              document.body.classList.remove('embed-loading');
              observerRef.current?.disconnect();
            }
          }, 6000);
        }
      } catch (e) {
        console.error(`[XPostEmbed] Error loading:`, e);
        !cancelled && setIsLoading(false);
      }
    };

    loadTwitterWidgets();

    return () => {
      cancelled = true;
      observerRef.current?.disconnect();
      clearTimeout(fallbackTimeout);
      heightStabilityRef.current = null;
      document.body.classList.remove('embed-loading');
    };
  }, [embedCode]);

  // Check if it's a Twitter/X URL and convert to blockquote
  if (embedCode.includes('twitter.com') || embedCode.includes('x.com')) {
    const urlMatch = embedCode.match(/https?:\/\/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/);
    if (urlMatch) {
      const tweetUrl = urlMatch[0];
      return (
        <div 
          ref={containerRef} 
          className="twitter-embed x-embed-container w-full overflow-hidden"
          style={{
            contain: 'strict',
            contentVisibility: isLoading ? 'hidden' : 'auto',
            position: 'relative',
            minHeight: 0,
            WebkitTransform: 'translateZ(0)',
            transform: 'translateZ(0)'
          }}
        >
          {isLoading && (
            <div className="flex items-center justify-center p-4 text-muted-foreground absolute inset-0 bg-muted/20">
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
        contain: 'strict',
        contentVisibility: isLoading ? 'hidden' : 'auto',
        position: 'relative',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
        WebkitOverflowScrolling: 'auto',
        overflowX: 'hidden'
      }}
      dangerouslySetInnerHTML={{ __html: sanitized }} 
    />
  );
}, (prevProps, nextProps) => {
  // Deep comparison for embedCode to ensure memo works properly
  return prevProps.embedCode === nextProps.embedCode;
});

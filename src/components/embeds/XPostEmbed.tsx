import { useEffect, useRef, useState } from "react";

interface XPostEmbedProps {
  embedCode: string; // oEmbed HTML or tweet URL
}

export function XPostEmbed({ embedCode }: XPostEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTwitterWidgets = async () => {
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

      // Process widgets in container
      if ((window as any).twttr?.widgets && containerRef.current) {
        await (window as any).twttr.widgets.load(containerRef.current);
        setIsLoading(false);
      }
    };

    loadTwitterWidgets().catch(() => setIsLoading(false));
  }, [embedCode]);

  // Check if it's a Twitter/X URL and convert to blockquote
  if (embedCode.includes('twitter.com') || embedCode.includes('x.com')) {
    const urlMatch = embedCode.match(/https?:\/\/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/);
    if (urlMatch) {
      const tweetUrl = urlMatch[0];
      return (
        <div ref={containerRef} className="twitter-embed w-full max-w-full">
          {isLoading && (
            <div className="flex items-center justify-center p-4 text-muted-foreground">
              <div className="text-sm">Loading tweet...</div>
            </div>
          )}
          <blockquote className="twitter-tweet" data-conversation="none" data-width="100%">
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
      className="embed-content w-full max-w-full" 
      dangerouslySetInnerHTML={{ __html: sanitized }} 
    />
  );
}

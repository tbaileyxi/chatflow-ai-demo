import React, { memo, useState, useEffect } from 'react';
import { parseXEmbed } from '@/utils/embedUtils';
import { TwitterPortal } from './TwitterPortal';

interface XPostEmbedProps {
  embedCode: string;
}

export const XPostEmbed = memo<XPostEmbedProps>(({ embedCode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Detect theme
  useEffect(() => {
    const detectTheme = () => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    };

    detectTheme();
    
    const observer = new MutationObserver(detectTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Parse tweet data
  const tweetData = parseXEmbed(embedCode);
  
  console.log('[XPostEmbed] Rendering embed:', { embedCode, tweetData, theme });

  if (!tweetData) {
    console.error('[XPostEmbed] Failed to parse tweet data from:', embedCode);
    return (
      <div className="rounded-xl overflow-hidden w-full my-2 p-6 bg-muted/50 text-center">
        <p className="text-sm text-muted-foreground">Invalid tweet format</p>
        <p className="text-xs text-muted-foreground mt-1">{embedCode.substring(0, 100)}</p>
      </div>
    );
  }

  const tweetUrl = `https://twitter.com/${tweetData.username}/status/${tweetData.tweetId}`;

  const handleLoad = () => {
    console.log('[XPostEmbed] Tweet loaded successfully:', tweetData.tweetId);
    setIsLoading(false);
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    console.error('[XPostEmbed] Tweet load error:', errorMessage, tweetData.tweetId);
    setError(errorMessage);
    setIsLoading(false);
  };

  return (
    <div className="rounded-xl overflow-hidden w-full my-2">
      {isLoading && !error && (
        <div className="flex items-center justify-center p-6 bg-muted/30 rounded-xl">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
            <div className="text-xs text-muted-foreground">Loading tweet...</div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-xl space-y-2">
          <div className="text-xs text-muted-foreground">{error}</div>
          <a 
            href={tweetUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline font-medium"
          >
            View on X →
          </a>
        </div>
      )}

      {!error && (
        <div className={isLoading ? 'hidden' : 'block'}>
          <TwitterPortal
            tweetId={tweetData.tweetId}
            theme={theme}
            onLoad={handleLoad}
            onError={handleError}
          />
        </div>
      )}
    </div>
  );
});

XPostEmbed.displayName = 'XPostEmbed';

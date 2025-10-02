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

  if (!tweetData) {
    return (
      <div className="rounded-xl overflow-hidden w-full my-2 p-6 bg-muted/50 text-center">
        <p className="text-sm text-muted-foreground">Invalid tweet format</p>
      </div>
    );
  }

  const tweetUrl = `https://twitter.com/${tweetData.username}/status/${tweetData.tweetId}`;

  const handleLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setIsLoading(false);
  };

  return (
    <div 
      className="rounded-xl overflow-hidden w-full my-2 relative"
      style={{ 
        pointerEvents: 'auto',
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
      
      {error && (
        <div className="flex flex-col items-center justify-center p-6 bg-muted/50 rounded-xl min-h-[150px] space-y-3">
          <div className="text-sm font-medium text-muted-foreground">{error}</div>
          <a 
            href={tweetUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            View on X/Twitter →
          </a>
        </div>
      )}

      {!error && (
        <div style={{ display: isLoading ? 'none' : 'block' }}>
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

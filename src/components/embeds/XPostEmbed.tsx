import React, { memo, useState, useEffect } from 'react';
import { parseXEmbed } from '@/utils/embedUtils';
import { LazyTwitterEmbed } from './LazyTwitterEmbed';

interface XPostEmbedProps {
  embedCode: string;
}

export const XPostEmbed = memo<XPostEmbedProps>(({ embedCode }) => {
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

  // Parse the embed code
  const parsed = parseXEmbed(embedCode);

  console.log('[XPostEmbed] Parsing result:', { 
    hasInput: !!embedCode, 
    parsed: !!parsed, 
    tweetId: parsed?.tweetId,
    username: parsed?.username 
  });

  if (!parsed?.tweetId) {
    console.error('[XPostEmbed] ❌ Failed to parse embed code:', embedCode?.substring(0, 150));
    return (
      <div className="w-full p-4 border border-border rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground">
          Unable to load tweet. Invalid embed format.
        </p>
      </div>
    );
  }

  const handleError = (errorMessage: string) => {
    console.error('[XPostEmbed] Error from LazyTwitterEmbed:', errorMessage);
    setError(errorMessage);
  };

  return (
    <div className="w-full max-w-full my-4">
      <LazyTwitterEmbed
        tweetId={parsed.tweetId}
        theme={theme}
        onError={handleError}
      />
    </div>
  );
});

XPostEmbed.displayName = 'XPostEmbed';

import React, { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useIntersectionObserver } from '@/utils/performance';

interface LazyTwitterEmbedProps {
  tweetId: string;
  theme?: 'light' | 'dark';
  onLoad?: () => void;
  onError?: (error: string) => void;
}

// Global script loader singleton
let scriptLoadPromise: Promise<void> | null = null;
let scriptLoaded = false;

const loadTwitterScript = (): Promise<void> => {
  if (scriptLoaded && (window as any).twttr?.widgets) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]');
    
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if ((window as any).twttr?.widgets) {
          scriptLoaded = true;
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Twitter script timeout'));
      }, 10000);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Twitter script'));
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
};

export const LazyTwitterEmbed: React.FC<LazyTwitterEmbedProps> = ({
  tweetId,
  theme = 'light',
  onLoad,
  onError
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const hasRendered = useRef(false);

  // Intersection Observer for lazy loading (200px margin)
  const { setElement } = useIntersectionObserver(
    (entry) => {
      if (entry.isIntersecting && !isVisible) {
        console.log(`[LazyTwitterEmbed] Tweet ${tweetId} entering viewport, loading...`);
        setIsVisible(true);
      }
    },
    { rootMargin: '200px' }
  );

  // Set up intersection observer
  useEffect(() => {
    if (containerRef.current) {
      setElement(containerRef.current);
    }
  }, [setElement]);

  // Load and render tweet when visible
  useEffect(() => {
    if (!isVisible || !containerRef.current || hasRendered.current) return;

    const loadAndRender = async () => {
      try {
        console.log(`[LazyTwitterEmbed] Loading script for tweet ${tweetId}...`);
        await loadTwitterScript();

        if (!containerRef.current || hasRendered.current) return;

        console.log(`[LazyTwitterEmbed] Rendering tweet ${tweetId}...`);
        hasRendered.current = true;

        const element = await (window as any).twttr.widgets.createTweet(
          tweetId,
          containerRef.current,
          {
            theme,
            conversation: 'none',
            cards: 'visible',
            align: 'center',
            dnt: true
          }
        );

        if (element) {
          console.log(`[LazyTwitterEmbed] ✅ Tweet ${tweetId} loaded successfully`);
          setIsLoading(false);
          onLoad?.();
        } else {
          throw new Error('Tweet not found or unavailable');
        }
      } catch (error) {
        console.error(`[LazyTwitterEmbed] ❌ Error loading tweet ${tweetId}:`, error);
        setHasError(true);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load tweet');
        setIsLoading(false);
        onError?.(errorMessage);
      }
    };

    loadAndRender();
  }, [isVisible, tweetId, theme, onLoad, onError, errorMessage]);

  if (hasError) {
    return (
      <div className="w-full p-4 border border-border rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground">
          Unable to load tweet. <a 
            href={`https://twitter.com/i/status/${tweetId}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            View on X →
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {isLoading && (
        <div className="space-y-3 p-4 border border-border rounded-lg bg-card">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      )}
      <div ref={containerRef} className="w-full min-h-[200px]" />
    </div>
  );
};

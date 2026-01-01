import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ExternalLink, Loader2, Zap, MessageCircle, Twitter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useRenderCount } from '@/components/debug/RenderCounter';

interface PulseItem {
  id: string;
  type: 'youtube' | 'grok' | 'reddit' | 'x' | 'curated';
  headline: string;
  body?: string;
  thumbnail?: string;
  video_id?: string;
  external_url?: string;
  created_at: string;
  author?: string;
  sponsor?: string;
}

interface PulseFeedBackgroundProps {
  huddleId: string;
  teamId: string;
  isLive: boolean;
  onItemCountChange?: (count: number) => void;
  onRefreshRef?: (fn: () => void) => void;
}

export const PulseFeedBackground = memo(function PulseFeedBackground({ 
  huddleId, 
  teamId, 
  isLive, 
  onItemCountChange,
  onRefreshRef 
}: PulseFeedBackgroundProps) {
  const [pulseItems, setPulseItems] = useState<PulseItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Performance: Track renders
  useRenderCount('pulse');
  
  // Performance: Refs for preventing redundant updates
  const didInitRef = useRef(false);
  const lastIdsRef = useRef('');
  const lastFetchRef = useRef(0);
  const THROTTLE_MS = 1500;

  // Parse message to pulse item
  const parseMessage = useCallback((msg: any): PulseItem => {
    let videoId: string | undefined;
    let itemType: PulseItem['type'] = 'curated';
    
    if (msg.embed_code?.startsWith('youtube:')) {
      videoId = msg.embed_code.replace('youtube:', '');
      itemType = 'youtube';
    } else if (msg.embed_code?.startsWith('x:')) {
      itemType = 'x';
    } else if (msg.embed_code?.startsWith('reddit:')) {
      itemType = 'reddit';
    } else if (msg.embed_code?.startsWith('grok:')) {
      itemType = 'grok';
    } else if (msg.pulse_source === 'youtube') {
      itemType = 'youtube';
      const youtubeMatch = msg.media_url?.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      videoId = youtubeMatch?.[1];
    } else if (msg.pulse_source === 'x') {
      itemType = 'x';
    } else if (msg.pulse_source === 'reddit') {
      itemType = 'reddit';
    } else if (msg.pulse_source === 'grok') {
      itemType = 'grok';
    }
    
    let headline = msg.content?.split('\n')[0] || 'Update';
    let author: string | undefined;
    const authorMatch = headline.match(/^@?(\w+):\s*/);
    if (authorMatch) {
      author = authorMatch[1];
      headline = headline.replace(authorMatch[0], '');
    }
    
    return {
      id: msg.id,
      type: itemType,
      headline,
      body: msg.content?.split('\n').slice(1).join('\n'),
      thumbnail: msg.media_url && !videoId ? msg.media_url : undefined,
      video_id: videoId,
      external_url: msg.media_url,
      created_at: msg.created_at,
      author,
      sponsor: undefined
    };
  }, []);

  // Fetch pulse items with throttle and smart diffing
  const fetchPulseItems = useCallback(async () => {
    // Throttle: skip if called too recently
    const now = Date.now();
    if (now - lastFetchRef.current < THROTTLE_MS) {
      return;
    }
    lastFetchRef.current = now;
    
    // Only show loading on first fetch
    if (!didInitRef.current) {
      setIsLoading(true);
    }
    
    const { data, error } = await supabase
      .from('huddle_messages')
      .select('*')
      .eq('huddle_id', huddleId)
      .in('message_type', ['social_buzz', 'highlight', 'pulse'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching pulse items:', error);
      didInitRef.current = true;
      setIsLoading(false);
      return;
    }

    // Smart diffing: only update state if data changed
    const newIds = (data || []).map(d => d.id).join(',');
    if (newIds === lastIdsRef.current) {
      didInitRef.current = true;
      setIsLoading(false);
      return;
    }
    lastIdsRef.current = newIds;

    const items: PulseItem[] = (data || []).map(parseMessage);
    setPulseItems(items);
    onItemCountChange?.(items.length);
    
    didInitRef.current = true;
    setIsLoading(false);
  }, [huddleId, onItemCountChange, parseMessage]);

  // Expose refresh function to parent
  useEffect(() => {
    onRefreshRef?.(fetchPulseItems);
  }, [fetchPulseItems, onRefreshRef]);

  // Initial fetch + polling
  useEffect(() => {
    fetchPulseItems();
    
    // Poll for new items - faster during live games
    const interval = setInterval(fetchPulseItems, isLive ? 30000 : 120000);
    
    return () => clearInterval(interval);
  }, [fetchPulseItems, isLive]);

  // Subscribe to realtime pulse updates - APPEND instead of refetch
  useEffect(() => {
    const channel = supabase
      .channel(`pulse-${huddleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'huddle_messages',
          filter: `huddle_id=eq.${huddleId}`
        },
        (payload) => {
          if (['social_buzz', 'highlight', 'pulse'].includes(payload.new.message_type)) {
            // Append new item directly instead of full refetch
            try {
              const newItem = parseMessage(payload.new);
              setPulseItems(prev => {
                // Dedupe check
                if (prev.some(p => p.id === newItem.id)) return prev;
                const updated = [newItem, ...prev].slice(0, 20);
                lastIdsRef.current = updated.map(p => p.id).join(',');
                onItemCountChange?.(updated.length);
                return updated;
              });
            } catch (e) {
              // Fallback to refetch if parsing fails
              fetchPulseItems();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [huddleId, parseMessage, fetchPulseItems, onItemCountChange]);

  const handleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="h-full overflow-y-auto px-4 pt-48 pb-[60vh] scrollbar-hide"
    >
      <AnimatePresence mode="popLayout">
        {pulseItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ 
              delay: index * 0.05,
              type: 'spring',
              stiffness: 300,
              damping: 25
            }}
            className="mb-4"
          >
            <PulseCard
              item={item}
              isExpanded={expandedId === item.id}
              onExpand={() => handleExpand(item.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      
      {/* Placeholder cards when empty */}
      {pulseItems.length === 0 && !isLoading && (
        <div className="space-y-4">
          <PlaceholderCard 
            icon={<Zap className="h-5 w-5" />}
            title="Pulse warming up..."
            subtitle="Fetching X + Reddit + YouTube content"
          />
          <PlaceholderCard 
            icon={<Play className="h-5 w-5" />}
            title="No clips yet"
            subtitle="Tap 'Drop Pulse' (admin) to fetch highlights"
          />
        </div>
      )}
      
      {isLoading && pulseItems.length === 0 && (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <p>Loading pulse feed...</p>
        </div>
      )}
    </div>
  );
});

// Placeholder card component
function PlaceholderCard({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="w-full bg-card/50 backdrop-blur-sm rounded-2xl border border-border/20 border-dashed p-6 text-center">
      <div className="flex justify-center mb-3 text-muted-foreground/50">
        {icon}
      </div>
      <h3 className="font-medium text-sm text-muted-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>
    </div>
  );
}

interface PulseCardProps {
  item: PulseItem;
  isExpanded: boolean;
  onExpand: () => void;
}

const PulseCard = memo(function PulseCard({ item, isExpanded, onExpand }: PulseCardProps) {
  const hasYouTubeVideo = !!item.video_id;
  const thumbnailUrl = hasYouTubeVideo 
    ? `https://img.youtube.com/vi/${item.video_id}/hqdefault.jpg`
    : item.thumbnail;

  const SourceIcon = () => {
    switch (item.type) {
      case 'x':
        return <Twitter className="h-3 w-3 text-sky-400" />;
      case 'reddit':
        return <MessageCircle className="h-3 w-3 text-orange-500" />;
      case 'youtube':
        return <Play className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <motion.button
      onClick={onExpand}
      className={cn(
        "w-full text-left bg-card/80 backdrop-blur-sm rounded-2xl border border-border/30",
        "shadow-lg shadow-primary/5 hover:shadow-primary/10 transition-all",
        "overflow-hidden",
        isExpanded && "ring-2 ring-primary/30"
      )}
      layout
    >
      {/* Compact View */}
      <div className="p-3 flex gap-3">
        {(thumbnailUrl || hasYouTubeVideo) && (
          <div className="relative w-24 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20" />
            )}
            {hasYouTubeVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
                  <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <SourceIcon />
            {item.author && (
              <span className="text-[10px] font-medium text-muted-foreground">
                @{item.author}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground/60 ml-auto">
              {timeAgo(item.created_at)}
            </span>
          </div>
          
          <h3 className="font-bold text-sm leading-tight line-clamp-2">
            {item.headline}
          </h3>
          {!isExpanded && item.body && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {item.body}
            </p>
          )}
        </div>
      </div>

      {/* Expanded View */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {hasYouTubeVideo && (
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${item.video_id}?playsinline=1&autoplay=1&mute=1`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            
            {item.body && (
              <div className="px-3 py-2">
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </div>
            )}
            
            {item.external_url && (
              <a
                href={item.external_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-3 py-2 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View source
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
});

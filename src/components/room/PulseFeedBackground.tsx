import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PulseItem {
  id: string;
  type: 'youtube' | 'grok' | 'reddit' | 'curated';
  headline: string;
  body?: string;
  thumbnail?: string;
  video_id?: string;
  external_url?: string;
  created_at: string;
  sponsor?: string;
}

interface PulseFeedBackgroundProps {
  huddleId: string;
  teamId: string;
  isLive: boolean;
}

export function PulseFeedBackground({ huddleId, teamId, isLive }: PulseFeedBackgroundProps) {
  const [pulseItems, setPulseItems] = useState<PulseItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch pulse items from huddle_messages with pulse types
  const fetchPulseItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('huddle_messages')
      .select('*')
      .eq('huddle_id', huddleId)
      .in('message_type', ['social_buzz', 'highlight', 'pulse'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching pulse items:', error);
      return;
    }

    const items: PulseItem[] = (data || []).map((msg: any) => {
      // Extract video ID from YouTube URLs
      const youtubeMatch = msg.media_url?.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      
      return {
        id: msg.id,
        type: msg.pulse_source === 'youtube' ? 'youtube' : 
              msg.pulse_source === 'grok' ? 'grok' :
              msg.pulse_source === 'reddit' ? 'reddit' : 'curated',
        headline: msg.content?.split('\n')[0] || 'Update',
        body: msg.content?.split('\n').slice(1).join('\n'),
        thumbnail: msg.media_url && !youtubeMatch ? msg.media_url : undefined,
        video_id: youtubeMatch?.[1],
        external_url: msg.embed_code,
        created_at: msg.created_at,
        sponsor: undefined
      };
    });

    setPulseItems(items);
  }, [huddleId]);

  useEffect(() => {
    fetchPulseItems();
    
    // Poll for new items - faster during live games
    const interval = setInterval(fetchPulseItems, isLive ? 30000 : 120000);
    
    return () => clearInterval(interval);
  }, [fetchPulseItems, isLive]);

  // Subscribe to realtime pulse updates
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
            fetchPulseItems();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [huddleId, fetchPulseItems]);

  const handleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div 
      ref={containerRef}
      className="h-full overflow-y-auto px-4 pt-20 pb-[50vh] scrollbar-hide"
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
      
      {pulseItems.length === 0 && (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <p>Waiting for pulse updates...</p>
        </div>
      )}
    </div>
  );
}

interface PulseCardProps {
  item: PulseItem;
  isExpanded: boolean;
  onExpand: () => void;
}

function PulseCard({ item, isExpanded, onExpand }: PulseCardProps) {
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
        {/* Thumbnail */}
        {(item.thumbnail || item.video_id) && (
          <div className="relative w-24 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
            {item.video_id ? (
              <>
                <img
                  src={`https://img.youtube.com/vi/${item.video_id}/mqdefault.jpg`}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="h-6 w-6 text-white fill-white" />
                </div>
              </>
            ) : item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 min-w-0">
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
            {/* YouTube Embed */}
            {item.video_id && (
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${item.video_id}?playsinline=1&autoplay=1&mute=1`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            
            {/* Full body text */}
            {item.body && (
              <div className="px-3 py-2">
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </div>
            )}
            
            {/* External link */}
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
            
            {/* Sponsor (very small, muted) */}
            {item.sponsor && (
              <div className="px-3 pb-2">
                <span className="text-[10px] text-muted-foreground/50">
                  Sponsored by {item.sponsor}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

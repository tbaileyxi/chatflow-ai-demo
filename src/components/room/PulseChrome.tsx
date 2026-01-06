import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Twitter, MessageCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface PulseMessage {
  id: string;
  content: string;
  created_at: string;
  pulse_source?: string;
  media_url?: string;
  embed_code?: string;
}

interface PulseChromeProps {
  huddleId: string;
  teamId?: string | null;
  isLive: boolean;
  className?: string;
}

export const PulseChrome = memo(function PulseChrome({ huddleId, teamId, isLive, className }: PulseChromeProps) {
  const [pulseItems, setPulseItems] = useState<PulseMessage[]>([]);
  const [showPulseOnly, setShowPulseOnly] = useState(false);
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const lastIdsRef = useRef('');
  const { toast } = useToast();

  // Fetch pulse messages
  const fetchPulse = useCallback(async () => {
    const { data, error } = await supabase
      .from('huddle_messages')
      .select('id, content, created_at, pulse_source, media_url, embed_code')
      .eq('huddle_id', huddleId)
      .eq('is_pulse_moment', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching pulse:', error);
      setIsLoading(false);
      return;
    }

    const newIds = (data || []).map(d => d.id).join(',');
    if (newIds !== lastIdsRef.current && lastIdsRef.current !== '') {
      setHasNewUpdates(true);
    }
    lastIdsRef.current = newIds;
    setPulseItems(data || []);
    setIsLoading(false);
  }, [huddleId]);

  // Initial fetch + polling
  useEffect(() => {
    fetchPulse();
    const intervalMs = isLive ? 60000 : 5 * 60 * 1000;
    const interval = setInterval(fetchPulse, intervalMs);
    return () => clearInterval(interval);
  }, [fetchPulse, isLive]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`pulse-chrome-${huddleId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'huddle_messages', filter: `huddle_id=eq.${huddleId}` },
        (payload) => {
          if (payload.new.is_pulse_moment) {
            setPulseItems(prev => {
              if (prev.some(p => p.id === payload.new.id)) return prev;
              setHasNewUpdates(true);
              return [payload.new as PulseMessage, ...prev].slice(0, 20);
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [huddleId]);

  const handleJumpToNew = () => {
    setHasNewUpdates(false);
    toast({ title: 'Pulse refreshed', description: 'Showing latest updates' });
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const SourceIcon = ({ source }: { source?: string }) => {
    if (source === 'x') return <Twitter className="h-3 w-3 text-sky-400" />;
    if (source === 'reddit') return <MessageCircle className="h-3 w-3 text-orange-500" />;
    return <Zap className="h-3 w-3 text-primary" />;
  };

  if (pulseItems.length === 0 && !isLoading) return null;

  return (
    <div className={cn('border-b border-border/30 bg-muted/20', className)}>
      {/* Pulse Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Pulse</span>
          {isLive && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 animate-pulse">
              LIVE
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn('text-xs h-6 px-2', showPulseOnly && 'bg-primary/20 text-primary')}
            onClick={() => setShowPulseOnly(!showPulseOnly)}
          >
            {showPulseOnly ? 'All' : 'Pulse only'}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchPulse}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <p className="px-4 pb-1 text-[10px] text-muted-foreground">What fans are talking about right now</p>

      {/* New updates toast */}
      <AnimatePresence>
        {hasNewUpdates && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 pb-2"
          >
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={handleJumpToNew}>
              New Pulse updates • Tap to jump
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pulse Cards Carousel */}
      <div className="flex overflow-x-auto gap-2 px-4 pb-3 scrollbar-hide">
        {isLoading && (
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-56 h-20 bg-muted/50 rounded-xl animate-pulse shrink-0" />
            ))}
          </div>
        )}
        {pulseItems.map(item => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-56 shrink-0 bg-card/80 backdrop-blur-sm rounded-xl border border-border/30 p-3 flex flex-col gap-1"
          >
            <div className="flex items-center gap-1.5">
              <SourceIcon source={item.pulse_source} />
              <span className="text-[10px] text-muted-foreground capitalize">{item.pulse_source || 'Pulse'}</span>
              <span className="text-[10px] text-muted-foreground/60 ml-auto">{timeAgo(item.created_at)}</span>
            </div>
            <p className="text-xs font-medium line-clamp-2 text-foreground">{item.content}</p>
            {item.media_url && (
              <a
                href={item.media_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-primary flex items-center gap-0.5 mt-auto"
              >
                <ExternalLink className="h-2.5 w-2.5" /> Open
              </a>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
});

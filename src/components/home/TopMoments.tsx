import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MessageSquare, Twitter, Globe } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface TopMoment {
  id: string;
  content: string;
  created_at: string;
  huddle_id: string;
  huddle_name: string;
  team_logo_url: string | null;
  source: 'bot' | 'x' | 'reddit' | 'user';
  is_bot_message: boolean;
}

export const TopMoments = () => {
  const navigate = useNavigate();
  const [moments, setMoments] = useState<TopMoment[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTopMoments = useCallback(async () => {
    try {
      // Fetch recent notable messages from public huddles
      // Priority: pulse moments, bot messages, or messages with replies
      const { data: messages, error } = await supabase
        .from('huddle_messages')
        .select(`
          id,
          content,
          created_at,
          huddle_id,
          is_bot_message,
          is_pulse_moment,
          pulse_source,
          message_type,
          huddles!inner (
            id,
            name,
            is_private,
            is_official_team_huddle,
            teams!team_id (
              name,
              logo_url
            )
          )
        `)
        .or('is_pulse_moment.eq.true,is_bot_message.eq.true,message_type.eq.pulse')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Filter to public huddles only and transform
      const publicMoments = (messages || [])
        .filter((m: any) => !m.huddles?.is_private || m.huddles?.is_official_team_huddle)
        .slice(0, 6) // Get top 6 for rotation
        .map((m: any) => {
          let source: TopMoment['source'] = 'bot';
          if (m.pulse_source === 'x') source = 'x';
          else if (m.pulse_source === 'reddit') source = 'reddit';
          else if (!m.is_bot_message) source = 'user';

          return {
            id: m.id,
            content: m.content,
            created_at: m.created_at,
            huddle_id: m.huddle_id,
            huddle_name: m.huddles?.teams?.name || m.huddles?.name || 'Huddle',
            team_logo_url: m.huddles?.teams?.logo_url || null,
            source,
            is_bot_message: m.is_bot_message
          };
        });

      setMoments(publicMoments);
    } catch (error) {
      console.error('Error fetching top moments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopMoments();
    // Refresh every 2 minutes
    const interval = setInterval(fetchTopMoments, 120000);
    return () => clearInterval(interval);
  }, [fetchTopMoments]);

  // Auto-rotate every 6-8 seconds
  useEffect(() => {
    if (moments.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % Math.min(moments.length, 3));
    }, 7000);
    return () => clearInterval(interval);
  }, [moments.length]);

  const handleMomentClick = (moment: TopMoment) => {
    // Navigate to huddle and scroll to message
    navigate(`/huddle/${moment.huddle_id}?scrollTo=${moment.id}`);
  };

  const getSourceIcon = (source: TopMoment['source']) => {
    switch (source) {
      case 'x':
        return <Twitter className="h-3 w-3" />;
      case 'reddit':
        return <Globe className="h-3 w-3" />;
      default:
        return <MessageSquare className="h-3 w-3" />;
    }
  };

  const getSourceLabel = (source: TopMoment['source']) => {
    switch (source) {
      case 'x':
        return 'X';
      case 'reddit':
        return 'Reddit';
      case 'bot':
        return 'Bot';
      default:
        return 'Fan';
    }
  };

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Top Moments</h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (moments.length === 0) {
    return null; // Don't show empty state
  }

  // Show max 3 cards
  const visibleMoments = moments.slice(0, 3);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Top Moments</h2>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {visibleMoments.map((moment, index) => (
            <motion.button
              key={moment.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                scale: index === activeIndex ? 1 : 0.98
              }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              onClick={() => handleMomentClick(moment)}
              className={cn(
                "w-full text-left rounded-xl p-4 border transition-all",
                index === activeIndex 
                  ? "bg-primary/10 border-primary/30 shadow-lg" 
                  : "bg-card border-border/50 hover:border-primary/30"
              )}
            >
              <div className="flex gap-3">
                {/* Team Avatar */}
                <Avatar className="h-10 w-10 ring-2 ring-border/30 flex-shrink-0">
                  <AvatarImage src={moment.team_logo_url || undefined} alt={moment.huddle_name} />
                  <AvatarFallback className="text-xs bg-muted">
                    {moment.huddle_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0 space-y-1">
                  {/* Header: Team + Source + Time */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{moment.huddle_name}</span>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] gap-1">
                      {getSourceIcon(moment.source)}
                      {getSourceLabel(moment.source)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(moment.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Message Preview - chat bubble style */}
                  <div className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    moment.is_bot_message 
                      ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-foreground" 
                      : "bg-muted/50 text-foreground"
                  )}>
                    <p className="line-clamp-2">{moment.content}</p>
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* Rotation indicators */}
      {moments.length > 1 && (
        <div className="flex justify-center gap-1.5 pt-1">
          {visibleMoments.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === activeIndex 
                  ? "w-4 bg-primary" 
                  : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
};

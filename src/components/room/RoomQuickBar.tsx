import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface RoomQuickBarProps {
  onReaction: (emoji: string) => void;
  huddleId: string;
  lastMessageId: string | null;
}

const QUICK_EMOJIS = ['🔥', '😤', '🤯'];

export function RoomQuickBar({ onReaction, huddleId, lastMessageId }: RoomQuickBarProps) {
  const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  let burstId = 0;

  // Fetch reaction counts for the last message
  useEffect(() => {
    if (!lastMessageId) return;

    const fetchCounts = async () => {
      const { data } = await supabase
        .from('huddle_message_reactions')
        .select('emoji')
        .eq('message_id', lastMessageId);

      if (data) {
        const counts: Record<string, number> = {};
        QUICK_EMOJIS.forEach(e => counts[e] = 0);
        data.forEach(r => {
          if (QUICK_EMOJIS.includes(r.emoji)) {
            counts[r.emoji] = (counts[r.emoji] || 0) + 1;
          }
        });
        setReactionCounts(counts);
      }
    };

    fetchCounts();

    // Subscribe to realtime reaction updates
    const channel = supabase
      .channel(`reactions-${lastMessageId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'huddle_message_reactions',
          filter: `message_id=eq.${lastMessageId}`
        },
        (payload) => {
          const emoji = payload.new.emoji;
          if (QUICK_EMOJIS.includes(emoji)) {
            setReactionCounts(prev => ({
              ...prev,
              [emoji]: (prev[emoji] || 0) + 1
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lastMessageId]);

  const handleTap = (emoji: string, event: React.MouseEvent<HTMLButtonElement>) => {
    onReaction(emoji);
    
    // Optimistic increment
    setReactionCounts(prev => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1
    }));
    
    // Create burst animation
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    
    const newBurst = { id: burstId++, emoji, x };
    setBursts(prev => [...prev, newBurst]);
    
    // Remove burst after animation
    setTimeout(() => {
      setBursts(prev => prev.filter(b => b.id !== newBurst.id));
    }, 1000);
  };

  return (
    <>
      {/* Burst Animations */}
      <AnimatePresence>
        {bursts.map(burst => (
          <motion.div
            key={burst.id}
            initial={{ 
              opacity: 1, 
              y: window.innerHeight - 120,
              x: burst.x - 20,
              scale: 1
            }}
            animate={{ 
              opacity: 0, 
              y: window.innerHeight - 300,
              scale: 1.5
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="fixed z-[100] text-4xl pointer-events-none"
          >
            {burst.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Quick Bar - Fixed at absolute bottom with safe area */}
      <div 
        className="fixed left-0 right-0 z-[60]"
        style={{ 
          bottom: 0,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        {/* Reaction Counters */}
        <div className="flex justify-center gap-8 pb-1">
          {QUICK_EMOJIS.map((emoji) => {
            const count = reactionCounts[emoji] || 0;
            return count > 0 ? (
              <motion.div
                key={`count-${emoji}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-xs font-bold text-muted-foreground"
              >
                {emoji} {count}
              </motion.div>
            ) : null;
          })}
        </div>

        <div className="flex justify-center gap-6 py-3 px-6 bg-background/95 backdrop-blur-md border-t border-border/30">
          {QUICK_EMOJIS.map((emoji) => (
            <motion.button
              key={emoji}
              onClick={(e) => handleTap(emoji, e)}
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.1 }}
              className={cn(
                "w-14 h-14 rounded-full",
                "bg-card border-2 border-border/50",
                "flex items-center justify-center",
                "text-3xl",
                "shadow-lg shadow-black/10",
                "hover:border-primary/50 transition-colors",
                "active:bg-primary/10"
              )}
            >
              {emoji}
            </motion.button>
          ))}
        </div>
      </div>
    </>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface RoomQuickBarProps {
  onReaction: (emoji: string) => void;
  huddleId: string;
  selectedTargetId: string | null;
}

const QUICK_EMOJIS = ['🔥', '😤', '🤯', '😂', '💀'];

export function RoomQuickBar({ onReaction, huddleId, selectedTargetId }: RoomQuickBarProps) {
  const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  let burstId = 0;

  // Fetch reaction counts for the selected target
  useEffect(() => {
    if (!selectedTargetId) {
      setReactionCounts({});
      return;
    }

    const fetchCounts = async () => {
      const { data } = await supabase
        .from('huddle_message_reactions')
        .select('emoji')
        .eq('message_id', selectedTargetId);

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
      .channel(`reactions-${selectedTargetId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'huddle_message_reactions',
          filter: `message_id=eq.${selectedTargetId}`
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
  }, [selectedTargetId]);

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

  // Check if any emoji has reactions
  const hasAnyReactions = Object.values(reactionCounts).some(c => c > 0);

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
        {/* Reaction Counters (shown above buttons when there are reactions) */}
        {hasAnyReactions && (
          <div className="flex justify-center gap-6 pb-1 px-6">
            {QUICK_EMOJIS.map((emoji) => {
              const count = reactionCounts[emoji] || 0;
              return count > 0 ? (
                <motion.div
                  key={`count-${emoji}`}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xs font-bold text-muted-foreground min-w-[40px] text-center"
                >
                  {emoji} {count}
                </motion.div>
              ) : (
                <div key={`count-${emoji}`} className="min-w-[40px]" />
              );
            })}
          </div>
        )}

        <div className="flex justify-center gap-4 py-3 px-6 bg-background/95 backdrop-blur-md border-t border-border/30">
          {QUICK_EMOJIS.map((emoji) => (
            <motion.button
              key={emoji}
              onClick={(e) => handleTap(emoji, e)}
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.1 }}
              disabled={!selectedTargetId}
              className={cn(
                "w-12 h-12 rounded-full",
                "bg-card border-2 border-border/50",
                "flex items-center justify-center",
                "text-2xl",
                "shadow-lg shadow-black/10",
                "hover:border-primary/50 transition-colors",
                "active:bg-primary/10",
                "disabled:opacity-50 disabled:cursor-not-allowed"
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

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Camera, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmotionBarProps {
  onReaction: (emoji: string, messageId?: string) => void;
  onVoice?: () => void;
  onCamera?: () => void;
  onBoost?: () => void;
  lastMessageId?: string;
  className?: string;
}

const EMOTIONS = ['🔥', '😤', '🤯', '😂', '💀'] as const;

interface BurstEmoji {
  id: number;
  emoji: string;
  x: number;
  y: number;
}

export const EmotionBar: React.FC<EmotionBarProps> = ({
  onReaction,
  onVoice,
  onCamera,
  onBoost,
  lastMessageId,
  className
}) => {
  const [bursts, setBursts] = useState<BurstEmoji[]>([]);
  const burstIdRef = useRef(0);
  const tapCountRef = useRef<Map<string, number>>(new Map());
  const tapTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const handleEmojiTap = useCallback((emoji: string, event: React.MouseEvent | React.TouchEvent) => {
    // Get position for burst animation
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;

    // Track rapid taps for burst effect
    const currentCount = (tapCountRef.current.get(emoji) || 0) + 1;
    tapCountRef.current.set(emoji, currentCount);

    // Clear existing timeout for this emoji
    const existingTimeout = tapTimeoutRef.current.get(emoji);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Reset count after 500ms of no taps
    const timeout = setTimeout(() => {
      tapCountRef.current.set(emoji, 0);
    }, 500);
    tapTimeoutRef.current.set(emoji, timeout);

    // Create burst particles based on tap count
    const particleCount = Math.min(currentCount, 5);
    const newBursts: BurstEmoji[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      newBursts.push({
        id: ++burstIdRef.current,
        emoji,
        x: x + (Math.random() - 0.5) * 40,
        y: y
      });
    }

    setBursts(prev => [...prev, ...newBursts]);

    // Remove bursts after animation
    setTimeout(() => {
      setBursts(prev => prev.filter(b => !newBursts.some(nb => nb.id === b.id)));
    }, 1000);

    // Trigger reaction
    onReaction(emoji, lastMessageId);
  }, [onReaction, lastMessageId]);

  return (
    <>
      {/* Burst animations - rendered at root level for proper positioning */}
      <AnimatePresence>
        {bursts.map(burst => (
          <motion.div
            key={burst.id}
            initial={{ 
              x: burst.x, 
              y: burst.y, 
              scale: 0.5, 
              opacity: 1 
            }}
            animate={{ 
              y: burst.y - 100 - Math.random() * 50, 
              x: burst.x + (Math.random() - 0.5) * 60,
              scale: 1.2, 
              opacity: 0,
              rotate: (Math.random() - 0.5) * 30
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="fixed pointer-events-none text-2xl z-50"
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            {burst.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Main bar */}
      <div className={cn(
        "flex items-center justify-between gap-1 px-2 py-1.5",
        "bg-background/80 backdrop-blur-md border-t border-team-primary/20",
        className
      )}>
        {/* Emoji reactions - left side */}
        <div className="flex items-center gap-0.5">
          {EMOTIONS.map((emoji) => (
            <motion.button
              key={emoji}
              onClick={(e) => handleEmojiTap(emoji, e)}
              className={cn(
                "h-11 w-11 flex items-center justify-center rounded-full",
                "text-xl active:scale-90 transition-transform",
                "hover:bg-team-primary/10 active:bg-team-primary/20"
              )}
              whileTap={{ scale: 0.85 }}
            >
              {emoji}
            </motion.button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-team-primary/20" />

        {/* Action buttons - right side */}
        <div className="flex items-center gap-1">
          {/* Voice */}
          {onVoice && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onVoice}
              className="h-10 w-10 rounded-full hover:bg-team-primary/10"
            >
              <Mic className="h-5 w-5 text-muted-foreground" />
            </Button>
          )}

          {/* Camera */}
          {onCamera && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCamera}
              className="h-10 w-10 rounded-full hover:bg-team-primary/10"
            >
              <Camera className="h-5 w-5 text-muted-foreground" />
            </Button>
          )}

          {/* Boost */}
          {onBoost && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBoost}
              className="h-10 w-10 rounded-full hover:bg-yellow-500/20 text-yellow-500"
            >
              <Zap className="h-5 w-5 fill-current" />
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

EmotionBar.displayName = 'EmotionBar';

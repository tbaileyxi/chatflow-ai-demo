import React, { useState } from 'react';
import { Flame, ThumbsUp, Zap, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface QuickReactionBarProps {
  huddleId: string;
  isVisible: boolean;
}

interface ReactionBurst {
  id: string;
  emoji: string;
  x: number;
}

const REACTIONS = [
  { emoji: '🔥', icon: Flame, label: 'Fire' },
  { emoji: '💪', icon: ThumbsUp, label: 'Strong' },
  { emoji: '⚡', icon: Zap, label: 'Electric' },
  { emoji: '🎉', icon: PartyPopper, label: 'Celebrate' },
];

export const QuickReactionBar: React.FC<QuickReactionBarProps> = ({
  huddleId,
  isVisible,
}) => {
  const { user } = useAuth();
  const [bursts, setBursts] = useState<ReactionBurst[]>([]);
  const [cooldowns, setCooldowns] = useState<Record<string, boolean>>({});

  const handleReaction = async (emoji: string) => {
    if (!user || cooldowns[emoji]) return;

    // Create visual burst
    const burstId = `${Date.now()}-${Math.random()}`;
    const newBurst: ReactionBurst = {
      id: burstId,
      emoji,
      x: Math.random() * 80 + 10, // Random position 10-90%
    };
    
    setBursts(prev => [...prev, newBurst]);
    
    // Remove burst after animation
    setTimeout(() => {
      setBursts(prev => prev.filter(b => b.id !== burstId));
    }, 1500);

    // Set cooldown
    setCooldowns(prev => ({ ...prev, [emoji]: true }));
    setTimeout(() => {
      setCooldowns(prev => ({ ...prev, [emoji]: false }));
    }, 1000);

    // Post to huddle (lightweight reaction message)
    try {
      await supabase.from('huddle_messages').insert({
        huddle_id: huddleId,
        user_id: user.id,
        content: emoji,
        message_type: 'quick_reaction',
      });
    } catch (error) {
      console.error('Error posting reaction:', error);
    }
  };

  const handleThis = async () => {
    if (!user || cooldowns['this']) return;

    setCooldowns(prev => ({ ...prev, ['this']: true }));
    
    // Create multiple bursts for "This!"
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const burstId = `${Date.now()}-${Math.random()}`;
        setBursts(prev => [...prev, {
          id: burstId,
          emoji: '🙌',
          x: 30 + Math.random() * 40,
        }]);
        
        setTimeout(() => {
          setBursts(prev => prev.filter(b => b.id !== burstId));
        }, 1500);
      }, i * 100);
    }

    setTimeout(() => {
      setCooldowns(prev => ({ ...prev, ['this']: false }));
    }, 2000);

    try {
      await supabase.from('huddle_messages').insert({
        huddle_id: huddleId,
        user_id: user.id,
        content: '🙌 THIS!',
        message_type: 'quick_reaction',
      });
    } catch (error) {
      console.error('Error posting reaction:', error);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="relative">
      {/* Floating reaction bursts */}
      <div className="absolute inset-x-0 bottom-full h-32 pointer-events-none overflow-hidden">
        {bursts.map((burst) => (
          <div
            key={burst.id}
            className="absolute animate-float-up text-3xl"
            style={{ left: `${burst.x}%`, bottom: 0 }}
          >
            {burst.emoji}
          </div>
        ))}
      </div>

      {/* Reaction bar */}
      <div className="flex items-center justify-center gap-2 py-2 px-4 bg-zinc-900/90 backdrop-blur-sm border-t border-zinc-700/50">
        {REACTIONS.map(({ emoji, label }) => (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            disabled={cooldowns[emoji]}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-xl",
              "bg-zinc-800 hover:bg-zinc-700 active:scale-90 transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              cooldowns[emoji] && "scale-110"
            )}
            title={label}
          >
            {emoji}
          </button>
        ))}
        
        {/* THIS! button */}
        <button
          onClick={handleThis}
          disabled={cooldowns['this']}
          className={cn(
            "px-4 py-2 rounded-full font-bold text-sm",
            "bg-primary text-primary-foreground",
            "hover:bg-primary/90 active:scale-95 transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            cooldowns['this'] && "animate-pulse"
          )}
        >
          THIS! 🙌
        </button>
      </div>
    </div>
  );
};

// Add animation to global CSS
const floatUpStyle = `
@keyframes float-up {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-100px) scale(1.5);
  }
}

.animate-float-up {
  animation: float-up 1.5s ease-out forwards;
}
`;

// Inject style if not exists
if (typeof document !== 'undefined' && !document.querySelector('#game-pulse-styles')) {
  const style = document.createElement('style');
  style.id = 'game-pulse-styles';
  style.textContent = floatUpStyle;
  document.head.appendChild(style);
}

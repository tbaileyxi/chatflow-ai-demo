import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Flame, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BoostButtonProps {
  messageId: string;
  currentBoost?: number;
  onBoostComplete?: (amount: number) => void;
  className?: string;
}

const BOOST_TIERS = [1, 2, 3, 5] as const;

export const BoostButton = ({
  messageId,
  currentBoost = 0,
  onBoostComplete,
  className,
}: BoostButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  const handleBoost = async (amount: typeof BOOST_TIERS[number]) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "You need to be signed in to boost messages",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setSelectedAmount(amount);

    try {
      // Call Stripe checkout edge function
      const { data, error } = await supabase.functions.invoke('create-boost-checkout', {
        body: {
          message_id: messageId,
          amount,
          user_id: user.id,
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        // Direct boost (for testing/free tier)
        toast({
          title: "Boost sent! 🔥",
          description: `You boosted this message with $${amount}`,
        });
        onBoostComplete?.(amount);
        setOpen(false);
      }
    } catch (error) {
      console.error('Boost error:', error);
      toast({
        title: "Boost failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setSelectedAmount(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-1.5 transition-all",
            currentBoost > 0 
              ? "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10" 
              : "text-muted-foreground hover:text-foreground",
            className
          )}
        >
          <Flame className={cn(
            "w-4 h-4 transition-all",
            currentBoost > 0 && "fill-yellow-400"
          )} />
          {currentBoost > 0 && (
            <span className="text-xs font-bold">+${currentBoost}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-2 bg-background/95 backdrop-blur-sm border-primary/20"
        side="top"
        align="center"
      >
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground text-center px-2">
            Boost this message 🔥
          </p>
          <div className="flex gap-1">
            {BOOST_TIERS.map((amount) => (
              <motion.div
                key={amount}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBoost(amount)}
                  disabled={loading}
                  className={cn(
                    "h-10 w-12 font-bold transition-all",
                    "border-yellow-500/30 hover:border-yellow-400 hover:bg-yellow-400/10",
                    selectedAmount === amount && loading && "opacity-50"
                  )}
                >
                  <DollarSign className="w-3 h-3 -mr-0.5" />
                  {amount}
                </Button>
              </motion.div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Boosted messages glow & pin briefly
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

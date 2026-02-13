import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Star, Coins, BarChart3, Shield, Users, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PremiumUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PremiumUpgradeModal({ open, onOpenChange }: PremiumUpgradeModalProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-premium-checkout');
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start checkout');
      setLoading(false);
    }
  };

  const features = [
    { icon: Coins, text: 'Never run out of chips (100¢ minimum)' },
    { icon: Star, text: 'Start with 1,500¢' },
    { icon: BarChart3, text: 'Full analytics & leaderboards' },
    { icon: Shield, text: 'Premium badge in all chats' },
    { icon: Users, text: 'Unlimited private huddles' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-black">
            Out of Chips! 🎰
          </DialogTitle>
        </DialogHeader>

        <p className="text-center text-sm text-muted-foreground">
          You've run out of chips. Upgrade to Premium to:
        </p>

        <div className="space-y-3 my-4">
          {features.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm">
              <Icon className="h-4 w-4 text-yellow-500 shrink-0" />
              <span>{text}</span>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-2xl font-black text-foreground">$5<span className="text-sm font-normal text-muted-foreground">/month</span></p>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <Button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-black font-bold"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Star className="h-4 w-4 mr-2 fill-current" />}
            Upgrade to Premium
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground"
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

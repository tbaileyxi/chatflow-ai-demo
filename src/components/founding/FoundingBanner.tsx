import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Trophy, Gift, X } from 'lucide-react';
import { useFoundingCounts } from '@/hooks/useFoundingCounts';
import { useFoundingStatus } from '@/hooks/useFoundingStatus';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function FoundingBanner() {
  const { user } = useAuth();
  const { charterRemaining, foundingRemaining, isExpired, isSoldOut, loading: countsLoading } = useFoundingCounts();
  const { isFoundingMember, foundingTier, spotNumber, loading: statusLoading } = useFoundingStatus();
  const [checkoutLoading, setCheckoutLoading] = useState<'charter' | 'founding' | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (user?.id) {
      return localStorage.getItem(`sh_founding_banner_hidden_${user.id}`) === 'true';
    }
    return false;
  });

  const handleDismiss = () => {
    if (user?.id) {
      localStorage.setItem(`sh_founding_banner_hidden_${user.id}`, 'true');
    }
    setDismissed(true);
  };

  const handleCheckout = async (tier: 'charter' | 'founding') => {
    if (!user?.id) {
      toast.error('Please sign in first');
      return;
    }

    setCheckoutLoading(tier);
    try {
      const { data, error } = await supabase.functions.invoke('create-founding-checkout', {
        body: { tier, userId: user.id },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error(err.message || 'Failed to start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  };

  // Loading state
  if (countsLoading || statusLoading) {
    return null;
  }

  // Already a founding member - show success banner
  if (isFoundingMember && spotNumber) {
    const tierLabel = foundingTier === 'charter' ? 'Platinum Charter' : 'Gold Founding';
    const tierColor = foundingTier === 'charter' ? 'text-[#C0C0C0]' : 'text-[#FFD700]';
    
    return (
      <div className="bg-gradient-to-r from-muted/80 to-muted/40 border border-border rounded-lg p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <Trophy className={`w-5 h-5 ${tierColor}`} />
          </div>
          <div>
            <p className={`font-bold ${tierColor}`}>
              {tierLabel} Member 2025
            </p>
            <p className="text-sm text-muted-foreground">
              Spot #{spotNumber} locked in forever
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Don't show purchase banner if expired, sold out, or dismissed
  if (isExpired || isSoldOut || dismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/5 border border-yellow-500/30 rounded-lg p-4 mb-4 relative">
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="space-y-4">
        {/* Header */}
        <div>
          <h3 className="font-bold text-foreground">Become a Founding Member</h3>
          <p className="text-sm text-muted-foreground">
            Only 300 spots available in 2025
          </p>
        </div>

        {/* Counters */}
        <div className="flex gap-4 text-sm">
          <div>
            <span className="font-bold text-[#C0C0C0]">{charterRemaining}</span>
            <span className="text-muted-foreground"> Platinum left</span>
          </div>
          <div>
            <span className="font-bold text-[#FFD700]">{foundingRemaining}</span>
            <span className="text-muted-foreground"> Gold left</span>
          </div>
        </div>

        {/* Benefits */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-muted/50 px-2 py-1 rounded-full flex items-center gap-1">
            <Check className="w-3 h-3 text-yellow-500" /> Verified badge
          </span>
          <span className="bg-muted/50 px-2 py-1 rounded-full flex items-center gap-1">
            <Gift className="w-3 h-3 text-yellow-500" /> Free Verified Huddle
          </span>
        </div>

        {/* CTAs */}
        <div className="flex gap-2">
          <Button
            onClick={() => handleCheckout('charter')}
            disabled={checkoutLoading !== null || charterRemaining === 0}
            size="sm"
            className="flex-1 bg-gradient-to-r from-[#C0C0C0] to-[#E8E8E8] text-black hover:opacity-90"
          >
            {checkoutLoading === 'charter' ? '...' : charterRemaining === 0 ? 'Sold Out' : '$49 Platinum'}
          </Button>
          <Button
            onClick={() => handleCheckout('founding')}
            disabled={checkoutLoading !== null || foundingRemaining === 0}
            size="sm"
            className="flex-1 bg-gradient-to-r from-[#FFD700] to-[#FFC000] text-black hover:opacity-90"
          >
            {checkoutLoading === 'founding' ? '...' : foundingRemaining === 0 ? 'Sold Out' : '$29 Gold'}
          </Button>
        </div>
      </div>
    </div>
  );
}

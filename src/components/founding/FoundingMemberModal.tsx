import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Trophy, Gift, Shield, X } from 'lucide-react';
import { useFoundingCounts } from '@/hooks/useFoundingCounts';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FoundingMemberModalProps {
  open: boolean;
  onClose: () => void;
}

export function FoundingMemberModal({ open, onClose }: FoundingMemberModalProps) {
  const { user } = useAuth();
  const { charterRemaining, foundingRemaining, isExpired, isSoldOut, loading } = useFoundingCounts();
  const [checkoutLoading, setCheckoutLoading] = useState<'charter' | 'founding' | null>(null);

  const handleDismissForever = () => {
    if (user?.id) {
      localStorage.setItem(`sh_founding_dismissed_${user.id}`, 'true');
    }
    onClose();
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

  // Don't show if expired or sold out
  if (isExpired || isSoldOut) {
    return null;
  }

  const benefits = [
    { icon: Check, text: 'Blue verified checkmark on all your messages forever' },
    { icon: Trophy, text: 'Exclusive founding member badge on your avatar' },
    { icon: Gift, text: 'Free lifetime Verified Huddle ($49/year value)' },
    { icon: Shield, text: 'Exclusive merch drop access' },
  ];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md bg-background border-none p-0 gap-0 max-h-[90vh] overflow-y-auto" hideCloseButton>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              Only 300 people will ever get this in 2025
            </h2>
            <p className="text-muted-foreground text-sm">
              Become a Founding Member and get exclusive perks forever.
            </p>
          </div>

          {/* Live Counters */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center border border-[#C0C0C0]/30">
              <div className="text-3xl font-bold text-[#C0C0C0]">
                {loading ? '...' : charterRemaining}
              </div>
              <div className="text-xs text-muted-foreground">Platinum spots left</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center border border-[#FFD700]/30">
              <div className="text-3xl font-bold text-[#FFD700]">
                {loading ? '...' : foundingRemaining}
              </div>
              <div className="text-xs text-muted-foreground">Gold spots left</div>
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-3">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <benefit.icon className="w-4 h-4 text-yellow-500" />
                </div>
                <span className="text-sm text-foreground">{benefit.text}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="space-y-3">
            <Button
              onClick={() => handleCheckout('charter')}
              disabled={checkoutLoading !== null || charterRemaining === 0}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-[#C0C0C0] to-[#E8E8E8] text-black hover:opacity-90"
            >
              {checkoutLoading === 'charter' ? (
                'Loading...'
              ) : charterRemaining === 0 ? (
                'Sold Out'
              ) : (
                <>
                  <Trophy className="w-5 h-5 mr-2" />
                  $49 – Platinum Charter Member
                </>
              )}
            </Button>

            <Button
              onClick={() => handleCheckout('founding')}
              disabled={checkoutLoading !== null || foundingRemaining === 0}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-[#FFD700] to-[#FFC000] text-black hover:opacity-90"
            >
              {checkoutLoading === 'founding' ? (
                'Loading...'
              ) : foundingRemaining === 0 ? (
                'Sold Out'
              ) : (
                <>
                  <Gift className="w-5 h-5 mr-2" />
                  $29 – Gold Founding Member
                </>
              )}
            </Button>
          </div>

          {/* Dismiss Link */}
          <button
            onClick={handleDismissForever}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Maybe later →
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Check, Loader2, ExternalLink } from 'lucide-react';
import { usePremium } from '@/hooks/usePremium';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function PremiumSettingsCard() {
  const { isPremium, premiumSince, loading: premiumLoading } = usePremium();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-premium-checkout');
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || 'Failed to start checkout');
      setCheckoutLoading(false);
    }
  };

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-premium-portal');
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || 'Failed to open portal');
      setPortalLoading(false);
    }
  };

  if (premiumLoading) return null;

  if (isPremium) {
    return (
      <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-amber-500/5">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            <h3 className="font-bold text-lg">Premium Member</h3>
          </div>
          {premiumSince && (
            <p className="text-sm text-muted-foreground mb-4">
              Member since {format(new Date(premiumSince), 'MMMM d, yyyy')}
            </p>
          )}
          <Button onClick={handleManage} disabled={portalLoading} variant="outline" className="w-full">
            {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
            Manage Subscription
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Free user: feature comparison
  const features = [
    { feature: 'Starting Chips', free: '1,000¢', premium: '1,500¢' },
    { feature: 'Chip Floor', free: '0¢ (locked out)', premium: '100¢ (never locked)' },
    { feature: 'Bet History', free: '30 days', premium: 'All-time' },
    { feature: 'Leaderboard', free: 'Top 10', premium: 'Full + Compare' },
    { feature: 'Private Huddles', free: 'Max 2', premium: 'Unlimited' },
    { feature: 'Premium Badge', free: '—', premium: '⭐ PRO' },
    { feature: 'Analytics', free: '—', premium: 'Full' },
  ];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Star className="h-5 w-5 text-yellow-500" />
          <h3 className="font-bold text-lg">Upgrade to Premium</h3>
        </div>

        <div className="space-y-2 mb-4">
          {features.map(({ feature, free, premium }) => (
            <div key={feature} className="grid grid-cols-3 text-xs gap-2">
              <span className="text-muted-foreground">{feature}</span>
              <span className="text-center">{free}</span>
              <span className="text-center font-semibold text-yellow-500">{premium}</span>
            </div>
          ))}
        </div>

        <div className="text-center mb-3">
          <span className="text-2xl font-black">$5</span>
          <span className="text-sm text-muted-foreground">/month</span>
        </div>

        <Button onClick={handleUpgrade} disabled={checkoutLoading} className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-black font-bold">
          {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Star className="h-4 w-4 mr-2 fill-current" />}
          Upgrade to Premium
        </Button>
      </CardContent>
    </Card>
  );
}

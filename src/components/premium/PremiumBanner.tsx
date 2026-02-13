import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Star, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PremiumBannerProps {
  className?: string;
}

export function PremiumBanner({ className }: PremiumBannerProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-premium-checkout');
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || 'Failed to start checkout');
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      "flex items-center justify-between gap-3 p-3 rounded-lg",
      "bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20",
      className
    )}>
      <div className="flex items-center gap-2 text-sm">
        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />
        <span className="text-foreground font-medium">Upgrade to Premium to keep playing</span>
      </div>
      <Button
        size="sm"
        onClick={handleUpgrade}
        disabled={loading}
        className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold shrink-0"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Upgrade'}
      </Button>
    </div>
  );
}

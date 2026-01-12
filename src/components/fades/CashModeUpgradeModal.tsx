import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap, DollarSign, Lock, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface CashModeUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CashModeUpgradeModal: React.FC<CashModeUpgradeModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!user) {
      toast({ title: 'Sign in required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-cashmode-checkout', {
        body: {
          userId: user.id,
          returnUrl: window.location.href,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Zap className="h-6 w-6 text-amber-400" />
            Unlock Cash Mode
          </DialogTitle>
          <DialogDescription>
            Take your fades to the next level
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
            <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Venmo Settlement</p>
              <p className="text-sm text-muted-foreground">Deep-link to Venmo with prefilled amounts</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/30">
            <DollarSign className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Higher Stakes</p>
              <p className="text-sm text-muted-foreground">Up to $200 per fade in private huddles</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
            <Lock className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Cash Mode Badge</p>
              <p className="text-sm text-muted-foreground">Show off your premium status</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Upgrade for $9.99/month
              </>
            )}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

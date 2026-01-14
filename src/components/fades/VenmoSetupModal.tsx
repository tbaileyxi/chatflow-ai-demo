import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Check, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface VenmoSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export const VenmoSetupModal: React.FC<VenmoSetupModalProps> = ({
  open,
  onOpenChange,
  onComplete
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [venmoUsername, setVenmoUsername] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !venmoUsername.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('cash_mode_subscriptions')
        .update({ venmo_username: venmoUsername.trim() })
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (error) throw error;

      toast({
        title: '🎉 Cash Mode Activated!',
        description: 'Your Venmo handle is saved. You can now settle fades with friends.',
      });

      onComplete?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to save Venmo username',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    toast({
      title: 'Cash Mode Active',
      description: 'You can add your Venmo handle later in Settings.',
    });
    onComplete?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Cash Mode Activated! 🎉</DialogTitle>
              <DialogDescription className="text-sm">
                Set up your Venmo for easy settlement
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Benefits reminder */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>Higher stakes up to $200 in private huddles</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>Venmo deep-linking for quick settlement</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>Two-way payment confirmation</span>
            </div>
          </div>

          {/* Venmo input */}
          <div className="space-y-2">
            <Label htmlFor="venmo">Your Venmo Username</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">@</span>
              <Input
                id="venmo"
                placeholder="yourvenmo"
                value={venmoUsername}
                onChange={(e) => setVenmoUsername(e.target.value.replace('@', ''))}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This allows friends to settle bets directly via Venmo
            </p>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground text-center">
            Side Huddle does not transfer or process any money. Cash Mode simply tracks bets and provides settlement tools between friends.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            className="flex-1"
          >
            Skip for now
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !venmoUsername.trim()}
            className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
          >
            {saving ? (
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <DollarSign className="h-4 w-4 mr-1" />
                Save
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

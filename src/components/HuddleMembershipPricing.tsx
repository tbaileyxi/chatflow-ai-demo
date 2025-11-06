import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, Save } from 'lucide-react';

interface HuddleMembershipPricingProps {
  huddleId: string;
  isOwner: boolean;
}

interface PricingSettings {
  id?: string;
  price_per_month: number;
  is_enabled: boolean;
}

export const HuddleMembershipPricing = ({ huddleId, isOwner }: HuddleMembershipPricingProps) => {
  const [settings, setSettings] = useState<PricingSettings>({
    price_per_month: 199, // Default $1.99
    is_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, [huddleId]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('huddle_pricing')
        .select('*')
        .eq('huddle_id', huddleId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching pricing settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!isOwner) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('huddle_pricing')
        .upsert({
          huddle_id: huddleId,
          price_per_month: settings.price_per_month,
          is_enabled: settings.is_enabled,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'huddle_id' });

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Membership pricing settings have been updated.",
      });
    } catch (error: any) {
      console.error('Error saving pricing settings:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const handlePriceChange = (value: string) => {
    const dollars = parseFloat(value) || 0;
    const cents = Math.round(dollars * 100);
    setSettings(prev => ({ ...prev, price_per_month: cents }));
  };

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <DollarSign className="w-5 h-5" />
            Membership Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <DollarSign className="w-5 h-5" />
          Member Subscription Pricing
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Set how much members pay to join your verified huddle (separate from verification cost)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isOwner && (
          <div className="text-sm text-muted-foreground p-3 bg-muted/20 rounded-lg">
            Only huddle owners can modify pricing settings.
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="pricing-enabled" className="text-sm font-medium">
                Require Paid Membership
              </Label>
              <p className="text-xs text-muted-foreground">
                Toggle OFF for free member access, or ON to charge monthly subscriptions
              </p>
            </div>
            <Switch
              id="pricing-enabled"
              checked={settings.is_enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, is_enabled: checked }))
              }
              disabled={!isOwner}
            />
          </div>

          {settings.is_enabled && (
            <div className="space-y-2">
              <Label htmlFor="monthly-price" className="text-sm font-medium">
                Monthly Price (USD)
              </Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                  $
                </div>
                <Input
                  id="monthly-price"
                  type="number"
                  step="0.01"
                  min="0.99"
                  max="99.99"
                  value={formatPrice(settings.price_per_month)}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  className="pl-8"
                  disabled={!isOwner}
                  placeholder="1.99"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum $0.99, maximum $99.99 per month
              </p>
            </div>
          )}

          {isOwner && (
            <Button 
              onClick={saveSettings} 
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          )}

          {settings.is_enabled && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> New members will need to pay ${formatPrice(settings.price_per_month)}/month to join this huddle. 
                Existing members are not affected.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
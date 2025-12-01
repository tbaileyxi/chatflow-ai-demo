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
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-5 h-5 text-primary" />
          <CardTitle className="text-foreground">Member Access Pricing</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          Your huddle is verified! Configure how members join (free or paid)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isOwner && (
          <div className="text-sm text-muted-foreground p-3 bg-muted/20 rounded-lg">
            Only huddle owners can modify pricing settings.
          </div>
        )}

        <div className="space-y-4">
          {/* FREE / PAID Toggle */}
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="pricing-enabled" className="text-sm font-semibold">
                  Member Access
                </Label>
                {settings.is_enabled ? (
                  <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-700 dark:text-green-400 rounded-full">
                    PAID
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-700 dark:text-blue-400 rounded-full">
                    FREE
                  </span>
                )}
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
            <p className="text-xs text-muted-foreground">
              {settings.is_enabled 
                ? "Members pay a monthly subscription to join" 
                : "Anyone can join for free"}
            </p>
          </div>

          {/* Price Input - Only show when enabled */}
          {settings.is_enabled && (
            <div className="space-y-2 p-4 border border-border rounded-lg">
              <Label htmlFor="monthly-price" className="text-sm font-medium">
                Monthly Subscription Price
              </Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground font-medium">
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
                  className="pl-8 text-lg font-semibold"
                  disabled={!isOwner}
                  placeholder="1.99"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Set between $0.99 - $99.99 per month
              </p>
            </div>
          )}

          {/* Info Box */}
          <div className={`p-3 rounded-lg border ${
            settings.is_enabled 
              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' 
              : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
          }`}>
            <p className={`text-sm ${
              settings.is_enabled 
                ? 'text-amber-800 dark:text-amber-200' 
                : 'text-blue-800 dark:text-blue-200'
            }`}>
              {settings.is_enabled ? (
                <>
                  <strong>💳 Paid Membership:</strong> New members will pay ${formatPrice(settings.price_per_month)}/month via Stripe. 
                  They can use promo codes during checkout. Current members are not affected.
                </>
              ) : (
                <>
                  <strong>🎉 Free Access:</strong> Anyone can join your verified huddle without payment. 
                  You can switch to paid membership anytime.
                </>
              )}
            </p>
          </div>

          {/* Save Button */}
          {isOwner && (
            <Button 
              onClick={saveSettings} 
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Pricing Settings"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
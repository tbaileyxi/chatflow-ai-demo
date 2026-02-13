import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Scale } from 'lucide-react';
import { PremiumSettingsCard } from '@/components/premium/PremiumSettingsCard';

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen-dynamic bg-background pb-24">
      <div className="sticky top-0 z-20 px-4 py-3 border-b border-border/30 bg-background/95 backdrop-blur-sm safe-area-inset-top">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-9 w-9 p-0 rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </div>

      <div className="px-4 space-y-6 mt-4 max-w-lg mx-auto">
        {/* Premium */}
        <PremiumSettingsCard />

        {/* Legal Disclaimer */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Legal Disclaimer</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Virtual currency for entertainment purposes only. Cannot be redeemed for cash, prizes, or real-world value. Side Huddle is a game of skill and prediction, not gambling.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

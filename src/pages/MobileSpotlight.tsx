import React from 'react';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { GlassHeader } from '@/components/mobile/GlassHeader';
import { BottomNav } from '@/components/mobile/BottomNav';
import { SpotlightFeed } from '@/components/SpotlightFeed';

export const MobileSpotlight = () => {
  return (
    <MobileLayout>
      <GlassHeader 
        title="Spotlight" 
        subtitle="Trending sports moments"
        showBack={false}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <SpotlightFeed />
      </div>

      <BottomNav />
    </MobileLayout>
  );
};

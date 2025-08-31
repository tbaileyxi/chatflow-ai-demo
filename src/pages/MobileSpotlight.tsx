import React from 'react';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { GlassHeader } from '@/components/mobile/GlassHeader';
import { BottomNav } from '@/components/mobile/BottomNav';
import { VirtualizedOptimizedSpotlightFeed } from '@/components/optimized/VirtualizedOptimizedSpotlightFeed';

export const MobileSpotlight = () => {
  return (
    <MobileLayout>
      <GlassHeader 
        title="Spotlight" 
        subtitle="Trending sports moments"
        showBack={false}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <VirtualizedOptimizedSpotlightFeed />
      </div>

      <BottomNav />
    </MobileLayout>
  );
};

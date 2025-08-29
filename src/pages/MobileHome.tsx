import React from 'react';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { GlassHeader } from '@/components/mobile/GlassHeader';
import { HuddleList } from '@/components/mobile/HuddleList';
import { BottomNav } from '@/components/mobile/BottomNav';
import { useAuth } from '@/hooks/useAuth';

export const MobileHome = () => {
  const { user } = useAuth();

  return (
    <MobileLayout>
      <GlassHeader 
        title="Side Huddle"
        subtitle="Your sports chats"
        showBack={false}
      />
      <HuddleList />
      <BottomNav />
    </MobileLayout>
  );
};
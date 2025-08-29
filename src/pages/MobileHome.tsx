import React from 'react';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { GlassHeader } from '@/components/mobile/GlassHeader';
import { HuddleList } from '@/components/mobile/HuddleList';
import { BottomNav } from '@/components/mobile/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export const MobileHome = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-mobile-background flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

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
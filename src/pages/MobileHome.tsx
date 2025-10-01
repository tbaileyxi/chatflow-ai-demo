import React from 'react';
import { GlassHeader } from '@/components/mobile/GlassHeader';
import { HuddleList } from '@/components/mobile/HuddleList';
import { BottomNav } from '@/components/mobile/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export const MobileHome = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background crt-effect flex items-center justify-center">
        <div className="text-lg text-muted-foreground font-arcade">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background crt-effect">
      {/* Retro background effects */}
      <div className="fixed inset-0 pointer-events-none opacity-10">
        <div className="absolute inset-0 retro-grid"></div>
        <div className="absolute inset-0 retro-scanlines"></div>
      </div>

      <div className="relative">
        <GlassHeader 
          title="Side Huddle"
          subtitle="Your sports chats"
          showBack={false}
        />
        <HuddleList />
        <BottomNav />
      </div>
    </div>
  );
};
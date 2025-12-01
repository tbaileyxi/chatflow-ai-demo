import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { GlassHeader } from '@/components/mobile/GlassHeader';
import { BottomNav } from '@/components/mobile/BottomNav';
import { TrendingTeamsSection } from '@/components/TrendingTeamsSection';
import { TeamDirectoryGrid } from '@/components/TeamDirectoryGrid';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import logo from '@/assets/sh-logo.png';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background crt-effect flex flex-col">
      {/* Retro background effects */}
      <div className="fixed inset-0 pointer-events-none opacity-10">
        <div className="absolute inset-0 retro-grid"></div>
        <div className="absolute inset-0 retro-scanlines"></div>
      </div>
      
      <div className="relative flex flex-col h-screen">
        <GlassHeader 
          title="SIDE HUDDLE"
          showBack={false}
        />

        {/* Hero Section */}
        <div className="relative bg-gradient-to-b from-primary/10 to-transparent border-b border-primary/20 px-4 py-6">
          <div className="max-w-4xl mx-auto text-center space-y-3">
            <div className="flex items-center justify-center gap-3 mb-2">
              <img src={logo} alt="Side Huddle" className="w-12 h-12 md:w-16 md:h-16" />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Your Team. Your Crew. Your Huddle.
              </h1>
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
              Private AI-powered chats + curated team updates.
            </p>
            
            {!user && (
              <div className="pt-2">
                <Button 
                  onClick={() => navigate('/auth')}
                  className="bg-primary hover:bg-primary/90"
                  size="lg"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In / Sign Up
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto pb-20">
          <div className="container mx-auto max-w-6xl p-4 space-y-8">
            {/* Trending Teams Section */}
            <TrendingTeamsSection />

            {/* Team Directory Grid */}
            <TeamDirectoryGrid />
          </div>
        </div>

        <BottomNav />
      </div>
    </div>
  );
}

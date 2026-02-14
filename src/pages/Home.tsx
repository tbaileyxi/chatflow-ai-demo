import React, { useState, useEffect, useCallback } from 'react';
import { MoreVertical, Mail, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BottomNav } from '@/components/mobile/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import shLogo from '@/assets/sh-logo.png';

// New modular components
import { LiveEventCard } from '@/components/home/LiveEventCard';
import { YourHuddlesSection } from '@/components/home/YourHuddlesSection';
import { DiscoverySection } from '@/components/home/DiscoverySection';

interface LiveEvent {
  id: string;
  name: string;
  subtitle: string | null;
  start_time: string;
  network: string | null;
  status: 'upcoming' | 'live' | 'completed';
  score_team1: number | null;
  score_team2: number | null;
}

interface Huddle {
  id: string;
  name: string;
  team_name: string;
  team_logo_url: string;
  participant_count: number;
  is_verified?: boolean;
  is_official_team_huddle?: boolean;
  unread_count?: number;
  latest_message?: {
    content: string;
    created_at: string;
    is_bot_message?: boolean;
  };
}

export default function Home() {
  const { user } = useAuth();
  const [liveEvent, setLiveEvent] = useState<LiveEvent | null>(null);
  const [publicHuddles, setPublicHuddles] = useState<Huddle[]>([]);
  const [privateHuddles, setPrivateHuddles] = useState<Huddle[]>([]);
  const [huddlesLoading, setHuddlesLoading] = useState(true);

  // Fetch active live event (only LIVE status)
  const fetchLiveEvent = useCallback(async () => {
    const { data } = await supabase
      .from('live_events')
      .select('*')
      .eq('status', 'live')
      .eq('is_pinned', true)
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle();
    
    setLiveEvent(data as LiveEvent | null);
  }, []);

  // Fetch user's huddles
  const fetchHuddles = useCallback(async () => {
    if (!user) {
      setPublicHuddles([]);
      setPrivateHuddles([]);
      setHuddlesLoading(false);
      return;
    }

    try {
      const { data: membershipData } = await supabase
        .from('huddle_members')
        .select(`
          huddle_id,
          last_read_at,
          huddles (
            id, name, member_count, last_message_at,
            is_verified, is_official_team_huddle, is_private,
            teams!team_id (name, city, logo_url)
          )
        `)
        .eq('user_id', user.id);

      const huddles = membershipData?.map(m => m.huddles).filter(Boolean) || [];
      const huddleIds = huddles.map(h => h.id);

      // Get latest messages
      const { data: latestMessages } = await supabase
        .from('huddle_messages')
        .select('huddle_id, content, created_at, is_bot_message')
        .in('huddle_id', huddleIds)
        .order('created_at', { ascending: false });

      // Calculate unread counts
      const unreadCounts: Record<string, number> = {};
      const { data: unreadMessages } = await supabase
        .from('huddle_messages')
        .select('huddle_id, created_at')
        .in('huddle_id', huddleIds);

      membershipData?.forEach(member => {
        const lastReadTime = member.last_read_at ? new Date(member.last_read_at) : new Date(0);
        unreadCounts[member.huddle_id] = unreadMessages?.filter(msg => 
          msg.huddle_id === member.huddle_id && new Date(msg.created_at) > lastReadTime
        ).length || 0;
      });

      const transformed: Huddle[] = huddles.map(h => {
        const latestMsg = latestMessages?.find(m => m.huddle_id === h.id);
        return {
          id: h.id,
          name: h.name,
          team_name: `${h.teams?.city || ''} ${h.teams?.name || ''}`.trim(),
          team_logo_url: h.teams?.logo_url || '/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png',
          participant_count: h.member_count || 0,
          is_verified: h.is_verified,
          is_official_team_huddle: h.is_official_team_huddle,
          unread_count: unreadCounts[h.id] || 0,
          latest_message: latestMsg ? {
            content: latestMsg.content,
            created_at: latestMsg.created_at,
            is_bot_message: latestMsg.is_bot_message
          } : undefined
        };
      });

      setPublicHuddles(transformed.filter(h => h.is_official_team_huddle));
      setPrivateHuddles(transformed.filter(h => !h.is_official_team_huddle));
    } catch (error) {
      console.error('Error fetching huddles:', error);
    } finally {
      setHuddlesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLiveEvent();
    fetchHuddles();
  }, [fetchLiveEvent, fetchHuddles]);

  const hasHuddles = publicHuddles.length > 0 || privateHuddles.length > 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="w-10" />
          <div className="flex flex-col items-center gap-1">
            <img src={shLogo} alt="Side Huddle" className="h-12 object-contain" />
            <p className="text-sm font-bold text-foreground">All your best team socials. One huddle.</p>
            <p className="text-xs text-muted-foreground mt-0.5">Chat with fans while the best team posts and clips are automatically pulled into one place.</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0 rounded-full">
                <MoreVertical className="h-5 w-5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => window.location.href = '/sponsor'}>
                <Sparkles className="mr-2 h-4 w-4" />
                Sponsor
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open('https://sidehuddlefounders.carrd.co/#contactus', '_blank')}>
                <Mail className="mr-2 h-4 w-4" />
                Contact Us
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="px-4 py-6 space-y-8">
        {/* SECTION 1: Live Event (conditional - only when live) */}
        {liveEvent && <LiveEventCard event={liveEvent} />}

        {/* SECTION 3: Your Huddles (returning users only) */}
        {user && hasHuddles && (
          <YourHuddlesSection
            publicHuddles={publicHuddles}
            privateHuddles={privateHuddles}
            loading={huddlesLoading}
          />
        )}

        {/* SECTION 4 & 5: Discovery (everyone) */}
        <DiscoverySection />
      </div>

      <BottomNav />
    </div>
  );
}

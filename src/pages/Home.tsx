import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/mobile/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Zap, Users, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StartHuddleDialog } from '@/components/StartHuddleDialog';
import { cn } from '@/lib/utils';

interface HuddlePreview {
  id: string;
  name: string;
  team: {
    id: string;
    name: string;
    city: string;
    logo_url: string;
    league: string;
  };
  member_count: number;
  last_message_at: string;
  is_live?: boolean;
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [liveHuddles, setLiveHuddles] = useState<HuddlePreview[]>([]);
  const [myHuddles, setMyHuddles] = useState<HuddlePreview[]>([]);
  const [suggestedHuddles, setSuggestedHuddles] = useState<HuddlePreview[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto-redirect to last active huddle if returning user
  useEffect(() => {
    const lastHuddleId = localStorage.getItem('lastActiveHuddle');
    if (lastHuddleId && user) {
      // Check if still a member
      supabase
        .from('huddle_members')
        .select('huddle_id')
        .eq('user_id', user.id)
        .eq('huddle_id', lastHuddleId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            navigate(`/huddle/${lastHuddleId}`);
          }
        });
    }
  }, [user, navigate]);

  // Fetch huddles
  useEffect(() => {
    const fetchHuddles = async () => {
      setLoading(true);
      
      // Fetch live/active huddles (recent activity)
      const { data: active } = await supabase
        .from('huddles')
        .select(`
          id, name, member_count, last_message_at,
          team:teams(id, name, city, logo_url, league)
        `)
        .eq('is_private', false)
        .order('last_message_at', { ascending: false })
        .limit(5);

      if (active) {
        setLiveHuddles(active.map(h => ({ ...h, team: h.team as any, is_live: true })));
      }

      // Fetch user's huddles if logged in
      if (user) {
        const { data: myData } = await supabase
          .from('huddle_members')
          .select(`
            huddle:huddles(
              id, name, member_count, last_message_at,
              team:teams(id, name, city, logo_url, league)
            )
          `)
          .eq('user_id', user.id)
          .order('joined_at', { ascending: false })
          .limit(10);

        if (myData) {
          setMyHuddles(myData.map(m => ({ ...m.huddle as any, team: (m.huddle as any)?.team })).filter(h => h?.id));
        }
      }

      // Fetch suggested huddles (popular ones user isn't in)
      const { data: suggested } = await supabase
        .from('huddles')
        .select(`
          id, name, member_count, last_message_at,
          team:teams(id, name, city, logo_url, league)
        `)
        .eq('is_private', false)
        .order('member_count', { ascending: false })
        .limit(8);

      if (suggested) {
        const userHuddleIds = new Set(myHuddles.map(h => h.id));
        setSuggestedHuddles(
          suggested
            .filter(h => !userHuddleIds.has(h.id))
            .map(h => ({ ...h, team: h.team as any }))
            .slice(0, 5)
        );
      }

      setLoading(false);
    };

    fetchHuddles();
  }, [user]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/huddle-search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const HuddleCard = ({ huddle, isLive = false }: { huddle: HuddlePreview; isLive?: boolean }) => (
    <button
      onClick={() => navigate(`/huddle/${huddle.id}`)}
      className={cn(
        "w-full p-3 rounded-xl border transition-all duration-200",
        "bg-card/50 hover:bg-card border-border/50 hover:border-primary/30",
        "flex items-center gap-3 text-left",
        isLive && "ring-2 ring-green-500/50 bg-green-500/5"
      )}
    >
      {huddle.team?.logo_url ? (
        <img 
          src={huddle.team.logo_url} 
          alt={huddle.team.name}
          className="w-12 h-12 rounded-lg object-contain bg-background p-1"
        />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
          <Users className="w-6 h-6 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground truncate">{huddle.name}</span>
          {isLive && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/20 rounded text-xs text-green-400">
              <Zap className="w-3 h-3" /> LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{huddle.team?.city} {huddle.team?.name}</span>
          <span>•</span>
          <span>{huddle.member_count || 0} fans</span>
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Compact Header with Search */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 p-3 safe-area-inset-top">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Find a team or live event..."
              className="pl-9 bg-muted/50 border-border/50"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-24 p-4 space-y-6">
        {/* New Huddle CTA - Large Primary Button */}
        <StartHuddleDialog
          trigger={
            <Button
              size="lg"
              className="w-full h-14 text-lg font-bold bg-yellow-400 hover:bg-yellow-500 text-black shadow-lg"
            >
              <Plus className="w-6 h-6 mr-2" />
              New Huddle
            </Button>
          }
        />

        {/* Section 1: Live / Active Events */}
        {liveHuddles.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-400" />
              Live & Active
            </h2>
            <div className="space-y-2">
              {liveHuddles.map(huddle => (
                <HuddleCard key={huddle.id} huddle={huddle} isLive />
              ))}
            </div>
          </section>
        )}

        {/* Section 2: Your Active Teams */}
        {user && myHuddles.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Your Huddles
            </h2>
            <div className="space-y-2">
              {myHuddles.map(huddle => (
                <HuddleCard key={huddle.id} huddle={huddle} />
              ))}
            </div>
          </section>
        )}

        {/* Section 3: Suggested Teams */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Suggested Huddles
          </h2>
          <div className="space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
              ))
            ) : suggestedHuddles.length > 0 ? (
              suggestedHuddles.map(huddle => (
                <HuddleCard key={huddle.id} huddle={huddle} />
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No suggestions yet. Create your first huddle!
              </p>
            )}
          </div>
        </section>
      </div>

      <BottomNav />
    </div>
  );
}

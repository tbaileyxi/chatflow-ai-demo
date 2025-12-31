import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Radio, Flame, Clock, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/mobile/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import shLogo from '@/assets/sh-logo-updated.png';

interface Team {
  id: string;
  name: string;
  city: string;
  logo_url: string | null;
  league: string;
}

interface LiveEvent {
  id: string;
  name: string;
  subtitle: string | null;
  start_time: string;
  network: string | null;
  status: 'upcoming' | 'live' | 'completed';
  score_team1: number | null;
  score_team2: number | null;
  team1_id: string | null;
  team2_id: string | null;
}

interface TeamWithActivity extends Team {
  huddle_id?: string;
  is_active?: boolean;
  member_count?: number;
}

const RECENTLY_VIEWED_KEY = 'sh_recently_viewed';

const getRecentlyViewed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
  } catch {
    return [];
  }
};

const addRecentlyViewed = (teamId: string) => {
  const recent = getRecentlyViewed().filter(id => id !== teamId);
  recent.unshift(teamId);
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recent.slice(0, 5)));
};

export default function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [teams, setTeams] = useState<TeamWithActivity[]>([]);
  const [recentTeams, setRecentTeams] = useState<TeamWithActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch live events
      const eventsResult = await supabase
        .from('live_events')
        .select('*')
        .in('status', ['live', 'upcoming'])
        .eq('is_pinned', true)
        .order('start_time', { ascending: true })
        .limit(5);
      setLiveEvents((eventsResult.data as unknown as LiveEvent[]) || []);

      // Fetch teams - explicit cast to avoid TS2589
      const teamsData: Team[] = ((await (supabase as any)
        .from('teams')
        .select('id, name, city, logo_url, league')
        .eq('is_active', true)
        .order('name')).data) || [];

      // Fetch official huddles
      type HuddleRow = { id: string; team_id: string; member_count: number | null; last_message_at: string | null };
      const huddlesData: HuddleRow[] = ((await (supabase as any)
        .from('huddles')
        .select('id, team_id, member_count, last_message_at')
        .eq('is_official_team_huddle', true)).data) || [];

      const huddlesByTeam = new Map<string, HuddleRow>();
      huddlesData.forEach((h) => {
        if (h.team_id) huddlesByTeam.set(h.team_id, h);
      });
      
      const formattedTeams: TeamWithActivity[] = teamsData.map((t) => {
        const huddle = huddlesByTeam.get(t.id);
        const lastMessage = huddle?.last_message_at ? new Date(huddle.last_message_at) : null;
        const isActive = lastMessage ? (Date.now() - lastMessage.getTime()) < 3600000 : false;
        return {
          id: t.id,
          name: t.name,
          city: t.city || '',
          logo_url: t.logo_url,
          league: t.league || '',
          huddle_id: huddle?.id,
          is_active: isActive,
          member_count: huddle?.member_count || 0
        };
      }).filter((t) => t.huddle_id);

      setTeams(formattedTeams);

      const recentIds = getRecentlyViewed();
      const recentTeamsData = formattedTeams.filter(t => recentIds.includes(t.id));
      recentTeamsData.sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));
      setRecentTeams(recentTeamsData.slice(0, 5));
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTeamClick = (team: TeamWithActivity) => {
    addRecentlyViewed(team.id);
    if (team.huddle_id) {
      navigate(`/huddle/${team.huddle_id}`);
    }
  };

  const handleEventClick = (event: LiveEvent) => {
    if (event.team1_id) {
      const team = teams.find(t => t.id === event.team1_id);
      if (team?.huddle_id) {
        navigate(`/huddle/${team.huddle_id}`);
      }
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/huddle-search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatEventTime = (startTime: string) => {
    const date = new Date(startTime);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="px-4 py-4 flex flex-col items-center gap-2">
          <img src={shLogo} alt="Side Huddle" className="h-10 object-contain" />
          <p className="text-xs text-muted-foreground">Your Team. Your Crew. Live.</p>
        </div>
      </header>

      <div className="px-4 py-6">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Pick a team or live event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 py-6 text-lg rounded-2xl bg-card border-2 border-primary/20 focus:border-primary/50 transition-all"
            />
          </div>
        </form>
      </div>

      <div className="px-4 space-y-8">
        {liveEvents.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Radio className="h-5 w-5 text-destructive animate-pulse" />
              <h2 className="text-lg font-bold">Live Events</h2>
            </div>
            <div className="space-y-3">
              {liveEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className="w-full bg-card rounded-xl p-4 border border-border/50 hover:border-primary/50 transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {event.status === 'live' && (
                          <Badge variant="destructive" className="animate-pulse text-xs">LIVE</Badge>
                        )}
                        {event.network && <span className="text-sm text-muted-foreground">{event.network}</span>}
                      </div>
                      <h3 className="font-semibold">{event.name}</h3>
                      {event.subtitle && <p className="text-sm text-muted-foreground">{event.subtitle}</p>}
                      {event.status === 'live' && event.score_team1 !== null && (
                        <p className="text-lg font-bold text-primary mt-1">{event.score_team1} - {event.score_team2}</p>
                      )}
                      {event.status === 'upcoming' && (
                        <p className="text-sm text-muted-foreground mt-1">{formatEventTime(event.start_time)}</p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {recentTeams.length > 0 && !searchQuery && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-bold">Recently Viewed</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {recentTeams.map((team) => (
                <button key={team.id} onClick={() => handleTeamClick(team)} className="flex-shrink-0 flex flex-col items-center gap-2">
                  <div className={cn("relative rounded-full p-0.5", team.is_active && "ring-2 ring-green-500 animate-pulse")}>
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={team.logo_url || undefined} alt={team.name} />
                      <AvatarFallback>{team.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                  </div>
                  <span className="text-xs text-center max-w-[64px] truncate">{team.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center gap-2 mb-4">
            <Flame className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-bold">Teams</h2>
          </div>
          {loading ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
                  <div className="h-14 w-14 rounded-full bg-muted" />
                  <div className="h-3 w-12 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
              {filteredTeams.map((team) => (
                <button key={team.id} onClick={() => handleTeamClick(team)} className="flex flex-col items-center gap-2 group">
                  <div className={cn("relative rounded-full transition-all duration-200 group-hover:scale-110", team.is_active && "ring-2 ring-green-500")}>
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={team.logo_url || undefined} alt={team.name} />
                      <AvatarFallback className="text-xs">{team.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    {team.is_active && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />}
                  </div>
                  <span className="text-xs text-center max-w-[56px] truncate text-muted-foreground group-hover:text-foreground transition-colors">{team.name}</span>
                </button>
              ))}
            </div>
          )}
          {!loading && filteredTeams.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No teams found matching "{searchQuery}"</p>
          )}
        </section>
      </div>

      <BottomNav />
    </div>
  );
}

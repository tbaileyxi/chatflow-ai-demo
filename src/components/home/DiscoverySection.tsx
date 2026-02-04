import React, { useState, useEffect, useCallback } from 'react';
import { Compass, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Team {
  id: string;
  name: string;
  city: string;
  logo_url: string | null;
  league: string;
  huddle_id?: string;
  is_active?: boolean;
}

interface ActiveHuddle {
  id: string;
  name: string;
  team_logo_url: string | null;
  team_name: string;
}

const LEAGUES = [
  { id: 'all', label: 'All' },
  { id: 'NFL', label: 'NFL' },
  { id: 'NCAA', label: 'NCAA' },
  { id: 'NBA', label: 'NBA' },
  { id: 'NHL', label: 'NHL' },
  { id: 'MLB', label: 'MLB' },
];

export const DiscoverySection = () => {
  const navigate = useNavigate();
  const [selectedLeague, setSelectedLeague] = useState('all');
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeHuddles, setActiveHuddles] = useState<ActiveHuddle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Fetch active public huddles (by recent activity, not popularity)
      const { data: huddlesData } = await supabase
        .from('huddles')
        .select(`
          id,
          name,
          last_message_at,
          is_official_team_huddle,
          is_private,
          teams!team_id (
            name,
            logo_url
          )
        `)
        .eq('is_official_team_huddle', true)
        .not('last_message_at', 'is', null)
        .order('last_message_at', { ascending: false })
        .limit(6);

      const activeOnes = (huddlesData || [])
        .filter((h: any) => {
          const lastMsg = h.last_message_at ? new Date(h.last_message_at).getTime() : 0;
          return (Date.now() - lastMsg) < 6 * 60 * 60 * 1000; // 6 hours
        })
        .slice(0, 4)
        .map((h: any) => ({
          id: h.id,
          name: h.name,
          team_logo_url: h.teams?.logo_url || null,
          team_name: h.teams?.name || h.name
        }));

      setActiveHuddles(activeOnes);

      // Fetch teams for "Follow a Team"
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name, city, logo_url, league')
        .eq('status', 'active')
        .order('name');

      // Get official huddles to map team -> huddle
      const { data: officialHuddles } = await supabase
        .from('huddles')
        .select('id, team_id, last_message_at')
        .eq('is_official_team_huddle', true);

      const huddleMap = new Map<string, { id: string; lastMsg: string | null }>();
      (officialHuddles || []).forEach((h: any) => {
        if (h.team_id) huddleMap.set(h.team_id, { id: h.id, lastMsg: h.last_message_at });
      });

      const formattedTeams = (teamsData || [])
        .map((t: any) => {
          const huddle = huddleMap.get(t.id);
          const isActive = huddle?.lastMsg 
            ? (Date.now() - new Date(huddle.lastMsg).getTime()) < 3600000 
            : false;
          return {
            id: t.id,
            name: t.name,
            city: t.city || '',
            logo_url: t.logo_url,
            league: t.league || '',
            huddle_id: huddle?.id,
            is_active: isActive
          };
        });
      // Show all teams, including those without huddles

      setTeams(formattedTeams);
    } catch (error) {
      console.error('Error fetching discovery data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredTeams = teams.filter(t => 
    selectedLeague === 'all' || t.league === selectedLeague
  );

  const handleTeamClick = (team: Team) => {
    if (team.huddle_id) {
      navigate(`/huddle/${team.huddle_id}`);
    } else {
      // Navigate to team feed for teams without huddles
      navigate(`/team/${team.id}`);
    }
  };

  const handleHuddleClick = (huddle: ActiveHuddle) => {
    navigate(`/huddle/${huddle.id}`);
  };

  return (
    <div className="space-y-8">
      {/* Drop Into a Huddle - only show if there are active huddles */}
      {activeHuddles.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Drop Into a Huddle</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {activeHuddles.map((huddle) => (
              <button
                key={huddle.id}
                onClick={() => handleHuddleClick(huddle)}
                className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all text-left"
              >
                <Avatar className="h-10 w-10 ring-2 ring-green-500/50">
                  <AvatarImage src={huddle.team_logo_url || undefined} alt={huddle.team_name} />
                  <AvatarFallback className="text-xs bg-muted">
                    {huddle.team_name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{huddle.team_name}</p>
                  <p className="text-xs text-green-500">Active now</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Follow a Team */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-bold">Follow a Team</h2>
        </div>

        <Tabs value={selectedLeague} onValueChange={setSelectedLeague}>
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
            {LEAGUES.map((league) => (
              <TabsTrigger key={league.id} value={league.id} className="flex-shrink-0">
                {league.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

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
              <button 
                key={team.id} 
                onClick={() => handleTeamClick(team)} 
                className="flex flex-col items-center gap-2 group"
              >
                <div className={cn(
                  "relative rounded-full transition-all duration-200 group-hover:scale-110",
                  team.is_active && "ring-2 ring-green-500"
                )}>
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={team.logo_url || undefined} alt={team.name} />
                    <AvatarFallback className="text-xs">{team.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                </div>
                <span className="text-xs max-w-[56px] truncate text-muted-foreground group-hover:text-foreground transition-colors">
                  {team.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

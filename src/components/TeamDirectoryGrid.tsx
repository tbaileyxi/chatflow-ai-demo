import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamTile } from './TeamTile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  city: string;
  logo_url?: string;
  league?: string;
  huddle?: {
    id: string;
    member_count: number;
    last_message_at?: string;
  };
}

export const TeamDirectoryGrid: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      // Fetch all teams with their public huddles
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, city, logo_url, league')
        .order('league', { ascending: true })
        .order('city', { ascending: true });

      if (teamsError) throw teamsError;

      // Fetch all public huddles for these teams
      const { data: huddlesData } = await supabase
        .from('huddles')
        .select('id, team_id, member_count, last_message_at')
        .eq('is_private', false)
        .eq('is_official_team_huddle', true);

      // Map huddles to teams
      const huddlesMap = new Map(
        huddlesData?.map(h => [h.team_id, {
          id: h.id,
          member_count: h.member_count || 0,
          last_message_at: h.last_message_at
        }]) || []
      );

      const formatted = teamsData?.map(team => ({
        ...team,
        huddle: huddlesMap.get(team.id)
      })) || [];

      setTeams(formatted);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTeams = (league: string | null) => {
    let filtered = teams;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(team => 
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.city.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by league
    if (league) {
      filtered = filtered.filter(team => team.league === league);
    }

    return filtered;
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading teams...</div>;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-foreground">All Teams</h2>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="NFL">NFL</TabsTrigger>
          <TabsTrigger value="NCAA">College</TabsTrigger>
          <TabsTrigger value="NBA">NBA</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          {filterTeams(null).length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {filterTeams(null).map(team => (
                <TeamTile key={team.id} team={team} huddle={team.huddle} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No teams found
            </div>
          )}
        </TabsContent>

        <TabsContent value="NFL" className="space-y-4 mt-4">
          {filterTeams('NFL').length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {filterTeams('NFL').map(team => (
                <TeamTile key={team.id} team={team} huddle={team.huddle} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No NFL teams found
            </div>
          )}
        </TabsContent>

        <TabsContent value="NCAA" className="space-y-4 mt-4">
          {filterTeams('NCAA').length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {filterTeams('NCAA').map(team => (
                <TeamTile key={team.id} team={team} huddle={team.huddle} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No NCAA teams found
            </div>
          )}
        </TabsContent>

        <TabsContent value="NBA" className="space-y-4 mt-4">
          {filterTeams('NBA').length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {filterTeams('NBA').map(team => (
                <TeamTile key={team.id} team={team} huddle={team.huddle} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No NBA teams found
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
};

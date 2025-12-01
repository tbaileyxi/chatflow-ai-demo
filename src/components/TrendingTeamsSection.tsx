import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamTile } from './TeamTile';
import { Flame } from 'lucide-react';

interface TrendingTeam {
  id: string;
  name: string;
  city: string;
  logo_url?: string;
  league?: string;
  huddle: {
    id: string;
    member_count: number;
    last_message_at?: string;
  };
}

export const TrendingTeamsSection: React.FC = () => {
  const [trendingTeams, setTrendingTeams] = useState<TrendingTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrendingTeams();
  }, []);

  const fetchTrendingTeams = async () => {
    try {
      // Fetch top 10 public huddles by member count with their team info
      const { data: huddles, error } = await supabase
        .from('huddles')
        .select(`
          id,
          member_count,
          last_message_at,
          is_private,
          is_official_team_huddle,
          teams!team_id (
            id,
            name,
            city,
            logo_url,
            league
          )
        `)
        .eq('is_private', false)
        .eq('is_official_team_huddle', true)
        .order('member_count', { ascending: false })
        .limit(10);

      if (error) throw error;

      const formatted = huddles
        ?.filter(h => h.teams) // Ensure team data exists
        .map(h => ({
          id: h.teams.id,
          name: h.teams.name,
          city: h.teams.city,
          logo_url: h.teams.logo_url,
          league: h.teams.league,
          huddle: {
            id: h.id,
            member_count: h.member_count || 0,
            last_message_at: h.last_message_at
          }
        })) || [];

      setTrendingTeams(formatted);
    } catch (error) {
      console.error('Error fetching trending teams:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold text-foreground">Top Teams</h2>
        </div>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (trendingTeams.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Flame className="w-5 h-5 text-orange-500" />
        <h2 className="text-lg font-bold text-foreground">🔥 Trending Teams</h2>
      </div>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {trendingTeams.map(team => (
          <TeamTile 
            key={team.id} 
            team={team} 
            huddle={team.huddle}
            size="large"
          />
        ))}
      </div>
    </section>
  );
};

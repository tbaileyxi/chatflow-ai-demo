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
  featured_order?: number;
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

  const calculateTrendingScore = (huddle: any, team: any) => {
    // Admin boost: Lower featured_order = higher priority (inverted scale)
    // Default 999 means not featured (minimal boost)
    const adminBoost = team.featured_order ? (1000 - team.featured_order) : 1;
    
    // Activity score: Recent messages boost ranking
    const lastMessageTime = huddle.last_message_at ? new Date(huddle.last_message_at) : new Date(0);
    const hoursAgo = (Date.now() - lastMessageTime.getTime()) / (1000 * 60 * 60);
    const activityScore = hoursAgo < 24 ? Math.max(0, 100 - hoursAgo * 4) : 0; // Decays over 24h
    
    // Member count score (capped at 100 to prevent complete domination)
    const memberScore = Math.min(huddle.member_count || 0, 100);
    
    // Weighted formula: admin control has highest weight, then activity, then size
    return (adminBoost * 10) + (activityScore * 2) + memberScore;
  };

  const fetchTrendingTeams = async () => {
    try {
      // Fetch top public huddles with their team info
      const { data: huddles, error } = await supabase
        .from('huddles')
        .select(`
          id,
          member_count,
          last_message_at,
          is_private,
          is_official_team_huddle,
          team_id,
          teams!team_id (
            id,
            name,
            city,
            logo_url,
            league,
            featured_order
          )
        `)
        .eq('is_private', false)
        .eq('is_official_team_huddle', true);

      if (error) throw error;

      // Calculate trending scores and combine data
      const combined = huddles
        ?.filter(h => h.teams) // Ensure team data exists
        .map(h => ({
          id: h.teams.id,
          name: h.teams.name,
          city: h.teams.city,
          logo_url: h.teams.logo_url,
          league: h.teams.league,
          featured_order: h.teams.featured_order,
          huddle: {
            id: h.id,
            member_count: h.member_count || 0,
            last_message_at: h.last_message_at
          },
          trendingScore: calculateTrendingScore(
            { member_count: h.member_count, last_message_at: h.last_message_at },
            { featured_order: h.teams.featured_order }
          )
        })) || [];

      // Sort by trending score (highest first), take top 10
      combined.sort((a, b) => b.trendingScore - a.trendingScore);
      
      setTrendingTeams(combined.slice(0, 10));
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

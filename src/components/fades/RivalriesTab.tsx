import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Flame, TrendingDown } from 'lucide-react';

interface RivalriesTabProps {
  huddleId: string;
}

interface SeasonStats {
  total_points: number;
  total_wins: number;
  total_losses: number;
  current_streak: number;
}

interface Rivalry {
  opponentId: string;
  opponentName: string;
  opponentAvatar: string | null;
  netPoints: number;
  totalFades: number;
  myWins: number;
  theirWins: number;
}

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalPoints: number;
  rank: number;
}

export const RivalriesTab: React.FC<RivalriesTabProps> = ({ huddleId }) => {
  const { user } = useAuth();
  const [myStats, setMyStats] = useState<SeasonStats | null>(null);
  const [rivalries, setRivalries] = useState<Rivalry[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    fetchData();
  }, [huddleId, user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // Fetch my season stats
      const { data: statsData } = await supabase
        .from('fade_season_stats')
        .select('*')
        .eq('huddle_id', huddleId)
        .eq('user_id', user.id)
        .eq('season_year', new Date().getFullYear())
        .maybeSingle();

      setMyStats(statsData);

      // Fetch ledgers involving me
      const { data: ledgersA } = await supabase
        .from('fade_ledgers')
        .select('*')
        .eq('huddle_id', huddleId)
        .eq('user_a_id', user.id);

      const { data: ledgersB } = await supabase
        .from('fade_ledgers')
        .select('*')
        .eq('huddle_id', huddleId)
        .eq('user_b_id', user.id);

      const allLedgers = [...(ledgersA || []), ...(ledgersB || [])];
      
      // Get opponent profiles
      const opponentIds = allLedgers.map(l => 
        l.user_a_id === user.id ? l.user_b_id : l.user_a_id
      );

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, username, avatar_url')
        .in('user_id', opponentIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const rivalryList: Rivalry[] = allLedgers.map(ledger => {
        const isUserA = ledger.user_a_id === user.id;
        const opponentId = isUserA ? ledger.user_b_id : ledger.user_a_id;
        const profile = profileMap.get(opponentId);
        
        return {
          opponentId,
          opponentName: profile?.display_name || profile?.username || 'Unknown',
          opponentAvatar: profile?.avatar_url,
          netPoints: isUserA ? ledger.net_points : -ledger.net_points,
          totalFades: ledger.total_fades,
          myWins: isUserA ? ledger.user_a_wins : ledger.user_b_wins,
          theirWins: isUserA ? ledger.user_b_wins : ledger.user_a_wins,
        };
      }).sort((a, b) => Math.abs(b.netPoints) - Math.abs(a.netPoints));

      setRivalries(rivalryList);

      // Fetch leaderboard (top 5)
      const { data: allStats } = await supabase
        .from('fade_season_stats')
        .select('*')
        .eq('huddle_id', huddleId)
        .eq('season_year', new Date().getFullYear())
        .order('total_points', { ascending: false })
        .limit(5);

      if (allStats && allStats.length > 0) {
        const userIds = allStats.map(s => s.user_id);
        const { data: leaderProfiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_url')
          .in('user_id', userIds);

        const leaderProfileMap = new Map(leaderProfiles?.map(p => [p.user_id, p]) || []);

        const leaderboardEntries: LeaderboardEntry[] = allStats.map((stat, index) => {
          const profile = leaderProfileMap.get(stat.user_id);
          return {
            userId: stat.user_id,
            displayName: profile?.display_name || profile?.username || 'Unknown',
            avatarUrl: profile?.avatar_url,
            totalPoints: stat.total_points,
            rank: index + 1,
          };
        });

        setLeaderboard(leaderboardEntries);
      }
    } catch (error) {
      console.error('Error fetching rivalries data:', error);
    } finally {
      setLoading(false);
    }
  };

  const winRate = myStats 
    ? Math.round((myStats.total_wins / (myStats.total_wins + myStats.total_losses || 1)) * 100)
    : 0;

  const streakEmoji = myStats?.current_streak 
    ? myStats.current_streak > 0 
      ? '🔥'.repeat(Math.min(myStats.current_streak, 5))
      : '😤'
    : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* My Stats Header */}
      <div className="p-4 bg-zinc-900/50 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-yellow-400">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-yellow-400 text-black font-bold">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm text-gray-400">Season {new Date().getFullYear()}</p>
            <p className={`text-2xl font-bold ${(myStats?.total_points || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(myStats?.total_points || 0) >= 0 ? '+' : ''}{myStats?.total_points || 0} pts
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">{winRate}% win rate</p>
            <p className="text-lg">{streakEmoji}</p>
          </div>
        </div>
      </div>

      {/* Rivalries List */}
      <div className="flex-1 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Head-to-Head
        </h3>
        
        {rivalries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No rivalries yet!</p>
            <p className="text-sm mt-1">Post a fade to start</p>
          </div>
        ) : (
          rivalries.map(rivalry => (
            <div
              key={rivalry.opponentId}
              className="flex items-center gap-3 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800 hover:border-yellow-400/30 transition-colors"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={rivalry.opponentAvatar || undefined} />
                <AvatarFallback className="bg-zinc-700 text-white">
                  {rivalry.opponentName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{rivalry.opponentName}</p>
                <p className="text-xs text-gray-500">{rivalry.totalFades} fades</p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${rivalry.netPoints >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {rivalry.netPoints >= 0 ? '+' : ''}{rivalry.netPoints}
                </p>
                <p className="text-xs text-gray-500">
                  {rivalry.myWins}W - {rivalry.theirWins}L
                </p>
              </div>
              {rivalry.netPoints > 0 ? (
                <Flame className="h-5 w-5 text-orange-500" />
              ) : rivalry.netPoints < 0 ? (
                <TrendingDown className="h-5 w-5 text-red-500" />
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400" />
            Huddle Leaderboard
          </h3>
          <div className="space-y-2">
            {leaderboard.map(entry => (
              <div
                key={entry.userId}
                className={`flex items-center gap-2 p-2 rounded ${
                  entry.userId === user?.id ? 'bg-yellow-400/10 border border-yellow-400/30' : ''
                }`}
              >
                <span className={`w-6 text-center font-bold ${
                  entry.rank === 1 ? 'text-yellow-400' :
                  entry.rank === 2 ? 'text-gray-300' :
                  entry.rank === 3 ? 'text-amber-600' : 'text-gray-500'
                }`}>
                  {entry.rank}
                </span>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={entry.avatarUrl || undefined} />
                  <AvatarFallback className="bg-zinc-700 text-white text-xs">
                    {entry.displayName[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm text-white truncate">{entry.displayName}</span>
                <span className={`font-bold text-sm ${entry.totalPoints >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {entry.totalPoints >= 0 ? '+' : ''}{entry.totalPoints}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

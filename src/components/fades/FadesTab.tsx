import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FadeOptionCard } from './FadeOptionCard';
import { PostFadeModal } from './PostFadeModal';
import { ActiveFadeCard } from './ActiveFadeCard';
import { LockedFadeCard } from './LockedFadeCard';
import { SettledFadeCard } from './SettledFadeCard';
import { Clock, CalendarDays, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';

interface FadesTabProps {
  huddleId: string;
  teamName: string;
}

interface GameData {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  sport_key: string;
}

interface FadeOption {
  type: 'over' | 'under' | 'spread' | 'team_total';
  label: string;
  line_value: number;
  description: string;
}

interface Fade {
  id: string;
  poster_id: string;
  accepter_id: string | null;
  game_id: string;
  game_commence_time: string;
  home_team: string;
  away_team: string;
  fade_type: string;
  line_value: number;
  line_description: string;
  stake: number;
  status: string;
  winner_id: string | null;
  final_score_home: number | null;
  final_score_away: number | null;
  created_at: string;
  poster?: { display_name: string | null; username: string | null; avatar_url: string | null };
  accepter?: { display_name: string | null; username: string | null; avatar_url: string | null };
}
  game_commence_time: string;
  home_team: string;
  away_team: string;
  fade_type: string;
  line_value: number;
  line_description: string;
  stake: number;
  status: 'open' | 'locked' | 'expired' | 'settled';
  winner_id: string | null;
  final_score_home: number | null;
  final_score_away: number | null;
  created_at: string;
  poster?: { display_name: string | null; username: string | null; avatar_url: string | null };
  accepter?: { display_name: string | null; username: string | null; avatar_url: string | null };
}

export const FadesTab: React.FC<FadesTabProps> = ({ huddleId, teamName }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<GameData | null>(null);
  const [fadeOptions, setFadeOptions] = useState<FadeOption[]>([]);
  const [fades, setFades] = useState<Fade[]>([]);
  const [selectedOption, setSelectedOption] = useState<FadeOption | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOdds();
    fetchFades();
    
    // Subscribe to fades changes
    const channel = supabase
      .channel(`fades-${huddleId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'fades',
        filter: `huddle_id=eq.${huddleId}`,
      }, () => {
        fetchFades();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [huddleId, teamName]);

  const fetchOdds = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('fades-get-odds', {
        body: { team: teamName, sport: 'ncaab' },
      });

      if (error) throw error;

      if (data.game) {
        setGame(data.game);
        setFadeOptions(data.fade_options || []);
      } else {
        setError(data.message || 'No upcoming games found');
        // Use fallback options
        if (data.fallback) {
          setFadeOptions([
            { type: 'over', label: `Over ${data.fallback.over_under}`, line_value: data.fallback.over_under, description: `Total points Over ${data.fallback.over_under}` },
            { type: 'under', label: `Under ${data.fallback.over_under}`, line_value: data.fallback.over_under, description: `Total points Under ${data.fallback.over_under}` },
            { type: 'spread', label: `${teamName} ${data.fallback.spread}`, line_value: data.fallback.spread, description: `${teamName} covers ${data.fallback.spread}` },
            { type: 'team_total', label: `${teamName} Over ${data.fallback.team_total}`, line_value: data.fallback.team_total, description: `${teamName} scores Over ${data.fallback.team_total}` },
          ]);
        }
      }
    } catch (err: any) {
      console.error('Error fetching odds:', err);
      setError('Failed to load game odds');
    } finally {
      setLoading(false);
    }
  };

  const fetchFades = async () => {
    try {
      const { data, error } = await supabase
        .from('fades')
        .select(`
          *,
          poster:profiles!fades_poster_id_fkey(display_name, username, avatar_url),
          accepter:profiles!fades_accepter_id_fkey(display_name, username, avatar_url)
        `)
        .eq('huddle_id', huddleId)
        .order('created_at', { ascending: false });

      if (error) {
        // If join fails, fetch without profiles
        const { data: simpleFades } = await supabase
          .from('fades')
          .select('*')
          .eq('huddle_id', huddleId)
          .order('created_at', { ascending: false });
        
        setFades(simpleFades || []);
      } else {
        setFades(data || []);
      }
    } catch (err) {
      console.error('Error fetching fades:', err);
    }
  };

  const handleOptionClick = (option: FadeOption) => {
    if (!game) return;
    setSelectedOption(option);
    setShowPostModal(true);
  };

  const handlePostFade = async (stake: number) => {
    if (!user || !game || !selectedOption) return;

    try {
      const { error } = await supabase.from('fades').insert({
        huddle_id: huddleId,
        poster_id: user.id,
        game_id: game.id,
        game_commence_time: game.commence_time,
        home_team: game.home_team,
        away_team: game.away_team,
        sport: game.sport_key,
        fade_type: selectedOption.type,
        line_value: selectedOption.line_value,
        line_description: selectedOption.description,
        stake,
      });

      if (error) throw error;

      // Post to chat
      const systemUser = await supabase.rpc('get_or_create_system_user');
      
      const { data: posterProfile } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('user_id', user.id)
        .maybeSingle();

      const posterName = posterProfile?.display_name || posterProfile?.username || 'Someone';

      await supabase.from('huddle_messages').insert({
        huddle_id: huddleId,
        user_id: systemUser.data,
        content: `🔥 New Fade: ${posterName} posted ${stake} points on ${selectedOption.label} – anyone fading?`,
        message_type: 'fade_notification',
        is_bot_message: true,
      });

      setShowPostModal(false);
      setSelectedOption(null);
      fetchFades();
    } catch (err: any) {
      console.error('Error posting fade:', err);
    }
  };

  const handleAcceptFade = async (fade: Fade) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('fades')
        .update({
          accepter_id: user.id,
          status: 'locked',
          locked_at: new Date().toISOString(),
        })
        .eq('id', fade.id);

      if (error) throw error;

      // Post to chat
      const systemUser = await supabase.rpc('get_or_create_system_user');
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, username')
        .in('user_id', [fade.poster_id, user.id]);

      const posterProfile = profiles?.find(p => p.user_id === fade.poster_id);
      const accepterProfile = profiles?.find(p => p.user_id === user.id);

      const posterName = posterProfile?.display_name || posterProfile?.username || 'Poster';
      const accepterName = accepterProfile?.display_name || accepterProfile?.username || 'Someone';

      const oppositeOption = fade.fade_type === 'over' ? 'Under' : 
                            fade.fade_type === 'under' ? 'Over' : 
                            `Against ${fade.line_description}`;

      await supabase.from('huddle_messages').insert({
        huddle_id: huddleId,
        user_id: systemUser.data,
        content: `💥 ${accepterName} faded ${posterName}! Locked: ${posterName} (${fade.line_description}) vs ${accepterName} (${oppositeOption}) – ${fade.stake} points`,
        message_type: 'fade_notification',
        is_bot_message: true,
      });

      fetchFades();
    } catch (err: any) {
      console.error('Error accepting fade:', err);
    }
  };

  const gameTime = game ? new Date(game.commence_time) : null;
  const isGameLocked = gameTime ? isPast(gameTime) : false;

  // Group fades by date
  const groupedFades = fades.reduce((acc, fade) => {
    const date = format(new Date(fade.created_at), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(fade);
    return acc;
  }, {} as Record<string, Fade[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Game Header */}
      <div className="p-4 bg-zinc-900/50 border-b border-zinc-800">
        {game ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider">
                {game.sport_key.includes('ncaa') ? 'NCAA' : 'NFL'}
              </span>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="h-3 w-3" />
                {isGameLocked ? (
                  <span className="text-red-400">Locked</span>
                ) : (
                  <span>{formatDistanceToNow(gameTime!, { addSuffix: true })}</span>
                )}
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              {game.away_team} @ {game.home_team}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <CalendarDays className="h-4 w-4" />
              {format(gameTime!, 'EEE, MMM d, h:mm a')}
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-400">{error || 'No upcoming games'}</p>
          </div>
        )}
      </div>

      {/* Fade Options (fixed section) */}
      {game && !isGameLocked && (
        <div className="p-4 space-y-2 border-b border-zinc-800">
          {fadeOptions.map((option) => (
            <FadeOptionCard
              key={option.type}
              label={option.label}
              onClick={() => handleOptionClick(option)}
            />
          ))}
        </div>
      )}

      {/* Active & Past Fades */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.entries(groupedFades).map(([date, dateFades]) => (
          <div key={date}>
            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 border-t border-dotted border-gray-600" />
              <span className="text-xs text-gray-500">
                {format(new Date(date), 'EEEE, MMM d')}
              </span>
              <div className="flex-1 border-t border-dotted border-gray-600" />
            </div>
            
            <div className="space-y-3">
              {dateFades.map((fade) => {
                if (fade.status === 'open') {
                  return (
                    <ActiveFadeCard
                      key={fade.id}
                      fade={fade}
                      currentUserId={user?.id}
                      onAccept={() => handleAcceptFade(fade)}
                    />
                  );
                } else if (fade.status === 'locked') {
                  return <LockedFadeCard key={fade.id} fade={fade} />;
                } else if (fade.status === 'settled') {
                  return <SettledFadeCard key={fade.id} fade={fade} currentUserId={user?.id} />;
                } else {
                  // Expired
                  return (
                    <div key={fade.id} className="p-3 bg-zinc-900/30 rounded-lg opacity-50">
                      <p className="text-sm text-gray-500">Expired: {fade.line_description}</p>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        ))}

        {fades.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No fades yet</p>
            <p className="text-sm mt-1">Be the first to post!</p>
          </div>
        )}
      </div>

      {/* Post Fade Modal */}
      {showPostModal && selectedOption && (
        <PostFadeModal
          option={selectedOption}
          onPost={handlePostFade}
          onClose={() => {
            setShowPostModal(false);
            setSelectedOption(null);
          }}
        />
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FadeOptionCard } from './FadeOptionCard';
import { PostFadeModal } from './PostFadeModal';
import { ActiveFadeCard } from './ActiveFadeCard';
import { LockedFadeCard } from './LockedFadeCard';
import { SettledFadeCard } from './SettledFadeCard';
import { LiveCountdown } from './LiveCountdown';
import { CalendarDays, Loader2, Sparkles } from 'lucide-react';
import { format, isPast, differenceInHours } from 'date-fns';

interface FadesTabProps {
  huddleId: string;
  teamName: string;
  teamLeague: string;
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

export const FadesTab: React.FC<FadesTabProps> = ({ huddleId, teamName, teamLeague }) => {
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
  }, [huddleId, teamName, teamLeague]);

  // Determine sport based on league
  const getSport = (): string => {
    const league = teamLeague?.toUpperCase() || '';
    if (league === 'NFL') return 'nfl';
    if (league === 'NBA') return 'nba';
    // NCAA defaults to basketball during winter months, football during fall
    const month = new Date().getMonth();
    if (month >= 10 || month <= 2) return 'ncaab'; // Nov-Feb = basketball
    return 'ncaaf'; // Aug-Oct = football
  };

  const fetchOdds = async () => {
    try {
      setLoading(true);
      setError(null);

      const sport = getSport();
      console.log(`Fetching odds for ${teamName}, sport: ${sport}, league: ${teamLeague}`);

      const { data, error } = await supabase.functions.invoke('fades-get-odds', {
        body: { team: teamName, sport },
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
        .select('*')
        .eq('huddle_id', huddleId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for poster and accepter
      const userIds = [...new Set(data?.flatMap(f => [f.poster_id, f.accepter_id].filter(Boolean)) || [])];
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_url')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        const fadesWithProfiles = data?.map(fade => ({
          ...fade,
          poster: profileMap.get(fade.poster_id),
          accepter: fade.accepter_id ? profileMap.get(fade.accepter_id) : null,
        })) || [];

        setFades(fadesWithProfiles as Fade[]);
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

  const handlePostFade = async (stake: number, announceInChat: boolean) => {
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

      // Only post to chat if user checked the option
      if (announceInChat) {
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
      }

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

      // Post to chat (always announce accepts)
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
  const showCountdown = gameTime && differenceInHours(gameTime, new Date()) <= 24 && !isGameLocked;

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
              <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                {game.sport_key.includes('ncaa') ? 'NCAA' : game.sport_key.includes('nfl') ? 'NFL' : 'NBA'}
              </span>
              {showCountdown ? (
                <LiveCountdown targetTime={gameTime!} />
              ) : isGameLocked ? (
                <span className="text-xs font-medium text-red-400 bg-red-400/10 px-2 py-1 rounded">
                  LOCKED
                </span>
              ) : (
                <span className="text-xs text-gray-400">
                  {format(gameTime!, 'h:mm a')}
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              {game.away_team} @ {game.home_team}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <CalendarDays className="h-4 w-4" />
              {format(gameTime!, 'EEEE, MMMM d, yyyy • h:mm a')}
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-300 font-medium">No upcoming games found for {teamName}</p>
            <p className="text-sm text-gray-500 mt-1">Check back closer to game day</p>
          </div>
        )}
      </div>

      {/* Fade Options (fixed section) */}
      {game && !isGameLocked && (
        <div className="p-4 space-y-2 border-b border-zinc-800">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Pick your fade</p>
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
              <span className="text-xs text-gray-500 font-medium">
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
          <div className="text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto text-yellow-400/40 mb-4" />
            <p className="text-gray-300 font-medium">No fades yet</p>
            <p className="text-sm text-gray-500 mt-1">Be the first to post!</p>
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
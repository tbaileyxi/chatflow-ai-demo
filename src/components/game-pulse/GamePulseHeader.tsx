import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface GamePulseHeaderProps {
  teamId: string;
  teamName: string;
  isVisible: boolean;
}

interface LiveGameData {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  period: string;
  clock: string;
  status: 'live' | 'final' | 'scheduled';
  homeLogo?: string;
  awayLogo?: string;
}

export const GamePulseHeader: React.FC<GamePulseHeaderProps> = ({
  teamId,
  teamName,
  isVisible,
}) => {
  const [gameData, setGameData] = useState<LiveGameData | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);
  const [lastScore, setLastScore] = useState<string>('');

  useEffect(() => {
    if (!isVisible) return;

    const fetchLiveGame = async () => {
      try {
        // Check game_states table for live game
        const { data: gameState } = await supabase
          .from('game_states')
          .select('*')
          .contains('teams', [teamName])
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        if (gameState && gameState.last_status === 'STATUS_IN_PROGRESS') {
          const teams = gameState.teams as { home: string; away: string; homeLogo?: string; awayLogo?: string };
          const scores = gameState.last_score.split('-').map((s: string) => parseInt(s.trim()));
          
          const newScoreString = gameState.last_score;
          
          // Trigger pulse animation on score change
          if (lastScore && lastScore !== newScoreString) {
            setIsPulsing(true);
            setTimeout(() => setIsPulsing(false), 2000);
          }
          setLastScore(newScoreString);

          setGameData({
            homeTeam: teams.home || 'Home',
            awayTeam: teams.away || 'Away',
            homeScore: scores[1] || 0,
            awayScore: scores[0] || 0,
            period: `Q${gameState.last_period}`,
            clock: gameState.last_clock || '',
            status: 'live',
            homeLogo: teams.homeLogo,
            awayLogo: teams.awayLogo,
          });
        } else if (gameState?.last_status === 'STATUS_FINAL') {
          const teams = gameState.teams as { home: string; away: string };
          const scores = gameState.last_score.split('-').map((s: string) => parseInt(s.trim()));
          
          setGameData({
            homeTeam: teams.home || 'Home',
            awayTeam: teams.away || 'Away',
            homeScore: scores[1] || 0,
            awayScore: scores[0] || 0,
            period: 'FINAL',
            clock: '',
            status: 'final',
          });
        } else {
          setGameData(null);
        }
      } catch (error) {
        console.error('Error fetching live game:', error);
      }
    };

    fetchLiveGame();
    const interval = setInterval(fetchLiveGame, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [isVisible, teamName, lastScore]);

  if (!gameData || !isVisible) return null;

  const isLive = gameData.status === 'live';

  return (
    <div 
      className={cn(
        "sticky top-0 z-20 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border-b border-zinc-700/50",
        "transition-all duration-300",
        isPulsing && "animate-pulse ring-2 ring-primary/50"
      )}
    >
      <div className="flex items-center justify-between px-4 py-3">
        {/* Away Team */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center overflow-hidden">
            {gameData.awayLogo ? (
              <img src={gameData.awayLogo} alt={gameData.awayTeam} className="w-6 h-6" />
            ) : (
              <span className="text-xs font-bold text-white">
                {gameData.awayTeam.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <span className="text-sm font-medium text-white hidden sm:inline">
            {gameData.awayTeam}
          </span>
        </div>

        {/* Score Display */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3">
            <span 
              className={cn(
                "text-2xl font-bold tabular-nums transition-all",
                isPulsing ? "text-primary scale-110" : "text-white"
              )}
            >
              {gameData.awayScore}
            </span>
            <span className="text-zinc-500 text-lg">-</span>
            <span 
              className={cn(
                "text-2xl font-bold tabular-nums transition-all",
                isPulsing ? "text-primary scale-110" : "text-white"
              )}
            >
              {gameData.homeScore}
            </span>
          </div>
          
          {/* Status indicator */}
          <div className="flex items-center gap-2 mt-1">
            {isLive && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
            <span className={cn(
              "text-xs font-medium",
              isLive ? "text-red-400" : "text-zinc-400"
            )}>
              {isLive ? `${gameData.period} • ${gameData.clock}` : gameData.period}
            </span>
          </div>
        </div>

        {/* Home Team */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white hidden sm:inline">
            {gameData.homeTeam}
          </span>
          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center overflow-hidden">
            {gameData.homeLogo ? (
              <img src={gameData.homeLogo} alt={gameData.homeTeam} className="w-6 h-6" />
            ) : (
              <span className="text-xs font-bold text-white">
                {gameData.homeTeam.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Frown } from 'lucide-react';

interface SettledFadeCardProps {
  fade: {
    id: string;
    poster_id: string;
    accepter_id: string | null;
    line_description: string;
    stake: number;
    winner_id: string | null;
    final_score_home: number | null;
    final_score_away: number | null;
    home_team: string;
    away_team: string;
    poster?: { display_name: string | null; username: string | null; avatar_url: string | null };
    accepter?: { display_name: string | null; username: string | null; avatar_url: string | null };
  };
  currentUserId?: string;
}

export const SettledFadeCard: React.FC<SettledFadeCardProps> = ({ fade, currentUserId }) => {
  const posterName = fade.poster?.display_name || fade.poster?.username || 'Poster';
  const accepterName = fade.accepter?.display_name || fade.accepter?.username || 'Opponent';
  
  const winnerName = fade.winner_id === fade.poster_id ? posterName : accepterName;
  const loserName = fade.winner_id === fade.poster_id ? accepterName : posterName;
  
  const isCurrentUserWinner = fade.winner_id === currentUserId;
  const isCurrentUserInvolved = currentUserId === fade.poster_id || currentUserId === fade.accepter_id;

  const borderColor = isCurrentUserInvolved
    ? isCurrentUserWinner
      ? 'border-green-500/50'
      : 'border-red-500/50'
    : 'border-zinc-700';

  const bgColor = isCurrentUserInvolved
    ? isCurrentUserWinner
      ? 'bg-green-500/5'
      : 'bg-red-500/5'
    : 'bg-zinc-900';

  return (
    <div className={`p-4 rounded-xl border-2 ${borderColor} ${bgColor}`}>
      {/* Result Banner */}
      <div className={`flex items-center justify-center gap-2 mb-3 py-1 px-3 rounded-full ${
        isCurrentUserInvolved && isCurrentUserWinner
          ? 'bg-green-500/20'
          : isCurrentUserInvolved
          ? 'bg-red-500/20'
          : 'bg-zinc-800'
      }`}>
        {isCurrentUserInvolved && isCurrentUserWinner ? (
          <>
            <Trophy className="h-3 w-3 text-green-400" />
            <span className="text-xs font-semibold text-green-400 uppercase">You Won!</span>
          </>
        ) : isCurrentUserInvolved ? (
          <>
            <Frown className="h-3 w-3 text-red-400" />
            <span className="text-xs font-semibold text-red-400 uppercase">You Lost</span>
          </>
        ) : (
          <span className="text-xs font-semibold text-gray-400 uppercase">Settled</span>
        )}
      </div>

      {/* Score */}
      {fade.final_score_home !== null && fade.final_score_away !== null && (
        <div className="text-center mb-3">
          <p className="text-lg font-bold text-white">
            {fade.away_team} {fade.final_score_away} - {fade.final_score_home} {fade.home_team}
          </p>
        </div>
      )}

      {/* VS Layout */}
      <div className="flex items-center justify-between mb-4">
        {/* Poster */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar className={`h-12 w-12 border-2 ${
              fade.winner_id === fade.poster_id ? 'border-green-400' : 'border-red-400'
            }`}>
              <AvatarImage src={fade.poster?.avatar_url || undefined} />
              <AvatarFallback className={`font-bold ${
                fade.winner_id === fade.poster_id ? 'bg-green-500 text-white' : 'bg-red-500/50 text-white'
              }`}>
                {posterName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {fade.winner_id === fade.poster_id && (
              <Trophy className="absolute -top-1 -right-1 h-4 w-4 text-yellow-400" />
            )}
          </div>
          <span className="text-xs text-gray-400 mt-1 max-w-[80px] truncate">{posterName}</span>
          <span className={`text-xs font-bold ${
            fade.winner_id === fade.poster_id ? 'text-green-400' : 'text-red-400'
          }`}>
            {fade.winner_id === fade.poster_id ? `+${fade.stake}` : `-${fade.stake}`}
          </span>
        </div>

        {/* VS */}
        <div className="flex flex-col items-center">
          <span className="text-xl font-black text-gray-600">VS</span>
        </div>

        {/* Accepter */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar className={`h-12 w-12 border-2 ${
              fade.winner_id === fade.accepter_id ? 'border-green-400' : 'border-red-400'
            }`}>
              <AvatarImage src={fade.accepter?.avatar_url || undefined} />
              <AvatarFallback className={`font-bold ${
                fade.winner_id === fade.accepter_id ? 'bg-green-500 text-white' : 'bg-red-500/50 text-white'
              }`}>
                {accepterName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {fade.winner_id === fade.accepter_id && (
              <Trophy className="absolute -top-1 -right-1 h-4 w-4 text-yellow-400" />
            )}
          </div>
          <span className="text-xs text-gray-400 mt-1 max-w-[80px] truncate">{accepterName}</span>
          <span className={`text-xs font-bold ${
            fade.winner_id === fade.accepter_id ? 'text-green-400' : 'text-red-400'
          }`}>
            {fade.winner_id === fade.accepter_id ? `+${fade.stake}` : `-${fade.stake}`}
          </span>
        </div>
      </div>

      {/* Result Text */}
      <p className="text-sm text-gray-400 text-center">
        {fade.line_description} • <span className="text-white font-medium">{winnerName}</span> wins {fade.stake} points 🎉
      </p>
    </div>
  );
};

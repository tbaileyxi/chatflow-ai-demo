import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Lock } from 'lucide-react';

interface LockedFadeCardProps {
  fade: {
    id: string;
    poster_id: string;
    accepter_id: string | null;
    line_description: string;
    stake: number;
    fade_type: string;
    poster?: { display_name: string | null; username: string | null; avatar_url: string | null };
    accepter?: { display_name: string | null; username: string | null; avatar_url: string | null };
  };
}

export const LockedFadeCard: React.FC<LockedFadeCardProps> = ({ fade }) => {
  const posterName = fade.poster?.display_name || fade.poster?.username || 'Poster';
  const accepterName = fade.accepter?.display_name || fade.accepter?.username || 'Opponent';

  return (
    <div className="p-4 bg-zinc-900 rounded-xl border-2 border-blue-500/50">
      {/* Locked Banner */}
      <div className="flex items-center justify-center gap-2 mb-3 py-1 px-3 bg-blue-500/20 rounded-full">
        <Lock className="h-3 w-3 text-blue-400" />
        <span className="text-xs font-semibold text-blue-400 uppercase">Locked</span>
      </div>

      {/* VS Layout */}
      <div className="flex items-center justify-between mb-4">
        {/* Poster */}
        <div className="flex flex-col items-center">
          <Avatar className="h-12 w-12 border-2 border-yellow-400">
            <AvatarImage src={fade.poster?.avatar_url || undefined} />
            <AvatarFallback className="bg-yellow-400 text-black font-bold">
              {posterName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-gray-400 mt-1 max-w-[80px] truncate">{posterName}</span>
        </div>

        {/* VS */}
        <div className="flex flex-col items-center">
          <span className="text-2xl font-black text-blue-400">VS</span>
          <span className="text-xs text-gray-500">{fade.stake} pts</span>
        </div>

        {/* Accepter */}
        <div className="flex flex-col items-center">
          <Avatar className="h-12 w-12 border-2 border-blue-400">
            <AvatarImage src={fade.accepter?.avatar_url || undefined} />
            <AvatarFallback className="bg-blue-500 text-white font-bold">
              {accepterName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-gray-400 mt-1 max-w-[80px] truncate">{accepterName}</span>
        </div>
      </div>

      {/* Fade Details */}
      <p className="text-sm text-gray-400 text-center">
        <span className="text-white">{posterName}</span>
        {' '}({fade.line_description}) vs{' '}
        <span className="text-white">{accepterName}</span>
        {' '}({fade.fade_type === 'over' ? 'Under' : fade.fade_type === 'under' ? 'Over' : 'Opposite'})
      </p>
    </div>
  );
};

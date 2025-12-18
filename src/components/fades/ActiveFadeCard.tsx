import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Zap, Loader2 } from 'lucide-react';

interface ActiveFadeCardProps {
  fade: {
    id: string;
    poster_id: string;
    line_description: string;
    stake: number;
    fade_type: string;
    poster?: { display_name: string | null; username: string | null; avatar_url: string | null };
  };
  currentUserId?: string;
  onAccept: () => Promise<void>;
  isAccepting?: boolean;
}

export const ActiveFadeCard: React.FC<ActiveFadeCardProps> = ({
  fade,
  currentUserId,
  onAccept,
  isAccepting = false,
}) => {
  const [localAccepting, setLocalAccepting] = useState(false);
  const posterName = fade.poster?.display_name || fade.poster?.username || 'Someone';
  const isOwn = fade.poster_id === currentUserId;

  const handleAccept = async () => {
    if (localAccepting) return;
    setLocalAccepting(true);
    try {
      await onAccept();
    } finally {
      setLocalAccepting(false);
    }
  };

  const getOppositeLabel = () => {
    if (fade.fade_type === 'over') return 'Take Under';
    if (fade.fade_type === 'under') return 'Take Over';
    return 'Take Opposite';
  };

  return (
    <div className="p-4 bg-zinc-900 rounded-xl border-2 border-yellow-400/30">
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
          <span className="text-2xl font-black text-yellow-400">VS</span>
        </div>

        {/* Empty slot */}
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-zinc-700 border-2 border-dashed border-zinc-600 flex items-center justify-center">
            <span className="text-2xl text-zinc-600">?</span>
          </div>
          <span className="text-xs text-gray-500 mt-1">Open</span>
        </div>
      </div>

      {/* Fade Details */}
      <p className="text-sm text-gray-300 text-center mb-4">
        <span className="font-semibold text-white">{posterName}</span> posted{' '}
        <span className="font-bold text-yellow-400">{fade.stake} points</span> on{' '}
        <span className="font-medium">{fade.line_description}</span>
      </p>

      {/* Accept Button (only show if not own fade) */}
      {!isOwn && (
        <Button
          onClick={handleAccept}
          disabled={localAccepting || isAccepting}
          className="w-full h-12 bg-yellow-400 hover:bg-yellow-500 text-black font-bold disabled:opacity-50"
        >
          {localAccepting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Accepting...
            </>
          ) : (
            <>
              <Zap className="h-5 w-5 mr-2" />
              Fade This – {getOppositeLabel()}
            </>
          )}
        </Button>
      )}

      {isOwn && (
        <p className="text-center text-sm text-gray-500">
          Waiting for someone to fade...
        </p>
      )}
    </div>
  );
};

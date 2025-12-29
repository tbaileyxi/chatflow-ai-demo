import React from 'react';
import { Lock, Zap, Trophy, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface PrivateFeaturesTeaserProps {
  teamName: string;
  onCreatePrivate?: () => void;
}

export const PrivateFeaturesTeaser: React.FC<PrivateFeaturesTeaserProps> = ({
  teamName,
  onCreatePrivate,
}) => {
  const navigate = useNavigate();

  const handleCreatePrivate = () => {
    if (onCreatePrivate) {
      onCreatePrivate();
    } else {
      navigate('/');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold text-white mb-2">Unlock Private Features</h3>
        <p className="text-sm text-gray-400">
          Create a private huddle for the full experience
        </p>
      </div>

      {/* Blurred Feature Cards */}
      <div className="space-y-3">
        {/* Fades Preview */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-yellow-400/20 to-yellow-600/10 border border-yellow-400/30 p-4">
          <div className="absolute inset-0 backdrop-blur-sm bg-zinc-900/40" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white">Fades</h4>
              <p className="text-xs text-gray-400">Bet virtual points with friends</p>
            </div>
            <Lock className="h-4 w-4 text-yellow-400" />
          </div>
          
          {/* Blurred sample fades */}
          <div className="mt-3 space-y-2 filter blur-[2px] opacity-60">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-300">Over 45.5</span>
              <span className="text-yellow-400">100 pts</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-300">Bears +3.5</span>
              <span className="text-yellow-400">50 pts</span>
            </div>
          </div>
        </div>

        {/* Game Pulse Preview */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-red-400/20 to-red-600/10 border border-red-400/30 p-4">
          <div className="absolute inset-0 backdrop-blur-sm bg-zinc-900/40" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-400/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white">Game Pulse</h4>
              <p className="text-xs text-gray-400">Live scores & quick reactions</p>
            </div>
            <Lock className="h-4 w-4 text-red-400" />
          </div>
          
          {/* Blurred score header */}
          <div className="mt-3 filter blur-[2px] opacity-60">
            <div className="flex justify-center items-center gap-4 text-sm">
              <span className="text-gray-300">CHI</span>
              <span className="text-xl font-bold text-white">24 - 21</span>
              <span className="text-gray-300">GB</span>
            </div>
          </div>
        </div>

        {/* Leaderboard Preview */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-400/20 to-purple-600/10 border border-purple-400/30 p-4">
          <div className="absolute inset-0 backdrop-blur-sm bg-zinc-900/40" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-400/20 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white">Rivalries</h4>
              <p className="text-xs text-gray-400">Season standings & head-to-head</p>
            </div>
            <Lock className="h-4 w-4 text-purple-400" />
          </div>
        </div>
      </div>

      {/* CTA */}
      <Button
        onClick={handleCreatePrivate}
        className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
      >
        Create Private Huddle
      </Button>
      
      <p className="text-center text-xs text-gray-500">
        Private = participation. Public = awareness.
      </p>
    </div>
  );
};

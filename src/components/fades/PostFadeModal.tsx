import React, { useState } from 'react';
import { X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FadeOption {
  type: string;
  label: string;
  line_value: number;
  description: string;
}

interface PostFadeModalProps {
  option: FadeOption;
  onPost: (stake: number) => void;
  onClose: () => void;
}

export const PostFadeModal: React.FC<PostFadeModalProps> = ({
  option,
  onPost,
  onClose,
}) => {
  const [selectedStake, setSelectedStake] = useState<number>(100);
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    setPosting(true);
    await onPost(selectedStake);
    setPosting(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm bg-zinc-900 rounded-2xl border border-yellow-400/30 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-lg font-bold text-white">Post Fade</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Selected Option */}
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-1">You're posting</p>
            <p className="text-xl font-bold text-yellow-400">{option.label}</p>
          </div>

          {/* Stake Selector */}
          <div className="space-y-3">
            <p className="text-sm text-gray-400 text-center">Select stake</p>
            <div className="flex gap-3">
              {[50, 100, 200].map((stake) => (
                <button
                  key={stake}
                  onClick={() => setSelectedStake(stake)}
                  className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${
                    selectedStake === stake
                      ? 'bg-yellow-400 text-black border-2 border-yellow-400'
                      : 'bg-zinc-800 text-white border-2 border-zinc-700 hover:border-yellow-400/50'
                  }`}
                >
                  {stake}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <p className="text-xs text-gray-500 text-center">
            Winner takes {selectedStake * 2} points total
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2 border-t border-zinc-800">
          <Button
            onClick={handlePost}
            disabled={posting}
            className="w-full h-14 bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-lg"
          >
            {posting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⚡</span> Posting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="h-5 w-5" /> Post Fade
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full text-gray-400 hover:text-white"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

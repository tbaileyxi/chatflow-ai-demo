import React from 'react';
import { Zap } from 'lucide-react';

interface FadeOptionCardProps {
  label: string;
  onClick: () => void;
}

export const FadeOptionCard: React.FC<FadeOptionCardProps> = ({ label, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full p-4 bg-zinc-900 border-2 border-yellow-400/50 rounded-xl 
                 hover:border-yellow-400 hover:bg-zinc-800 transition-all
                 flex items-center justify-between group"
    >
      <span className="text-lg font-bold text-white group-hover:text-yellow-400 transition-colors">
        {label}
      </span>
      <Zap className="h-5 w-5 text-yellow-400 opacity-50 group-hover:opacity-100 transition-opacity" />
    </button>
  );
};

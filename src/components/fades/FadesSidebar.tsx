import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RivalriesTab } from './RivalriesTab';
import { FadesTab } from './FadesTab';

interface FadesSidebarProps {
  huddleId: string;
  teamName: string;
  onClose: () => void;
}

export const FadesSidebar: React.FC<FadesSidebarProps> = ({
  huddleId,
  teamName,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'rivalries' | 'fades'>('rivalries');

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-zinc-950 border-l border-yellow-400/30 z-50 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-yellow-400/20">
        <h2 className="text-xl font-bold text-yellow-400">⚡ Fades</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-gray-400 hover:text-white hover:bg-zinc-800"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Tab Switcher */}
      <div className="flex p-2 gap-2 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('rivalries')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
            activeTab === 'rivalries'
              ? 'bg-yellow-400 text-black'
              : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
          }`}
        >
          Rivalries
        </button>
        <button
          onClick={() => setActiveTab('fades')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
            activeTab === 'fades'
              ? 'bg-yellow-400 text-black'
              : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
          }`}
        >
          Fades
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'rivalries' ? (
          <RivalriesTab huddleId={huddleId} />
        ) : (
          <FadesTab huddleId={huddleId} teamName={teamName} />
        )}
      </div>
    </div>
  );
};

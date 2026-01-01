import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DevBannerProps {
  eventId?: string;
  huddleId?: string;
  pulseCount?: number;
  huddleCreated?: boolean;
  team1Name?: string;
  team2Name?: string;
  eventStatus?: string;
}

export function DevBanner({
  eventId,
  huddleId,
  pulseCount,
  huddleCreated,
  team1Name,
  team2Name,
  eventStatus
}: DevBannerProps) {
  const location = useLocation();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Determine environment
  const isDev = window.location.hostname.includes('localhost') || 
                window.location.hostname.includes('lovableproject.com');

  return (
    <>
      {/* DEV Pill - Always visible, top-left */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed top-8 left-2 z-[9999]",
          "bg-destructive text-destructive-foreground",
          "text-[10px] px-2 py-0.5 rounded-full font-mono font-bold",
          "flex items-center gap-1 shadow-lg",
          "hover:opacity-90 transition-opacity"
        )}
      >
        DEV
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {/* Debug Drawer Overlay */}
      {isOpen && (
        <div 
          className={cn(
            "fixed top-14 left-2 z-[9998]",
            "bg-background/95 backdrop-blur-md",
            "border border-border rounded-lg shadow-xl",
            "p-3 max-w-xs text-[10px] font-mono",
            "animate-in fade-in slide-in-from-top-2"
          )}
        >
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-1 right-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>

          <div className="space-y-2">
            <div className="border-b border-border pb-2">
              <span className="text-muted-foreground">ROUTE:</span>{' '}
              <span className="text-primary font-bold">{location.pathname}</span>
            </div>

            <div>
              <span className="text-muted-foreground">user:</span>{' '}
              <span>{user?.id?.slice(0, 8) || 'anon'}</span>
            </div>

            <div>
              <span className="text-muted-foreground">env:</span>{' '}
              <span>{isDev ? 'dev' : 'prod'}</span>
            </div>

            {eventId && (
              <div className="border-t border-border pt-2 mt-2">
                <div className="text-yellow-400 font-bold mb-1">EVENT</div>
                <div><span className="text-muted-foreground">id:</span> {eventId.slice(0, 8)}</div>
                <div><span className="text-muted-foreground">status:</span> {eventStatus || 'unknown'}</div>
                <div><span className="text-muted-foreground">teams:</span> {team1Name} vs {team2Name}</div>
              </div>
            )}

            {huddleId && (
              <div className="border-t border-border pt-2 mt-2">
                <div className="text-blue-400 font-bold mb-1">HUDDLE</div>
                <div><span className="text-muted-foreground">id:</span> {huddleId.slice(0, 8)}</div>
                <div><span className="text-muted-foreground">created:</span> {huddleCreated ? 'yes' : 'no'}</div>
              </div>
            )}

            {typeof pulseCount === 'number' && (
              <div className="border-t border-border pt-2 mt-2">
                <div className="text-purple-400 font-bold mb-1">PULSE</div>
                <div><span className="text-muted-foreground">items:</span> {pulseCount}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

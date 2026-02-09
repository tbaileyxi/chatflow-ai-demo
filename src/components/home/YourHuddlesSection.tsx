import React from 'react';
import { Users, Globe, Lock, ChevronRight, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Huddle {
  id: string;
  name: string;
  team_name: string;
  team_logo_url: string;
  participant_count: number;
  is_verified?: boolean;
  is_official_team_huddle?: boolean;
  unread_count?: number;
  latest_message?: {
    content: string;
    created_at: string;
    is_bot_message?: boolean;
  };
}

interface YourHuddlesSectionProps {
  publicHuddles: Huddle[];
  privateHuddles: Huddle[];
  loading: boolean;
}

export const YourHuddlesSection = ({ 
  publicHuddles, 
  privateHuddles, 
  loading 
}: YourHuddlesSectionProps) => {
  const navigate = useNavigate();
  const hasAnyHuddles = publicHuddles.length > 0 || privateHuddles.length > 0;

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Your Huddles</h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (!hasAnyHuddles) {
    return null; // Don't show empty state per spec
  }

  const isRecentlyActive = (huddle: Huddle) => {
    if (!huddle.latest_message?.created_at) return false;
    const ts = new Date(huddle.latest_message.created_at).getTime();
    return (Date.now() - ts) < 60 * 60 * 1000; // 1 hour
  };

  const HuddleCard = ({ huddle, type }: { huddle: Huddle; type: 'public' | 'private' | 'hosted' }) => {
    const active = isRecentlyActive(huddle);
    const hasNew = active || (huddle.unread_count && huddle.unread_count > 0);
    
    return (
      <button
        onClick={() => navigate(`/huddle/${huddle.id}`)}
        className={cn(
          "w-full text-left rounded-xl p-3 border transition-all",
          type === 'public' 
            ? "bg-primary/5 border-primary/20 hover:bg-primary/10" 
            : type === 'hosted'
            ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15"
            : "bg-card border-border/50 hover:border-primary/30"
        )}
      >
        <div className="flex items-center gap-3">
          <Avatar className={cn("h-12 w-12", active && "ring-2 ring-green-500")}>
            <AvatarImage src={huddle.team_logo_url} alt={huddle.name} />
            <AvatarFallback className="text-xs bg-muted">
              {huddle.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {type === 'public' ? (
                <Globe className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              ) : type === 'hosted' ? (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <span className="font-semibold text-sm truncate">
                {type === 'public' ? huddle.team_name : huddle.name}
              </span>
              {type === 'hosted' && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-emerald-500/50 text-emerald-500 font-bold">
                  HOSTED
                </Badge>
              )}
              {hasNew && (
                <Badge variant="default" className="h-5 px-1.5 text-[10px] bg-green-500">
                  New
                </Badge>
              )}
            </div>
            {huddle.latest_message && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {huddle.latest_message.is_bot_message && '🤖 '}
                {huddle.latest_message.content}
              </p>
            )}
          </div>

          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>
      </button>
    );
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Your Huddles</h2>
      </div>

      {/* Public Huddles */}
      {publicHuddles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Public Huddles</h3>
          </div>
          <div className="space-y-2">
            {publicHuddles.map((huddle) => (
              <HuddleCard key={huddle.id} huddle={huddle} type="public" />
            ))}
          </div>
        </div>
      )}

      {/* Hosted Huddles */}
      {privateHuddles.filter(h => h.is_verified).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-emerald-500 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Hosted Huddles
            </h3>
          </div>
          <div className="space-y-2">
            {privateHuddles.filter(h => h.is_verified).map((huddle) => (
              <HuddleCard key={huddle.id} huddle={huddle} type="hosted" />
            ))}
          </div>
        </div>
      )}

      {/* Private Huddles */}
      {privateHuddles.filter(h => !h.is_verified).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Private</h3>
          </div>
          <div className="space-y-2">
            {privateHuddles.filter(h => !h.is_verified).map((huddle) => (
              <HuddleCard key={huddle.id} huddle={huddle} type="private" />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

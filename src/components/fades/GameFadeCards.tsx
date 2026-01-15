import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, ChevronDown, ChevronUp, Zap, Clock, Receipt } from 'lucide-react';
import { format, isPast, differenceInHours } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { FadeConfirmSheet } from './FadeConfirmSheet';

interface GameData {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  sport_key: string;
}

interface FadeOption {
  type: 'over' | 'under' | 'spread' | 'spread_against' | 'moneyline_home' | 'moneyline_away';
  label: string;
  line_value: number;
  description: string;
}

interface GameFadeCardsProps {
  huddleId: string;
  teamName: string;
  teamLeague: string;
  isPrivate?: boolean;
  onFadePosted?: () => void;
  onViewLedger?: () => void;
}

export const GameFadeCards: React.FC<GameFadeCardsProps> = ({
  huddleId,
  teamName,
  teamLeague,
  isPrivate = false,
  onFadePosted,
  onViewLedger,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<GameData | null>(null);
  const [fadeOptions, setFadeOptions] = useState<FadeOption[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [selectedOption, setSelectedOption] = useState<FadeOption | null>(null);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [oddsUnavailable, setOddsUnavailable] = useState(false);

  // Determine sport based on league and season
  const getSport = useCallback((): string => {
    const league = teamLeague?.toUpperCase() || '';
    if (league === 'NFL') return 'nfl';
    if (league === 'NBA') return 'nba';
    const month = new Date().getMonth();
    if (month === 11 || month === 0) return 'ncaaf';
    if (month >= 1 && month <= 2) return 'ncaab';
    if (month >= 10) return 'ncaab';
    return 'ncaaf';
  }, [teamLeague]);

  const loadFallbackGameFromFades = useCallback(async (): Promise<GameData | null> => {
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('fades')
        .select('game_id, home_team, away_team, game_commence_time, sport')
        .eq('huddle_id', huddleId)
        .in('status', ['open', 'locked'])
        .gt('game_commence_time', nowIso)
        .order('game_commence_time', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const fallbackGame: GameData = {
        id: data.game_id,
        home_team: data.home_team,
        away_team: data.away_team,
        commence_time: data.game_commence_time,
        sport_key: data.sport,
      };

      setGame(fallbackGame);
      setFadeOptions([]);
      return fallbackGame;
    } catch (err) {
      console.error('Error loading fallback game from fades:', err);
      return null;
    }
  }, [huddleId]);

  const fetchOdds = useCallback(async () => {
    try {
      setLoading(true);
      setOddsUnavailable(false);

      const sport = getSport();
      const cacheKey = `fades-odds:${sport}:${teamName.toLowerCase().trim()}`;

      // 15-minute client cache to reduce Odds API usage
      try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as { ts: number; data: any };
          if (cached?.ts && Date.now() - cached.ts < 15 * 60 * 1000 && cached?.data?.game) {
            setGame(cached.data.game);
            setFadeOptions(cached.data.fade_options || []);
            return;
          }
        }
      } catch {
        // ignore cache errors
      }

      const { data, error } = await supabase.functions.invoke('fades-get-odds', {
        body: { team: teamName, sport },
      });

      if (error) throw error;

      try {
        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
      } catch {
        // ignore cache errors
      }

      if (data?.game) {
        setGame(data.game);
        setFadeOptions(data.fade_options || []);
        return;
      }

      // Odds API can return game=null when rate limited. If there are open/locked upcoming
      // fades in this huddle, keep the pinned header visible by deriving matchup + time from fades.
      setOddsUnavailable(true);
      const fallback = await loadFallbackGameFromFades();
      if (!fallback) {
        setGame(null);
        setFadeOptions([]);
      }
    } catch (err) {
      console.error('Error fetching odds:', err);
      setOddsUnavailable(true);
      // Same fallback for network/API failures
      const fallback = await loadFallbackGameFromFades();
      if (!fallback) {
        setGame(null);
        setFadeOptions([]);
      }
    } finally {
      setLoading(false);
    }
  }, [teamName, getSport, loadFallbackGameFromFades]);

  useEffect(() => {
    fetchOdds();
  }, [fetchOdds]);

  const handleOptionSelect = (option: FadeOption) => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to post a fade', variant: 'destructive' });
      return;
    }
    setSelectedOption(option);
    setShowConfirmSheet(true);
  };

  const handleConfirmFade = async (stake: number) => {
    if (!user || !game || !selectedOption) return;

    try {
      const { error } = await supabase.from('fades').insert({
        huddle_id: huddleId,
        poster_id: user.id,
        game_id: game.id,
        game_commence_time: game.commence_time,
        home_team: game.home_team,
        away_team: game.away_team,
        sport: game.sport_key,
        fade_type: selectedOption.type,
        line_value: selectedOption.line_value,
        line_description: selectedOption.description,
        stake,
      });

      if (error) throw error;

      // Post to chat
      const { data: systemUserId } = await supabase.rpc('get_or_create_system_user');
      if (systemUserId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('user_id', user.id)
          .single();

        const posterName = profile?.display_name || profile?.username || 'Someone';
        const lockTime = format(new Date(game.commence_time), 'MMM d, h:mm a');

        await supabase.from('huddle_messages').insert({
          huddle_id: huddleId,
          user_id: systemUserId,
          content: `⚡ ${posterName} took ${selectedOption.label} for $${stake} (locks at ${lockTime})`,
          message_type: 'fade_notification',
          is_bot_message: true,
        });
      }

      toast({ title: '⚡ Fade Posted!', description: `${selectedOption.label} for $${stake}` });
      setShowConfirmSheet(false);
      setSelectedOption(null);
      onFadePosted?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to post fade', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!game) {
    return null; // No upcoming game
  }

  const gameTime = new Date(game.commence_time);
  const isGameLocked = isPast(gameTime);
  const hoursUntil = differenceInHours(gameTime, new Date());
  const showCountdown = hoursUntil <= 24 && hoursUntil > 0;

  if (isGameLocked) {
    return null; // Don't show if game already started
  }

  const maxStake = isPrivate ? 200 : 10;

  return (
    <>
      <Card data-fade-cards className="mx-4 mb-4 overflow-hidden border-primary/30 bg-card/50 backdrop-blur">
        {/* Header - Always Visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-foreground">
                {game.away_team} @ {game.home_team}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {showCountdown ? (
                  <span className="text-primary font-medium">
                    Locks in {hoursUntil}h
                  </span>
                ) : (
                  <span>{format(gameTime, 'MMM d, h:mm a')}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full",
              isPrivate ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400"
            )}>
              Max ${maxStake}
            </span>
            {expanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Expanded Options */}
        {expanded && (
          <div className="px-4 pb-4 space-y-2 border-t border-border/50 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">
                Select your side — someone else will fade you
              </p>
              {onViewLedger && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewLedger();
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                >
                  <Receipt className="h-3 w-3 mr-1" />
                  Ledger
                </Button>
              )}
            </div>
            {fadeOptions.map((option) => (
              <Button
                key={`${option.type}-${option.line_value}`}
                variant="outline"
                className="w-full h-auto py-3 px-4 hover:bg-primary/10 hover:border-primary text-left"
                onClick={() => handleOptionSelect(option)}
              >
                <div className="flex flex-col items-start gap-1 min-w-0 w-full">
                  <span className="font-semibold text-primary truncate max-w-full">{option.label}</span>
                  <span className="text-muted-foreground text-xs whitespace-normal break-words">{option.description}</span>
                </div>
              </Button>
            ))}
          </div>
        )}
      </Card>

      {/* Confirm Sheet */}
      <FadeConfirmSheet
        open={showConfirmSheet}
        onOpenChange={setShowConfirmSheet}
        option={selectedOption}
        game={game}
        maxStake={maxStake}
        isPrivate={isPrivate}
        onConfirm={handleConfirmFade}
      />
    </>
  );
};
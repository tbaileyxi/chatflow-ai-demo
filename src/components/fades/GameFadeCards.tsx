import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, ChevronDown, ChevronUp, Zap, Clock } from 'lucide-react';
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
}

export const GameFadeCards: React.FC<GameFadeCardsProps> = ({
  huddleId,
  teamName,
  teamLeague,
  isPrivate = false,
  onFadePosted,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<GameData | null>(null);
  const [fadeOptions, setFadeOptions] = useState<FadeOption[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [selectedOption, setSelectedOption] = useState<FadeOption | null>(null);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);

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

  const fetchOdds = useCallback(async () => {
    try {
      setLoading(true);
      const sport = getSport();
      
      const { data, error } = await supabase.functions.invoke('fades-get-odds', {
        body: { team: teamName, sport },
      });

      if (error) throw error;

      if (data.game) {
        setGame(data.game);
        setFadeOptions(data.fade_options || []);
      }
    } catch (err) {
      console.error('Error fetching odds:', err);
    } finally {
      setLoading(false);
    }
  }, [teamName, getSport]);

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
      <Card className="mx-4 mb-4 overflow-hidden border-primary/30 bg-card/50 backdrop-blur">
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
            <p className="text-xs text-muted-foreground mb-2">
              Select your side — someone else will fade you
            </p>
            {fadeOptions.map((option) => (
              <Button
                key={`${option.type}-${option.line_value}`}
                variant="outline"
                className="w-full justify-between h-auto py-3 px-4 hover:bg-primary/10 hover:border-primary"
                onClick={() => handleOptionSelect(option)}
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-muted-foreground text-sm">{option.description}</span>
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
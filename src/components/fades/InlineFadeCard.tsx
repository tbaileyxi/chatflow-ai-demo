import React, { useState, useCallback } from 'react';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { Lock, Clock, Zap, Check, X, DollarSign, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface FadeData {
  id: string;
  poster_id: string;
  accepter_id: string | null;
  game_id: string;
  game_commence_time: string;
  home_team: string;
  away_team: string;
  fade_type: string;
  line_value: number;
  line_description: string;
  stake: number;
  status: 'open' | 'locked' | 'settled' | 'expired';
  winner_id: string | null;
  final_score_home: number | null;
  final_score_away: number | null;
  settlement_status?: 'unpaid' | 'paid_unverified' | 'paid_verified';
  poster?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  accepter?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface InlineFadeCardProps {
  fade: FadeData;
  huddleId: string;
  isPrivate?: boolean;
  hasCashMode?: boolean;
  onAccepted?: () => void;
  onSettlementUpdate?: () => void;
}

export const InlineFadeCard: React.FC<InlineFadeCardProps> = ({
  fade,
  huddleId,
  isPrivate = false,
  hasCashMode = false,
  onAccepted,
  onSettlementUpdate,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accepting, setAccepting] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  const gameTime = new Date(fade.game_commence_time);
  const isGameStarted = isPast(gameTime);
  const isOwn = user?.id === fade.poster_id;
  const isAccepter = user?.id === fade.accepter_id;
  const isParticipant = isOwn || isAccepter;

  const posterName = fade.poster?.display_name || fade.poster?.username || 'Poster';
  const accepterName = fade.accepter?.display_name || fade.accepter?.username || 'Opponent';

  // Determine if current user won/lost for settled fades
  const isWinner = fade.status === 'settled' && fade.winner_id === user?.id;
  const isLoser = fade.status === 'settled' && fade.winner_id && fade.winner_id !== user?.id && isParticipant;

  const getOppositeLabel = () => {
    if (fade.fade_type === 'over') return 'Under';
    if (fade.fade_type === 'under') return 'Over';
    return 'Fade';
  };

  const handleAccept = useCallback(async () => {
    if (!user || accepting) return;
    
    setAccepting(true);
    try {
      // Check if game has started
      if (isGameStarted) {
        await supabase.from('fades').update({ status: 'expired' }).eq('id', fade.id).eq('status', 'open');
        toast({ title: 'Expired', description: 'This game has already started', variant: 'destructive' });
        return;
      }

      const { error } = await supabase
        .from('fades')
        .update({
          accepter_id: user.id,
          status: 'locked',
          locked_at: new Date().toISOString(),
        })
        .eq('id', fade.id)
        .eq('status', 'open');

      if (error) throw error;

      // Post acceptance message
      const { data: systemUserId } = await supabase.rpc('get_or_create_system_user');
      if (systemUserId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('user_id', user.id)
          .single();
        
        const myName = profile?.display_name || profile?.username || 'Someone';
        await supabase.from('huddle_messages').insert({
          huddle_id: huddleId,
          user_id: systemUserId,
          content: `💥 ${myName} faded ${posterName}! LOCKED: ${posterName} (${fade.line_description}) vs ${myName} (${getOppositeLabel()}) – $${fade.stake}`,
          message_type: 'fade_notification',
          is_bot_message: true,
        });
      }

      toast({ title: '🔒 Locked!', description: `You faded ${posterName} for $${fade.stake}` });
      onAccepted?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to accept fade', variant: 'destructive' });
    } finally {
      setAccepting(false);
    }
  }, [user, fade, huddleId, posterName, isGameStarted, accepting, toast, onAccepted]);

  const handleMarkPaid = useCallback(async () => {
    if (!user || markingPaid) return;
    setMarkingPaid(true);
    
    try {
      const newStatus = fade.settlement_status === 'unpaid' ? 'paid_unverified' : 'paid_verified';
      
      await supabase
        .from('fades')
        .update({
          settlement_status: newStatus,
          paid_marked_at: newStatus === 'paid_unverified' ? new Date().toISOString() : undefined,
          paid_marked_by: newStatus === 'paid_unverified' ? user.id : undefined,
          paid_confirmed_at: newStatus === 'paid_verified' ? new Date().toISOString() : undefined,
          paid_confirmed_by: newStatus === 'paid_verified' ? user.id : undefined,
        })
        .eq('id', fade.id);

      toast({ title: newStatus === 'paid_verified' ? '✅ Verified!' : '📤 Marked Paid' });
      onSettlementUpdate?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setMarkingPaid(false);
    }
  }, [user, fade, markingPaid, toast, onSettlementUpdate]);

  const handleVenmoSettle = useCallback(() => {
    if (!isPrivate) {
      toast({ title: 'Private Huddle Required', description: 'Venmo settlement is only available in private huddles', variant: 'destructive' });
      return;
    }
    
    if (!hasCashMode) {
      // Trigger upsell - parent component should handle showing the modal
      toast({ title: 'Cash Mode Required', description: 'Upgrade to Cash Mode for Venmo settlement' });
      return;
    }
    
    const note = encodeURIComponent(`SideHuddle fade: ${fade.line_description}`);
    const venmoUrl = `venmo://paycharge?txn=pay&amount=${fade.stake}&note=${note}`;
    window.open(venmoUrl, '_blank');
  }, [hasCashMode, isPrivate, fade, toast]);

  // Render based on status
  if (fade.status === 'expired') {
    return (
      <div className="p-3 bg-muted/30 rounded-xl border border-border/30 opacity-60">
        <div className="flex items-center gap-2 text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="text-sm">Expired – No taker</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{fade.line_description}</p>
      </div>
    );
  }

  if (fade.status === 'settled') {
    return (
      <div className={cn(
        "p-4 rounded-xl border-2 transition-all",
        isWinner ? "bg-green-500/10 border-green-500/50" :
        isLoser ? "bg-red-500/10 border-red-500/50" :
        "bg-muted/30 border-border/50"
      )}>
        {/* Result Banner */}
        <div className={cn(
          "flex items-center justify-center gap-2 mb-3 py-1 px-3 rounded-full w-fit mx-auto",
          isWinner ? "bg-green-500/20 text-green-400" :
          isLoser ? "bg-red-500/20 text-red-400" :
          "bg-muted text-muted-foreground"
        )}>
          {isWinner ? <Check className="h-3 w-3" /> : isLoser ? <X className="h-3 w-3" /> : null}
          <span className="text-xs font-bold uppercase">
            {isWinner ? 'You Won!' : isLoser ? 'You Lost' : 'Settled'}
          </span>
        </div>

        {/* Score Display */}
        {fade.final_score_home !== null && fade.final_score_away !== null && (
          <div className="text-center mb-3">
            <span className="text-lg font-bold text-foreground">
              {fade.home_team} {fade.final_score_home} - {fade.final_score_away} {fade.away_team}
            </span>
          </div>
        )}

        {/* Matchup */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Avatar className={cn("h-8 w-8 border-2", fade.winner_id === fade.poster_id ? "border-green-400" : "border-muted")}>
              <AvatarImage src={fade.poster?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs">{posterName[0]}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{posterName}</span>
          </div>
          <span className="text-xl font-black text-muted-foreground">VS</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{accepterName}</span>
            <Avatar className={cn("h-8 w-8 border-2", fade.winner_id === fade.accepter_id ? "border-green-400" : "border-muted")}>
              <AvatarImage src={fade.accepter?.avatar_url || undefined} />
              <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">{accepterName[0]}</AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Settlement Actions */}
        {isParticipant && fade.settlement_status !== 'paid_verified' && (
          <div className="flex gap-2 mt-3">
            {isLoser && fade.settlement_status === 'unpaid' && (
              <>
                <Button size="sm" onClick={handleMarkPaid} disabled={markingPaid} className="flex-1">
                  <DollarSign className="h-3 w-3 mr-1" />
                  I Paid
                </Button>
                {isPrivate && hasCashMode && (
                  <Button size="sm" variant="outline" onClick={handleVenmoSettle} className="flex-1">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Venmo
                  </Button>
                )}
              </>
            )}
            {isWinner && fade.settlement_status === 'paid_unverified' && (
              <Button size="sm" onClick={handleMarkPaid} disabled={markingPaid} className="flex-1 bg-green-500 hover:bg-green-600">
                <Check className="h-3 w-3 mr-1" />
                Confirm Received
              </Button>
            )}
          </div>
        )}

        {fade.settlement_status === 'paid_verified' && (
          <div className="text-center text-xs text-green-400 mt-2">✅ Settled</div>
        )}
      </div>
    );
  }

  if (fade.status === 'locked') {
    return (
      <div className="p-4 bg-primary/10 rounded-xl border-2 border-primary/50">
        <div className="flex items-center justify-center gap-2 mb-3 py-1 px-3 bg-primary/20 rounded-full w-fit mx-auto">
          <Lock className="h-3 w-3 text-primary" />
          <span className="text-xs font-bold text-primary uppercase">Locked</span>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col items-center">
            <Avatar className="h-10 w-10 border-2 border-primary">
              <AvatarImage src={fade.poster?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary">{posterName[0]}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground mt-1 max-w-[60px] truncate">{posterName}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xl font-black text-primary">VS</span>
            <span className="text-xs text-muted-foreground">${fade.stake}</span>
          </div>
          <div className="flex flex-col items-center">
            <Avatar className="h-10 w-10 border-2 border-secondary">
              <AvatarImage src={fade.accepter?.avatar_url || undefined} />
              <AvatarFallback className="bg-secondary text-secondary-foreground">{accepterName[0]}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground mt-1 max-w-[60px] truncate">{accepterName}</span>
          </div>
        </div>

        <p className="text-sm text-center text-muted-foreground">
          <span className="text-foreground">{posterName}</span> ({fade.line_description}) vs{' '}
          <span className="text-foreground">{accepterName}</span> ({getOppositeLabel()})
        </p>
      </div>
    );
  }

  // Open fade
  return (
    <div className="p-4 bg-card rounded-xl border border-border/50 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={fade.poster?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs">{posterName[0]}</AvatarFallback>
          </Avatar>
          <div>
            <span className="text-sm font-medium">{posterName}</span>
            <span className="text-xs text-muted-foreground ml-2">posted a fade</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{format(gameTime, 'MMM d, h:mm a')}</span>
        </div>
      </div>

      {/* Game Info */}
      <div className="mb-3">
        <div className="text-sm font-semibold text-foreground mb-1">
          {fade.away_team} @ {fade.home_team}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-primary font-bold">{fade.line_description}</span>
          <span className="text-lg font-black text-foreground">${fade.stake}</span>
        </div>
      </div>

      {/* Privacy Label */}
      <div className="mb-3">
        <span className={cn(
          "text-[10px] px-2 py-0.5 rounded-full",
          isPrivate ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400"
        )}>
          {isPrivate ? 'Private — cash enabled' : 'Public — no cash'}
        </span>
      </div>

      {/* Actions */}
      {!isOwn && !isGameStarted && (
        <Button
          onClick={handleAccept}
          disabled={accepting}
          className="w-full bg-primary hover:bg-primary/90"
        >
          {accepting ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Locking...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Fade ({getOppositeLabel()}) – ${fade.stake}
            </span>
          )}
        </Button>
      )}

      {isOwn && (
        <p className="text-xs text-center text-muted-foreground">
          Your fade – waiting for taker
        </p>
      )}

      {isGameStarted && fade.status === 'open' && (
        <p className="text-xs text-center text-destructive">
          Game started – no longer accepting fades
        </p>
      )}
    </div>
  );
};
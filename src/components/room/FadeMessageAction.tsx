import React, { useState, useCallback, useEffect } from 'react';
import { Zap, Loader2, Lock, Check, X, DollarSign, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { isPast, format } from 'date-fns';

interface FadeData {
  id: string;
  poster_id: string;
  accepter_id: string | null;
  game_commence_time: string;
  home_team: string;
  away_team: string;
  fade_type: string;
  line_value: number;
  line_description: string;
  stake: number;
  status: 'open' | 'locked' | 'settled' | 'expired';
  winner_id: string | null;
  poster_name?: string;
  accepter_name?: string;
}

interface FadeMessageActionProps {
  messageContent: string;
  huddleId: string;
  isPrivate?: boolean;
  onCashModeRequired?: () => void;
}

export const FadeMessageAction: React.FC<FadeMessageActionProps> = ({
  messageContent,
  huddleId,
  isPrivate = false,
  onCashModeRequired,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fade, setFade] = useState<FadeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  // Parse the message to extract the fade details
  useEffect(() => {
    const findMatchingFade = async () => {
      if (!messageContent.includes('took') && !messageContent.includes('faded')) {
        setLoading(false);
        return;
      }

      // Check for locked fade message (e.g., "💥 JOE faded JONES! LOCKED:")
      if (messageContent.includes('LOCKED:')) {
        setLoading(false);
        return; // Already locked, no action needed
      }

      // Look for open fades in this huddle
      const { data: fades } = await supabase
        .from('fades')
        .select('*')
        .eq('huddle_id', huddleId)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (!fades || fades.length === 0) {
        setLoading(false);
        return;
      }

      // Match the message content to a fade (by stake and line_description)
      const matchedFade = fades.find(f => {
        const hasStake = messageContent.includes(`$${f.stake}`);
        const hasLine = messageContent.toLowerCase().includes(f.line_description.toLowerCase().slice(0, 20));
        return hasStake && hasLine;
      });

      if (matchedFade) {
        // Fetch poster name
        const { data: posterProfile } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('user_id', matchedFade.poster_id)
          .single();

        setFade({
          ...matchedFade,
          status: matchedFade.status as FadeData['status'],
          poster_name: posterProfile?.display_name || posterProfile?.username || 'Someone',
        });
      }

      setLoading(false);
    };

    findMatchingFade();
  }, [messageContent, huddleId]);

  const getOppositeLabel = () => {
    if (!fade) return 'Fade';
    if (fade.fade_type === 'over') return 'Under';
    if (fade.fade_type === 'under') return 'Over';
    if (fade.line_description.includes('+')) return 'Against spread';
    if (fade.line_description.includes('-')) return 'Against spread';
    return 'Fade';
  };

  const handleAccept = useCallback(async () => {
    if (!user || !fade || accepting) return;

    const gameTime = new Date(fade.game_commence_time);
    if (isPast(gameTime)) {
      toast({ title: 'Expired', description: 'This game has already started', variant: 'destructive' });
      return;
    }

    setAccepting(true);
    try {
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
          content: `💥 ${myName} faded ${fade.poster_name}! LOCKED: ${fade.poster_name} (${fade.line_description}) vs ${myName} (${getOppositeLabel()}) – $${fade.stake}`,
          message_type: 'fade_notification',
          is_bot_message: true,
        });
      }

      toast({ title: '🔒 Locked!', description: `You faded ${fade.poster_name} for $${fade.stake}` });
      setFade(null); // Clear the fade since it's now locked
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to accept fade', variant: 'destructive' });
    } finally {
      setAccepting(false);
    }
  }, [user, fade, huddleId, accepting, toast]);

  // Don't render anything if no matching open fade or still loading
  if (loading || !fade) return null;

  // Don't show button for own fades
  if (user?.id === fade.poster_id) {
    return (
      <div className="mt-3 pt-2 border-t border-border/30 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3 w-3" />
        <span>Waiting for someone to fade you...</span>
      </div>
    );
  }

  // Check if game has started
  const gameTime = new Date(fade.game_commence_time);
  if (isPast(gameTime)) {
    return (
      <div className="mt-3 pt-2 border-t border-border/30 flex items-center justify-center gap-2 text-xs text-destructive">
        <X className="h-3 w-3" />
        <span>Game started – no longer accepting</span>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-2 border-t border-border/30">
      <Button
        onClick={handleAccept}
        disabled={accepting}
        size="sm"
        className="w-full bg-primary hover:bg-primary/90 font-bold"
      >
        {accepting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Locking...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Fade ({getOppositeLabel()}) – ${fade.stake}
          </span>
        )}
      </Button>
      <p className="text-[10px] text-muted-foreground text-center mt-1">
        Locks {format(gameTime, 'MMM d, h:mm a')}
      </p>
    </div>
  );
};

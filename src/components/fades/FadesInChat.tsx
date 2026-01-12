import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Receipt } from 'lucide-react';
import { InlineFadeCard, FadeData } from './InlineFadeCard';

interface FadesInChatProps {
  huddleId: string;
  isPrivate?: boolean;
  onViewLedger?: () => void;
}

export const FadesInChat: React.FC<FadesInChatProps> = ({ 
  huddleId, 
  isPrivate = false,
  onViewLedger 
}) => {
  const { user } = useAuth();
  const [fades, setFades] = useState<FadeData[]>([]);
  const [hasCashMode, setHasCashMode] = useState(false);

  const fetchFades = useCallback(async () => {
    const { data, error } = await supabase
      .from('fades')
      .select('*')
      .eq('huddle_id', huddleId)
      .in('status', ['open', 'locked', 'settled'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching fades:', error);
      return;
    }

    // Fetch profiles
    const userIds = [...new Set((data || []).flatMap(f => [f.poster_id, f.accepter_id].filter(Boolean)))];
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, username, avatar_url')
        .in('user_id', userIds as string[]);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const fadesWithProfiles = (data || []).map(fade => ({
        ...fade,
        status: fade.status as FadeData['status'],
        settlement_status: (fade as any).settlement_status as FadeData['settlement_status'],
        poster: profileMap.get(fade.poster_id),
        accepter: fade.accepter_id ? profileMap.get(fade.accepter_id) : null,
      }));

      setFades(fadesWithProfiles);
    } else {
      setFades((data || []).map(f => ({
        ...f,
        status: f.status as FadeData['status'],
        settlement_status: (f as any).settlement_status as FadeData['settlement_status'],
      })));
    }
  }, [huddleId]);

  // Check user's Cash Mode status
  useEffect(() => {
    if (!user) return;

    const checkCashMode = async () => {
      const { data } = await supabase
        .from('cash_mode_subscriptions')
        .select('status, expires_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (data && new Date(data.expires_at) > new Date()) {
        setHasCashMode(true);
      }
    };

    checkCashMode();
  }, [user]);

  useEffect(() => {
    fetchFades();

    // Subscribe to changes
    const channel = supabase
      .channel(`fades-inline-${huddleId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'fades',
        filter: `huddle_id=eq.${huddleId}`,
      }, () => {
        fetchFades();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [huddleId, fetchFades]);

  if (fades.length === 0) return null;

  return (
    <div className="px-4 space-y-3 mb-4">
      {/* Ledger Link Header */}
      {onViewLedger && (
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewLedger}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Receipt className="h-3 w-3 mr-1" />
            View Ledger
          </Button>
        </div>
      )}
      
      {fades.map(fade => (
        <InlineFadeCard
          key={fade.id}
          fade={fade}
          huddleId={huddleId}
          isPrivate={isPrivate}
          hasCashMode={hasCashMode}
          onAccepted={fetchFades}
          onSettlementUpdate={fetchFades}
        />
      ))}
    </div>
  );
};
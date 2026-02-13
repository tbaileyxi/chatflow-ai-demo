import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PredictionCard } from './PredictionCard';

interface PredictionCardInMessageProps {
  content: string;
  huddleId: string;
}

export const PredictionCardInMessage: React.FC<PredictionCardInMessageProps> = ({ content, huddleId }) => {
  const [markets, setMarkets] = useState<any[]>([]);

  useEffect(() => {
    const loadMarkets = async () => {
      try {
        // Content is JSON with market IDs
        const parsed = JSON.parse(content);
        const marketIds = parsed.market_ids || [];
        
        if (marketIds.length === 0) return;

        const { data } = await supabase
          .from('kalshi_markets')
          .select('*')
          .in('id', marketIds);

        if (data) setMarkets(data);
      } catch {
        // Not valid JSON - try to find markets by huddle
        // This handles legacy format
      }
    };

    loadMarkets();
  }, [content]);

  if (markets.length === 0) return null;

  return (
    <div className="space-y-2 mt-2">
      {markets.map(market => (
        <PredictionCard
          key={market.id}
          market={market}
          huddleId={huddleId}
        />
      ))}
    </div>
  );
};

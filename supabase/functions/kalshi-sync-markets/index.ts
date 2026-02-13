import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

// Series tickers for sports markets on Kalshi
const SPORT_SERIES: Record<string, string[]> = {
  NBA: ['KXNBA'],
  NFL: ['KXNFL'],
  NHL: ['KXNHL'],
  NCAA: ['KXNCAAB', 'KXNCAAF'],
  MLB: ['KXMLB'],
};

async function fetchKalshiMarkets(seriesTicker: string, apiKeyId: string, privateKey: string) {
  try {
    const url = `${KALSHI_BASE}/markets?series_ticker=${seriesTicker}&status=open&limit=200`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Kalshi API error for ${seriesTicker}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.markets || [];
  } catch (err) {
    console.error(`Error fetching Kalshi markets for ${seriesTicker}:`, err);
    return [];
  }
}

async function fetchResolvedMarkets(apiKeyId: string, privateKey: string) {
  try {
    const url = `${KALSHI_BASE}/markets?status=settled&limit=100`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.markets || [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiKeyId = Deno.env.get('KALSHI_API_KEY_ID') || '';
    const privateKey = Deno.env.get('KALSHI_PRIVATE_KEY') || '';
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all teams for matching
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, city, league')
      .eq('status', 'active');

    const teamMap = new Map<string, { id: string; name: string; city: string }>();
    (teams || []).forEach(t => {
      teamMap.set(t.name.toLowerCase(), t);
      teamMap.set(`${t.city} ${t.name}`.toLowerCase(), t);
      // Also add just the city for matching
      teamMap.set(t.city.toLowerCase(), t);
    });

    let totalUpserted = 0;
    let totalSettled = 0;

    // Fetch open markets for each sport
    for (const [league, seriesTickers] of Object.entries(SPORT_SERIES)) {
      for (const seriesTicker of seriesTickers) {
        const markets = await fetchKalshiMarkets(seriesTicker, apiKeyId, privateKey);

        for (const m of markets) {
          // Try to match to our teams
          const title = (m.title || m.subtitle || '').toLowerCase();
          let matchedTeamId: string | null = null;

          for (const [key, team] of teamMap.entries()) {
            if (title.includes(key)) {
              matchedTeamId = team.id;
              break;
            }
          }

          // Determine market type
          let marketType = 'other';
          const titleLower = title;
          if (titleLower.includes('spread') || titleLower.includes('cover')) marketType = 'spread';
          else if (titleLower.includes('total') || titleLower.includes('over') || titleLower.includes('under')) marketType = 'total';
          else if (titleLower.includes('win') || titleLower.includes('winner') || titleLower.includes('moneyline')) marketType = 'winner';
          else if (titleLower.includes('points') || titleLower.includes('rebounds') || titleLower.includes('assists')) marketType = 'player_prop';

          const yesPrice = Math.round((m.yes_ask || m.last_price || 0.5) * 100);

          const { error } = await supabase
            .from('kalshi_markets')
            .upsert({
              kalshi_ticker: m.ticker,
              team_id: matchedTeamId,
              question: m.title || m.subtitle || m.ticker,
              current_yes_price: Math.max(1, Math.min(99, yesPrice)),
              market_type: marketType,
              event_start_time: m.close_time || m.expiration_time,
              kalshi_event_ticker: m.event_ticker || '',
              metadata: {
                volume: m.volume,
                open_interest: m.open_interest,
                subtitle: m.subtitle,
                series_ticker: seriesTicker,
                league,
              },
            }, { onConflict: 'kalshi_ticker' });

          if (!error) totalUpserted++;
        }
      }
    }

    // Check for resolved markets in our DB
    const { data: unresolvedMarkets } = await supabase
      .from('kalshi_markets')
      .select('id, kalshi_ticker')
      .eq('is_resolved', false)
      .lt('event_start_time', new Date().toISOString());

    if (unresolvedMarkets && unresolvedMarkets.length > 0) {
      // Fetch settled markets from Kalshi
      const resolvedKalshi = await fetchResolvedMarkets(apiKeyId, privateKey);
      const resolvedMap = new Map(resolvedKalshi.map((m: any) => [m.ticker, m.result]));

      for (const market of unresolvedMarkets) {
        const result = resolvedMap.get(market.kalshi_ticker);
        if (result === 'yes' || result === 'no') {
          const resolution = result.toUpperCase();
          const { data: settledCount } = await supabase.rpc('settle_shadow_bets', {
            p_market_id: market.id,
            p_resolution: resolution,
          });
          if (settledCount) totalSettled += settledCount;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      markets_upserted: totalUpserted,
      bets_settled: totalSettled,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('kalshi-sync-markets error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

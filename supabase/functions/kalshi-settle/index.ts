import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find unresolved markets past their event time
    const { data: unresolvedMarkets } = await supabase
      .from('kalshi_markets')
      .select('id, kalshi_ticker, huddle_id, question')
      .eq('is_resolved', false)
      .lt('event_start_time', new Date().toISOString());

    if (!unresolvedMarkets || unresolvedMarkets.length === 0) {
      return new Response(JSON.stringify({ settled: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalSettled = 0;

    // Check each market against Kalshi
    for (const market of unresolvedMarkets) {
      try {
        const url = `${KALSHI_BASE}/markets/${market.kalshi_ticker}`;
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) continue;

        const data = await response.json();
        const kalshiMarket = data.market;

        if (!kalshiMarket || kalshiMarket.status !== 'settled') continue;

        const result = kalshiMarket.result;
        if (result !== 'yes' && result !== 'no') continue;

        const resolution = result.toUpperCase();

        // Settle bets
        const { data: settledCount } = await supabase.rpc('settle_shadow_bets', {
          p_market_id: market.id,
          p_resolution: resolution,
        });

        // Post result to chat if huddle exists
        if (market.huddle_id) {
          const { data: systemUserId } = await supabase.rpc('get_or_create_system_user');
          if (systemUserId) {
            const emoji = resolution === 'YES' ? '✅' : '❌';
            await supabase.from('huddle_messages').insert({
              huddle_id: market.huddle_id,
              user_id: systemUserId,
              content: `${emoji} Market resolved: "${market.question}" → **${resolution}**`,
              is_bot_message: true,
              message_type: 'prediction_result',
            });
          }
        }

        totalSettled += (settledCount || 0);
      } catch (err) {
        console.error(`Error settling market ${market.kalshi_ticker}:`, err);
      }
    }

    return new Response(JSON.stringify({ settled: totalSettled }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('kalshi-settle error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

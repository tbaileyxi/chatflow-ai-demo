import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BADGE_PRICES: Record<string, number> = {
  basic: 499, // $4.99 in cents
  superfan: 2499 // $24.99 in cents
};

const BADGE_NAMES: Record<string, string> = {
  basic: 'Fan Badge',
  superfan: 'Superfan Badge'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) {
      throw new Error('Missing Stripe secret key');
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    const { teamId, tier, userId, returnUrl } = await req.json();

    if (!teamId || !tier || !userId) {
      throw new Error('Missing required fields: teamId, tier, userId');
    }

    if (!BADGE_PRICES[tier]) {
      throw new Error('Invalid badge tier');
    }

    // Use provided returnUrl or fallback to origin
    const origin = req.headers.get('origin') || 'https://sidehuddle.com';
    const successRedirect = returnUrl || origin;
    const cancelRedirect = returnUrl || origin;

    // Get team name for description
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    let teamName = 'Team';
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { data: team } = await supabase
        .from('teams')
        .select('name, city')
        .eq('id', teamId)
        .single();
      
      if (team) {
        teamName = `${team.city} ${team.name}`;
      }
    }

    // Create Stripe Checkout session with promo code support
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${teamName} ${BADGE_NAMES[tier]}`,
              description: tier === 'superfan' 
                ? 'Premium badge with glow effect - shows next to your name forever'
                : 'Show your team pride - badge shows next to your name forever',
            },
            unit_amount: BADGE_PRICES[tier],
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      allow_promotion_codes: true, // Enable promo codes on checkout
      success_url: `${successRedirect}${successRedirect.includes('?') ? '&' : '?'}badge_success=true`,
      cancel_url: `${cancelRedirect}${cancelRedirect.includes('?') ? '&' : '?'}badge_canceled=true`,
      metadata: {
        userId,
        teamId,
        tier,
        type: 'badge_purchase'
      },
    });

    console.log('Created badge checkout session:', session.id);

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Badge checkout error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

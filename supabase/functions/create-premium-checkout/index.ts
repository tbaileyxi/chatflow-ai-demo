import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!STRIPE_SECRET_KEY) throw new Error('Missing Stripe secret key');

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    const origin = req.headers.get('origin') || 'https://sidehuddle.com';

    // Check if user already has a stripe_customer_id
    const serviceClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('stripe_customer_id, is_premium')
      .eq('user_id', userId)
      .single();

    if (profile?.is_premium) {
      return new Response(JSON.stringify({ error: 'Already a Premium member' }), { status: 400, headers: corsHeaders });
    }

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Get user email
      const { data: userData } = await supabase.auth.getUser();
      const customer = await stripe.customers.create({
        email: userData?.user?.email || undefined,
        metadata: { user_id: userId },
      });
      customerId = customer.id;

      await serviceClient
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', userId);
    }

    // Create checkout session for $5/month subscription
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Side Huddle Premium',
            description: 'Never run out of chips • Full analytics • Premium badge • Unlimited private huddles',
          },
          unit_amount: 500, // $5.00
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      mode: 'subscription',
      allow_promotion_codes: true,
      success_url: `${origin}/ledger?premium=success`,
      cancel_url: `${origin}/ledger?premium=cancelled`,
      metadata: {
        user_id: userId,
        type: 'premium_subscription',
      },
    });

    console.log('Created premium checkout session:', session.id, 'for user:', userId);

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Premium checkout error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

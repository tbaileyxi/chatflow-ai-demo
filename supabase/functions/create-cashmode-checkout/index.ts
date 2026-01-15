import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, returnUrl } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    // Cash Mode subscription - $9.99/month
    // Parse returnUrl - if it already has query params, append with &, otherwise with ?
    const baseReturnUrl = returnUrl || 'https://sidehuddlesports.com/ledger';
    const hasQuery = baseReturnUrl.includes('?');
    const successUrl = hasQuery 
      ? `${baseReturnUrl}&session_id={CHECKOUT_SESSION_ID}`
      : `${baseReturnUrl}?cashmode=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = hasQuery
      ? baseReturnUrl.replace('cashmode=success', 'cashmode=cancelled')
      : `${baseReturnUrl}?cashmode=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Cash Mode',
              description: 'Unlock Venmo settlement, higher stakes, and premium fade features',
            },
            unit_amount: 999, // $9.99
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'cash_mode',
        user_id: userId,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating Cash Mode checkout:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

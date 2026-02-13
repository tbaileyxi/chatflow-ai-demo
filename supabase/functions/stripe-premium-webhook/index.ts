import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
    const WEBHOOK_SECRET = Deno.env.get('STRIPE_PREMIUM_WEBHOOK_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.text();
    let event: Stripe.Event;

    if (WEBHOOK_SECRET) {
      const sig = req.headers.get('stripe-signature')!;
      event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
    } else {
      console.warn('No STRIPE_PREMIUM_WEBHOOK_SECRET set, parsing without verification');
      event = JSON.parse(body);
    }

    console.log('Premium webhook event:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const type = session.metadata?.type;

      if (type !== 'premium_subscription' || !userId) {
        console.log('Not a premium subscription event, skipping');
        return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
      }

      console.log('Activating premium for user:', userId);

      // Update profile
      await supabase.from('profiles').update({
        is_premium: true,
        premium_since: new Date().toISOString(),
        premium_expires_at: null,
        stripe_subscription_id: session.subscription as string,
      }).eq('user_id', userId);

      // Update portfolio: add 500 chips, set premium fields
      const { data: portfolio } = await supabase
        .from('user_portfolios')
        .select('total_chips')
        .eq('user_id', userId)
        .single();

      if (portfolio) {
        await supabase.from('user_portfolios').update({
          is_premium: true,
          starting_chips: 1500,
          minimum_chips: 100,
          total_chips: portfolio.total_chips + 500,
        }).eq('user_id', userId);
      } else {
        await supabase.from('user_portfolios').insert({
          user_id: userId,
          total_chips: 1500,
          is_premium: true,
          starting_chips: 1500,
          minimum_chips: 100,
        });
      }

      console.log('Premium activated, 500 chips added for user:', userId);
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      // Find user by stripe_customer_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (profile) {
        console.log('Downgrading user from premium:', profile.user_id);

        await supabase.from('profiles').update({
          is_premium: false,
          stripe_subscription_id: null,
          premium_expires_at: null,
        }).eq('user_id', profile.user_id);

        await supabase.from('user_portfolios').update({
          is_premium: false,
          starting_chips: 1000,
          minimum_chips: 0,
        }).eq('user_id', profile.user_id);
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (profile) {
        // 3-day grace period
        const graceDate = new Date();
        graceDate.setDate(graceDate.getDate() + 3);

        console.log('Payment failed, grace period set for user:', profile.user_id);

        await supabase.from('profiles').update({
          premium_expires_at: graceDate.toISOString(),
        }).eq('user_id', profile.user_id);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Premium webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

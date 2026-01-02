import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_BADGE_WEBHOOK_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (STRIPE_WEBHOOK_SECRET && signature) {
      try {
        event = await stripe.webhooks.constructEventAsync(
          body,
          signature,
          STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 400, headers: corsHeaders }
        );
      }
    } else {
      // For testing without signature verification
      event = JSON.parse(body);
    }

    console.log('Received badge webhook event:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Only process badge purchases
      if (session.metadata?.type !== 'badge_purchase') {
        console.log('Not a badge purchase, skipping');
        return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
      }

      const { userId, teamId, tier } = session.metadata;

      if (!userId || !teamId || !tier) {
        console.error('Missing metadata in session:', session.metadata);
        throw new Error('Missing required metadata');
      }

      console.log('Processing badge purchase:', { userId, teamId, tier });

      // Check if user already has this badge
      const { data: existingBadge } = await supabase
        .from('user_badges')
        .select('id, tier')
        .eq('user_id', userId)
        .eq('team_id', teamId)
        .single();

      if (existingBadge) {
        // Upgrade existing badge if new tier is higher
        if (tier === 'superfan' && existingBadge.tier === 'basic') {
          await supabase
            .from('user_badges')
            .update({
              tier: 'superfan',
              stripe_payment_id: session.payment_intent as string
            })
            .eq('id', existingBadge.id);
          
          console.log('Upgraded badge to superfan');
        } else {
          console.log('Badge already exists, no update needed');
        }
      } else {
        // Insert new badge - set as active if user has no other active badges
        const { data: activeBadges } = await supabase
          .from('user_badges')
          .select('id')
          .eq('user_id', userId)
          .eq('is_active', true)
          .limit(1);

        const shouldBeActive = !activeBadges || activeBadges.length === 0;

        const { error: insertError } = await supabase
          .from('user_badges')
          .insert({
            user_id: userId,
            team_id: teamId,
            tier,
            is_active: shouldBeActive,
            stripe_payment_id: session.payment_intent as string
          });

        if (insertError) {
          console.error('Error inserting badge:', insertError);
          throw insertError;
        }

        console.log('Badge created successfully, is_active:', shouldBeActive);
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Badge webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

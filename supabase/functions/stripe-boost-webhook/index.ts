import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_BOOST_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!stripeSecretKey || !webhookSecret) {
    console.error('Missing Stripe configuration');
    return new Response('Server configuration error', { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('Missing stripe signature', { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log(`📨 Boost webhook event: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Only process boost payments
      if (session.metadata?.type !== 'boost') {
        console.log('Not a boost payment, skipping');
        return new Response('OK', { status: 200 });
      }

      const { message_id, user_id, huddle_id, amount } = session.metadata;
      const amountNum = parseInt(amount);

      console.log(`🔥 Processing boost: $${amount} for message ${message_id}`);

      // Record the boost in the database
      const { error: boostError } = await supabase
        .from('boosts')
        .insert({
          message_id,
          booster_id: user_id,
          amount: amountNum,
          stripe_payment_id: session.payment_intent as string,
        });

      if (boostError) {
        console.error('❌ Error recording boost:', boostError);
        throw boostError;
      }

      // Get the boosted message content for the announcement
      const { data: message } = await supabase
        .from('huddle_messages')
        .select('content, user_id')
        .eq('id', message_id)
        .single();

      // Get booster profile
      const { data: boosterProfile } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('user_id', user_id)
        .single();

      const boosterName = boosterProfile?.display_name || boosterProfile?.username || 'Someone';

      // Post boost announcement to huddle
      const { data: systemUserId } = await supabase.rpc('get_or_create_system_user');
      
      const announcement = `🔥 ${boosterName} just boosted a message with $${amount}! That take is 🔥`;

      await supabase
        .from('huddle_messages')
        .insert({
          huddle_id,
          user_id: systemUserId,
          content: announcement,
          is_bot_message: true,
          message_type: 'boost_announcement',
        });

      console.log(`✅ Boost recorded and announced for message ${message_id}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use the service role key to perform writes (upsert) in Supabase
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const { sessionId, huddleId } = await req.json();
    if (!sessionId || !huddleId) throw new Error("Session ID and Huddle ID are required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== 'paid') {
      throw new Error("Payment not completed");
    }

    const userId = session.metadata?.user_id;
    if (!userId) {
      throw new Error("User ID not found in session metadata");
    }

    // Get subscription ID from the session
    const subscriptionId = session.subscription as string;
    if (!subscriptionId) {
      throw new Error("Subscription ID not found");
    }

    // Get the subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

    // Update or create the member subscription record
    const { error: subscriptionError } = await supabaseClient
      .from('huddle_member_subscriptions')
      .upsert({
        huddle_id: huddleId,
        user_id: userId,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: session.customer as string,
        status: subscription.status,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'huddle_id,user_id' });

    if (subscriptionError) throw subscriptionError;

    // Add user to huddle members if not already a member
    const { error: memberError } = await supabaseClient
      .from('huddle_members')
      .upsert({
        huddle_id: huddleId,
        user_id: userId,
      }, { onConflict: 'huddle_id,user_id' });

    if (memberError) throw memberError;

    return new Response(JSON.stringify({ 
      success: true,
      expires_at: expiresAt,
      status: subscription.status
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error('Error checking membership:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
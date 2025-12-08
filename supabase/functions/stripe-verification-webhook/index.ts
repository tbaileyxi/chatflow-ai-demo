import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2023-10-16",
  });

  const supabaseServiceRole = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_VERIFICATION_WEBHOOK_SECRET");

    if (!signature || !webhookSecret) {
      console.error("Missing signature or webhook secret");
      return new Response(JSON.stringify({ error: "Missing signature or webhook secret" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Verify webhook signature using async method for Deno compatibility
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`Received event: ${event.type}`);

    // Handle checkout.session.completed for one-time verification payments
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Only process huddle verification payments
      const paymentType = session.metadata?.type;
      
      if (paymentType !== "huddle_verification") {
        console.log("Skipping - not a huddle verification payment");
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const huddleId = session.metadata?.huddle_id;
      const ownerId = session.metadata?.owner_id;

      if (!huddleId || !ownerId) {
        console.error("Missing huddle_id or owner_id in session metadata");
        return new Response(JSON.stringify({ error: "Missing metadata" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      console.log(`Processing verification for huddle ${huddleId} by owner ${ownerId}`);

      // Verify payment was successful
      if (session.payment_status !== 'paid') {
        console.log("Payment not completed yet");
        return new Response(JSON.stringify({ received: true, pending: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Create huddle_subscriptions record with permanent verification (no expiration)
      // Using a far future date since expires_at is required in the schema
      const permanentDate = new Date('2099-12-31T23:59:59Z');
      
      const { error: subscriptionError } = await supabaseServiceRole
        .from("huddle_subscriptions")
        .upsert({
          huddle_id: huddleId,
          owner_id: ownerId,
          status: "active",
          expires_at: permanentDate.toISOString(),
          stripe_customer_id: session.customer as string || null,
          stripe_subscription_id: null, // One-time payment, no subscription
        }, {
          onConflict: "huddle_id"
        });

      if (subscriptionError) {
        console.error("Error creating huddle subscription:", subscriptionError);
        throw subscriptionError;
      }

      // Update huddle to set is_verified = true (trigger will also do this, but be explicit)
      const { error: huddleError } = await supabaseServiceRole
        .from("huddles")
        .update({
          is_verified: true,
          verification_expires_at: permanentDate.toISOString(),
        })
        .eq("id", huddleId);

      if (huddleError) {
        console.error("Error updating huddle verification:", huddleError);
        throw huddleError;
      }

      // Log the verification for audit
      await supabaseServiceRole.from("subscription_audit_log").insert({
        user_id: ownerId,
        huddle_id: huddleId,
        action: "huddle_verified_payment",
      });

      console.log(`Successfully verified huddle ${huddleId} for owner ${ownerId}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

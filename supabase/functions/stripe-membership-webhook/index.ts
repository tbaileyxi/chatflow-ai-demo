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
    const webhookSecret = Deno.env.get("STRIPE_MEMBERSHIP_WEBHOOK_SECRET");

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

    // Handle checkout.session.completed for subscription payments
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Check if this is a membership subscription (not verification payment)
      const huddleId = session.metadata?.huddle_id;
      const userId = session.metadata?.user_id;
      const paymentType = session.metadata?.type;
      
      // Skip if this is a huddle verification payment (handled by different webhook)
      if (paymentType === "huddle_verification") {
        console.log("Skipping - this is a huddle verification payment");
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      if (!huddleId || !userId) {
        console.error("Missing huddle_id or user_id in session metadata");
        return new Response(JSON.stringify({ error: "Missing metadata" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      console.log(`Processing membership for user ${userId} to huddle ${huddleId}`);

      // Calculate subscription expiry (1 month from now for monthly subscription)
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      // Add user to huddle_member_subscriptions
      const { error: subscriptionError } = await supabaseServiceRole
        .from("huddle_member_subscriptions")
        .upsert({
          huddle_id: huddleId,
          user_id: userId,
          status: "active",
          expires_at: expiresAt.toISOString(),
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
        }, {
          onConflict: "huddle_id,user_id"
        });

      if (subscriptionError) {
        console.error("Error creating member subscription:", subscriptionError);
        throw subscriptionError;
      }

      // Add user to huddle_members
      const { error: memberError } = await supabaseServiceRole
        .from("huddle_members")
        .upsert({
          huddle_id: huddleId,
          user_id: userId,
        }, {
          onConflict: "huddle_id,user_id"
        });

      if (memberError) {
        console.error("Error adding user to huddle members:", memberError);
        throw memberError;
      }

      // Update huddle member count
      const { data: currentHuddle } = await supabaseServiceRole
        .from("huddles")
        .select("member_count")
        .eq("id", huddleId)
        .single();

      await supabaseServiceRole
        .from("huddles")
        .update({
          member_count: (currentHuddle?.member_count || 0) + 1,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", huddleId);

      console.log(`Successfully added user ${userId} to huddle ${huddleId} with membership`);
    }

    // Handle subscription cancellation
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeSubscriptionId = subscription.id;

      // Find and update the member subscription
      const { error } = await supabaseServiceRole
        .from("huddle_member_subscriptions")
        .update({ status: "cancelled" })
        .eq("stripe_subscription_id", stripeSubscriptionId);

      if (error) {
        console.error("Error cancelling member subscription:", error);
      } else {
        console.log(`Cancelled subscription: ${stripeSubscriptionId}`);
      }
    }

    // Handle subscription renewal
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubscriptionId = invoice.subscription as string;

      if (stripeSubscriptionId) {
        // Extend subscription expiry by 1 month
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        const { error } = await supabaseServiceRole
          .from("huddle_member_subscriptions")
          .update({
            status: "active",
            expires_at: expiresAt.toISOString(),
          })
          .eq("stripe_subscription_id", stripeSubscriptionId);

        if (error) {
          console.error("Error renewing subscription:", error);
        } else {
          console.log(`Renewed subscription: ${stripeSubscriptionId}`);
        }
      }
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

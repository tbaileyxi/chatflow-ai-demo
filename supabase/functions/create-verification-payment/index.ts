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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseServiceRole = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const { huddleId, promoCode } = await req.json();
    if (!huddleId) throw new Error("Huddle ID is required");

    // Verify user owns the huddle
    const { data: huddle, error: huddleError } = await supabaseClient
      .from("huddles")
      .select("id, name, owner_id")
      .eq("id", huddleId)
      .eq("owner_id", user.id)
      .single();

    if (huddleError || !huddle) {
      throw new Error("Huddle not found or you don't own this huddle");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });

    // Validate promo code if provided
    let finalAmount = 4999; // $49.99 in cents
    let promoData = null;

    if (promoCode) {
      const { data: promo, error: promoError } = await supabaseClient
        .from("promo_codes")
        .select("*")
        .eq("code", promoCode.toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (promo) {
        // Check expiration
        if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
          throw new Error("Promo code has expired");
        }

        // Check usage limit
        if (promo.max_uses && promo.current_uses >= promo.max_uses) {
          throw new Error("Promo code usage limit reached");
        }

        promoData = promo;

        // Calculate discount
        if (promo.discount_type === 'free') {
          finalAmount = 0;
        } else if (promo.discount_type === 'percentage') {
          finalAmount = Math.round(4999 * (1 - promo.discount_value / 100));
        } else if (promo.discount_type === 'fixed') {
          finalAmount = Math.max(0, 4999 - promo.discount_value);
        }
      }
    }

    // If promo code gives 100% discount, verify immediately without payment
    if (finalAmount === 0 && promoData) {
      console.log(`Processing free verification with promo ${promoCode} for huddle ${huddleId}`);
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year from now

      console.log("Updating huddle to verified...");
      // Update huddle as verified (use service role to bypass RLS)
      const { error: huddleError } = await supabaseServiceRole
        .from("huddles")
        .update({ 
          is_verified: true,
          verification_expires_at: expiresAt.toISOString()
        })
        .eq("id", huddleId);

      if (huddleError) {
        console.error("Error updating huddle:", huddleError);
        throw new Error(`Failed to verify huddle: ${huddleError.message}`);
      }

      console.log("Creating subscription record...");
      // Create subscription record (use service role to bypass RLS)
      const { error: subscriptionError } = await supabaseServiceRole
        .from("huddle_subscriptions")
        .insert({
          huddle_id: huddleId,
          owner_id: user.id,
          status: "active",
          expires_at: expiresAt.toISOString()
        });

      if (subscriptionError) {
        console.error("Error creating subscription:", subscriptionError);
        throw new Error(`Failed to create subscription: ${subscriptionError.message}`);
      }

      console.log("Incrementing promo usage...");
      // Increment promo code usage
      await supabaseServiceRole
        .from("promo_codes")
        .update({ current_uses: (promoData.current_uses || 0) + 1 })
        .eq("id", promoData.id);

      console.log("Promo verification complete!");
      return new Response(JSON.stringify({ success: true, message: "Huddle verified with promo code!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create one-time payment session for huddle verification
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { 
              name: `Huddle Verification - ${huddle.name}`,
              description: promoData ? `One-time payment (${promoCode} applied)` : "One-time payment to verify your huddle"
            },
            unit_amount: finalAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/huddle/${huddleId}/settings?verification=success`,
      cancel_url: `${req.headers.get("origin")}/huddle/${huddleId}/settings?verification=cancelled`,
      metadata: {
        huddle_id: huddleId,
        owner_id: user.id,
        type: "huddle_verification",
        promo_code: promoCode || "",
        promo_id: promoData?.id || ""
      }
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in create-verification-payment:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
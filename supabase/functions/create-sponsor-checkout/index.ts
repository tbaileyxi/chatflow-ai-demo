import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEPOSIT_AMOUNT = 14900; // $149 in cents

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { teamId, teamName } = await req.json();
    console.log(`Creating sponsor checkout for team ${teamId}: ${teamName}`);

    if (!teamId || !teamName) {
      throw new Error("Missing required fields: teamId and teamName");
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Stripe is not configured");
    }
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || "https://sidehuddles.com";

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      allow_promotion_codes: true,
      billing_address_collection: "required",
      custom_fields: [
        {
          key: "company",
          label: { type: "custom", custom: "Company Name" },
          type: "text",
        },
        {
          key: "contact_name",
          label: { type: "custom", custom: "Contact Name" },
          type: "text",
        },
      ],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Side Huddle – Founding Sponsor Deposit",
              description: `Exclusive founding sponsor reservation for ${teamName}. Deposit is applied to first invoice at launch. Non-refundable.`,
            },
            unit_amount: DEPOSIT_AMOUNT,
          },
          quantity: 1,
        },
      ],
      metadata: {
        team_id: teamId,
        team_name: teamName,
        type: "sponsor_deposit",
      },
      success_url: `${origin}/sponsor?success=true&team=${encodeURIComponent(teamName)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/sponsor?cancelled=true`,
    });

    console.log(`Created checkout session: ${session.id}`);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in create-sponsor-checkout:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});

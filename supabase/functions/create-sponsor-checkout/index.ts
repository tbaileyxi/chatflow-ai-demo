import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEPOSIT_PER_TEAM = 14900; // $149 in cents
const BULK_DISCOUNT_THRESHOLD = 3;
const BULK_DISCOUNT_PERCENT = 20;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Support both old single-team format and new multi-team format
    let teams: Array<{ teamId: string; teamName: string }>;
    
    if (body.teams && Array.isArray(body.teams)) {
      // New multi-team format
      teams = body.teams;
    } else if (body.teamId && body.teamName) {
      // Legacy single-team format
      teams = [{ teamId: body.teamId, teamName: body.teamName }];
    } else {
      throw new Error("Missing required fields: teams array or teamId/teamName");
    }

    if (teams.length === 0) {
      throw new Error("At least one team is required");
    }

    console.log(`Creating sponsor checkout for ${teams.length} team(s)`);

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Stripe is not configured");
    }
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    // Calculate pricing
    const teamCount = teams.length;
    const subtotal = DEPOSIT_PER_TEAM * teamCount;
    const hasDiscount = teamCount >= BULK_DISCOUNT_THRESHOLD;
    const discountAmount = hasDiscount ? Math.round(subtotal * BULK_DISCOUNT_PERCENT / 100) : 0;
    const total = subtotal - discountAmount;

    console.log(`Pricing: ${teamCount} teams, subtotal: $${subtotal/100}, discount: $${discountAmount/100}, total: $${total/100}`);

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || "https://sidehuddles.com";

    // Create team names list for display
    const teamNamesList = teams.map(t => t.teamName).join(", ");
    const teamIdsJson = JSON.stringify(teams.map(t => t.teamId));
    const teamNamesJson = JSON.stringify(teams.map(t => t.teamName));

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (teamCount === 1) {
      // Single team - simple line item
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Side Huddle – Founding Sponsor Deposit",
            description: `Exclusive founding sponsor reservation for ${teams[0].teamName}. Deposit is applied to first invoice at launch. Non-refundable.`,
          },
          unit_amount: DEPOSIT_PER_TEAM,
        },
        quantity: 1,
      });
    } else {
      // Multiple teams - show as quantity with potential discount
      const teamsList = teams.map(t => t.teamName).join(", ");
      const description = hasDiscount
        ? `Founding sponsor reservations for: ${teamsList}. 20% bulk discount applied. Deposits applied to first invoices at launch. Non-refundable.`
        : `Founding sponsor reservations for: ${teamsList}. Deposits applied to first invoices at launch. Non-refundable.`;

      // Calculate effective unit amount after discount
      const effectiveUnitAmount = Math.round(total / teamCount);

      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: hasDiscount 
              ? `Side Huddle – Founding Sponsor Deposit (${teamCount} Teams, 20% Off)`
              : `Side Huddle – Founding Sponsor Deposit (${teamCount} Teams)`,
            description: description,
          },
          unit_amount: effectiveUnitAmount,
        },
        quantity: teamCount,
      });
    }

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
      line_items: lineItems,
      metadata: {
        team_ids: teamIdsJson,
        team_names: teamNamesJson,
        team_count: teamCount.toString(),
        type: "sponsor_deposit",
        discount_applied: hasDiscount.toString(),
        discount_amount: discountAmount.toString(),
      },
      success_url: `${origin}/sponsor?success=true&team=${encodeURIComponent(teamNamesList)}&count=${teamCount}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/sponsor?cancelled=true`,
    });

    console.log(`Created checkout session: ${session.id} for ${teamCount} teams`);

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

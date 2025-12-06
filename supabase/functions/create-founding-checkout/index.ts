import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OFFER_EXPIRY = new Date('2026-01-01T00:00:00Z');
const CHARTER_LIMIT = 100;
const FOUNDING_LIMIT = 200;

// Prices in cents
const CHARTER_PRICE = 4900; // $49
const FOUNDING_PRICE = 2900; // $29

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tier, userId } = await req.json();
    console.log(`Creating founding checkout for user ${userId}, tier: ${tier}`);

    if (!tier || !userId) {
      throw new Error("Missing required fields: tier and userId");
    }

    if (tier !== 'charter' && tier !== 'founding') {
      throw new Error("Invalid tier. Must be 'charter' or 'founding'");
    }

    // Check if offer has expired
    if (new Date() >= OFFER_EXPIRY) {
      throw new Error("This offer has expired");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check current counts
    const { data: countsData, error: countsError } = await supabase.rpc('get_founding_counts');
    
    if (countsError) {
      console.error("Error fetching counts:", countsError);
      throw new Error("Failed to check availability");
    }

    const counts = countsData?.[0] || { charter_count: 0, founding_count: 0, total_count: 0 };
    const charterCount = Number(counts.charter_count) || 0;
    const foundingCount = Number(counts.founding_count) || 0;

    // Check limits
    if (tier === 'charter' && charterCount >= CHARTER_LIMIT) {
      throw new Error("All Charter spots are sold out");
    }
    if (tier === 'founding' && foundingCount >= FOUNDING_LIMIT) {
      throw new Error("All Founding spots are sold out");
    }

    // Check if user is already a founding member
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_founding_member')
      .eq('user_id', userId)
      .single();

    if (profile?.is_founding_member) {
      throw new Error("You are already a Founding Member");
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Stripe is not configured");
    }
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    // Get user email for Stripe
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const customerEmail = userData?.user?.email;

    // Determine price and product name
    const price = tier === 'charter' ? CHARTER_PRICE : FOUNDING_PRICE;
    const productName = tier === 'charter' 
      ? 'Platinum Charter Founding Member 2025' 
      : 'Gold Founding Member 2025';

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || "https://sidehuddles.com";

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: productName,
              description: tier === 'charter' 
                ? "Exclusive Platinum tier with animated badge, blue checkmark, and free lifetime Verified Huddle"
                : "Gold tier with static badge, blue checkmark, and free lifetime Verified Huddle",
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: userId,
        tier: tier,
        type: "founding_member",
      },
      success_url: `${origin}/profile?founding=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/profile?founding=cancelled`,
    });

    console.log(`Created checkout session: ${session.id}`);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in create-founding-checkout:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});

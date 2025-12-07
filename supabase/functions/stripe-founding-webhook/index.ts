import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_FOUNDING_WEBHOOK_SECRET");
    
    if (!stripeSecretKey) {
      throw new Error("Stripe is not configured");
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      } catch (err: any) {
        console.error("Webhook signature verification failed:", err.message);
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // For testing without webhook secret
      event = JSON.parse(body);
      console.log("Warning: Processing webhook without signature verification");
    }

    console.log(`Received webhook event: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;

      // Only process founding member purchases
      if (metadata?.type !== "founding_member") {
        console.log("Not a founding member purchase, skipping");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = metadata.user_id;
      const tier = metadata.tier as 'charter' | 'founding';

      console.log(`Processing founding member purchase: user=${userId}, tier=${tier}`);

      // Initialize Supabase with service role
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Generate promo code
      const { data: countsData } = await supabase.rpc('get_founding_counts');
      const totalCount = Number(countsData?.[0]?.total_count || 0);
      const nextSpot = totalCount + 1;
      const promoCode = `FOUNDER2025-${String(nextSpot).padStart(4, '0')}`;

      // Claim the founding spot using the database function
      const { data: spotNumber, error: claimError } = await supabase.rpc('claim_founding_spot', {
        p_user_id: userId,
        p_tier: tier,
        p_promo_code: promoCode,
      });

      if (claimError) {
        console.error("Error claiming founding spot:", claimError);
        throw new Error(`Failed to claim founding spot: ${claimError.message}`);
      }

      console.log(`Successfully claimed spot #${spotNumber} for user ${userId}`);

      // Try to send confirmation email (optional - won't fail if not configured)
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey && session.customer_email) {
          const tierLabel = tier === 'charter' ? 'Platinum Charter' : 'Gold Founding';
          
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Side Huddles <noreply@sidehuddles.com>",
              to: [session.customer_email],
              subject: `🎉 Welcome to the Founding 300, ${tierLabel} Member!`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h1 style="color: ${tier === 'charter' ? '#C0C0C0' : '#FFD700'};">
                    Congratulations, ${tierLabel} Member #${spotNumber}!
                  </h1>
                  <p>You're officially one of the Founding 300 members of Side Huddles.</p>
                  <p><strong>Your perks:</strong></p>
                  <ul>
                    <li>✓ Blue verified checkmark on all your messages forever</li>
                    <li>✓ Exclusive ${tierLabel} badge on your avatar</li>
                    <li>✓ Free lifetime Verified Huddle (use code: <strong>${promoCode}</strong>)</li>
                    <li>✓ Exclusive merch drop access</li>
                  </ul>
                  <p>Your promo code for a free Verified Huddle: <strong style="font-size: 18px; color: #FFD700;">${promoCode}</strong></p>
                  <p>Thank you for believing in us early!</p>
                  <p>– The Side Huddles Team</p>
                </div>
              `,
            }),
          });

          if (emailResponse.ok) {
            console.log("Confirmation email sent successfully");
          } else {
            console.log("Email send failed, but proceeding:", await emailResponse.text());
          }
        }
      } catch (emailError) {
        console.log("Email sending skipped or failed:", emailError);
        // Don't throw - email is optional
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

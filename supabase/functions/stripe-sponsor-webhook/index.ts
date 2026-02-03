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
    const webhookSecret = Deno.env.get("STRIPE_SPONSOR_WEBHOOK_SECRET");
    
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

      // Only process sponsor deposits
      if (metadata?.type !== "sponsor_deposit") {
        console.log("Not a sponsor deposit, skipping");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const teamId = metadata.team_id;
      const teamName = metadata.team_name;

      // Extract custom fields
      const customFields = session.custom_fields || [];
      const companyField = customFields.find(f => f.key === "company");
      const contactNameField = customFields.find(f => f.key === "contact_name");
      
      const company = companyField?.text?.value || "Unknown";
      const contactName = contactNameField?.text?.value || "Unknown";
      const email = session.customer_details?.email || session.customer_email || "";

      console.log(`Processing sponsor deposit: team=${teamName}, company=${company}, contact=${contactName}`);

      // Initialize Supabase with service role
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Create reservation record
      const { error: insertError } = await supabase
        .from('sponsor_reservations')
        .insert({
          team_id: teamId,
          reserved_by_name: contactName,
          reserved_by_company: company,
          reserved_email: email,
          stripe_payment_id: session.payment_intent as string,
          stripe_session_id: session.id,
          deposit_amount: 14900,
          status: 'reserved'
        });

      if (insertError) {
        // Check if it's a duplicate (team already reserved)
        if (insertError.code === '23505') {
          console.error("Team already reserved, refund may be needed:", teamId);
          // In production, you might want to initiate a refund here
        } else {
          console.error("Error creating reservation:", insertError);
          throw new Error(`Failed to create reservation: ${insertError.message}`);
        }
      } else {
        console.log(`Successfully reserved team ${teamName} for ${company}`);
      }

      // Try to send confirmation email (optional - won't fail if not configured)
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey && email) {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Side Huddles <noreply@sidehuddles.com>",
              to: [email],
              subject: `🎉 You're the Founding Sponsor for ${teamName}!`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h1 style="color: #FFD700;">Congratulations, Founding Sponsor!</h1>
                  <p>You're locked in as the founding sponsor for <strong>${teamName}</strong>.</p>
                  
                  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Reservation Details:</strong></p>
                    <ul style="list-style: none; padding: 0;">
                      <li>Team: ${teamName}</li>
                      <li>Company: ${company}</li>
                      <li>Deposit: $149.00</li>
                    </ul>
                  </div>
                  
                  <p><strong>What's next?</strong></p>
                  <ul>
                    <li>We'll contact you before launch to activate your sponsorship</li>
                    <li>Your $149 deposit will be applied to your first invoice</li>
                    <li>You'll have exclusive sponsorship rights for ${teamName}</li>
                  </ul>
                  
                  <p>Thank you for becoming a founding sponsor!</p>
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

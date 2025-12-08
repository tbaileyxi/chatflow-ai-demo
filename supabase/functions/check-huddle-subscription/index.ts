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

  // Use service role for secure database operations
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("Session ID is required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Get checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const huddleId = session.metadata?.huddle_id;
    const paymentType = session.metadata?.type;
    
    if (!huddleId) throw new Error("Huddle ID not found in session metadata");

    // Verify user owns the huddle before updating
    const { data: huddleData, error: huddleError } = await supabaseClient
      .from("huddles")
      .select("owner_id")
      .eq("id", huddleId)
      .single();

    if (huddleError || !huddleData) {
      throw new Error("Huddle not found");
    }

    if (huddleData.owner_id !== user.id) {
      throw new Error("Access denied: You do not own this huddle");
    }

    // Handle one-time verification payment (not a subscription)
    if (session.payment_status === 'paid' && paymentType === 'huddle_verification') {
      // Permanent verification - use far future date
      const permanentDate = new Date('2099-12-31T23:59:59Z');
      
      await supabaseClient.from("huddle_subscriptions").upsert({
        huddle_id: huddleId,
        owner_id: user.id,
        stripe_subscription_id: null,
        stripe_customer_id: session.customer as string || null,
        status: 'active',
        expires_at: permanentDate.toISOString(),
      }, {
        onConflict: "huddle_id"
      });

      // Update huddle verification status
      await supabaseClient.from("huddles").update({
        is_verified: true,
        verification_expires_at: permanentDate.toISOString(),
      }).eq("id", huddleId);

      // Log the verification for audit
      await supabaseClient.from("subscription_audit_log").insert({
        user_id: user.id,
        huddle_id: huddleId,
        action: "verification_confirmed",
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown"
      });

      return new Response(JSON.stringify({ 
        success: true, 
        verified: true,
        permanent: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    // Handle subscription-based payments (if any in the future)
    if (session.payment_status === 'paid' && session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const expiresAt = new Date(subscription.current_period_end * 1000);
      
      await supabaseClient.from("huddle_subscriptions").upsert({
        huddle_id: huddleId,
        owner_id: user.id,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        status: subscription.status === 'active' ? 'active' : 'cancelled',
        expires_at: expiresAt.toISOString(),
      });

      await supabaseClient.from("subscription_audit_log").insert({
        user_id: user.id,
        huddle_id: huddleId,
        action: "subscription_verified",
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        user_agent: req.headers.get("user-agent") || "unknown"
      });

      return new Response(JSON.stringify({ 
        success: true, 
        verified: true,
        expires_at: expiresAt.toISOString()
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      verified: false 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error checking huddle subscription:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Square webhook -> flip a sponsor_claims row to reserved/claimed on completed payment.
//
// Required edge-function secrets:
//   SQUARE_WEBHOOK_SIGNATURE_KEY – signature key from the Square webhook subscription
//   SQUARE_WEBHOOK_URL           – the exact notification URL registered in Square
//                                  (e.g. https://<ref>.supabase.co/functions/v1/square-webhook)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY – injected automatically
//
// Register this URL in the Square dashboard for the `payment.updated` event.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-square-hmacsha256-signature",
};

async function verifySignature(signatureKey: string, url: string, body: string, signature: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signatureKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(url + body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return expected === signature;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ok = () => new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const body = await req.text();
    const signatureKey = Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY");
    const notificationUrl = Deno.env.get("SQUARE_WEBHOOK_URL");
    const signature = req.headers.get("x-square-hmacsha256-signature");

    if (signatureKey && notificationUrl && signature) {
      const valid = await verifySignature(signatureKey, notificationUrl, body, signature);
      if (!valid) {
        console.error("Square webhook signature verification failed");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("Processing Square webhook without signature verification");
    }

    const event = JSON.parse(body);
    console.log(`Square webhook: ${event?.type}`);

    const payment = event?.data?.object?.payment;
    if (!payment) return ok();

    // Only act on a settled payment.
    const status = payment.status; // APPROVED | COMPLETED | CANCELED | FAILED
    if (status !== "COMPLETED" && status !== "APPROVED") return ok();

    const orderId = payment.order_id;
    if (!orderId) return ok();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: claim, error: findErr } = await supabase
      .from("sponsor_claims")
      .select("id, plan, status")
      .eq("square_order_id", orderId)
      .maybeSingle();

    if (findErr || !claim) {
      console.error("No sponsor_claims row for order_id", orderId, findErr);
      return ok();
    }
    if (claim.status === "reserved" || claim.status === "claimed") return ok(); // idempotent

    const amountPaid = payment.amount_money?.amount ?? 0;
    const now = new Date().toISOString();
    const isFull = claim.plan === "full";

    const { error: updErr } = await supabase
      .from("sponsor_claims")
      .update({
        status: isFull ? "claimed" : "reserved",
        amount_paid_cents: amountPaid,
        balance_due_cents: isFull ? 0 : 55000,
        square_payment_id: payment.id ?? null,
        reserved_at: now,
        claimed_at: isFull ? now : null,
        updated_at: now,
      })
      .eq("id", claim.id);

    if (updErr) console.error("sponsor_claims update error:", updErr);
    else console.log(`Sponsor claim ${claim.id} -> ${isFull ? "claimed" : "reserved"}`);

    return ok();
  } catch (err) {
    console.error("square-webhook error:", err);
    // Return 200 so Square doesn't hammer retries on a parse error we can't fix.
    return ok();
  }
});

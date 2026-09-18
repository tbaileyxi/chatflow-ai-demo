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

    const { data: claims, error: findErr } = await supabase
      .from("sponsor_claims")
      .select("id, plan, status, team_key, team_name, business_name, website")
      .eq("square_order_id", orderId);

    if (findErr || !claims?.length) {
      console.error("No sponsor_claims row for order_id", orderId, findErr);
      return ok();
    }
    if (claims.every((claim) => claim.status === "reserved" || claim.status === "claimed")) return ok();

    const totalPaid = payment.amount_money?.amount ?? 0;
    const amountPaidPerTeam = Math.round(totalPaid / claims.length);
    const now = new Date().toISOString();

    for (const claim of claims) {
      if (claim.status === "reserved" || claim.status === "claimed") continue;
      const { error: updErr } = await supabase
        .from("sponsor_claims")
        .update({
          status: "claimed",
          amount_paid_cents: amountPaidPerTeam,
          balance_due_cents: 0,
          square_payment_id: payment.id ?? null,
          reserved_at: now,
          claimed_at: now,
          updated_at: now,
        })
        .eq("id", claim.id);

      if (updErr) {
        console.error("sponsor_claims update error:", updErr);
        continue;
      }
      console.log(`Sponsor claim ${claim.id} -> claimed`);

      // Put the sponsor ON SCREEN.
      //
      // Marking the claim paid used to be the end of it, which meant a sponsor
      // could pay and never appear anywhere in the product — the app reads
      // team_sponsors, and nothing was writing it. This is the step that turns
      // a payment into the thing that was actually sold.
      //
      // team_key holds a teams.id uuid for anything bought through the current
      // board. Older rows key on "NFL|Chicago|Bears" and cannot be resolved to
      // a team, so they are skipped rather than guessed at.
      // Keys arrive as "<team uuid>:founding" (and older ones as "<uuid>:3" or
      // "<uuid>:all"). Only the uuid half identifies the team. Reading the
      // whole string as the id failed the uuid test on every new claim and
      // skipped it — before the founding_partners row was ever written.
      const teamId = String(claim.team_key ?? "").split(":")[0];
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);
      if (!isUuid) {
        console.log(`Claim ${claim.id}: team_key "${teamId}" is not a team id — no sponsor row written`);
        continue;
      }
      if (!claim.business_name) {
        console.error(`Claim ${claim.id}: missing business_name, cannot record a partner`);
        continue;
      }
      // The claim form no longer asks for a website. The legacy team_sponsors
      // row needs a link to render, so it is skipped without one — but the
      // founding_partners row below does not, and must never be skipped for
      // lack of one. That table is what the product reads; a paid partner
      // missing from it appears nowhere.
      const hasSite = !!claim.website;

      // One active sponsor per team is enforced by a partial unique index, so
      // retire whatever was there before rather than colliding with it.
      if (hasSite) {
      const { error: retireErr } = await supabase
        .from("team_sponsors")
        .update({ is_active: false })
        .eq("team_id", teamId)
        .eq("is_active", true);
      if (retireErr) console.error("team_sponsors retire error:", retireErr);

      const { error: sponsorErr } = await supabase.from("team_sponsors").insert({
        team_id: teamId,
        brand_name: claim.business_name,
        link_url: claim.website,
        is_active: true,
        // A season, dated from the payment. Without an end date the sponsorship
        // would quietly run forever and there would be nothing to renew.
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (sponsorErr) console.error("team_sponsors insert error:", sponsorErr);
      else console.log(`${claim.business_name} is now live on ${claim.team_name}`);
      }

      // AND THE TABLE THE PRODUCT ACTUALLY READS.
      //
      // team_sponsors is the old model's store, and nothing in the app reads
      // it any more — the pregame card and the clip caption both read
      // founding_partners. Payment was landing in a table the surfaces never
      // look at, which means a partner could pay $2,500 and never appear
      // anywhere, with every row in the database saying it had worked.
      //
      // team_sponsors is still written above so the old board and anything
      // reporting off it keep functioning; this is the row that makes the
      // partnership real.
      const teamSlug = String(claim.team_name ?? "")
        .toLowerCase()
        .replace(/\s*\((all six|spot \d+|season|founding)\)\s*$/i, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      if (!teamSlug) {
        console.error(`Claim ${claim.id}: no usable team slug from "${claim.team_name}"`);
        continue;
      }

      const { error: partnerErr } = await supabase
        .from("founding_partners")
        .upsert(
          {
            team_slug: teamSlug,
            partner_name: claim.business_name,
            // sponsor_claims does not carry a category today. Null rather
            // than guessed: the category is what the exclusivity is against,
            // and inventing one would make a promise nobody sold.
            category: null,
            season: new Date().getFullYear(),
          },
          { onConflict: "team_slug,season" },
        );

      if (partnerErr) console.error("founding_partners upsert error:", partnerErr);
      else console.log(`${claim.business_name} is the founding partner for ${teamSlug}`);
    }

    return ok();
  } catch (err) {
    console.error("square-webhook error:", err);
    // Return 200 so Square doesn't hammer retries on a parse error we can't fix.
    return ok();
  }
});

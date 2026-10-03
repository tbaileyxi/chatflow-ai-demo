import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Square webhook -> keep sponsor_claims, team_sponsors and founding_partners
// in step with a MONTHLY SUBSCRIPTION.
//
// The season model only had one thing to hear: a payment landed, put the
// sponsor on screen, done forever. A subscription has a life — it starts, it
// bills again every month, and it can stop — and the last of those is the one
// that matters, because a partner who stops paying has to come off the rooms
// the same day.
//
// FOUR EVENTS, AND THE THREAD BETWEEN THEM IS THE CUSTOMER.
//
//   payment.updated      the first charge. Carries the order id we stored at
//                        checkout, so this is the only event that can find
//                        the claim by itself — and it carries customer_id,
//                        which is why it writes it down.
//   subscription.created arrives just after, with the subscription id and the
//                        same customer_id and NOTHING ELSE in common. Square
//                        never says "this subscription came from that
//                        checkout"; the customer is the only thread, which is
//                        why the event above must run first and must store it.
//   invoice.payment_made every month after. Found by subscription id.
//   subscription.updated status changes. CANCELED or DEACTIVATED takes the
//                        sponsor down and puts the slot back on the board.
//
// Register ALL FOUR in the Square dashboard. Registering only payment.updated
// — which is what the season model needed — gives you sponsors who can never
// stop paying and never come down.
//
// Required edge-function secrets:
//   SQUARE_WEBHOOK_SIGNATURE_KEY – signature key from the Square webhook subscription
//   SQUARE_WEBHOOK_URL           – the exact notification URL registered in Square
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY – injected automatically

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-square-hmacsha256-signature",
};

type Claim = {
  id: string;
  plan: string | null;
  status: string;
  team_key: string;
  team_name: string;
  business_name: string | null;
  website: string | null;
  monthly_cents: number | null;
  amount_paid_cents: number | null;
};

const CLAIM_COLUMNS =
  "id, plan, status, team_key, team_name, business_name, website, monthly_cents, amount_paid_cents";

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

/** teams.id out of a team_key like "<uuid>:founding". Null if it is a legacy key. */
function teamIdFrom(claim: Claim): string | null {
  const teamId = String(claim.team_key ?? "").split(":")[0];
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);
  return isUuid ? teamId : null;
}

/** The slug founding_partners keys on. */
function teamSlugFrom(claim: Claim): string {
  return String(claim.team_name ?? "")
    .toLowerCase()
    .replace(/\s*\((all six|spot \d+|season|founding)\)\s*$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Put the sponsor on screen. */
async function activate(supabase: any, claim: Claim) {
  const teamId = teamIdFrom(claim);
  if (!teamId) {
    console.log(`Claim ${claim.id}: team_key is not a team id — no sponsor row written`);
    return;
  }
  if (!claim.business_name) {
    console.error(`Claim ${claim.id}: missing business_name, cannot record a partner`);
    return;
  }

  // The claim form no longer asks for a website. The legacy team_sponsors row
  // needs a link to render, so it is skipped without one — but the
  // founding_partners row below does not, and must never be skipped for lack
  // of one. That table is what the product reads.
  if (claim.website) {
    // One active sponsor per team is enforced by a partial unique index, so
    // retire whatever was there before rather than colliding with it.
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
      // A year out. On a subscription the real end is whenever they cancel,
      // and subscription.updated is what actually takes them down — this is
      // only a backstop so a forgotten row cannot run forever.
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (sponsorErr) console.error("team_sponsors insert error:", sponsorErr);
    else console.log(`${claim.business_name} is now live on ${claim.team_name}`);
  }

  // AND THE TABLE THE PRODUCT ACTUALLY READS. The pregame card and the clip
  // caption both read founding_partners; team_sponsors is the old model's
  // store and nothing in the app looks at it any more.
  const teamSlug = teamSlugFrom(claim);
  if (!teamSlug) {
    console.error(`Claim ${claim.id}: no usable team slug from "${claim.team_name}"`);
    return;
  }

  const { error: partnerErr } = await supabase
    .from("founding_partners")
    .upsert(
      {
        team_slug: teamSlug,
        partner_name: claim.business_name,
        // sponsor_claims does not carry a category today. Null rather than
        // guessed: the category is what the exclusivity is against.
        category: null,
        season: new Date().getFullYear(),
      },
      { onConflict: "team_slug,season" },
    );

  if (partnerErr) console.error("founding_partners upsert error:", partnerErr);
  else console.log(`${claim.business_name} is the partner for ${teamSlug}`);
}

/** Take the sponsor down and put the slot back on the board. */
async function lapse(supabase: any, claim: Claim) {
  const now = new Date().toISOString();

  const { error: claimErr } = await supabase
    .from("sponsor_claims")
    .update({ status: "lapsed", updated_at: now })
    .eq("id", claim.id);
  if (claimErr) {
    console.error("sponsor_claims lapse error:", claimErr);
    return;
  }

  const teamId = teamIdFrom(claim);
  if (teamId) {
    const { error: retireErr } = await supabase
      .from("team_sponsors")
      .update({ is_active: false })
      .eq("team_id", teamId)
      .eq("is_active", true);
    if (retireErr) console.error("team_sponsors retire error:", retireErr);
  }

  // DELETED, not flagged. founding_partners has no active column — the row's
  // existence IS the sponsorship, and the pregame card reads it directly. A
  // row left behind is a logo still showing for a business that cancelled.
  const teamSlug = teamSlugFrom(claim);
  if (teamSlug) {
    const { error: partnerErr } = await supabase
      .from("founding_partners")
      .delete()
      .eq("team_slug", teamSlug)
      .eq("season", new Date().getFullYear());
    if (partnerErr) console.error("founding_partners delete error:", partnerErr);
  }

  console.log(`Claim ${claim.id} lapsed — ${claim.team_name} is open again`);
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
    const type = String(event?.type ?? "");
    console.log(`Square webhook: ${type}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const now = new Date().toISOString();

    // ---- The first charge. The only event that can find the claim alone. ----
    if (type === "payment.updated" || type === "payment.created") {
      const payment = event?.data?.object?.payment;
      if (!payment) return ok();
      const status = payment.status; // APPROVED | COMPLETED | CANCELED | FAILED
      if (status !== "COMPLETED" && status !== "APPROVED") return ok();

      const orderId = payment.order_id;
      if (!orderId) return ok();

      const { data: claims, error: findErr } = await supabase
        .from("sponsor_claims")
        .select(CLAIM_COLUMNS)
        .eq("square_order_id", orderId);

      if (findErr || !claims?.length) {
        console.error("No sponsor_claims row for order_id", orderId, findErr);
        return ok();
      }

      const totalPaid = payment.amount_money?.amount ?? 0;
      const paidPerTeam = Math.round(totalPaid / claims.length);

      for (const claim of claims as Claim[]) {
        if (claim.status === "claimed") continue;
        const { error: updErr } = await supabase
          .from("sponsor_claims")
          .update({
            status: "claimed",
            amount_paid_cents: paidPerTeam,
            balance_due_cents: 0,
            square_payment_id: payment.id ?? null,
            // THE THREAD. Without this, subscription.created below has no way
            // of knowing which team it belongs to, and a cancellation can
            // never be matched back to a logo that needs taking down.
            square_customer_id: payment.customer_id ?? null,
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
        await activate(supabase, claim);
      }
      return ok();
    }

    // ---- The subscription appears, carrying only the customer in common. ----
    if (type === "subscription.created") {
      const sub = event?.data?.object?.subscription;
      const customerId = sub?.customer_id;
      if (!sub?.id || !customerId) return ok();

      const { error: linkErr } = await supabase
        .from("sponsor_claims")
        .update({ square_subscription_id: sub.id, updated_at: now })
        .eq("square_customer_id", customerId)
        .is("square_subscription_id", null);

      if (linkErr) console.error("subscription link error:", linkErr);
      else console.log(`Subscription ${sub.id} linked to customer ${customerId}`);
      return ok();
    }

    // ---- Every month after. Found by subscription id. ----
    if (type === "invoice.payment_made") {
      const invoice = event?.data?.object?.invoice;
      const subId = invoice?.subscription_id;
      if (!subId) return ok();

      const { data: claims } = await supabase
        .from("sponsor_claims")
        .select(CLAIM_COLUMNS)
        .eq("square_subscription_id", subId);
      if (!claims?.length) {
        console.error("No sponsor_claims row for subscription", subId);
        return ok();
      }

      for (const claim of claims as Claim[]) {
        const paid = (claim.amount_paid_cents ?? 0) + (claim.monthly_cents ?? 0);
        await supabase
          .from("sponsor_claims")
          .update({ amount_paid_cents: paid, updated_at: now })
          .eq("id", claim.id);

        // A sponsor who lapsed and then paid again comes straight back up.
        if (claim.status !== "claimed") {
          await supabase
            .from("sponsor_claims")
            .update({ status: "claimed", claimed_at: now, updated_at: now })
            .eq("id", claim.id);
          await activate(supabase, claim);
        }
      }
      return ok();
    }

    // ---- They stopped. Take them down. ----
    if (type === "subscription.updated") {
      const sub = event?.data?.object?.subscription;
      const subId = sub?.id;
      const status = String(sub?.status ?? "").toUpperCase();
      if (!subId) return ok();
      // ACTIVE and PENDING are fine; PAUSED, CANCELED and DEACTIVATED are not.
      if (status === "ACTIVE" || status === "PENDING") return ok();

      const { data: claims } = await supabase
        .from("sponsor_claims")
        .select(CLAIM_COLUMNS)
        .eq("square_subscription_id", subId);
      if (!claims?.length) {
        console.error("No sponsor_claims row for subscription", subId);
        return ok();
      }

      for (const claim of claims as Claim[]) {
        if (claim.status === "lapsed") continue;
        await lapse(supabase, claim);
      }
      return ok();
    }

    return ok();
  } catch (err) {
    console.error("square-webhook error:", err);
    // Return 200 so Square doesn't hammer retries on a parse error we can't fix.
    return ok();
  }
});

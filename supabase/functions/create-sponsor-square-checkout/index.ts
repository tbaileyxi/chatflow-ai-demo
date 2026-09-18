import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { seasonPriceCents } from "../_shared/founding.ts";

// Sponsor checkout via Square Payment Links (Online Checkout).
//
// One price per team for the season, paid in full. No deposit, no balance at
// the opener, no tier ladder — every one of those was a second conversation.
//
// The link is built HERE rather than pointing at a fixed Square link, and that
// is the entire point: a fixed link cannot know that somebody picked four
// teams. It would charge for one and ask them to retype the teams they already
// chose. This sends the exact total and puts the team list on the order note,
// so the buyer picks on the page and then only pays.
//
// This number must match the page. It is computed here, not sent by the client,
// so the two are edited together or a sponsor is charged something other than
// what they were shown.
//
// Required edge-function secrets (set in Supabase → Edge Functions → Secrets):
//   SQUARE_ACCESS_TOKEN  – Square access token (Production or Sandbox)
//   SQUARE_LOCATION_ID   – your Square location id
//   SQUARE_ENV           – "production" or "sandbox" (default "sandbox")
//
// Body: { teams: [{ teamKey, teamName, league }], businessName, website }
//
// businessName and website are collected on the page and stored on the claim,
// because team_sponsors.link_url is NOT NULL and Square gives us neither.
// Without them a payment lands and the sponsor never appears in a room.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * ONE PRICE, AND EXCLUSIVITY IS NOT AN UPGRADE.
 *
 * This sold six positions per team at $100, with $500 to take all six — a
 * ladder that made the cheap option the default and category exclusivity a
 * thing you paid extra for. The model is now one founding partner per team per
 * season, one flat price: exclusivity IS the product, so there is nothing to
 * upsell and no second number to explain. No prorating, whenever in the season
 * it is bought.
 *
 * $500 until the founding deadline, $2,500 after — read at the moment of
 * checkout from _shared/founding.ts, so the charge flips on its own.
 */
function totalCents(count: number) {
  return count * seasonPriceCents();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Exclusive rides the same path as a single slot rather than a fixed
    // Square link. A fixed link takes $500 and cannot say WHICH team it was
    // for — the order arrives as an anonymous amount and somebody has to go
    // and ask. Here the team is on the order note and the claim row exists
    // before the card field is ever shown, exactly as it is for $100.
    // `exclusive` is still accepted and ignored: every partnership is
    // exclusive now, and an old page or a stale tab sending it should not be
    // charged differently for saying so.
    const { teams, businessName, website, contactName, email } = await req.json();
    if (!Array.isArray(teams) || teams.length === 0) {
      return json({ error: "Select at least one team." }, 400);
    }
    if (teams.length > 20) {
      return json({ error: "Contact partnerships for packages larger than 20 teams." }, 400);
    }

    const brand = String(businessName || "").trim();
    const site = String(website || "").trim();
    if (!brand) return json({ error: "Add your business name." }, 400);
    // Website is optional now: the claim form asks for a name and an email,
    // which is what it takes to reach somebody, and a business with no site is
    // still a business.
    const who = String(contactName ?? "").trim();
    const mail = String(email ?? "").trim();
    if (!who) return json({ error: "Add your name." }, 400);
    if (!mail || !mail.includes("@")) return json({ error: "Add an email we can reach you at." }, 400);
    // Accept "murphys.com" as well as a full URL — nobody types https://.
    // Empty stays empty — "https://" on its own is not a website.
    const siteUrl = !site ? null : /^https?:\/\//i.test(site) ? site : `https://${site}`;

    const cleanTeams = teams.map((team: unknown) => {
      const candidate = team as { teamKey?: unknown; teamName?: unknown; league?: unknown };
      return {
        teamKey: String(candidate.teamKey || "").trim(),
        teamName: String(candidate.teamName || "").trim(),
        league: String(candidate.league || "").trim(),
      };
    });
    if (cleanTeams.some((team) => !team.teamKey || !team.teamName || !team.league)) {
      return json({ error: "One or more selected teams are invalid." }, 400);
    }

    const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
    const locationId = Deno.env.get("SQUARE_LOCATION_ID");
    if (!accessToken || !locationId) {
      console.error("Square is not configured: missing SQUARE_ACCESS_TOKEN / SQUARE_LOCATION_ID");
      return json({ error: "Checkout is down for a moment. Email ty@sidehuddlesports.com and it'll be sorted today." }, 500);
    }
    const squareBase = (Deno.env.get("SQUARE_ENV") || "sandbox") === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: unavailable, error: availabilityError } = await supabase
      .from("sponsor_claims")
      .select("team_key, team_name, status")
      .in("team_key", cleanTeams.map((team) => team.teamKey))
      .in("status", ["reserved", "claimed"]);

    if (availabilityError) {
      console.error("Sponsor availability check failed:", availabilityError);
      return json({ error: "Couldn't check that team just now. Try again in a minute." }, 500);
    }
    if (unavailable?.length) {
      return json({
        error: `${unavailable.map((team) => team.team_name).join(", ")} already ${unavailable[0].status}. Refresh the page and choose another team.`,
      }, 409);
    }

    const count = cleanTeams.length;
    const total = totalCents(count);

    const teamNames: string[] = cleanTeams.map((team) => team.teamName);
    const teamList = teamNames.join(", ");
    const productName =
      count === 1
        ? `Side Huddle founding partner — ${teamNames[0]} (season)`
        : `Side Huddle founding partner — ${count} teams (season)`;

    const origin = req.headers.get("origin") || "https://sidehuddlesports.com";

    const squareRes = await fetch(`${squareBase}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Square-Version": "2024-10-17",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        quick_pay: {
          name: productName,
          price_money: { amount: total, currency: "USD" },
          location_id: locationId,
        },
        checkout_options: {
          redirect_url: `${origin}/sponsor?paid=1`,
          ask_for_shipping_address: false,
        },
        // Team list is recorded on the order note so you can see what was bought.
        // The teams ride on the order note, so a payment is always matchable
        // to the slots it bought without asking the buyer to say it twice.
        payment_note: `founding partner · ${teamList} · ${who} <${mail}>`.slice(0, 500),
      }),
    });

    const data = await squareRes.json();
    if (!squareRes.ok) {
      console.error("Square payment-link error:", JSON.stringify(data));
      return json({ error: "Square checkout failed.", detail: data?.errors ?? data }, 502);
    }

    const paymentLink = data.payment_link;
    const orderId = paymentLink?.order_id;
    if (!paymentLink?.url || !orderId) {
      console.error("Square response missing payment link/order:", JSON.stringify(data));
      return json({ error: "Square checkout did not return a usable order." }, 502);
    }

    const claimRows = cleanTeams.map((team) => ({
      team_key: team.teamKey,
      team_name: team.teamName,
      league: team.league,
      status: "open",
      // One plan exists now. The column stays so old rows still read.
      plan: "founding",
      business_name: brand,
      sponsor_email: mail,
      website: siteUrl,
      amount_paid_cents: 0,   // set by square-webhook when the payment lands
      balance_due_cents: 0,   // nothing owed later — the one price is the whole price
      square_checkout_id: paymentLink.id ?? null,
      square_order_id: orderId,
    }));

    const { error: claimError } = await supabase
      .from("sponsor_claims")
      .upsert(claimRows, { onConflict: "team_key" });

    if (claimError) {
      console.error("Sponsor claims creation failed:", claimError);
      return json({ error: "Checkout was created, but the team reservation record failed. Please contact partnerships." }, 500);
    }

    return json({ url: paymentLink.url, total, count });
  } catch (err) {
    console.error("create-sponsor-square-checkout error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

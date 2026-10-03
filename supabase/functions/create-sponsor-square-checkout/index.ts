import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { monthlyCentsForLeague, monthlyTotalCents } from "../_shared/founding.ts";

// Sponsor checkout via Square Payment Links — now a SUBSCRIPTION, not a sale.
//
// $500 a month per pro team, $250 for a college, billed by Square until they
// cancel. The season rate is gone: it sold nothing, and one-partner-per-team
// at $500 a season capped the whole business at $50k a year.
//
// HOW SQUARE DOES RECURRING. A payment link can start a subscription if it
// carries `subscription_plan_id` alongside the usual quick_pay — the id of a
// subscription plan VARIATION (the thing that holds cadence and price), not
// of the plan itself. Square then takes the card, charges the first month,
// and keeps charging monthly on its own.
// https://developer.squareup.com/docs/checkout-api/subscription-plan-checkout
//
// A VARIATION PER PRICE, CREATED ON DEMAND. The cart can be any mix of teams,
// so the monthly total is any multiple of $250 — there is no fixed set of
// plans to pre-build. Each distinct amount gets one variation named
// `shs-monthly-<cents>`, looked up before it is created and reused forever
// after. The alternative Square offers is a price override on the link, and
// that is a trap: it charges the right amount once and the variation's amount
// every month after, which is a sponsor quietly billed the wrong number.
//
// Required edge-function secrets (Supabase → Edge Functions → Secrets):
//   SQUARE_ACCESS_TOKEN  – Square access token (Production or Sandbox)
//   SQUARE_LOCATION_ID   – your Square location id
//   SQUARE_ENV           – "production" or "sandbox" (default "sandbox")
//
// Body: { teams: [{ teamKey, teamName, league }], businessName, website,
//         contactName, email }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQUARE_VERSION = "2024-10-17";
const PLAN_NAME = "Side Huddle partner";

type Square = { base: string; token: string };

async function squareFetch(sq: Square, path: string, body: unknown) {
  const res = await fetch(`${sq.base}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${sq.token}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

/** Find a catalog object by its exact name, or null. */
async function findByName(sq: Square, type: string, name: string): Promise<string | null> {
  const { ok, data } = await squareFetch(sq, "/v2/catalog/search", {
    object_types: [type],
    query: { exact_query: { attribute_name: "name", attribute_value: name } },
    limit: 1,
  });
  if (!ok) {
    console.error(`catalog search failed for ${type} ${name}:`, JSON.stringify(data));
    return null;
  }
  return data?.objects?.[0]?.id ?? null;
}

/**
 * The one plan every partner is on. Variations under it carry the prices.
 * Created the first time anybody checks out and found by name thereafter.
 */
async function ensurePlan(sq: Square): Promise<string> {
  const existing = await findByName(sq, "SUBSCRIPTION_PLAN", PLAN_NAME);
  if (existing) return existing;

  const { ok, data } = await squareFetch(sq, "/v2/catalog/object", {
    idempotency_key: `shs-plan-${PLAN_NAME}`,
    object: {
      type: "SUBSCRIPTION_PLAN",
      id: "#plan",
      subscription_plan_data: { name: PLAN_NAME, all_items: false },
    },
  });
  if (!ok) throw new Error(`Square could not create the partner plan: ${JSON.stringify(data?.errors ?? data)}`);
  return data.catalog_object.id;
}

/**
 * The variation for one exact monthly amount.
 *
 * No `periods` on the phase, deliberately — a phase with a period count stops
 * after that many cycles, and this should run until they cancel.
 */
async function ensureVariation(sq: Square, planId: string, cents: number): Promise<string> {
  const name = `shs-monthly-${cents}`;
  const existing = await findByName(sq, "SUBSCRIPTION_PLAN_VARIATION", name);
  if (existing) return existing;

  const { ok, data } = await squareFetch(sq, "/v2/catalog/object", {
    idempotency_key: `shs-var-${cents}`,
    object: {
      type: "SUBSCRIPTION_PLAN_VARIATION",
      id: "#variation",
      subscription_plan_variation_data: {
        name,
        subscription_plan_id: planId,
        phases: [
          {
            uid: "monthly",
            ordinal: 0,
            cadence: "MONTHLY",
            pricing: { type: "STATIC", price: { amount: cents, currency: "USD" } },
          },
        ],
      },
    },
  });
  if (!ok) throw new Error(`Square could not create the ${cents} plan: ${JSON.stringify(data?.errors ?? data)}`);
  return data.catalog_object.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
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
    const who = String(contactName ?? "").trim();
    const mail = String(email ?? "").trim();
    if (!who) return json({ error: "Add your name." }, 400);
    if (!mail || !mail.includes("@")) return json({ error: "Add an email we can reach you at." }, 400);
    // Accept "murphys.com" as well as a full URL — nobody types https://.
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
    const sq: Square = {
      token: accessToken,
      base: (Deno.env.get("SQUARE_ENV") || "sandbox") === "production"
        ? "https://connect.squareup.com"
        : "https://connect.squareupsandbox.com",
    };
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // A lapsed team is available again: the test asks only whether somebody is
    // currently in the slot, and a sponsor who stopped paying is not.
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
    const monthly = monthlyTotalCents(cleanTeams.map((team) => team.league));

    const teamNames: string[] = cleanTeams.map((team) => team.teamName);
    const teamList = teamNames.join(", ");
    const productName =
      count === 1
        ? `Side Huddle partner — ${teamNames[0]} (monthly)`
        : `Side Huddle partner — ${count} teams (monthly)`;

    const planId = await ensurePlan(sq);
    const variationId = await ensureVariation(sq, planId, monthly);

    const origin = req.headers.get("origin") || "https://sidehuddlesports.com";

    const { ok, data } = await squareFetch(sq, "/v2/online-checkout/payment-links", {
      idempotency_key: crypto.randomUUID(),
      // price_money here must equal the variation's price. Square treats a
      // mismatch as a one-off override on the first charge only, which would
      // mean every month after is billed at a number nobody agreed to.
      quick_pay: {
        name: productName,
        price_money: { amount: monthly, currency: "USD" },
        location_id: locationId,
      },
      subscription_plan_id: variationId,
      checkout_options: {
        redirect_url: `${origin}/sponsor?paid=1`,
        ask_for_shipping_address: false,
      },
      payment_note: `partner · ${teamList} · ${who} <${mail}>`.slice(0, 500),
    });

    if (!ok) {
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
      plan: "monthly",
      business_name: brand,
      sponsor_email: mail,
      website: siteUrl,
      // What THIS team costs each month, not the cart's total — one row per
      // team, and a cart can mix a pro side with a college one.
      monthly_cents: monthlyCentsForLeague(team.league),
      amount_paid_cents: 0,   // climbs with each Square charge, via square-webhook
      balance_due_cents: 0,   // nothing is ever owed later on a subscription
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

    return json({ url: paymentLink.url, monthly, count });
  } catch (err) {
    console.error("create-sponsor-square-checkout error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

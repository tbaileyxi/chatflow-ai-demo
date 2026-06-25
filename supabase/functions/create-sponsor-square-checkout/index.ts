import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Founding-sponsor checkout via Square Payment Links (Online Checkout).
// Builds ONE hosted Square checkout for all selected teams, at the correct total
// ($200 reserve per team, or $750 paid-in-full per team).
//
// Required edge-function secrets (set in Supabase → Edge Functions → Secrets):
//   SQUARE_ACCESS_TOKEN  – Square access token (Production or Sandbox)
//   SQUARE_LOCATION_ID   – your Square location id
//   SQUARE_ENV           – "production" or "sandbox" (default "sandbox")
//
// Body: { teams: [{ teamKey, teamName, league }], plan: "reserve"|"full" }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESERVE_PER_TEAM = 20000; // $200.00 hold per team
const FULL_PER_TEAM = 75000;    // $750.00 paid-in-full per team

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { teams, plan } = await req.json();
    if (!Array.isArray(teams) || teams.length === 0) {
      return json({ error: "Select at least one team." }, 400);
    }
    if (teams.length > 20) {
      return json({ error: "Contact partnerships for packages larger than 20 teams." }, 400);
    }

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

    const checkoutPlan = plan === "full" ? "full" : "reserve";

    const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
    const locationId = Deno.env.get("SQUARE_LOCATION_ID");
    if (!accessToken || !locationId) {
      return json({ error: "Square is not configured yet (missing SQUARE_ACCESS_TOKEN / SQUARE_LOCATION_ID)." }, 500);
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
      return json({ error: "Could not verify team availability." }, 500);
    }
    if (unavailable?.length) {
      return json({
        error: `${unavailable.map((team) => team.team_name).join(", ")} already ${unavailable[0].status}. Refresh the page and choose another team.`,
      }, 409);
    }

    const perTeam = checkoutPlan === "full" ? FULL_PER_TEAM : RESERVE_PER_TEAM;
    const count = cleanTeams.length;
    const total = perTeam * count;

    const teamNames: string[] = cleanTeams.map((team) => team.teamName);
    const teamList = teamNames.join(", ");
    const planLabel = checkoutPlan === "full" ? "Paid in full" : "Reserve deposit";
    const productName = count === 1
      ? `Side Huddle Founding Sponsor — ${teamNames[0]} (${planLabel})`
      : `Side Huddle Founding Sponsor — ${count} teams (${planLabel})`;

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
          redirect_url: `${origin}/sponsors?paid=1`,
          ask_for_shipping_address: false,
        },
        // Team list is recorded on the order note so you can see what was bought.
        payment_note: `${checkoutPlan} · ${teamList}`.slice(0, 500),
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
      plan: checkoutPlan,
      amount_paid_cents: 0,
      balance_due_cents: checkoutPlan === "full" ? 0 : 55000,
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

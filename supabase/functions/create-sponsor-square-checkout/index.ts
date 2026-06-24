import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
    const checkoutPlan = plan === "full" ? "full" : "reserve";

    const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
    const locationId = Deno.env.get("SQUARE_LOCATION_ID");
    if (!accessToken || !locationId) {
      return json({ error: "Square is not configured yet (missing SQUARE_ACCESS_TOKEN / SQUARE_LOCATION_ID)." }, 500);
    }
    const squareBase = (Deno.env.get("SQUARE_ENV") || "sandbox") === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";

    const perTeam = checkoutPlan === "full" ? FULL_PER_TEAM : RESERVE_PER_TEAM;
    const count = teams.length;
    const total = perTeam * count;

    const teamNames: string[] = teams.map((t: { teamName: string }) => t.teamName);
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

    return json({ url: data.payment_link?.url, total, count });
  } catch (err) {
    console.error("create-sponsor-square-checkout error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

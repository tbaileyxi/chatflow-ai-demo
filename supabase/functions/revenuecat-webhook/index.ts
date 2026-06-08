// RevenueCat -> Supabase webhook bridge.
// RevenueCat is the source of truth for subscription state. This handler
// projects RC events into our `subscriptions` table and (for cancellations)
// flips the attached huddle's official_status back to inactive.
//
// Configure in RevenueCat dashboard:
//   Webhook URL: https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/revenuecat-webhook
//   Authorization Header: Bearer <REVENUECAT_WEBHOOK_AUTH>  (a secret you choose)
//
// Set Supabase secrets:
//   supabase secrets set --project-ref dejuwyeypiggvlyfliap \
//     REVENUECAT_WEBHOOK_AUTH=<long-random-string>

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// RevenueCat event reference:
// https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
type RcEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "NON_RENEWING_PURCHASE"
  | "EXPIRATION"
  | "BILLING_ISSUE"
  | "PRODUCT_CHANGE"
  | "TRANSFER"
  | "SUBSCRIBER_ALIAS";

interface RcEvent {
  type: RcEventType;
  id: string;
  app_user_id: string;
  original_app_user_id?: string;
  product_id: string;
  entitlement_ids?: string[];
  entitlement_id?: string;
  original_transaction_id?: string;
  store: "APP_STORE" | "PLAY_STORE" | "STRIPE" | "MAC_APP_STORE" | "PROMOTIONAL" | string;
  purchased_at_ms?: number;
  expiration_at_ms?: number;
  cancel_reason?: string;
  is_trial_period?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const REVENUECAT_WEBHOOK_AUTH = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("missing supabase env", { status: 500 });
  }

  // Shared-secret check. RevenueCat sends whatever you put in its
  // Authorization header field; treat it as a bearer secret.
  if (REVENUECAT_WEBHOOK_AUTH) {
    const auth = req.headers.get("Authorization") ?? "";
    const expected = `Bearer ${REVENUECAT_WEBHOOK_AUTH}`;
    if (auth !== expected) {
      console.warn("[rc-webhook] auth mismatch");
      return new Response("unauthorized", { status: 401 });
    }
  } else {
    console.warn("[rc-webhook] REVENUECAT_WEBHOOK_AUTH not set; accepting without auth");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const event: RcEvent = payload?.event ?? payload;
  if (!event?.type || !event?.app_user_id) {
    return new Response("missing fields", { status: 400 });
  }

  console.log(`[rc-webhook] ${event.type} for ${event.app_user_id}`);

  // app_user_id should be the Supabase auth.users.id (we configure mobile SDK
  // to set it that way). If it doesn't parse as a UUID, treat as opaque.
  const userId = isUuid(event.app_user_id) ? event.app_user_id : null;
  if (!userId) {
    console.warn("[rc-webhook] non-uuid app_user_id; cannot map to user");
    return new Response(JSON.stringify({ skipped: "non-uuid app_user_id" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const entitlementId =
    event.entitlement_ids?.[0] ??
    event.entitlement_id ??
    "official_huddle_access";
  const store = mapStore(event.store);

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE": {
      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          rc_app_user_id: event.app_user_id,
          product_id: event.product_id,
          entitlement_id: entitlementId,
          store,
          original_transaction_id: event.original_transaction_id ?? null,
          status: "active",
          period_start: event.purchased_at_ms
            ? new Date(event.purchased_at_ms).toISOString()
            : new Date().toISOString(),
          period_end: event.expiration_at_ms
            ? new Date(event.expiration_at_ms).toISOString()
            : null,
          auto_renews: event.type !== "NON_RENEWING_PURCHASE",
          raw_event: event,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "original_transaction_id" },
      );
      break;
    }

    case "CANCELLATION":
    case "EXPIRATION": {
      const { data: rows } = await supabase
        .from("subscriptions")
        .update({
          status: event.type === "EXPIRATION" ? "expired" : "cancelled",
          auto_renews: false,
          raw_event: event,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("entitlement_id", entitlementId)
        .eq("status", "active")
        .select("huddle_id");

      // Flip any attached huddles back to inactive.
      const huddleIds = (rows ?? []).map((r) => r.huddle_id).filter(Boolean) as string[];
      if (huddleIds.length > 0) {
        await supabase
          .from("huddles")
          .update({ official_status: "inactive" })
          .in("id", huddleIds);
      }
      break;
    }

    case "BILLING_ISSUE": {
      await supabase
        .from("subscriptions")
        .update({
          status: "in_grace",
          raw_event: event,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("entitlement_id", entitlementId)
        .eq("status", "active");
      break;
    }

    default:
      // TRANSFER, SUBSCRIBER_ALIAS — log only.
      console.log(`[rc-webhook] ignoring ${event.type}`);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function mapStore(s: string): "app_store" | "play_store" | "stripe" {
  const v = (s || "").toUpperCase();
  if (v === "PLAY_STORE") return "play_store";
  if (v === "STRIPE") return "stripe";
  return "app_store";
}

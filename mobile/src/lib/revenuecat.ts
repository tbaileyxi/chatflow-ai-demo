// RevenueCat SDK wrapper.
//
// Public SDK keys are designed to ship in client code (see RevenueCat docs).
// Tonight we're using the Test Store key — sandbox-only, won't connect to
// real App Store products yet. Swap to the appl_ key when the App Store
// app row finishes saving in RevenueCat.

import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";
import { Platform } from "react-native";
import { supabase } from "@/integrations/supabase/client";

// The single source of truth for the SDK key. Swap when production iOS key
// is available (will start with `appl_...`).
const REVENUECAT_IOS_KEY = "test_sypoGZMOgpTBVecrxIjvRMSWmJg";

// Entitlement that gates Official Huddle features.  Must match what you
// configure in RevenueCat dashboard.
export const OFFICIAL_HUDDLE_ENTITLEMENT = "official_huddle_access";

// Product identifier you registered in App Store Connect.
export const OFFICIAL_HUDDLE_PRODUCT_ID = "official_huddle_monthly";

let configured = false;

export async function ensureConfigured(userId?: string) {
  if (Platform.OS !== "ios") return;
  if (!configured) {
    Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({
      apiKey: REVENUECAT_IOS_KEY,
      appUserID: userId ?? null,
    });
    configured = true;
  } else if (userId) {
    // App may have configured anonymously at launch; re-identify once we know the user.
    try {
      const info = await Purchases.getCustomerInfo();
      if (info.originalAppUserId !== userId) {
        await Purchases.logIn(userId);
      }
    } catch (err) {
      console.warn("[rc] re-identify failed", err);
    }
  }
}

export async function logOut() {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    console.warn("[rc] logout failed", err);
  }
}

// ---- Offering / package helpers ----

export async function fetchOfficialHuddlePackage(): Promise<PurchasesPackage | null> {
  await ensureConfigured();
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return null;
    // Prefer the monthly package by identifier, then fall back to whatever's first.
    return (
      current.availablePackages.find(
        (p) => p.product.identifier === OFFICIAL_HUDDLE_PRODUCT_ID,
      ) ??
      current.monthly ??
      current.availablePackages[0] ??
      null
    );
  } catch (err) {
    console.warn("[rc] getOfferings failed", err);
    return null;
  }
}

// ---- Purchase flow ----

export interface PurchaseResult {
  ok: boolean;
  cancelled?: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}

export async function purchaseOfficialHuddle(
  pkg: PurchasesPackage,
): Promise<PurchaseResult> {
  try {
    const result = await Purchases.purchasePackage(pkg);
    return { ok: true, customerInfo: result.customerInfo };
  } catch (err: any) {
    if (err?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, error: err?.message ?? "Purchase failed" };
  }
}

export function hasOfficialEntitlement(info?: CustomerInfo | null): boolean {
  if (!info) return false;
  const ent = info.entitlements.active[OFFICIAL_HUDDLE_ENTITLEMENT];
  return !!ent;
}

// ---- Server side activation ----
// After a successful purchase, tell our backend to flip official_status on the
// huddle. RPC already verifies the user has an active subscription via the
// RevenueCat webhook that fired in parallel.

export async function activateOfficialOnHuddle(
  huddleId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await (supabase.rpc as any)("activate_official_huddle", {
    p_huddle_id: huddleId,
    p_entitlement_id: OFFICIAL_HUDDLE_ENTITLEMENT,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

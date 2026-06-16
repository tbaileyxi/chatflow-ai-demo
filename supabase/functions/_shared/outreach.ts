// Shared helpers for the sponsor-outreach edge functions (outreach-enrich / outreach-send).
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Service-role client — bypasses RLS for reads/writes inside the function. */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Verify the caller is an authenticated admin. Functions run with verify_jwt=true,
 * so the JWT is already validated; here we confirm the role via get_current_user_role.
 * Returns the service-role client on success, throws Response on failure.
 */
export async function requireAdmin(req: Request): Promise<SupabaseClient> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) throw json({ error: "Missing Authorization" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: role, error } = await userClient.rpc("get_current_user_role");
  if (error) {
    console.error("[requireAdmin] role check error:", error.message);
    throw json({ error: `Role check failed: ${error.message}` }, 403);
  }
  if (role !== "admin") {
    console.error("[requireAdmin] non-admin role:", role);
    throw json({ error: "Admin access required" }, 403);
  }

  return serviceClient();
}

// ── email validity / personal filters (ported from enrichment.py) ──────────────

const SKIP_PREFIXES = new Set([
  "info", "support", "contact", "hello", "admin", "team", "sales", "help", "mail",
  "office", "enquiries", "enquiry", "noreply", "no-reply", "webmaster", "general",
  "billing", "quotes", "quote", "service", "services", "reception", "front",
  "frontdesk", "booking", "bookings", "appointments", "care", "customercare",
  "clientcare", "marketing", "pr", "media", "careers", "jobs", "hr", "accounts",
]);

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".ico"];
const FAKE_LOCALS = new Set(["user", "example", "test", "email", "your", "name", "you"]);
const FAKE_DOMAINS = new Set(["domain.com", "example.com", "yourdomain.com", "email.com", "sentry.io"]);

export function isValidEmail(email: string): boolean {
  if (!email.includes("@")) return false;
  const lower = email.toLowerCase();
  const [local, domain] = lower.split("@").length === 2
    ? [lower.slice(0, lower.lastIndexOf("@")), lower.slice(lower.lastIndexOf("@") + 1)]
    : ["", ""];
  if (!local || !domain) return false;
  if (IMAGE_EXTS.some((ext) => domain.endsWith(ext))) return false;
  if (FAKE_LOCALS.has(local) || FAKE_DOMAINS.has(domain)) return false;
  if (local.length >= 32 && /^[0-9a-f]+$/.test(local)) return false;
  const parts = domain.split(".");
  const tld = parts[parts.length - 1];
  if (tld.length < 2 || tld.length > 6 || !/^[a-z]+$/.test(tld)) return false;
  if (parts.length < 2 || parts[parts.length - 2].length < 2) return false;
  const digitCount = (local.match(/\d/g) || []).length;
  if (local.includes("-") && digitCount > 2) return false;
  return true;
}

/** Personal (decision-maker) email — rejects generic inbox prefixes. */
export function isPersonal(email: string): boolean {
  if (!isValidEmail(email)) return false;
  const local = email.split("@")[0].toLowerCase();
  for (const skip of SKIP_PREFIXES) {
    if (local === skip || local.startsWith(skip + ".") || local.startsWith(skip + "_")) return false;
  }
  return true;
}

// Hard rejects — never real inboxes regardless of context (enrichment.py:_HARD_REJECT_PREFIXES).
const HARD_REJECT_PREFIXES = new Set([
  "noreply", "no-reply", "donotreply", "do-not-reply", "webmaster", "postmaster",
  "mailer-daemon", "bounces", "careers", "jobs", "hr", "billing", "accounts",
  "media", "pr", "marketing",
]);

/** Broader filter — accepts info@/contact@/office@ (small businesses read these),
 *  rejects only hard-reject prefixes. */
export function isAcceptable(email: string): boolean {
  if (!isValidEmail(email)) return false;
  const local = email.split("@")[0].toLowerCase();
  for (const skip of HARD_REJECT_PREFIXES) {
    if (local === skip || local.startsWith(skip + ".") || local.startsWith(skip + "_")) return false;
  }
  return true;
}

// ── title tiering (ported from enrichment.py:_title_tier) ───────────────────────
// Sponsor outreach priority: sponsorship/partnerships first, then marketing,
// then owner/CEO, then anyone else.

const SPONSORSHIP_TITLES = [
  "sponsorship", "sponsorships", "partnership", "partnerships", "partner marketing",
  "brand partnership", "sponsor",
];
const MARKETING_TITLES = [
  "marketing", "cmo", "chief marketing", "brand", "advertising", "media buyer",
  "communications", "public relations", " pr ", "growth", "demand generation", "digital",
];
// Any senior decision-maker — used so we still get a named exec when there's no
// marketing/sponsorship person in Apollo's data for that company.
const LEADERSHIP_TITLES = [
  "owner", "founder", "co-founder", "cofounder", "proprietor",
  "ceo", "chief executive", "coo", "chief operating", "president", "principal",
  "general manager", "managing director", "managing partner", "partner",
  "chief", "vice president", "vp ", "vp,", "evp", "svp", "head of", "director",
];

/**
 * Lower number = contact first.
 * 1 = sponsorship/partnerships, 2 = marketing/brand/comms, 3 = any senior exec, 4 = other.
 */
export function titleTier(title: string): number {
  const t = ` ${(title || "").toLowerCase()} `;
  if (SPONSORSHIP_TITLES.some((kw) => t.includes(kw))) return 1;
  if (MARKETING_TITLES.some((kw) => t.includes(kw))) return 2;
  if (LEADERSHIP_TITLES.some((kw) => t.includes(kw))) return 3;
  return 4;
}

export function normalizeDomain(raw: string): string {
  let d = (raw || "").trim().toLowerCase();
  if (!d) return "";
  if (d.includes("@") && !d.startsWith("http")) d = d.split("@").pop()!;
  d = d.replace("https://", "").replace("http://", "");
  d = d.split("/")[0].split("?")[0].trim();
  if (d.startsWith("www.")) d = d.slice(4);
  return d;
}

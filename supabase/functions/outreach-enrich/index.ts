// outreach-enrich — discover sponsor prospects via Google Places, find a contact email
// via Hunter.io (optionally Apollo if APOLLO_API_KEY is set), store in sponsor_leads.
// Ports the real AISEARCHAudit pipeline: lib/prospector.ts (Places) + enrichment.py (Hunter/Apollo).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  corsHeaders,
  json,
  requireAdmin,
  isPersonal,
  isAcceptable,
  titleTier,
  normalizeDomain,
} from "../_shared/outreach.ts";

const TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";
const APOLLO_URL = "https://api.apollo.io/v1/mixed_people/api_search";

// ── Google Places (ported from lib/prospector.ts) ──────────────────────────────
function getThresholds(vertical: string): { minRating: number; minReviews: number } {
  const lower = vertical.toLowerCase();
  const financeLike = /(bank|banking|financial|advisor|advisory|wealth|accounting|accountant|insurance|mortgage|credit union|investment)/i.test(lower);
  const legalLike = /(\blawyer\b|\battorney\b|\blaw firm\b|\blegal\b)/i.test(lower);
  return { minRating: 4.0, minReviews: financeLike ? 3 : legalLike ? 5 : 5 };
}

type PlaceResult = {
  name?: string;
  rating?: number;
  user_ratings_total?: number;
  place_id?: string;
};

async function placesTextSearch(
  apiKey: string,
  vertical: string,
  region: string,
  maxResults: number,
): Promise<PlaceResult[]> {
  const query = region ? `${vertical} in ${region}` : vertical;
  const collected: PlaceResult[] = [];
  let nextPageToken: string | undefined;

  while (collected.length < maxResults) {
    const url = new URL(TEXT_SEARCH_URL);
    if (nextPageToken) {
      url.searchParams.set("pagetoken", nextPageToken);
    } else {
      url.searchParams.set("query", query);
    }
    url.searchParams.set("key", apiKey);

    const resp = await fetch(url.toString(), { cache: "no-store" });
    if (!resp.ok) throw new Error(`Google Places request failed (${resp.status})`);
    const payload = await resp.json();
    const status = payload.status ?? "UNKNOWN";
    if (status !== "OK" && status !== "ZERO_RESULTS") {
      throw new Error(payload.error_message || `Text Search failed: ${status}`);
    }
    collected.push(...((payload.results ?? []) as PlaceResult[]));
    nextPageToken = payload.next_page_token;
    if (!nextPageToken || status === "ZERO_RESULTS") break;
    await new Promise((r) => setTimeout(r, 2000)); // page tokens need a moment to activate
  }
  return collected.slice(0, maxResults);
}

async function placeDetails(apiKey: string, placeId: string): Promise<{ website: string; phone: string }> {
  const url = new URL(PLACE_DETAILS_URL);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "website,formatted_phone_number");
  url.searchParams.set("key", apiKey);
  const resp = await fetch(url.toString(), { cache: "no-store" });
  if (!resp.ok) return { website: "", phone: "" };
  const payload = await resp.json();
  return {
    website: payload.result?.website ?? "",
    phone: payload.result?.formatted_phone_number ?? "",
  };
}

// ── Hunter.io domain search (ported from enrichment.py:_find_email_hunter) ──────
type Contact = { email: string; confidence: string; name: string | null; title: string | null };

async function hunterFindEmail(domain: string): Promise<Contact | null> {
  const key = Deno.env.get("HUNTER_API_KEY");
  if (!key || !domain) return null;
  try {
    const resp = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${key}`,
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const emails = (data?.data?.emails ?? []) as Array<{
      value?: string;
      first_name?: string;
      last_name?: string;
      position?: string;
    }>;
    const toContact = (e: typeof emails[number], confidence: string): Contact => ({
      email: (e.value || "").toLowerCase(),
      confidence,
      name: [e.first_name, e.last_name].filter(Boolean).join(" ") || null,
      title: e.position || null,
    });
    const personal = emails.find((e) => isPersonal(e.value || ""));
    if (personal) return toContact(personal, "high");
    const acceptable = emails.find((e) => isAcceptable(e.value || ""));
    if (acceptable) return toContact(acceptable, "medium");
  } catch {
    // ignore
  }
  return null;
}

// ── Apollo (optional — only used when APOLLO_API_KEY is configured) ─────────────
async function apolloFindEmail(domain: string): Promise<Contact | null> {
  const key = Deno.env.get("APOLLO_API_KEY");
  if (!key || !domain) return null;
  try {
    const resp = await fetch(APOLLO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify({
        q_organization_domains: domain,
        page: 1,
        per_page: 20,
        person_titles: [
          // sponsorship / partnerships (top priority)
          "head of partnerships", "director of partnerships", "partnerships manager",
          "sponsorship manager", "head of sponsorships", "director of sponsorships",
          // marketing
          "cmo", "chief marketing officer", "vp marketing", "marketing director",
          "director of marketing", "head of marketing", "brand manager", "brand director",
          // owner / ceo
          "ceo", "chief executive officer", "owner", "founder", "president",
        ],
        contact_email_status: ["verified", "likely to engage"],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const people = (data.people ?? []) as Array<{ email?: string; name?: string; title?: string }>;
    const personal = people
      .filter((p) => isPersonal((p.email || "").toLowerCase()))
      .sort((a, b) => titleTier(a.title || "") - titleTier(b.title || ""));
    if (personal.length) {
      const best = personal[0];
      return { email: best.email!.toLowerCase(), confidence: "high", name: best.name || null, title: best.title || null };
    }
  } catch {
    // ignore
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let supabase;
  try {
    supabase = await requireAdmin(req);
  } catch (resp) {
    if (resp instanceof Response) return resp;
    return json({ error: resp instanceof Error ? resp.message : "Auth failed" }, 401);
  }

  try {
    const { vertical, region, maxResults = 25 } = await req.json();
    if (!vertical || !String(vertical).trim()) {
      return json({ error: "vertical is required" }, 400);
    }
    const v = String(vertical).trim();
    const reg = region ? String(region).trim() : "";
    const cap = Math.min(Math.max(Number(maxResults) || 25, 1), 60);

    const placesKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!placesKey) return json({ error: "GOOGLE_PLACES_API_KEY not configured" }, 500);

    // 1. Discover businesses via Places, keep well-reviewed ones (reference thresholds).
    const thresholds = getThresholds(v);
    const places = (await placesTextSearch(placesKey, v, reg, cap)).filter(
      (p) => (p.rating ?? 0) >= thresholds.minRating && (p.user_ratings_total ?? 0) >= thresholds.minReviews,
    );

    let withEmail = 0;
    const rows: Array<Record<string, unknown>> = [];

    // 2. For each, get website + phone, then find a contact email (Apollo → Hunter).
    for (const p of places) {
      if (!p.place_id) continue;
      const { website, phone } = await placeDetails(placesKey, p.place_id);
      const domain = normalizeDomain(website);

      let contact: Contact | null = null;
      if (domain) {
        contact = (await apolloFindEmail(domain)) || (await hunterFindEmail(domain));
      }
      if (contact?.email) withEmail++;

      rows.push({
        vertical: v,
        region: reg || null,
        company: p.name || "",
        website: website || null,
        domain: domain || null,
        phone: phone || null,
        rating: p.rating ?? null,
        review_count: p.user_ratings_total ?? null,
        contact_name: contact?.name ?? null,
        contact_title: contact?.title ?? null,
        contact_email: contact?.email ?? null,
        email_confidence: contact?.confidence ?? "low",
        // TIER1 = reachable sponsorship/marketing decision-maker; TIER2 = everyone else.
        priority: contact?.email && titleTier(contact.title || "") <= 2 ? "TIER1" : "TIER2",
      });
    }

    // 3. Persist. Upsert rows with email (dedup), insert the rest.
    const withEmailRows = rows.filter((r) => r.contact_email);
    const withoutEmailRows = rows.filter((r) => !r.contact_email);

    let stored = 0;
    if (withEmailRows.length) {
      const { data, error } = await supabase
        .from("sponsor_leads")
        .upsert(withEmailRows, { onConflict: "contact_email", ignoreDuplicates: true })
        .select();
      if (error) throw new Error(`DB upsert failed: ${error.message}`);
      stored += data?.length ?? 0;
    }
    if (withoutEmailRows.length) {
      const { data, error } = await supabase.from("sponsor_leads").insert(withoutEmailRows).select();
      if (error) throw new Error(`DB insert failed: ${error.message}`);
      stored += data?.length ?? 0;
    }

    return json({
      vertical: v,
      region: reg,
      found: rows.length,
      stored,
      withEmail,
      usedApollo: !!Deno.env.get("APOLLO_API_KEY"),
      rows,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Enrichment failed" }, 500);
  }
});

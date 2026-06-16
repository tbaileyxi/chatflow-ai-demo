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

const APOLLO_SEARCH_URL = "https://api.apollo.io/v1/mixed_people/api_search";
const APOLLO_MATCH_URL = "https://api.apollo.io/api/v1/people/match?reveal_personal_emails=true";

// Titles to target, in priority order: sponsorship/partnerships → marketing → owner/CEO.
const APOLLO_TITLES = [
  "head of partnerships", "director of partnerships", "partnerships manager",
  "sponsorship manager", "head of sponsorships",
  "cmo", "chief marketing officer", "vp marketing", "marketing director",
  "director of marketing", "head of marketing", "marketing manager", "brand manager",
  "ceo", "chief executive officer", "owner", "founder", "president", "general manager",
];

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

// ── Apollo: search for the decision-maker, then enrich to reveal their email ────
// Two steps because Apollo's search endpoint returns titles only (emails locked);
// the people/match endpoint with reveal=true returns the verified email (1 credit).
async function apolloFindEmail(domain: string): Promise<Contact | null> {
  const key = Deno.env.get("APOLLO_API_KEY");
  if (!key || !domain) return null;
  type Person = { id?: string; title?: string; has_email?: boolean };
  const search = async (withTitles: boolean): Promise<Person[]> => {
    const body: Record<string, unknown> = { q_organization_domains: domain, page: 1, per_page: 25 };
    if (withTitles) body.person_titles = APOLLO_TITLES;
    const r = await fetch(APOLLO_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify(body),
    });
    if (!r.ok) return [];
    return ((await r.json()).people ?? []) as Person[];
  };

  try {
    // 1. Prefer marketing/sponsorship titles; if Apollo has none for this company,
    //    fall back to everyone at the domain and rank them ourselves.
    let people = await search(true);
    if (!people.length) people = await search(false);
    if (!people.length) return null;

    // Best title tier first; within a tier, prefer someone Apollo has an email for.
    people.sort((a, b) =>
      titleTier(a.title || "") - titleTier(b.title || "") ||
      (b.has_email ? 1 : 0) - (a.has_email ? 1 : 0)
    );
    // Skip rank-and-file (recruiters, tellers, analysts) — only contact tier 1–3.
    const best = people.find((p) => p.id && titleTier(p.title || "") <= 3);
    if (!best?.id) return null;

    // 2. Enrich that one person to reveal the email (spends a credit).
    const mResp = await fetch(APOLLO_MATCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify({ id: best.id }),
    });
    if (!mResp.ok) return null;
    const mData = await mResp.json();
    const person = (mData.person ?? {}) as { first_name?: string; last_name?: string; title?: string; email?: string };
    const email = (person.email || "").toLowerCase().trim();
    if (email && isValidEmail(email)) {
      const name = [person.first_name, person.last_name].filter(Boolean).join(" ") || null;
      return { email, confidence: "high", name, title: person.title || best.title || null };
    }
  } catch (e) {
    console.error("[apollo] error:", e instanceof Error ? e.message : e);
  }
  return null;
}

// ── homepage scrape (ported from enrichment.py: _find_email_homepage / find_instagram) ──
// The reliable, no-quota path: pull email + Instagram straight off the company site.
const IG_SKIP = new Set(["p", "explore", "accounts", "stories", "reels", "tv", "direct", "sharer", "embed"]);

// Split emails by trust: mailto: links are intentional contacts; bare-text emails
// are only trusted when they're on the company's own domain (kills tracking tokens
// / third-party emails embedded in page scripts, e.g. trp8z9...@7qa.jyl).
function emailsFromHtml(html: string): { mailto: string[]; bare: string[] } {
  const mailto = new Set<string>();
  const bare = new Set<string>();
  for (const m of html.matchAll(/mailto:([^\s"'<>?&]+)/gi)) mailto.add(m[1].toLowerCase().trim());
  for (const m of html.matchAll(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g)) {
    const e = m[0].toLowerCase().trim();
    if (!mailto.has(e)) bare.add(e);
  }
  return { mailto: [...mailto], bare: [...bare] };
}

function igHandle(html: string): string {
  const m = html.match(/instagram\.com\/([A-Za-z0-9_.]+)/i);
  if (m && !IG_SKIP.has(m[1].toLowerCase())) return `@${m[1]}`;
  return "";
}

async function scrapeSite(website: string): Promise<{ email: string | null; confidence: string; instagram: string }> {
  const base = website.replace(/\/$/, "");
  const siteDomain = normalizeDomain(website);
  const paths = ["", "/contact", "/contact-us", "/about", "/about-us"];
  let acceptableFallback: string | null = null;
  let instagram = "";

  for (const p of paths) {
    let html = "";
    try {
      const r = await fetch(base + p, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; sidehuddle-bot/1.0)" },
        signal: AbortSignal.timeout(7000),
      });
      if (!r.ok) continue;
      html = await r.text();
    } catch {
      continue;
    }
    if (!instagram) instagram = igHandle(html);

    const { mailto, bare } = emailsFromHtml(html);
    // Trust mailto: links + bare emails only on the company's own domain.
    const sameDomainBare = bare.filter((e) => normalizeDomain(e.split("@")[1] || "") === siteDomain);
    const candidates = [...mailto, ...sameDomainBare];

    const personal = candidates.find((e) => isPersonal(e));
    if (personal) return { email: personal, confidence: "high", instagram };
    if (!acceptableFallback) acceptableFallback = candidates.find((e) => isAcceptable(e)) ?? null;

    if (acceptableFallback && instagram) break; // got the useful bits, stop early
  }
  return {
    email: acceptableFallback,
    confidence: acceptableFallback ? "medium" : "low",
    instagram,
  };
}

// ── Apollo company discovery (primary path — finds brands, not store locations) ──
const APOLLO_ORG_URL = "https://api.apollo.io/api/v1/mixed_companies/search";

type Company = { name: string; website: string; domain: string };

// Map common sponsor-vertical jargon to keyword tags real companies actually carry
// (e.g. "QSR" → restaurants, otherwise it matches vendors that *serve* QSRs).
const VERTICAL_SYNONYMS: Record<string, string[]> = {
  "qsr": ["fast food", "quick service restaurant", "restaurants"],
  "fast food": ["fast food", "quick service restaurant", "restaurants"],
  "restaurant": ["restaurants"],
  "restaurants": ["restaurants"],
  "bank": ["banking"],
  "banks": ["banking"],
  "credit union": ["credit unions", "banking"],
  "credit unions": ["credit unions", "banking"],
  "auto dealer": ["car dealership", "automotive"],
  "auto dealers": ["car dealership", "automotive"],
  "car dealer": ["car dealership", "automotive"],
  "car dealers": ["car dealership", "automotive"],
  "sportsbook": ["sports betting", "gambling"],
  "sportsbooks": ["sports betting", "gambling"],
  "brewery": ["breweries", "craft beer"],
  "breweries": ["breweries", "craft beer"],
  "gym": ["fitness", "gyms"],
  "gyms": ["fitness", "gyms"],
};

function keywordTags(vertical: string): string[] {
  const k = (vertical || "").toLowerCase().trim();
  return VERTICAL_SYNONYMS[k] ?? (vertical ? [vertical] : []);
}

async function apolloOrgSearch(
  vertical: string,
  company: string,
  region: string,
  cap: number,
): Promise<Company[]> {
  const key = Deno.env.get("APOLLO_API_KEY");
  if (!key) return [];
  const out = new Map<string, Company>();
  const locations = region ? [region] : ["United States"];

  // Build query variants so one box handles both brands and categories:
  //  - name search catches a specific brand ("DraftKings", "Raising Cane's")
  //  - keyword search catches a category ("insurance", "restaurants")
  const term = company || vertical;
  const variants: Record<string, unknown>[] = [];
  if (term) variants.push({ q_organization_name: term });
  if (!company && vertical) variants.push({ q_organization_keyword_tags: keywordTags(vertical) });

  const runQuery = async (variant: Record<string, unknown>) => {
    for (let page = 1; page <= 3 && out.size < cap; page++) {
      const body = { ...variant, organization_locations: locations, page, per_page: 25 };
      const r = await fetch(APOLLO_ORG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": key },
        body: JSON.stringify(body),
      });
      if (!r.ok) break;
      const data = await r.json();
      const orgs = (data.organizations ?? data.accounts ?? []) as Array<{
        name?: string;
        primary_domain?: string;
        website_url?: string;
      }>;
      if (!orgs.length) break;
      for (const o of orgs) {
        const domain = normalizeDomain(o.primary_domain || o.website_url || "");
        if (!domain || out.has(domain)) continue;
        out.set(domain, { name: o.name || domain, website: o.website_url || `https://${domain}`, domain });
        if (out.size >= cap) break;
      }
    }
  };

  try {
    for (const variant of variants) {
      if (out.size >= cap) break;
      await runQuery(variant);
    }
  } catch (e) {
    console.error("[apollo org] error:", e instanceof Error ? e.message : e);
  }
  return [...out.values()];
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
    const { vertical, company, region, maxResults = 25 } = await req.json();
    const v = vertical ? String(vertical).trim() : "";
    const co = company ? String(company).trim() : "";
    if (!v && !co) {
      return json({ error: "Enter a vertical or a company name" }, 400);
    }
    const reg = region ? String(region).trim() : "";
    const cap = Math.min(Math.max(Number(maxResults) || 25, 1), 60);

    // 1. Discover companies via Apollo company search (brands + categories).
    //    No Google Places fallback — it returned store locations / junk with no emails.
    type Disc = { name: string; website: string; domain: string };
    const companies: Disc[] = (await apolloOrgSearch(v, co, reg, cap)).map((o) => ({
      name: o.name,
      website: o.website,
      domain: o.domain,
    }));
    const source = "apollo";

    let withEmail = 0;
    const rows: Array<Record<string, unknown>> = [];

    // 2. For each company, find the decision-maker email + Instagram.
    //    Waterfall: Apollo people (named) → site scrape → Hunter.
    for (const c of companies) {
      const domain = c.domain;
      let contact: Contact | null = domain ? await apolloFindEmail(domain) : null;
      let instagram = "";

      if (c.website) {
        const scraped = await scrapeSite(c.website);
        instagram = scraped.instagram;
        if (!contact?.email && scraped.email) {
          contact = { email: scraped.email, confidence: scraped.confidence, name: null, title: null };
        }
      }
      if (!contact?.email && domain) {
        contact = (await hunterFindEmail(domain)) ?? contact;
      }
      if (contact?.email) withEmail++;

      rows.push({
        vertical: v,
        region: reg || null,
        company: c.name || domain,
        website: c.website || null,
        domain: domain || null,
        instagram_handle: instagram || null,
        contact_name: contact?.name ?? null,
        contact_title: contact?.title ?? null,
        contact_email: contact?.email ?? null,
        email_confidence: contact?.confidence ?? "low",
        // TIER1 = reachable named decision-maker; TIER2 = everyone else.
        priority: contact?.email && titleTier(contact.title || "") <= 3 ? "TIER1" : "TIER2",
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
      source,
      rows,
    });
  } catch (e) {
    console.error("[outreach-enrich] failed:", e instanceof Error ? e.stack || e.message : e);
    return json({ error: e instanceof Error ? e.message : "Enrichment failed" }, 500);
  }
});

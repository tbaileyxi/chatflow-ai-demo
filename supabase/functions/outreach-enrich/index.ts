// outreach-enrich — find sponsor prospects and a contact email, store in sponsor_leads.
//
// Discovery is APOLLO, not Google Places. The Places half was removed and this
// comment was not: there is no Google key read anywhere in this file and no
// Places call, so anyone reading the old note went hunting for a key that does
// not exist. Emails come from Hunter.io, with Apollo as the fallback.
//
// Requires APOLLO_API_KEY for discovery and HUNTER_API_KEY for emails. With
// neither set this function finds nothing and reports success, which is its own
// trap — check the counts it returns, not just that it ran.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  corsHeaders,
  json,
  requireAdmin,
  isValidEmail,
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

const SPONSOR_CATEGORY_SIGNALS: Record<string, { score: number; package: string; angle: string; signal: string }> = {
  pizza: {
    score: 14,
    package: "$1,500",
    angle: "Friday Night Scoreboard",
    signal: "Game-day food category with parent, athlete, and student demand.",
  },
  wings: {
    score: 14,
    package: "$1,500",
    angle: "Game of the Week",
    signal: "Game-day food category with a natural watch-party tie-in.",
  },
  restaurant: {
    score: 13,
    package: "$1,500",
    angle: "Game of the Week",
    signal: "Family/customer base overlaps with local sports fans.",
  },
  restaurants: {
    score: 13,
    package: "$1,500",
    angle: "Game of the Week",
    signal: "Family/customer base overlaps with local sports fans.",
  },
  "car dealership": {
    score: 14,
    package: "$3,000",
    angle: "Player of the Week",
    signal: "Dealers commonly buy local sports/community visibility.",
  },
  automotive: {
    score: 13,
    package: "$3,000",
    angle: "Player of the Week",
    signal: "Auto brands often invest in visible local sponsorships.",
  },
  "physical therapy": {
    score: 15,
    package: "$1,500",
    angle: "Athlete Spotlight",
    signal: "Sports medicine relevance creates a direct athlete/parent fit.",
  },
  orthodontist: {
    score: 14,
    package: "$1,500",
    angle: "Athlete Spotlight",
    signal: "Parent/student customer base and strong local referral value.",
  },
  dentist: {
    score: 13,
    package: "$1,500",
    angle: "Athlete Spotlight",
    signal: "Family customer base and strong local referral value.",
  },
  "credit union": {
    score: 14,
    package: "$3,000",
    angle: "Student Athlete of the Week",
    signal: "Community banking category often sponsors schools and youth programs.",
  },
  bank: {
    score: 13,
    package: "$3,000",
    angle: "Student Athlete of the Week",
    signal: "Community banking category often sponsors schools and youth programs.",
  },
  "insurance agency": {
    score: 12,
    package: "$1,500",
    angle: "Friday Night Scoreboard",
    signal: "Local agents rely on trust and community awareness.",
  },
  "real estate agent": {
    score: 12,
    package: "$1,500",
    angle: "Top Plays",
    signal: "Community-facing category with parent and alumni reach.",
  },
  "urgent care": {
    score: 13,
    package: "$1,500",
    angle: "Injury Report",
    signal: "Healthcare category with a strong sports-family fit.",
  },
  gym: {
    score: 12,
    package: "$500",
    angle: "Training Tip",
    signal: "Fitness category aligns with athletes and active families.",
  },
  "car wash": {
    score: 10,
    package: "$500",
    angle: "Top Plays",
    signal: "Local service business with broad family/customer appeal.",
  },
  "roofing company": {
    score: 10,
    package: "$1,500",
    angle: "Friday Night Scoreboard",
    signal: "Home service category often buys local awareness and trust.",
  },
};

// Category names, normalised on the way in.
//
// The list was collapsed from 32 spellings to 12 by hand, and one search put
// "restaurants" back alongside "restaurant" the same afternoon. Anything that
// creates a lead goes through here, so the fix holds.
function canonicalVertical(v: string): string {
  const x = (v || "").trim().toLowerCase();
  if (!x) return "other local business";
  if (/(car|auto).*(dealer)|dealership/.test(x)) return "auto dealer";
  if (/insurance/.test(x)) return "insurance";
  if (/bank|credit union/.test(x)) return "bank or credit union";
  if (/sports bar|^bars?$/.test(x)) return "sports bar";
  if (/restaurant|pizza|wings|deli|bbq|barbecue|cafe/.test(x)) return "restaurant";
  if (/ticket/.test(x)) return "ticketing";
  if (/urgent care|physical therapy|orthodont|dentist|chiropract|dental/.test(x)) return "health and dental";
  if (/advisor|finance|financial|wealth/.test(x)) return "financial advice";
  if (/gym|fitness/.test(x)) return "gym";
  if (/school partner/.test(x)) return "school partner";
  return x;
}

function keywordTags(vertical: string): string[] {
  const k = (vertical || "").toLowerCase().trim();
  return VERTICAL_SYNONYMS[k] ?? (vertical ? [vertical] : []);
}

function splitCategories(raw: string): string[] {
  const parts = (raw || "")
    .split(/[,;\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : [raw].filter(Boolean);
}

function scoreForCategory(category: string, hasEmail: boolean, hasInstagram: boolean) {
  const key = category.toLowerCase().trim();
  const base = SPONSOR_CATEGORY_SIGNALS[key] ?? {
    score: 9,
    package: "$1,500",
    angle: "Game of the Week",
    signal: "Local business category worth verifying for community sponsorship intent.",
  };
  const score = Math.min(20, base.score + (hasEmail ? 1 : 0) + (hasInstagram ? 1 : 0));
  return { ...base, score };
}

async function findContactForCompany(
  website: string | null,
  domain: string | null,
): Promise<{ contact: Contact | null; instagram: string }> {
  const normalizedDomain = normalizeDomain(domain || website || "");
  let contact: Contact | null = normalizedDomain ? await apolloFindEmail(normalizedDomain) : null;
  let instagram = "";

  const site = website || (normalizedDomain ? `https://${normalizedDomain}` : "");
  if (site) {
    const scraped = await scrapeSite(site);
    instagram = scraped.instagram;
    if (!contact?.email && scraped.email) {
      contact = { email: scraped.email, confidence: scraped.confidence, name: null, title: null };
    }
  }
  if (!contact?.email && normalizedDomain) {
    contact = (await hunterFindEmail(normalizedDomain)) ?? contact;
  }

  return { contact, instagram };
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
    const { vertical, company, region, market, school, maxResults = 25, leadId } = await req.json();

    if (leadId) {
      const { data: lead, error: leadError } = await supabase
        .from("sponsor_leads")
        .select("id,company,website,domain,vertical,region,sponsor_score")
        .eq("id", String(leadId))
        .maybeSingle();
      if (leadError) throw new Error(`Lead lookup failed: ${leadError.message}`);
      if (!lead) return json({ error: "Lead not found" }, 404);

      const row = lead as {
        company: string; website: string | null; domain: string | null;
        vertical: string | null; region: string | null; sponsor_score: number | null;
      };

      // Emails are found BY DOMAIN, so a lead without one cannot be enriched at
      // all — it silently returns nothing, every time. That is exactly what the
      // 665 bars imported from chapter-db are: a venue name and a town, no
      // website, because the fan-club pages that named them never listed one.
      //
      // So find the company first. Apollo can turn "Wing Warehouse" + "Stow, OH"
      // into a domain, and only then is there something to look an email up on.
      let website = row.website;
      let domain = row.domain;
      let resolved = false;
      if (!domain && !website && row.company) {
        const hits = await apolloOrgSearch(
          row.vertical || "",
          row.company,
          row.region || "",
          1,
        );
        if (hits.length) {
          website = hits[0].website;
          domain = hits[0].domain;
          resolved = true;
        }
      }

      const { contact, instagram } = await findContactForCompany(website, domain);

      const update: Record<string, unknown> = {
        instagram_handle: instagram || null,
        last_error: null,
      };
      if (resolved) {
        update.website = website;
        update.domain = domain;
      }
      if (contact?.email) {
        update.contact_email = contact.email;
        update.contact_name = contact.name;
        update.contact_title = contact.title;
        update.email_confidence = contact.confidence;
        update.priority = titleTier(contact.title || "") <= 3 ? "TIER1" : "TIER2";
        update.sponsor_score = Math.min(20, Number((lead as { sponsor_score: number | null }).sponsor_score || 9) + 1);
      }

      const { error: updateError } = await supabase
        .from("sponsor_leads")
        .update(update)
        .eq("id", String(leadId));
      if (updateError) throw new Error(`Lead update failed: ${updateError.message}`);

      // Never just "no email". A missing key, a company we could not identify
      // and a real business with no findable address are three different
      // problems with three different fixes, and they all used to look the same
      // from the dashboard.
      const why = contact?.email
        ? null
        : !Deno.env.get("APOLLO_API_KEY") && !domain
          ? "APOLLO_API_KEY is not set, so a company with no website cannot be identified"
          : !domain
            ? `Could not find a website for "${row.company}" — too small or named too generically to match`
            : !Deno.env.get("HUNTER_API_KEY")
              ? "HUNTER_API_KEY is not set, so no email lookup ran"
              : `Found ${domain} but no public email address on it`;

      return json({
        leadId,
        reason: why,
        resolved_domain: resolved ? domain : undefined,
        company: row.company,
        contact_email: contact?.email ?? null,
        contact_name: contact?.name ?? null,
        contact_title: contact?.title ?? null,
        email_confidence: contact?.confidence ?? null,
        instagram_handle: instagram || null,
      });
    }

    const v = vertical ? String(vertical).trim() : "";
    const co = company ? String(company).trim() : "";
    const mkt = market ? String(market).trim() : "";
    const sch = school ? String(school).trim() : "";
    if (!v && !co && !mkt && !sch) {
      return json({ error: "Enter a school, market, vertical, or company name" }, 400);
    }
    const reg = region ? String(region).trim() : mkt;
    const cap = Math.min(Math.max(Number(maxResults) || 25, 1), 100);
    const categories = co ? [v || "local sponsor"] : splitCategories(v);
    const perCategoryCap = Math.max(1, Math.ceil(cap / Math.max(categories.length, 1)));

    // 1. Discover companies via Apollo company search (brands + categories).
    //    No Google Places fallback — it returned store locations / junk with no emails.
    type Disc = { name: string; website: string; domain: string; category: string };
    const byDomain = new Map<string, Disc>();
    for (const category of categories) {
      const found = await apolloOrgSearch(category, co, reg, perCategoryCap);
      for (const o of found) {
        if (byDomain.has(o.domain)) continue;
        byDomain.set(o.domain, {
          name: o.name,
          website: o.website,
          domain: o.domain,
          category,
        });
        if (byDomain.size >= cap) break;
      }
      if (byDomain.size >= cap) break;
    }
    const companies: Disc[] = [...byDomain.values()];
    const source = "apollo";

    let withEmail = 0;
    const rows: Array<Record<string, unknown>> = [];

    // 2. For each company, find the decision-maker email + Instagram.
    //    Waterfall: Apollo people (named) → site scrape → Hunter.
    for (const c of companies) {
      const domain = c.domain;
      const { contact, instagram } = await findContactForCompany(c.website, domain);
      if (contact?.email) withEmail++;
      const score = scoreForCategory(c.category, Boolean(contact?.email), Boolean(instagram));

      rows.push({
        vertical: canonicalVertical(c.category || v),
        region: reg || null,
        market: mkt || reg || null,
        school: sch || null,
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
        sponsor_signal: score.signal,
        sponsor_score: score.score,
        best_package: score.package,
        best_angle: score.angle,
        status: "New",
      });
    }

    // 3. Persist.
    //
    // sponsor_leads has TWO unique indexes — one on contact_email, one on
    // (company, market) — and a PostgREST upsert can only name one conflict
    // target. So this used to upsert on contact_email and plain-insert the
    // rest, and both halves broke on the index they were not watching: a
    // company already on file for this market raised
    // "duplicate key value violates unique constraint
    // sponsor_leads_company_market_..." and took down the WHOLE search. One
    // already-known bar, and a run over fifty of them returned nothing.
    //
    // Resolve against both indexes here instead, then update what exists and
    // insert only what is genuinely new. Nothing that already exists is ever
    // inserted, so there is no conflict left to lose the run to.
    const stored = await persistLeads(supabase, rows);

    return json({
      vertical: canonicalVertical(v),
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

/**
 * Write enriched leads without letting one already-known company lose the run.
 *
 * Batched throughout: two reads to find what is already on file, one upsert per
 * 200 rows to update them (on the primary key, which cannot collide), one
 * insert per 200 genuinely new rows.
 */
async function persistLeads(
  supabase: { from: (t: string) => any },
  rows: Record<string, unknown>[],
): Promise<number> {
  if (!rows.length) return 0;

  const key = (company: unknown, market: unknown) =>
    `${String(company ?? "").trim().toLowerCase()}|${String(market ?? "").trim().toLowerCase()}`;

  // Two rows in one batch collide with each other as readily as with the table.
  // Last wins — later rows carry the same enrichment, so it costs nothing.
  const deduped = new Map<string, Record<string, unknown>>();
  for (const r of rows) deduped.set(key(r.company, r.market), r);
  const unique = [...deduped.values()];

  const companies = [...new Set(unique.map((r) => String(r.company ?? "")).filter(Boolean))];
  const emails = [...new Set(
    unique.map((r) => String(r.contact_email ?? "").toLowerCase()).filter(Boolean),
  )];

  const idByKey = new Map<string, string>();
  const idByEmail = new Map<string, string>();

  for (let i = 0; i < companies.length; i += 200) {
    const { data } = await supabase
      .from("sponsor_leads")
      .select("id, company, market, contact_email")
      .in("company", companies.slice(i, i + 200));
    for (const e of (data ?? []) as Record<string, string | null>[]) {
      if (e.id) idByKey.set(key(e.company, e.market), e.id);
      if (e.id && e.contact_email) idByEmail.set(e.contact_email.toLowerCase(), e.id);
    }
  }
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await supabase
      .from("sponsor_leads")
      .select("id, contact_email")
      .in("contact_email", emails.slice(i, i + 200));
    for (const e of (data ?? []) as Record<string, string | null>[]) {
      if (e.id && e.contact_email) idByEmail.set(e.contact_email.toLowerCase(), e.id);
    }
  }

  const updates: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[] = [];
  for (const r of unique) {
    const email = String(r.contact_email ?? "").toLowerCase();
    const id = idByKey.get(key(r.company, r.market)) ?? (email ? idByEmail.get(email) : undefined);
    if (id) updates.push({ ...r, id });
    else inserts.push(r);
  }

  let touched = 0;
  for (let i = 0; i < updates.length; i += 200) {
    const { data, error } = await supabase
      .from("sponsor_leads")
      .upsert(updates.slice(i, i + 200), { onConflict: "id" })
      .select("id");
    if (error) throw new Error(`DB update failed: ${error.message}`);
    touched += data?.length ?? 0;
  }
  for (let i = 0; i < inserts.length; i += 200) {
    const { data, error } = await supabase
      .from("sponsor_leads")
      .insert(inserts.slice(i, i + 200))
      .select("id");
    if (error) throw new Error(`DB insert failed: ${error.message}`);
    touched += data?.length ?? 0;
  }
  return touched;
}

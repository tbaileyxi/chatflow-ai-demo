// outreach-send — send the 3-step sponsor sequence via Brevo.
// Eligibility / dedup / sequence logic ported from brevo_send.py:run.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, json, requireAdmin, normalizeDomain } from "../_shared/outreach.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const FROM_EMAIL = "ty@sidehuddlesports.com";
const FROM_NAME = "Ty";
// SINGULAR, and the team preselected. /sponsors is the old board; /sponsor is
// the page that knows which team is being bought.
const SPONSOR_BASE = "https://sidehuddlesports.com/sponsor";
const APP_STORE_URL = "https://apps.apple.com/us/app/id6777524558";
const SCHOOL_PARTNER_VERTICAL = "school partner";

// THE MODEL, AS IT ACTUALLY IS.
//
// This file has quoted $2,500-with-a-deposit, then $100-plus-$500-exclusivity,
// each of which outlived the page it linked to — an email quoting a price the
// landing page contradicts loses a buyer who was otherwise ready.
//
// One founding partner per team per season, category exclusive. One price,
// no prorating, no deposit, no tiers to explain: $500 at the founding rate,
// $2,500 after the deadline. priceLine() flips on its own; the page and the
// checkout read the same deadline.
import {
  priceLine,
  isFoundingOpen,
  deadlineDay,
  foundingPrice,
  listPrice,
} from "../_shared/founding.ts";


// Trademark posture: we describe who the fans are, never claim affiliation.
// Never render a school or club mark, logo, or the word "official" beside one.
// "Not affiliated with, endorsed by, or sponsored by" inside a letter selling
// a sponsorship reads as a contradiction — the reader is being asked to
// sponsor something that opens by saying nobody sponsors it. Same legal
// meaning, one plain sentence, small.
const DISCLAIMER =
  "Side Huddle is an independent app, not affiliated with the team or league.";

type Lead = {
  id: string;
  company: string;
  domain: string | null;
  website: string | null;
  contact_name: string | null;
  contact_email: string | null;
  vertical: string;
  region: string | null;
  market: string | null;
  school: string | null;
  best_package: string | null;
  best_angle: string | null;
  sponsor_signal: string | null;
  sequence_step: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function firstName(lead: Lead): string {
  const n = (lead.contact_name || "").trim();
  return n ? n.split(/\s+/)[0] : "there";
}

function slotName(lead: Lead): string {
  return (lead.school || lead.market || lead.region || "your local team").trim();
}

// "Texas" is an administrative fact. "Texas Longhorns" is what somebody calls
// themselves at 11am on a Saturday, and the opener is asking them to feel
// something, so it needs the nickname. The lead row only carries the school,
// so teams is joined in once per run — 303 rows, one request for the whole
// send, not one per email.
//
// Keyed by place AND by college-or-pro, because one place is not one team.
// "Texas" is the Longhorns and the Rangers; a bar sponsoring the Longhorns
// opening on "Every Texas Rangers fan group" is worse than sending nothing.
// A lead carrying a school is a college lead, so it takes the NCAA row; a lead
// carrying only a market takes the pro one.
const NICKNAMES = new Map<string, { college?: string; pro?: string }>();

async function loadNicknames(supabase: SupabaseClient): Promise<void> {
  if (NICKNAMES.size) return;
  const { data } = await supabase
    .from("teams")
    .select("city, name, league")
    .eq("status", "active");
  for (const t of (data ?? []) as { city: string | null; name: string | null; league: string | null }[]) {
    const city = (t.city || "").trim().toLowerCase();
    const nick = (t.name || "").trim();
    if (!city || !nick) continue;
    const slotKind = (t.league || "").toUpperCase() === "NCAA" ? "college" : "pro";
    const entry = NICKNAMES.get(city) ?? {};
    // First of a kind wins; a school fielding several pro-league sports still
    // reads correctly because the nickname is shared across them.
    if (!entry[slotKind]) entry[slotKind] = nick;
    NICKNAMES.set(city, entry);
  }
}

// "Texas Longhorns" when we can, "Texas" when we cannot, and never
// "Texas Texas" for a place whose name already contains the nickname.
function fanName(lead: Lead): string {
  const slot = slotName(lead);
  const entry = NICKNAMES.get(slot.toLowerCase());
  if (!entry) return slot;
  const nick = lead.school ? (entry.college ?? entry.pro) : (entry.pro ?? entry.college);
  if (!nick) return slot;
  if (slot.toLowerCase().includes(nick.toLowerCase())) return slot;
  return `${slot} ${nick}`;
}


function isSchoolPartnerLead(lead: Lead): boolean {
  return lead.vertical === SCHOOL_PARTNER_VERTICAL ||
    (lead.best_angle || "").toLowerCase().startsWith("official side huddle partner");
}

function schoolName(lead: Lead): string {
  return (lead.school || lead.market || lead.region || "your school").trim();
}

// Always the school's own name, never a mascot. Mascot names ("Tiger",
// "Demon Deacon") are registered marks in their own right, and we have no
// licence to any of them — naming the school is ordinary descriptive use.
function huddleLabel(lead: Lead): string {
  return schoolName(lead);
}

// ── HTML shell (Side Huddle branding; structure from brevo_send.py:_body) ──────



// ── step templates ─────────────────────────────────────────────────────────────
function subject(step: number, lead: Lead): string {
  // Lowercase, specific, no hype words — subject lines that read like a person
  // wrote them clear spam filtering and get opened more than titled ones.
  if (isSchoolPartnerLead(lead)) {
    const huddle = huddleLabel(lead);
    switch (step) {
      case 2: return `backing ${huddle} fans`;
      case 3: return `last note — ${huddle}`;
      default: return `back the ${huddle} fans`;
    }
  }

  const slot = slotName(lead);
  switch (step) {
    case 2: return `backing ${slot} fans`;
    case 3: return `last note — ${slot}`;
    default: return `back the ${slot} fans`;
  }
}

/**
 * Their category, in the words a person would use out loud. The vertical
 * column holds things like "auto dealer" and "quick service restaurant";
 * "one auto dealer" reads fine, "one other quick service restaurant" is a
 * mouthful, and an empty vertical must never produce "one  ".
 */
function categoryWord(lead: Lead): string {
  const v = (lead.vertical || "").trim().toLowerCase();
  if (!v || v === SCHOOL_PARTNER_VERTICAL) return "business";
  return v.replace(/s$/, "");
}

/** The team page to buy on, with the team already chosen. */
function sponsorLink(lead: Lead): string {
  const team = (lead.school || lead.market || "").trim();
  const slug = team
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `${SPONSOR_BASE}?team=${slug}` : SPONSOR_BASE;
}

/**
 * The letter, in plain text.
 *
 * WHAT CHANGED AND WHY IT MATTERS: every previous version sold reach. Six
 * businesses, names on a board, a crowd described in the opening line — a
 * product that does not exist and an audience we cannot evidence. A local
 * owner checks the number first, and there was no number to stand behind.
 *
 * What is actually for sale is a founding story: one business per team per
 * season, the first one, named as such. That is specific, it is worth
 * something to somebody local, and every word of it is true today.
 *
 * PLAIN TEXT IS THE EMAIL. The HTML is generated from this, so the preview and
 * the send cannot drift apart. A one-to-one letter about a single-team handshake
 * should not arrive as a newsletter with a button in it.
 *
 * No audience numbers, no impressions, never "official" — the disclaimer at
 * the foot says exactly what we are not.
 */
function body(step: number, lead: Lead): string {
  const team = isSchoolPartnerLead(lead) ? huddleLabel(lead) : slotName(lead);
  const category = categoryWord(lead);
  const link = sponsorLink(lead);

  // COPY IS FIXED. These three letters are reproduced exactly as written —
  // the merge tags are the only moving parts. Anything that reads oddly here
  // is a copy decision, not a code one, and belongs in the copy rather than
  // in a well-meaning edit at render time.
  // The deadline sentences read forwards before the date and backwards after
  // it. Same approved wording either side; only the tense moves, and it moves
  // on its own, because a letter that still says "closes Oct 2" on October
  // third is a letter that tells the reader nobody is minding the shop.
  const open = isFoundingOpen();

  if (step === 2) {
    return [
      `Hi ${firstName(lead)},`,
      `Nudge on the ${team} founding slot \u2014 still open, no other ${category} has it.`,
      open
        ? `Founding window closes ${deadlineDay}, then it's ${listPrice} for the season. ${foundingPrice} until then: ${link}`
        : `Founding window closed ${deadlineDay} \u2014 it's ${listPrice} for the season now: ${link}`,
      `Ty`,
      DISCLAIMER,
    ].join("\n\n");
  }

  if (step === 3) {
    return [
      `Hi ${firstName(lead)},`,
      open
        ? `Last note on ${team}. After ${deadlineDay} the founding story goes to whoever took the slot \u2014 and the rate goes to ${listPrice}.`
        : `Last note on ${team}. The founding window closed ${deadlineDay}, so the slot is ${listPrice} for the season now.`,
      `If it's not for you, no hard feelings: ${link}`,
      `Ty`,
      `Not relevant? Reply "unsubscribe" and I won't follow up.`,
      // ONE disclaimer. It was listed twice here, so step 3 printed it twice.
      DISCLAIMER,
    ].join("\n\n");
  }

  return [
    `Hi ${firstName(lead)},`,
    // SAY WHAT THE THING IS BEFORE SELLING A SLOT IN IT. The first letter
    // opened on "one business per team becomes the founding partner", which
    // only means something to a reader who already knows what Side Huddle is
    // \u2014 and at step 1, none of them do.
    `Side Huddle is where ${team} fans watch the game together \u2014 their own room, the score and big plays landing in it live.`,
    `One business per team becomes the founding partner of ${team} fans on Side Huddle \u2014 the name attached to them from day one. That only happens once.`,
    `I'm holding the ${team} slot for one ${category}. ${priceLine()}`,
    link,
    `Ty`,
    DISCLAIMER,
  ].join("\n\n");
}

/**
 * Minimal HTML from the text: paragraphs and links, nothing else. If a style
 * attribute beyond the disclaimer ever appears here, the text version has
 * stopped being the email.
 */
function htmlFromText(text: string): string {
  const escape = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const linkify = (t: string) =>
    t.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>');
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => `<p>${linkify(escape(block)).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  // The disclaimer is part of the text now, so it arrives through the
  // paragraphs above. Appending it here as well printed it twice in any client
  // showing the HTML part.
  return `<!DOCTYPE html><html><body>\n${paragraphs}\n</body></html>`;
}


async function brevoSend(apiKey: string, to: string, subj: string, text: string): Promise<void> {
  const resp = await fetch(BREVO_URL, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: to }],
      subject: subj,
      // BOTH PARTS. Only htmlContent went before, so a text-only client saw
      // Brevo's stripped version of our markup — a rendering nobody here had
      // ever read — instead of the words we wrote.
      textContent: text,
      htmlContent: htmlFromText(text),
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Brevo ${resp.status}: ${text.slice(0, 200)}`);
  }
}

async function selectTargets(
  supabase: SupabaseClient,
  step: number,
  campaign: string,
  ids?: string[],
): Promise<Lead[]> {
  let q = supabase
    .from("sponsor_leads")
    .select("id,company,domain,website,contact_name,contact_email,vertical,region,market,school,best_package,best_angle,sponsor_signal,sequence_step")
    .eq("bounced", false)
    .eq("unsubscribed", false)
    .not("contact_email", "is", null)
    // SCHOOL PARTNERS ARE NOT SPONSORS, AND THIS IS THE SPONSOR SEQUENCE.
    //
    // The three letters sell a founding partner slot for money. A booster
    // club or alumni chapter is being asked to bring its people into a room,
    // which is a different conversation entirely, and sending them a price
    // reads as a solicitation to a group that was never a prospect. They get
    // their own track later.
    //
    // Sits with the other three because it is the same kind of rule — who is
    // writable at all — and so it holds on EVERY path, the explicit-ids send
    // from the worklist included, not just the campaign filters below.
    //
    // vertical alone is enough: isSchoolPartnerLead also matches best_angle
    // starting "official side huddle partner", and of the 62 rows that match
    // that phrase, zero have any other vertical.
    .neq("vertical", SCHOOL_PARTNER_VERTICAL);

  // "vertical:sports bar" — pick by WHO you are writing to.
  //
  // Campaigns used to be import batches ("school partner batch 3"), which is a
  // fact about when data was loaded, not a choice anyone wants to make. The
  // batch keys still work so old sends are reproducible, but nothing new should
  // use them.
  // An explicit list wins over every filter. The dashboard's worklist sends to
  // the people in ONE town, and no campaign filter can express "these ones".
  if (ids && ids.length) {
    const { data, error } = await q.in("id", ids).limit(500);
    if (error) throw new Error(`DB query failed: ${error.message}`);
    return (data || []) as Lead[];
  }

  if (campaign.startsWith("vertical:")) {
    q = q.eq("vertical", campaign.slice("vertical:".length));
  } else if (campaign.startsWith("school_partner")) {
    q = q.eq("vertical", SCHOOL_PARTNER_VERTICAL);
  }
  // Batch labels live in `region` so each import can be sent independently
  // without touching leads from an earlier batch.
  const BATCH_REGION: Record<string, string> = {
    school_partner_batch_2: "College athletics batch 2",
    school_partner_batch_3: "College athletics batch 3",
    school_partner_batch_4: "College athletics batch 4",
  };
  if (BATCH_REGION[campaign]) {
    q = q.eq("region", BATCH_REGION[campaign]);
  }

  if (step === 1) q = q.eq("emailed", false);
  else q = q.eq("emailed", true).eq("sequence_step", step - 1);

  const { data, error } = await q.order("priority", { ascending: true }).limit(500);
  if (error) throw new Error(`DB query failed: ${error.message}`);
  return (data || []) as Lead[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let supabase: SupabaseClient;
  try {
    supabase = await requireAdmin(req);
  } catch (resp) {
    if (resp instanceof Response) return resp;
    return json({ error: resp instanceof Error ? resp.message : "Auth failed" }, 401);
  }

  try {
    const { sequenceStep = 1, mode = "test", maxEmails = 40, campaign = "all", ids, testTo = null } = await req.json();
    const step = Number(sequenceStep);
    if (![1, 2, 3].includes(step)) return json({ error: "sequenceStep must be 1, 2, or 3" }, 400);

    // ── mode "self": the real email to one address, and nothing else.
    //
    // Until now the only way to see what a sponsor actually receives was to
    // send it to a sponsor. "test" returns text without sending, which cannot
    // show how the subject reads in a crowded inbox or whether the text and
    // HTML parts agree once a client has had them. This sends the genuine
    // article to an address you control.
    //
    // It deliberately does NOT read or write sponsor_leads: nothing is marked
    // emailed, no sequence advances, no real prospect is spent.
    if (mode === "self") {
      const to = String(testTo || "").trim();
      if (!to.includes("@")) {
        return json({ error: 'mode "self" needs testTo: "you@example.com"' }, 400);
      }
      const apiKeySelf = Deno.env.get("BREVO_API_KEY");
      if (!apiKeySelf) return json({ error: "BREVO_API_KEY not configured" }, 500);

      const sample = {
        id: "self-test",
        company: "Wally's Auto Group",
        // NO NAME ON A SELF TEST. A merged first name is the one part of the
        // letter that will be different for every real recipient, and reading
        // "Hi Dana" pulls attention onto the merge instead of the sentences
        // being judged. firstName() falls back to "there" when this is empty.
        contact_name: null,
        contact_email: to,
        vertical: "auto dealer",
        school: "Cleveland Browns",
        market: "Cleveland, OH",
        region: "OH",
        sponsor_signal: null,
        best_package: null,
        best_angle: null,
        domain: "wallysauto.com",
        website: null,
        sequence_step: step - 1,
        emailed: false,
      } as unknown as Lead;

      const subj = subject(step, sample);
      const text = body(step, sample);
      await brevoSend(apiKeySelf, to, subj, text);
      return json({
        mode: "self",
        step,
        to,
        subject: subj,
        text,
        note: "Real email sent. No sponsor_leads row was read or written.",
      });
    }

    const live = mode === "live";
    const cap = Math.min(Math.max(Number(maxEmails) || 40, 1), 200);

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (live && !apiKey) return json({ error: "BREVO_API_KEY not configured" }, 500);

    const KNOWN_CAMPAIGNS = new Set([
      "school_partner", "school_partner_batch_2",
      "school_partner_batch_3", "school_partner_batch_4",
    ]);
    // Any vertical is a valid audience; they come from the data, so the list
    // cannot be hardcoded here without going stale the next time one is added.
    if (String(campaign).startsWith("vertical:")) KNOWN_CAMPAIGNS.add(String(campaign));
    const campaignKey = KNOWN_CAMPAIGNS.has(campaign) ? campaign : "all";
    await loadNicknames(supabase);
    const targets = await selectTargets(supabase, step, campaignKey, Array.isArray(ids) ? ids : undefined);

    // Step 1: skip companies whose domain was already contacted (dedup like emailed_global.csv).
    const contactedDomains = new Set<string>();
    if (step === 1) {
      const { data } = await supabase
        .from("sponsor_leads")
        .select("domain")
        .eq("emailed", true);
      for (const r of data || []) {
        const d = normalizeDomain((r as { domain: string | null }).domain || "");
        if (d) contactedDomains.add(d);
      }
    }

    let sent = 0;
    let skippedDuplicate = 0;
    const errors: string[] = [];
    const previews: Array<{ to: string; company: string; subject: string; text: string }> = [];

    for (const lead of targets) {
      if (sent >= cap) break;
      const to = (lead.contact_email || "").trim();
      if (!to) continue;

      const dedupeDomain = normalizeDomain(lead.domain || lead.website || to);
      if (step === 1 && dedupeDomain && contactedDomains.has(dedupeDomain)) {
        skippedDuplicate++;
        continue;
      }

      const subj = subject(step, lead);
      // The preview is the email itself, not a rendering of it.
      const text = body(step, lead);
      previews.push({ to, company: lead.company, subject: subj, text });

      if (!live) {
        sent++;
        continue;
      }

      try {
        await brevoSend(apiKey!, to, subj, text);
      } catch (e) {
        const msg = `${to}: ${e instanceof Error ? e.message : e}`;
        errors.push(msg);
        await supabase.from("sponsor_leads").update({ last_error: msg }).eq("id", lead.id);
        continue;
      }

      await supabase
        .from("sponsor_leads")
        .update({
          emailed: true,
          emailed_at: new Date().toISOString(),
          sequence_step: step,
          status: step === 1 ? "Sent" : "Follow-up",
          last_touch: new Date().toISOString().slice(0, 10),
          follow_up_date: step < 3
            ? new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            : null,
          last_error: null,
        })
        .eq("id", lead.id);

      if (dedupeDomain) contactedDomains.add(dedupeDomain);
      sent++;
      if (sent < cap) await sleep(3000); // pacing, matches reference
    }

    return json({
      step,
      mode,
      campaign: campaignKey,
      sent,
      eligible: targets.length,
      skipped_duplicate: skippedDuplicate,
      errors,
      previews: previews.slice(0, 50),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Send failed" }, 500);
  }
});

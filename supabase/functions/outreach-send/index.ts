// outreach-send — send the 3-step sponsor sequence via Brevo.
// Eligibility / dedup / sequence logic ported from brevo_send.py:run.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, json, requireAdmin, normalizeDomain } from "../_shared/outreach.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const FROM_EMAIL = "ty@sidehuddlesports.com";
const FROM_NAME = "Ty";
const SPONSOR_URL = "https://sidehuddlesports.com/sponsors";
// Square hosted payment link for the deposit. The CTA points straight here
// rather than at the sponsor page: the ask in these emails is the deposit, and
// a page in between is one more place to lose someone reading on a phone.
// The board, not a fixed Square link. Checkout is generated per team now — a
// static link cannot know which team they want, and there is no sale without
// one.
const CHECKOUT_URL = "https://sidehuddlesports.com/sponsors";
// A sponsor should be able to look at the thing before paying for it, so every
// mail carries all three: buy, read the full pitch, see the app itself.
const APP_STORE_URL = "https://apps.apple.com/us/app/id6777524558";
const SCHOOL_PARTNER_VERTICAL = "school partner";

// $100 for the season, paid in full.
//
// This used to be $2,500 with a $500 deposit and a balance due "the day we
// launch". The app launched, and the page now sells $100 — an email quoting
// $2,500 that links to a $100 page is the fastest way to lose a buyer who was
// otherwise ready. One number, in both places.
//
// The deposit is gone with it: at $100 there is nothing to hold, and a deposit
// is a second conversation, which is the one thing this price exists to avoid.
const SEASON_PRICE = "$100";

// Trademark posture: we describe who the fans are, never claim affiliation.
// Never render a school or club mark, logo, or the word "official" beside one.
const DISCLAIMER =
  "Side Huddle is an independent app and is not affiliated with, endorsed by, " +
  "or sponsored by any school, team, or league.";

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

function fanGroup(lead: Lead): string {
  const slot = slotName(lead);
  return slot === "your local team"
    ? "local fans, friends, parents, and alumni"
    : `${slot} fans, friends, parents, and alumni`;
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
function shell(inner: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:24px 0;">
  <tr><td align="center">
  <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <tr><td style="background-color:#0a0a0a;padding:20px 32px;">
      <span style="color:#00c47d;font-size:16px;font-weight:bold;letter-spacing:0.5px;">Side Huddle</span>
      <span style="color:#888;font-size:13px;margin-left:12px;">The digital tailgate</span>
    </td></tr>
    <tr><td style="padding:32px;color:#1a1a1a;font-size:15px;line-height:1.7;">
${inner}
    </td></tr>
    <tr><td style="background:#f8f8f8;padding:20px 32px;border-top:1px solid #eee;">
      <p style="font-size:13px;color:#888;margin:0 0 4px 0;">— Ty &nbsp;|&nbsp; Side Huddle Sports &nbsp;|&nbsp; <a href="mailto:${FROM_EMAIL}" style="color:#888;">${FROM_EMAIL}</a></p>
      <p style="font-size:12px;color:#bbb;margin:0 0 6px 0;">Reply "unsubscribe" to opt out.</p>
      <p style="font-size:11px;color:#c4c4c4;margin:0;line-height:1.5;">${DISCLAIMER}</p>
    </td></tr>
  </table>
  </td></tr>
</table>
</body></html>`;
}

function cta(label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:4px 0 10px 0;"><tr>
    <td style="background-color:#00c47d;border-radius:6px;">
      <a href="${CHECKOUT_URL}" style="display:inline-block;padding:13px 26px;color:#000;font-size:15px;font-weight:bold;text-decoration:none;">${label} &rarr;</a>
    </td>
    <td style="width:10px;">&nbsp;</td>
    <td style="border:1.5px solid #d0d0d0;border-radius:6px;">
      <a href="${SPONSOR_URL}" style="display:inline-block;padding:12px 22px;color:#1a1a1a;font-size:15px;font-weight:bold;text-decoration:none;">See the full pitch &rarr;</a>
    </td></tr></table>`;
}

function appLine(): string {
  return `<p style="font-size:13px;color:#777;margin:0 0 14px 0;">`
    + `See the app: <a href="${APP_STORE_URL}" style="color:#00a86b;">${APP_STORE_URL}</a></p>`;
}

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

// The one line no other pitch in their inbox can write.
//
// A bar loaded from chapter-db carries the fan club it already hosts and how
// many people are in it — "Home of Northern Summit Browns Backers — 687
// members". Leading with that is the difference between a cold email and a
// letter about their own Sunday.
function signalLine(lead: Lead): string {
  const signal = (lead.sponsor_signal || "").trim();
  if (!signal) return "";
  return `<p style="margin:0 0 18px 0;">${signal}. That crowd is the reason I'm writing.</p>`;
}

function body(step: number, lead: Lead): string {
  if (isSchoolPartnerLead(lead)) return schoolPartnerBody(step, lead);

  const slot = slotName(lead);
  const fans = fanGroup(lead);

  if (step === 2) {
    return shell(`
      <p style="margin:0 0 18px 0;">Hi ${firstName(lead)} — quick follow-up.</p>
      <p style="margin:0 0 18px 0;">One of six businesses backing the ${slot} huddles, all season. ${SEASON_PRICE} — that is the whole price.</p>
      ${cta("Claim the slot")}
      ${appLine()}`);
  }

  if (step === 3) {
    return shell(`
      <p style="margin:0 0 18px 0;">Hi ${firstName(lead)},</p>
      <p style="margin:0 0 18px 0;">Last note on ${slot}. Six businesses get their name on those huddles this season, and the spots do not come back.</p>
      ${cta("Claim the slot")}
      ${appLine()}
      <p style="font-size:13px;color:#999;margin:0;">Not relevant? Reply "unsubscribe" and I won't follow up.</p>`);
  }

  // step 1 — the whole offer in four lines; anything longer stops being read
  // on a phone, which is where a local owner opens their mail.
  return shell(`
    <p style="margin:0 0 18px 0;">Hi ${firstName(lead)},</p>
    ${signalLine(lead)}
    <p style="margin:0 0 18px 0;">Side Huddle is the digital tailgate — the app fan groups use to watch the game together. Live scores, big plays and highlights land in the room while they argue about the call.</p>
    <p style="margin:0 0 18px 0;">${lead.company} would be one of six businesses backing the ${slot} huddles — your name on the board in every one of them, all season, in front of ${fans}.</p>
    <p style="margin:0 0 18px 0;">Not an advert beside the fans. A business behind them, the same way you would back a team at home.</p>
    <p style="margin:0 0 18px 0;"><strong>${SEASON_PRICE} for the season, paid once.</strong> No deposit, nothing owed later — less than one radio spot, and it runs every game instead of once. Six spots per team, no seventh.</p>
    ${cta("Claim the slot")}
    ${appLine()}
    <p style="font-size:13px;color:#999;margin:0;">Price goes up each week until kickoff.</p>`);
}

function schoolPartnerBody(step: number, lead: Lead): string {
  const organization = lead.company;
  const huddle = huddleLabel(lead);

  if (step === 2) {
    return shell(`
      <p style="margin:0 0 18px 0;">Hi ${firstName(lead)} — quick follow-up.</p>
      <p style="margin:0 0 18px 0;">One of six businesses backing the ${huddle} huddles, all season. ${SEASON_PRICE} — that is the whole price.</p>
      ${cta("Claim the slot")}
      ${appLine()}`);
  }

  if (step === 3) {
    return shell(`
      <p style="margin:0 0 18px 0;">Hi ${firstName(lead)},</p>
      <p style="margin:0 0 18px 0;">Last note on ${huddle}. One brand gets to be the only one inside those huddles this season.</p>
      ${cta("Claim the slot")}
      ${appLine()}
      <p style="font-size:13px;color:#999;margin:0;">Not relevant? Reply "unsubscribe" and I won't follow up.</p>`);
  }

  // These leads already sponsor the athletics program, so the opener names that
  // fact and nothing else — no comparison to what they pay their rights holder,
  // which reads as adversarial and invites "so you are worth less".
  return shell(`
    <p style="margin:0 0 18px 0;">Hi ${firstName(lead)},</p>
    <p style="margin:0 0 18px 0;">You already put your name in front of ${huddle} fans, so I'll be quick.</p>
    <p style="margin:0 0 18px 0;">Side Huddle is the digital tailgate — AI-enhanced team chat where one fanbase splits into hundreds of small huddles, each with a bot pulling live scores, news and highlights into the room.</p>
    <p style="margin:0 0 18px 0;">We sell one sponsor per category. ${organization} would be the only one across every ${huddle} huddle.</p>
    <p style="margin:0 0 18px 0;"><strong>${SEASON_PRICE} for the season, paid once.</strong> No deposit and nothing owed later.</p>
    ${cta("Claim the slot")}
    ${appLine()}
    <p style="font-size:13px;color:#999;margin:0;">Price goes up each week until kickoff.</p>`);
}


// Strip the HTML shell so a test run shows the words that will actually land in
// someone's inbox. Reading raw markup in a JSON preview is not a review.
function asText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/p>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&rarr;/g, "\u2192")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function brevoSend(apiKey: string, to: string, subj: string, html: string): Promise<void> {
  const resp = await fetch(BREVO_URL, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: to }],
      subject: subj,
      htmlContent: html,
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
    .not("contact_email", "is", null);

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
    const { sequenceStep = 1, mode = "test", maxEmails = 40, campaign = "all", ids } = await req.json();
    const step = Number(sequenceStep);
    if (![1, 2, 3].includes(step)) return json({ error: "sequenceStep must be 1, 2, or 3" }, 400);
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
      const html = body(step, lead);
      previews.push({ to, company: lead.company, subject: subj, text: asText(html) });

      if (!live) {
        sent++;
        continue;
      }

      try {
        await brevoSend(apiKey!, to, subj, html);
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

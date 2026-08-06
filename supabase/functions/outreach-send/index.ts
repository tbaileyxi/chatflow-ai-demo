// outreach-send — send the 3-step sponsor sequence via Brevo.
// Eligibility / dedup / sequence logic ported from brevo_send.py:run.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, json, requireAdmin, normalizeDomain } from "../_shared/outreach.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const FROM_EMAIL = "ty@sidehuddlesports.com";
const FROM_NAME = "Ty";
const SPONSOR_URL = "https://sidehuddlesports.com/sponsors";

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
      <span style="color:#888;font-size:13px;margin-left:12px;">Sports community for real fans</span>
    </td></tr>
    <tr><td style="padding:32px;color:#1a1a1a;font-size:15px;line-height:1.7;">
${inner}
    </td></tr>
    <tr><td style="background:#f8f8f8;padding:20px 32px;border-top:1px solid #eee;">
      <p style="font-size:13px;color:#888;margin:0 0 4px 0;">— Ty &nbsp;|&nbsp; Side Huddle Sports &nbsp;|&nbsp; <a href="mailto:${FROM_EMAIL}" style="color:#888;">${FROM_EMAIL}</a></p>
      <p style="font-size:12px;color:#bbb;margin:0;">Reply "unsubscribe" to opt out.</p>
    </td></tr>
  </table>
  </td></tr>
</table>
</body></html>`;
}

function cta(label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:4px 0 18px 0;"><tr>
    <td style="background-color:#00c47d;border-radius:6px;">
      <a href="${SPONSOR_URL}" style="display:inline-block;padding:13px 26px;color:#000;font-size:15px;font-weight:bold;text-decoration:none;">${label} &rarr;</a>
    </td></tr></table>`;
}

// ── step templates ─────────────────────────────────────────────────────────────
function subject(step: number, lead: Lead): string {
  switch (step) {
    case 2: return `Following up — ${lead.company} x Side Huddle`;
    case 3: return `Closing the loop on ${lead.company}`;
    default: return `Want to be the exclusive sponsor?`;
  }
}

function body(step: number, lead: Lead): string {
  const v = (lead.vertical || "your brand").toLowerCase();
  const region = (lead.school || lead.market || lead.region || "").trim();
  const where = region ? ` in ${region}` : "";
  const angle = lead.best_angle || "Player of the Week";
  const pkg = lead.best_package || "$1,500";

  if (step === 2) {
    return shell(`
      <p style="margin:0 0 18px 0;">Hi ${firstName(lead)},</p>
      <p style="margin:0 0 18px 0;">Circling back on Side Huddle. Quick why-now for ${lead.company}: ${lead.sponsor_signal || "you are a strong fit for local sports fans and families"}.</p>
      <p style="margin:0 0 18px 0;">The easiest slot to understand is ${angle}${where}: your business attached to a local sports moment parents, athletes, coaches, and fans already care about.</p>
      ${cta("See sponsorship options")}
      <p style="font-size:13px;color:#999;margin:0;">Worth a 15-minute call? Reply and I'll send a couple of times.</p>`);
  }

  if (step === 3) {
    return shell(`
      <p style="margin:0 0 18px 0;">Hi ${firstName(lead)},</p>
      <p style="margin:0 0 18px 0;">Last note from me. If reaching engaged sports fans${where} isn't a priority for ${lead.company} right now, no worries at all.</p>
      <p style="margin:0 0 18px 0;">If it might be, the ${angle} slot for ${v} is still open and the deck takes two minutes to skim.</p>
      ${cta("Take a look")}
      <p style="font-size:13px;color:#999;margin:0;">Not relevant? Reply "unsubscribe" and I won't follow up.</p>`);
  }

  // step 1 — short, human, conversational
  const teamsPhrase = region ? `${region.split(",")[0]} sports` : "your local sports community";
  return shell(`
    <p style="margin:0 0 18px 0;">Hi ${firstName(lead)},</p>
    <p style="margin:0 0 18px 0;">I am with Side Huddle Sports. We cover local athletes, teams, and game-day stories around ${teamsPhrase}.</p>
    <p style="margin:0 0 18px 0;">I noticed ${lead.company} ${lead.sponsor_signal || "is active in a category that fits parents, athletes, coaches, and fans"}, and thought you could be a strong fit for ${angle}.</p>
    <p style="margin:0 0 18px 0;">Would you be open to seeing the sponsor options? Packages start at ${pkg}.</p>
    ${cta("See the sponsor options")}
    <p style="font-size:14px;color:#555;margin:0;">Thanks,<br>Ty</p>`);
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

async function selectTargets(supabase: SupabaseClient, step: number): Promise<Lead[]> {
  let q = supabase
    .from("sponsor_leads")
    .select("id,company,domain,website,contact_name,contact_email,vertical,region,market,school,best_package,best_angle,sponsor_signal,sequence_step")
    .eq("bounced", false)
    .eq("unsubscribed", false)
    .not("contact_email", "is", null);

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
    const { sequenceStep = 1, mode = "test", maxEmails = 40 } = await req.json();
    const step = Number(sequenceStep);
    if (![1, 2, 3].includes(step)) return json({ error: "sequenceStep must be 1, 2, or 3" }, 400);
    const live = mode === "live";
    const cap = Math.min(Math.max(Number(maxEmails) || 40, 1), 200);

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (live && !apiKey) return json({ error: "BREVO_API_KEY not configured" }, 500);

    const targets = await selectTargets(supabase, step);

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
    const previews: Array<{ to: string; company: string; subject: string }> = [];

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
      previews.push({ to, company: lead.company, subject: subj });

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

// chapter-send — Brevo sequence for fan-club and alumni chapter presidents.
//
// Deliberately separate from outreach-send: that one is welded to sponsor_leads
// columns and campaign logic, and the pitch is completely different (a sponsor
// buys a slot; a chapter president is offered a free room for their members).
// Same Brevo account, same auth helpers, same step/bounce/suppression rules.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, json, requireAdmin } from "../_shared/outreach.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
// Same verified sender as outreach-send — sidehuddlesports.com, not sidehuddle.com.
const FROM_EMAIL = Deno.env.get("CHAPTER_FROM_EMAIL") ?? "ty@sidehuddlesports.com";
const FROM_NAME = "Ty";
const APP_URL = "https://www.sidehuddlesports.com";

/**
 * Per-org room to drop them into, as {"Cleveland Browns": ".../h/<id>"}.
 * The pitch is "join this room, then start your own" — landing them in a live
 * room beats asking them to create one from an empty screen. Falls back to the
 * site if no room is configured for their team yet.
 */
function seedRoom(org: string): string {
  try {
    const map = JSON.parse(Deno.env.get("CHAPTER_SEED_ROOMS") ?? "{}");
    if (map && typeof map[org] === "string" && map[org]) return map[org];
  } catch { /* fall through to the default */ }
  return APP_URL;
}

type Chapter = {
  id: string;
  chapter_name: string;
  org: string;
  org_type: string;
  city: string | null;
  state: string | null;
  venue: string | null;
  leader_name: string | null;
  first_name: string | null;
  email: string;
  member_count: number | null;
  sequence_step: number;
};

// ── copy helpers ──────────────────────────────────────────────────────────────

function greeting(c: Chapter): string {
  const n = (c.first_name || "").trim();
  return n && n.toLowerCase() !== "there" ? n : "there";
}

/** "the Sarasota Browns Backers" reads better than the bare chapter name. */
function chapterRef(c: Chapter): string {
  const name = (c.chapter_name || "your chapter").trim();
  return /^the\s/i.test(name) ? name : `the ${name}`;
}

/** Personalisation hook, strongest first: the bar, then the city. */
function where(c: Chapter): string {
  if (c.venue) return ` at ${c.venue}`;
  if (c.city) return ` in ${c.city}`;
  return "";
}

function sizeNote(c: Chapter): string {
  if (!c.member_count || c.member_count < 25) return "";
  return ` ${c.member_count} members is a real crowd —`;
}

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
      <p style="font-size:12px;color:#bbb;margin:0;">You're getting this because your chapter is listed in a public fan-club directory. Reply "unsubscribe" and I won't email again.</p>
    </td></tr>
  </table>
  </td></tr>
</table>
</body></html>`;
}

function cta(label: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:4px 0 18px 0;"><tr>
    <td style="background-color:#00c47d;border-radius:6px;">
      <a href="${href}" style="display:inline-block;padding:13px 26px;color:#000;font-size:15px;font-weight:bold;text-decoration:none;">${label} &rarr;</a>
    </td></tr></table>`;
}

// ── step templates ────────────────────────────────────────────────────────────

function subject(step: number, c: Chapter): string {
  const name = (c.chapter_name || "your chapter").trim();
  switch (step) {
    case 2: return `Following up — a private room for ${name}`;
    case 3: return `Last note on ${name}`;
    default: return c.venue
      ? `${name} — for the group at ${c.venue}`
      : `A private game-day room for ${name}`;
  }
}

function body(step: number, c: Chapter): string {
  const who = chapterRef(c);
  const spot = where(c);
  const org = c.org || "your team";
  const room = seedRoom(org);

  if (step === 2) {
    return shell(`
      <p style="margin:0 0 18px 0;">Hi ${greeting(c)},</p>
      <p style="margin:0 0 18px 0;">Following up on ${who}.</p>
      <p style="margin:0 0 18px 0;">Easiest way to see it is from the inside — the link below drops you straight into the ${org} room. Live scores, news and game-day prompts flow in on their own while fans talk.</p>
      <p style="margin:0 0 18px 0;">Once you're in, hit "create a huddle" and you've got your own private room for ${who}. Takes a minute, and you're the admin. Share your link with your members and that's it.</p>
      ${cta(`Join the ${org} room`, room)}
      <p style="font-size:13px;color:#999;margin:0;">Free for chapters. If it's not for your group, just say so and I'll leave you alone.</p>`);
  }

  if (step === 3) {
    return shell(`
      <p style="margin:0 0 18px 0;">Hi ${greeting(c)},</p>
      <p style="margin:0 0 18px 0;">Last note from me on ${who} — I don't want to clutter your inbox.</p>
      <p style="margin:0 0 18px 0;">The link's below if you ever want a look. Join the ${org} room, and if you like it, spin up your own for your members in about a minute.</p>
      <p style="margin:0 0 18px 0;">Either way, good luck this season.</p>
      ${cta(`Join the ${org} room`, room)}`);
  }

  return shell(`
    <p style="margin:0 0 18px 0;">Hi ${greeting(c)},</p>
    <p style="margin:0 0 18px 0;">I came across ${who}${spot} and wanted to reach out — you're exactly who I built this for.</p>
    <p style="margin:0 0 18px 0;">I run Side Huddle. It gives a fan group its own private room: live scores, ${org} news, highlights and game-day prompts flow in on their own, while your members talk to each other. It's the group chat your chapter probably already has, except the game is happening inside it.</p>
    <p style="margin:0 0 18px 0;">${sizeNote(c)} the members who can't make it${spot ? ` to${spot.replace(/^ at /, " ")}` : ""} on a Sunday still get to be part of it.</p>
    <p style="margin:0 0 18px 0;">Rather than explain it — the link below puts you in the ${org} room. Have a look around, and if it fits, create your own huddle for ${who} and send your members the link. You're the admin, it's free, and it takes about a minute.</p>
    ${cta(`Join the ${org} room`, room)}
    <p style="font-size:13px;color:#999;margin:0;">Worth a look for your group?</p>`);
}

// ── sending ───────────────────────────────────────────────────────────────────

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

const COLS =
  "id,chapter_name,org,org_type,city,state,venue,leader_name,first_name,email,member_count,sequence_step";

async function selectTargets(
  supabase: SupabaseClient,
  step: number,
  org: string | null,
  ids: string[] | null,
): Promise<Chapter[]> {
  let q = supabase
    .from("chapter_leads")
    .select(COLS)
    .eq("contact_channel", "email")
    .eq("bounced", false)
    .eq("unsubscribed", false)
    .not("email", "is", null)
    .neq("email", "");

  // Explicit selection from the dashboard wins over the step filter, so
  // "send to these five" does what it says.
  if (ids && ids.length) {
    q = q.in("id", ids);
  } else if (step === 1) {
    q = q.eq("emailed", false);
  } else {
    q = q.eq("emailed", true).eq("sequence_step", step - 1);
  }

  if (org) q = q.eq("org", org);

  const { data, error } = await q.order("score", { ascending: false }).limit(500);
  if (error) throw new Error(`DB query failed: ${error.message}`);
  return (data || []) as Chapter[];
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
    const {
      sequenceStep = 1,
      mode = "test",
      maxEmails = 25,
      org = null,
      ids = null,
    } = await req.json();

    const step = Number(sequenceStep);
    if (![1, 2, 3].includes(step)) return json({ error: "sequenceStep must be 1, 2, or 3" }, 400);

    const live = mode === "live";
    const cap = Math.min(Math.max(Number(maxEmails) || 25, 1), 200);

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (live && !apiKey) return json({ error: "BREVO_API_KEY not configured" }, 500);

    const targets = await selectTargets(supabase, step, org, ids);
    const batch = targets.slice(0, cap);

    const previews: Array<{ chapter: string; to: string; subject: string }> = [];
    const errors: Array<{ chapter: string; error: string }> = [];
    let sent = 0;

    for (const c of batch) {
      const subj = subject(step, c);
      previews.push({ chapter: c.chapter_name, to: c.email, subject: subj });
      if (!live) continue;

      try {
        await brevoSend(apiKey!, c.email, subj, body(step, c));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ chapter: c.chapter_name, error: msg });
        await supabase.from("chapter_leads").update({ last_error: msg }).eq("id", c.id);
        continue;
      }

      await supabase
        .from("chapter_leads")
        .update({
          emailed: true,
          emailed_at: new Date().toISOString(),
          sequence_step: step,
          status: "sent",
          last_touch: new Date().toISOString().slice(0, 10),
          last_error: null,
        })
        .eq("id", c.id);
      sent++;
    }

    return json({
      step,
      mode: live ? "live" : "test",
      eligible: targets.length,
      sent,
      errors,
      previews: previews.slice(0, 50),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

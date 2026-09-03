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
// The room links are web URLs, but a chapter actually lives in the app — so
// every mail carries the store link too. Without it the president lands on a
// page and has to go hunting for how to bring their members along.
const APP_STORE_URL = "https://apps.apple.com/us/app/id6777524558";

/**
 * Per-org room to drop them into, as {"Cleveland Browns": ".../h/<id>"}.
 * The pitch is "join this room, then start your own" — landing them in a live
 * room beats asking them to create one from an empty screen. Falls back to the
 * site if no room is configured for their team yet.
 */
function teamSlug(org: string): string {
  return org.toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function seedRoom(org: string): string {
  try {
    const map = JSON.parse(Deno.env.get("CHAPTER_SEED_ROOMS") ?? "{}");
    if (map && typeof map[org] === "string" && map[org]) return map[org];
  } catch { /* fall through to the team page */ }
  // CHAPTER_SEED_ROOMS has never been set, so this fallback is the real path.
  // It used to be the generic homepage while the copy promised "the <team>
  // room" — a broken promise in the first line of a cold email. /t/<slug> is a
  // page about their team that exists today and needs no live huddle.
  return `${APP_URL}/t/${teamSlug(org)}`;
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
  /** The six characters that turn this email into their room. */
  claim_code: string | null;
};

// ── copy helpers ──────────────────────────────────────────────────────────────

/**
 * How a team is named in copy, in two registers.
 *
 * `full` is the formal name, used where it has to match the team page the CTA
 * links to. `short` is what a fan would actually say out loud — "your Browns
 * group", "your Aggies group" — which is how the sentence is written.
 *
 * The scraped `org` values are informal and a few are ambiguous on their own:
 * bare "Texas" could be the state, the Longhorns, or the Rangers, and "your
 * Texas group to talk" reads like a mail-merge that lost a word. The nickname
 * fixes that and sounds like a person wrote it.
 *
 * Anything not in this map falls back to the raw org for both registers, so a
 * newly scraped team still produces a sane email before anyone adds a row.
 */
const ORG_COPY: Record<string, { full: string; short: string }> = {
  "Cleveland Browns":    { full: "Cleveland Browns",    short: "Browns" },
  "Buffalo Bills":       { full: "Buffalo Bills",       short: "Bills" },
  "Pittsburgh Steelers": { full: "Pittsburgh Steelers", short: "Steelers" },
  "Green Bay Packers":   { full: "Green Bay Packers",   short: "Packers" },
  "Dallas Cowboys":      { full: "Dallas Cowboys",      short: "Cowboys" },
  "Seattle Seahawks":    { full: "Seattle Seahawks",    short: "Seahawks" },
  "Las Vegas Raiders":   { full: "Las Vegas Raiders",   short: "Raiders" },
  "Texas A&M":           { full: "Texas A&M",           short: "Aggies" },
  "Penn State":          { full: "Penn State",          short: "Nittany Lions" },
  "Ohio State":          { full: "Ohio State",          short: "Buckeyes" },
  "Alabama":             { full: "Alabama",             short: "Crimson Tide" },
  "Clemson":             { full: "Clemson",             short: "Tigers" },
  "Georgia":             { full: "Georgia",             short: "Bulldogs" },
  "Texas":               { full: "Texas Longhorns",     short: "Longhorns" },
  "LSU":                 { full: "LSU",                 short: "Tigers" },
};

function orgNames(org: string): { full: string; short: string } {
  return ORG_COPY[org] ?? { full: org, short: org };
}

function greeting(c: Chapter): string {
  const n = (c.first_name || "").trim();
  return n && n.toLowerCase() !== "there" ? n : "there";
}

/** "the Sarasota Browns Backers" reads better than the bare chapter name. */
function chapterRef(c: Chapter): string {
  const name = (c.chapter_name || "your chapter").trim();
  return /^the\s/i.test(name) ? name : `the ${name}`;
}


/**
 * Fills "whether they made it___ or not".
 *
 * Only the venue is worth naming here. The city variant used to return
 * " out in Houston", which produced "whether they made it out in Houston or
 * not" — broken English, and exactly the kind of merge seam that makes an
 * email read as generated. A bare " out" fits the sentence in every case.
 */
function missedOut(c: Chapter): string {
  if (c.venue) return ` to ${c.venue}`;
  if (c.city) return " out";
  return "";
}

/**
 * Opening line, most specific version available.
 *
 * The venue is the single most personal thing we know about a chapter — naming
 * it in sentence one is the difference between a mail-merge and a note from
 * someone who actually looked. Degrades to the city, then to nothing, so a lead
 * with thin data never gets a sentence with a hole in it.
 *
 * NEVER NAME A DAY HERE. Eight of the fifteen orgs are college football, which
 * plays Saturday — an earlier version opened with "You've got Sundays figured
 * out" and would have been factually wrong to more than half the list.
 * Anything day-shaped ("game day", "on Sundays", "all week") has the same
 * problem and is also the wrong pitch: see the note on the step-1 body.
 */
function openingLine(c: Chapter): string {
  if (c.venue) return `You've got a good thing going at ${c.venue}.`;
  if (c.city) return `You've got a good thing going in ${c.city}.`;
  return `You've clearly got a good thing going.`;
}

function shell(inner: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:24px 0;">
  <tr><td align="center">
  <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <tr><td style="background-color:#0a0a0a;padding:20px 32px;">
      <span style="color:#FFD700;font-size:16px;font-weight:bold;letter-spacing:0.5px;">Side Huddle</span>
      <span style="color:#888;font-size:13px;margin-left:12px;">The digital tailgate</span>
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


/**
 * The code, made impossible to miss.
 *
 * This is the one thing in the email that has to survive being read on a phone
 * and typed into a different screen a minute later. Big, wide-tracked, and real
 * TEXT — an image of a code cannot be copied, and half of these will be read in
 * a mail client that blocks images by default.
 */
function codeBlock(code: string): string {
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 20px 0;"><tr>
    <td align="center" style="background-color:#faf7ea;border:2px dashed #d8cfa4;border-radius:10px;padding:18px 12px;">
      <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:1.5px;color:#8a7f55;text-transform:uppercase;font-weight:bold;">Your code</p>
      <p style="margin:0;font-size:34px;font-weight:bold;letter-spacing:8px;color:#1a1a1a;font-family:'Courier New',Courier,monospace;">${code}</p>
    </td></tr></table>`;
}

function cta(label: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:4px 0 18px 0;"><tr>
    <td style="background-color:#FFD700;border-radius:6px;">
      <a href="${href}" style="display:inline-block;padding:13px 26px;color:#000;font-size:15px;font-weight:bold;text-decoration:none;">${label} &rarr;</a>
    </td></tr></table>`;
}

// ── step templates ────────────────────────────────────────────────────────────

function subject(step: number, c: Chapter): string {
  const name = (c.chapter_name || "your chapter").trim();
  const { short } = orgNames(c.org || "");
  switch (step) {
    case 2: return `Re: the ${name} room`;
    case 3: return `Last one`;
    // MEASURED, not chosen. Brevo logs for the first 258 sends:
    //
    //   "Browns season — a room for X"   71 sent   35.2% open   8.5% click
    //   "Claim the X room"              185 sent   12.4% open   1.6% click
    //
    // Nearly three times the opens and five times the clicks. "Claim the … room"
    // was written to fix a real bug — `${name}'s group chat` produced "Sarasota
    // Browns Backers's group chat", a double possessive on any chapter name
    // ending in s, which most of them do — but the fix threw out the part that
    // was working. It leads with an instruction to a stranger, where the season
    // line leads with the thing they already care about and names their club.
    //
    // This keeps the season hook and sidesteps the possessive entirely: "a room
    // for X" needs no apostrophe.
    default: return `${short} season — a room for ${name}`;
  }
}

/**
 * The opening line, and the only sentence most of these get.
 *
 * "Somewhere to be" was a place, not a reason — it described a venue and gave a
 * chapter president nothing to want. The tension worth naming is the one every
 * chapter actually has: the group is scattered, and on any given Sunday most of
 * the roster is not at the bar. The room is where they are together anyway.
 *
 * The venue is the most personal thing we know, so it goes in the sentence when
 * we have it. Without one the same idea still holds, just less pointed.
 */
function hook(c: Chapter, who: string): string {
  if (c.venue) {
    return `Side Huddle keeps ${who} together on game day — the ones at ${c.venue}, and the ones who couldn't make it.`;
  }
  return `Side Huddle keeps ${who} together on game day — the ones who show up, and the ones who couldn't make it.`;
}

function body(step: number, c: Chapter): string {
  const who = chapterRef(c);
  const org = c.org || "your team";
  const { short: orgShort } = orgNames(org);
  const code = (c.claim_code || "").trim();

  // GAME DAY FIRST. An earlier line read "somewhere to be between game days",
  // which quietly says the main event is handled elsewhere. It is not — game day
  // is the whole point, and the days in between are the bonus. Getting that
  // backwards tells a chapter president you do not know what their group is for.
  //
  // LEAD WITH WHAT THE CHAPTER GETS. An earlier draft described what the
  // product DOES — news lands, members talk — and never said what that is worth
  // to the person reading. A chapter president is not shopping for an app; they
  // want their group active between game days and more people in it. Say that
  // first, then how.
  //
  // "CLAIM", NOT "I'VE SET ASIDE". Set-aside is a favour that puts them in debt
  // to a stranger. Claiming is theirs to take, and it is also literally what the
  // code does — the room does not exist until they redeem it.
  //
  // AND IT IS NOT A PRIVATE ROOM. claim_chapter_huddle creates it with
  // is_private = false and official_status = 'active', which means it is LISTED
  // and anyone can walk in. An earlier draft called it "a private room for your
  // members", which was plainly false and exactly the kind of thing a chapter
  // president finds out about in front of their members. What it actually is:
  // findable by their people, theirs to lock down whenever they want. That is a
  // better pitch anyway, because being findable is how the room grows.
  //
  // The code carries in EVERY step. Someone who skims step one and comes back a
  // week later should not have to work out which email had it.

  if (step === 2) {
    return shell(`
      <p style="margin:0 0 18px 0;">Hey ${greeting(c)},</p>
      <p style="margin:0 0 18px 0;">Following up once — the ${orgShort} room for ${chapterRef(c)} is still open.</p>
      <p style="margin:0 0 18px 0;">It runs itself. The score, the news and the clip everyone's passing around show up without anyone posting them, so it's somewhere to be on a Tuesday and not just Sunday.</p>
      ${cta(`Get the app — free`, APP_STORE_URL)}
      <p style="margin:0 0 18px 0;">Ty</p>
      ${code ? `<p style="font-size:13.5px;color:#777;margin:0;border-top:1px solid #eee;padding-top:16px;">P.S. Your code is <b style="color:#111;letter-spacing:1px;">${code}</b> if you want the room under your chapter's name.</p>` : ""}`);
  }

  if (step === 3) {
    return shell(`
      <p style="margin:0 0 18px 0;">Hey ${greeting(c)},</p>
      <p style="margin:0 0 18px 0;">Last one from me. If it's not for your group, no hard feelings — good luck this season either way.</p>
      <p style="margin:0 0 18px 0;">The ${orgShort} room stays open if you ever want it.</p>
      ${cta(`Get the app — free`, APP_STORE_URL)}
      <p style="margin:0 0 18px 0;">Ty</p>
      ${code ? `<p style="font-size:13.5px;color:#777;margin:0;border-top:1px solid #eee;padding-top:16px;">P.S. Code <b style="color:#111;letter-spacing:1px;">${code}</b>, ${chapterRef(c)} only. It doesn't expire.</p>` : ""}`);
  }

  // SIX LINES, AND ONE ASK.
  //
  // The long version explained the product to someone who had not agreed to
  // hear about it yet, and it asked for two things at once: install the app AND
  // enter a code. The code is what makes them the room's owner, so it read as a
  // second job on top of the first. 258 sends, 9 clicks, 0 rooms.
  //
  // So: one button, and the code demoted to a P.S. where it is a bonus rather
  // than a gate. Anyone who installs lands in the live team room either way, so
  // nobody who ignores the P.S. hits an empty screen.
  //
  // The angle is theirs, not ours — and "get people to turn up" was only ever
  // half of them. A Browns backers club hosts a bar on Sunday; an alumni
  // association does not, and opening on turnout read as a watch-party pitch to
  // people who are not running one. What both actually want is a membership
  // that stays attached to the team, together, in and out of game day. So the
  // opener leads on that, and the venue line appears only when there is a venue.
  return shell(`
    <p style="margin:0 0 18px 0;">Hey ${greeting(c)},</p>
    <p style="margin:0 0 18px 0;">Your members already care about every snap. They are just watching it apart — a hundred living rooms, a group text nobody reads.</p>
    <p style="margin:0 0 18px 0;">There's a ${orgShort} room for ${chapterRef(c)}: a digital tailgate. Everybody together for the game, the score and the ${orgShort} news landing on their own${c.venue ? `, and when you post "${c.venue}, 1pm" people actually see it` : `, and the chapter still in one place between game days`}.</p>
    ${cta(`Get the app — free`, APP_STORE_URL)}
    <p style="margin:0 0 18px 0;">Ty</p>
    ${code ? `<p style="font-size:13.5px;color:#777;margin:0;border-top:1px solid #eee;padding-top:16px;">P.S. Want it named for ${who} with you running it? Code <b style="color:#111;letter-spacing:1px;">${code}</b> at signup.</p>` : ""}`);
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
  "id,chapter_name,org,org_type,city,state,venue,leader_name,first_name,email,member_count,sequence_step,claim_code";

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
      testTo = null,
    } = await req.json();

    const step = Number(sequenceStep);
    if (![1, 2, 3].includes(step)) return json({ error: "sequenceStep must be 1, 2, or 3" }, 400);

    // ── mode "self": send the real HTML to one address and touch nothing else.
    //
    // `mode:"test"` only ever returned stripped text, which cannot tell you
    // whether the gold renders, whether the button survives Gmail, or how the
    // subject line looks in a list of forty other subject lines. This sends the
    // genuine article to an inbox you control.
    //
    // It deliberately does NOT read or write chapter_leads: no lead is marked
    // emailed, no sequence advances, nothing is consumed. Walk all three steps
    // as many times as you like without spending a single real lead.
    if (mode === "self") {
      const to = String(testTo || "").trim();
      if (!to.includes("@")) {
        return json({ error: 'mode "self" needs testTo: "you@example.com"' }, 400);
      }
      const apiKeySelf = Deno.env.get("BREVO_API_KEY");
      if (!apiKeySelf) return json({ error: "BREVO_API_KEY not configured" }, 500);

      // A realistic stand-in so every merge field is exercised — first name,
      // venue, city and member count all populated, which is the shape that
      // shows whether the sentences still read well once filled in.
      const sample: Chapter = {
        id: "self-test",
        chapter_name: "Sarasota Browns Backers",
        org: org || "Cleveland Browns",
        org_type: "fan club",
        city: "Sarasota",
        state: "FL",
        venue: "The Greenlight Bar",
        leader_name: "Test Recipient",
        first_name: "Ty",
        email: to,
        member_count: 140,
        sequence_step: step - 1,
        // A realistic code so a self-test shows the block that matters most.
        claim_code: "QBCKAK",
      };

      const subj = subject(step, sample);
      const html = body(step, sample);
      await brevoSend(apiKeySelf, to, subj, html);
      return json({
        mode: "self",
        step,
        to,
        subject: subj,
        note: "Real email sent. No chapter_leads row was read or written.",
      });
    }

    const live = mode === "live";
    const cap = Math.min(Math.max(Number(maxEmails) || 25, 1), 200);

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (live && !apiKey) return json({ error: "BREVO_API_KEY not configured" }, 500);

    const targets = await selectTargets(supabase, step, org, ids);
    const batch = targets.slice(0, cap);

    const previews: Array<{ chapter: string; to: string; subject: string; text: string }> = [];
    const errors: Array<{ chapter: string; error: string }> = [];
    let sent = 0;

    for (const c of batch) {
      const subj = subject(step, c);
      const html = body(step, c);
      previews.push({ chapter: c.chapter_name, to: c.email, subject: subj, text: asText(html) });
      if (!live) continue;

      try {
        await brevoSend(apiKey!, c.email, subj, html);
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

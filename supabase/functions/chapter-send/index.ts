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

function body(step: number, c: Chapter): string {
  const who = chapterRef(c);
  const { short: orgShort } = orgNames(c.org || "your team");

  // PLAIN TEXT IS THE EMAIL. The HTML is generated from this, not the other
  // way round, so what the preview shows is exactly what lands. The old
  // version built styled HTML and stripped it for preview, which meant the
  // preview was a lossy copy of the real thing and the real thing was a
  // newsletter — boxes, a gold code block, a CTA button table — sent by a
  // person writing one-to-one. A letter from Ty should look like a letter
  // from Ty.
  //
  // AND IT IS AN ENGAGEMENT TOOL, NOT A COMMUNITY TO RUN. Every earlier draft
  // asked a chapter president to take on a room: claim it, name it, own it.
  // That is a second job offered to a volunteer who already has one. What they
  // actually have is a group that goes quiet between games, and what this does
  // is fill it without them touching anything. The absence of admin work IS
  // the product; say that instead of handing them a code.
  //
  // NO CODES. Not in the body, not in a P.S. A code is a task, and every
  // version that carried one asked for two things at once: install this, and
  // then do this other thing. 258 sends, 9 clicks, 0 rooms.

  if (step === 2) {
    return [
      `Hey ${greeting(c)},`,
      `Following up once. The ${orgShort} room for ${who} is still there if you want it.`,
      `It fills itself — the score, the news and whatever clip everyone is passing around show up without anyone posting them. Nothing for you to run or moderate.`,
      `Free on iPhone: ${APP_STORE_URL}`,
      `Ty`,
    ].join("\n\n");
  }

  if (step === 3) {
    return [
      `Hey ${greeting(c)},`,
      `Last one from me. If it is not for your group, no hard feelings — good luck this season either way.`,
      `The ${orgShort} room stays open if you ever want it: ${APP_STORE_URL}`,
      `Ty`,
    ].join("\n\n");
  }

  return [
    `Hey ${greeting(c)},`,
    // "the Sarasota Browns Backers already cares" — a club name takes a plural
    // verb in the reader's ear, and half these names end in s. Naming the
    // members instead sidesteps it for fan clubs and alumni groups alike.
    `Your members already care about every snap. They are just watching apart, and the group goes quiet between games.`,
    `A ${orgShort} room fixes the quiet part on its own. The score, the news and the clips land in it without anyone posting them${c.venue ? `, and when you do post "${c.venue}, 1pm" people actually see it` : ``}.`,
    `There is no admin work. That is the whole tool — nothing for you to run.`,
    `Free on iPhone: ${APP_STORE_URL}`,
    `Ty`,
  ].join("\n\n");
}

/**
 * Minimal HTML from the text, because some clients prefer an HTML part and
 * showing them a wall of unwrapped text is worse than showing them paragraphs.
 * Paragraphs and links only: no tables, no colours, no buttons. If this ever
 * grows a style attribute, the text version has stopped being the email.
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
  return `<!DOCTYPE html><html><body>\n${paragraphs}\n</body></html>`;
}

// ── sending ───────────────────────────────────────────────────────────────────

async function brevoSend(apiKey: string, to: string, subj: string, text: string): Promise<void> {
  const resp = await fetch(BREVO_URL, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: to }],
      subject: subj,
      // BOTH PARTS. Only htmlContent went before, so a text-only client got
      // Brevo's own stripped version of our markup rather than anything we
      // wrote or ever looked at.
      textContent: text,
      htmlContent: htmlFromText(text),
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
        claim_code: null,
      };

      const subj = subject(step, sample);
      const text = body(step, sample);
      await brevoSend(apiKeySelf, to, subj, text);
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
      // The preview is the email, character for character — not a rendering of
      // it, not a strip of it.
      const text = body(step, c);
      previews.push({ chapter: c.chapter_name, to: c.email, subject: subj, text });
      if (!live) continue;

      try {
        await brevoSend(apiKey!, c.email, subj, text);
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

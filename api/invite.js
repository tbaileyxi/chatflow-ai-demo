// Server-rendered link preview for room invites: /i/<code>
//
// WHY THIS EXISTS
// The app already mints a room invite code and shares
// https://www.sidehuddlesports.com/i/<code> — from inside a room
// (PullInFriendsModal) and from Home's Invite action, which are the same code
// and the same URL. HomeScreen even passes `message` and `url` separately to
// Share so iMessage will build a preview card.
//
// That card was always the generic one. This site is a Vite SPA behind a
// catch-all rewrite to /index.html, and react-helmet-async sets its tags in
// the browser. iMessage, Twitter, Slack and Facebook crawlers do not run
// JavaScript — they read the static index.html and stop. So InviteCodePage's
// title and HuddleInvitePage's full og: block have never been seen by a
// crawler, and every invite anyone has ever sent unfurled as
// "Side Huddle — A room for you and your friends".
//
// This function sits in front of /i/<code>, looks the room up server-side, and
// returns the SAME index.html with real og: tags swapped in. Crawlers get the
// room. Browsers get the normal SPA, which routes to InviteCodePage exactly as
// before. Nothing about the app or the existing page changes.

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://dejuwyeypiggvlyfliap.supabase.co';

// The publishable anon key. Identical to the one already compiled into the
// browser bundle (src/integrations/supabase/client.ts) and into every copy of
// the iOS app, so putting it here exposes nothing new. get_invite_preview is
// SECURITY DEFINER and granted to anon precisely so an unauthenticated visitor
// can see this much and no more: room name, member count, who invited them.
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0';

const SITE = 'https://www.sidehuddlesports.com';

// Kept in step with src/lib/appStore.ts. A serverless function cannot import
// from the Vite source tree, so this is the one duplicated constant.
const APP_STORE_URL = 'https://apps.apple.com/us/app/id6777524558';

// A real PNG on our own domain, measured, so the dimensions below are true.
// SVG is not a safe og:image — iMessage and Twitter will not render one, which
// is why public/og-invite.svg (pointed at by HuddleInvitePage) has never shown
// a picture anywhere it was shared.
const FALLBACK_IMAGE = {
  url: `${SITE}/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png`,
  type: 'image/png',
  width: 1024,
  height: 1024,
};

const GENERIC_TITLE = 'Side Huddle';
const GENERIC_DESC = "A room for you and your friends, and the game you're all watching.";

/** Invite codes come from gen_random_uuid-ish minting; keep the shape tight. */
const CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Room name, member count and inviter — or null for a bad or expired code. */
async function loadPreview(code) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_invite_preview`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ p_invite_code: code }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const row = Array.isArray(data) ? data[0] : data;
  return row && row.huddle_name ? row : null;
}

/**
 * The room's own photo, served off our domain rather than the storage bucket
 * — vercel.json already proxies /room-photo/* there, so the card and the site
 * come from one host.
 */
function roomImage(preview) {
  const raw = preview && preview.room_photo_url;
  if (!raw) return null;
  const marker = '/room-photos/';
  const at = String(raw).indexOf(marker);
  if (at === -1) return /^https:\/\//.test(raw) ? { url: String(raw) } : null;
  return { url: `${SITE}/room-photo/${String(raw).slice(at + marker.length)}` };
}

/** "Sat 12:00 PM ET" — the card has no idea where the reader is, so say ET. */
function kickoff(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  try {
    return (
      new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
      }).format(new Date(t)) + ' ET'
    );
  } catch {
    return null;
  }
}

/**
 * The fixture, phrased for whichever half of the day it is: a score while it
 * is being played, the matchup and the time before it starts. A game that has
 * finished says nothing — an invite to a room whose game is over should not
 * lead with the thing you already missed.
 */
function gameLine(p) {
  const status = String(p.game_status || '').toLowerCase();
  const home = p.home_team || p.home_short;
  const away = p.away_team || p.away_short;
  if (!home || !away) return null;

  if (status === 'in_progress') {
    const hs = Number(p.home_score);
    const as = Number(p.away_score);
    if (Number.isFinite(hs) && Number.isFinite(as)) {
      return `Live: ${p.away_short || away} ${as}, ${p.home_short || home} ${hs}`;
    }
    return `${away} at ${home}, live now`;
  }
  if (['final', 'completed', 'closed'].includes(status)) return null;

  const when = kickoff(p.game_start);
  return when ? `${away} at ${home}, ${when}` : `${away} at ${home}`;
}

/**
 * The two lines that land in the text thread. Title is the bold one, so it is
 * the room — that is the thing the recipient recognises. The message the
 * sender types ("Jump into The Boys on Side Huddle.") sits above the card
 * already, so repeating a verb here would read twice.
 *
 * The description leads with the game, because that is the part someone who
 * has never heard of this app understands immediately.
 */
function cardText(preview) {
  if (!preview) return { title: GENERIC_TITLE, desc: GENERIC_DESC };

  const room = String(preview.huddle_name).trim() || GENERIC_TITLE;
  const who = (preview.inviter_name || '').trim();
  const n = Number(preview.member_count) || 0;

  const parts = [
    gameLine(preview),
    who ? `${who} saved you a seat` : 'A friend saved you a seat',
    n > 1 ? `${n} in the room` : null,
  ].filter(Boolean);

  return { title: room, desc: `${parts.join(' · ')}.` };
}

/**
 * Strip the tags index.html ships with and put ours in their place. Leaving
 * both sets in is not safe: crawlers differ on whether first or last wins.
 */
function injectTags(html, tags) {
  const stripped = html
    .replace(/<title>[\s\S]*?<\/title>\s*/gi, '')
    .replace(/<meta\s+[^>]*property=["']og:[^"']*["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+[^>]*name=["']twitter:[^"']*["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+[^>]*name=["']description["'][^>]*>\s*/gi, '');

  return stripped.replace(/<head([^>]*)>/i, `<head$1>\n${tags}`);
}

function buildTags({ title, desc, url, image }) {
  const lines = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta property="og:site_name" content="Side Huddle">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(image.url)}">`,
    `<meta property="og:image:secure_url" content="${esc(image.url)}">`,
    `<meta property="og:image:alt" content="${esc(title)}">`,
  ];

  // Declare size and type ONLY for the image we ship and have measured. A room
  // photo is whatever the person uploaded — any shape, jpg or png — and
  // announcing dimensions we do not know makes crawlers lay out a box the
  // picture does not fill.
  if (image.type) lines.push(`<meta property="og:image:type" content="${esc(image.type)}">`);
  if (image.width && image.height) {
    lines.push(`<meta property="og:image:width" content="${image.width}">`);
    lines.push(`<meta property="og:image:height" content="${image.height}">`);
  }

  lines.push(
    // summary_large_image on a square crops to a band rather than shrinking to
    // a thumbnail, which is still the bigger, more tappable card.
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:site" content="@sidehuddlesports">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${esc(image.url)}">`,
  );

  return lines.map((line) => `    ${line}`).join('\n');
}

/**
 * The shell the SPA boots from, fetched off this same deployment.
 *
 * The 200 is not enough on its own. A preview deployment sits behind Vercel's
 * SSO, which answers an unauthenticated fetch with its own login page at
 * status 200 — and injecting our tags into THAT would serve a card attached to
 * Vercel's markup. So the body has to actually look like our app before we
 * will touch it.
 */
async function loadShell(req) {
  const host =
    req.headers['x-forwarded-host'] || req.headers.host || 'www.sidehuddlesports.com';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const res = await fetch(`${proto}://${host}/index.html`, {
    headers: { 'user-agent': 'side-huddle-og' },
  });
  if (!res.ok) throw new Error(`shell ${res.status}`);
  const html = await res.text();
  if (!/<div\s+id=["']root["']/i.test(html)) throw new Error('shell is not our app');
  return html;
}

/**
 * If the shell cannot be fetched, the card still has to be right and the page
 * still has to go somewhere.
 *
 * It must NOT redirect. /i/<code> is this function — sending the browser back
 * to it, with or without a cache-busting query, lands here again and loops
 * forever. A query string does not change which route matched. So this is a
 * real, final page: the two buttons InviteCodePage offers, and nothing that
 * navigates on its own.
 */
function standalone({ title, desc, url, image }, code) {
  const deep = `sidehuddle://i/${encodeURIComponent(code || '')}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
${buildTags({ title, desc, url, image })}
    <style>
      body { margin:0; min-height:100vh; display:flex; flex-direction:column;
             align-items:center; justify-content:center; gap:14px; padding:24px;
             background:#0A0A0B; color:#F0F0F2; text-align:center;
             font-family:system-ui,-apple-system,sans-serif; }
      h1 { margin:0; font-size:26px; }
      p { margin:0; max-width:24rem; color:#A0A0A8; line-height:1.5; }
      a { display:block; width:100%; max-width:18rem; box-sizing:border-box;
          padding:14px 20px; border-radius:999px; font-weight:700;
          text-decoration:none; }
      .go { background:#F5C518; color:#0A0A0B; }
      .get { border:1px solid #2A2A2F; color:#F0F0F2; }
    </style>
  </head>
  <body>
    <h1>${esc(title)}</h1>
    <p>${esc(desc)}</p>
    <a class="go" href="${esc(deep)}">Open in the app</a>
    <a class="get" href="${esc(APP_STORE_URL)}">Get Side Huddle</a>
  </body>
</html>`;
}

export default async function handler(req, res) {
  const raw = req.query?.code;
  const code = Array.isArray(raw) ? raw[0] : raw;
  const url = `${SITE}/i/${encodeURIComponent(code || '')}`;

  let preview = null;
  if (code && CODE_RE.test(code)) {
    try {
      preview = await loadPreview(code);
    } catch {
      // A room we cannot read still gets a page, just a generic card.
    }
  }

  const { title, desc } = cardText(preview);
  const card = { title, desc, url, image: roomImage(preview) || FALLBACK_IMAGE };

  let body;
  try {
    body = injectTags(await loadShell(req), buildTags(card));
  } catch {
    body = standalone(card, code);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Crawlers re-fetch; the room name barely changes. Short edge cache keeps
  // the RPC quiet without the card going stale for long.
  res.setHeader(
    'Cache-Control',
    preview
      ? 'public, s-maxage=300, stale-while-revalidate=3600'
      : 'public, s-maxage=30, stale-while-revalidate=300',
  );
  res.status(200).send(body);
}

// ============================================================
// Side Huddle OG Preview Proxy — Cloudflare Worker
// ============================================================
// Paste this entire file into your Cloudflare Worker editor.
//
// What it does:
//   1. Receives requests like /message/<id>?v=<cachebuster>
//   2. Calls your Supabase og-message edge function with raw=1
//   3. Returns the HTML with correct Content-Type: text/html
//   4. iMessage (and other crawlers) can now parse OG tags!
// ============================================================

const SUPABASE_OG_FUNCTION =
  'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/og-message';

const SITE_URL = 'https://sidehuddlesports.com';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    // Extract message ID from path: /message/<id>
    const match = url.pathname.match(/^\/message\/([a-f0-9-]+)$/i);
    if (!match) {
      // Not a message URL — redirect to main site
      return Response.redirect(SITE_URL, 302);
    }

    const messageId = match[1];
    const cacheBuster = url.searchParams.get('v') || '';

    // Build the Supabase function URL with raw=1
    const supabaseUrl = `${SUPABASE_OG_FUNCTION}?id=${messageId}&raw=1&u=${encodeURIComponent(SITE_URL + '/message/' + messageId)}`;

    try {
      // Fetch OG HTML from Supabase edge function
      const response = await fetch(supabaseUrl, {
        headers: {
          'User-Agent': 'SideHuddleOGProxy/1.0',
        },
      });

      if (!response.ok) {
        // Fallback: redirect to the actual page
        return Response.redirect(`${SITE_URL}/message/${messageId}`, 302);
      }

      const html = await response.text();

      // Return with correct Content-Type — this is the whole point!
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'X-Content-Type-Options': 'nosniff',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      // On error, redirect to the actual page
      return Response.redirect(`${SITE_URL}/message/${messageId}`, 302);
    }
  },
};

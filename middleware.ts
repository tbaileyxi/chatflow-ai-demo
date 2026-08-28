// Serve link previews from OUR edge, with our own headers.
//
// The bug this fixes, and how it was finally pinned down: an identical static
// HTML page at /preview-test.html previewed perfectly in iMessage, while
// /i/<code> — same tags, same image, same content-type, complete and valid
// markup — rendered as "Text Document · 2 KB". The difference was never the
// HTML. It was the delivery.
//
// /i/ was a Vercel rewrite onto a Supabase Edge Function, and Supabase sits
// behind Cloudflare, so every response came back carrying
// `set-cookie: __cf_bm=…` plus sb-* and cf-* headers. Apple's LinkPresentation
// will not build a rich card from that. Response time was fine (0.4-0.8s), so
// it was not a timeout.
//
// This fetches the same function and returns a NEW Response with only the
// headers a preview needs. Same job the cloudflare-worker/og-proxy.js in this
// repo was written to do for shared messages.
//
// Only crawlers get here. A person opening the link falls straight through to
// the app, so invites still work and Universal Links are untouched.

const OG = "https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/og-preview";

const CRAWLER =
  /(facebookexternalhit|Facebot|Twitterbot|Slackbot|WhatsApp|Discordbot|LinkedInBot|TelegramBot|Applebot|redditbot|Iframely|SkypeUriPreview|Googlebot|bingbot|Pinterest|vkShare)/i;

export const config = {
  matcher: ["/i/:path*", "/h/:path*", "/t/:path*"],
};

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const ua = request.headers.get("user-agent") ?? "";
  if (!CRAWLER.test(ua)) return; // humans get the app, untouched

  const invite = url.pathname.match(/^\/i\/([^/]+)/)?.[1];
  const room = url.pathname.match(/^\/h\/([^/]+)/)?.[1];
  const team = url.pathname.match(/^\/t\/([^/]+)/)?.[1];

  const q = invite
    ? `invite=${encodeURIComponent(invite)}`
    : room
      ? `room=${encodeURIComponent(room)}`
      : team
        ? `team=${encodeURIComponent(team)}`
        : "";

  const upstream = await fetch(`${OG}?${q}`, {
    headers: { accept: "text/html" },
  });
  const html = await upstream.text();

  // A deliberately short header list. Everything the upstream sent — the
  // Cloudflare cookie above all — is dropped rather than forwarded.
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
    },
  });
}

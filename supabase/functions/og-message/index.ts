import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

// Social crawler User-Agent patterns (kept for logging/diagnostics)
const CRAWLER_PATTERNS = [
  'Twitterbot',
  'facebookexternalhit',
  'Facebot',
  'LinkedInBot',
  'Slackbot',
  'Discordbot',
  'TelegramBot',
  'WhatsApp',
  'Googlebot',
  'bingbot',
  'Applebot',
  'Apple-Messages',
  'CFNetwork', // iOS URL preview fetcher (often iMessage)
  'com.apple.WebKit', // Apple WebKit networking
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEFAULT_OG_IMAGE = 'https://sidehuddlesports.com/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png';
const SITE_URL = 'https://sidehuddlesports.com';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const messageId = url.searchParams.get('id');

    if (!messageId) {
      return new Response('Missing message ID', { status: 400, headers: corsHeaders });
    }

    const userAgent = req.headers.get('user-agent') || '';
    const isLikelyCrawler =
      CRAWLER_PATTERNS.some((pattern) => userAgent.toLowerCase().includes(pattern.toLowerCase())) ||
      userAgent.includes('bot') ||
      userAgent.includes('Bot') ||
      userAgent.toLowerCase().includes('preview');

    // Destination URL for human click-through (passed from the app)
    const destinationUrl =
      normalizeDestinationUrl(url.searchParams.get('u')) || `${SITE_URL}/message/${messageId}`;

    console.log(
      `[og-message] Request for message ${messageId}, UA: ${userAgent.slice(0, 100)}, likelyCrawler: ${isLikelyCrawler}, dest: ${destinationUrl}`,
    );

    // Always return OG-rich HTML (with minimal body + JS redirect).
    // This makes iMessage previews reliable even when the preview fetcher uses a "normal" Safari-like UA.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch message
    const { data: message, error: messageError } = await supabase
      .from('huddle_messages')
      .select('id, content, media_url, media_type, user_id, huddle_id, created_at')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      console.log(`[og-message] Message not found: ${messageId}`);
      return generateOgHtml({
        title: 'Post from Side Huddle',
        description: 'Join the conversation on Side Huddle',
        image: DEFAULT_OG_IMAGE,
        url: destinationUrl,
      });
    }

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, username, avatar_url')
      .eq('user_id', message.user_id)
      .single();

    // Fetch huddle
    const { data: huddle } = await supabase
      .from('huddles')
      .select('name, team_id')
      .eq('id', message.huddle_id)
      .single();

    // Fetch team logo if available
    let teamLogo: string | null = null;
    if (huddle?.team_id) {
      const { data: team } = await supabase
        .from('teams')
        .select('logo_url')
        .eq('id', huddle.team_id)
        .single();
      teamLogo = team?.logo_url || null;
    }

    const username = profile?.username || profile?.display_name || 'fan';
    const huddleName = huddle?.name || 'Side Huddle';

    const title = 'Post from Side Huddle';
    const description = message.content
      ? String(message.content).slice(0, 160)
      : `@${username} in ${huddleName}`;

    const safeMessageImage = isShareableImageUrl(message.media_url, message.media_type)
      ? message.media_url
      : null;

    const image = safeMessageImage || teamLogo || DEFAULT_OG_IMAGE;

    console.log(`[og-message] Serving OG for message ${messageId}: ${title}, image: ${image}`);

    return generateOgHtml({
      title,
      description,
      image,
      url: destinationUrl,
    });
  } catch (error) {
    console.error('[og-message] Error:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
});

function normalizeDestinationUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);

    // Prevent open-redirect abuse: only allow our known domains.
    const allowedRoots = ['sidehuddlesports.com', 'lovable.app', 'lovable.dev'];
    const hostOk = allowedRoots.some(
      (root) => parsed.hostname === root || parsed.hostname.endsWith(`.${root}`),
    );

    if (parsed.protocol !== 'https:' || !hostOk) return null;

    return parsed.toString();
  } catch {
    return null;
  }
}

function isShareableImageUrl(url: string | null, mediaType: string | null): url is string {
  if (!url) return false;
  if (mediaType && mediaType !== 'image') return false;

  // Basic heuristic: common image extensions or image transforms.
  return /\.(png|jpe?g|gif|webp)(\?|#|$)/i.test(url);
}

function generateOgHtml(meta: {
  title: string;
  description: string;
  image: string;
  url: string;
}): Response {
  // Minimal HTML with proper OG tags for social previews.
  // Keep the <body> extremely small so iMessage doesn't show raw "document text" previews.
  const safeUrl = escapeHtml(meta.url);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(meta.title)}</title>
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(meta.title)}">
<meta property="og:description" content="${escapeHtml(meta.description)}">
<meta property="og:image" content="${escapeHtml(meta.image)}">
<meta property="og:image:secure_url" content="${escapeHtml(meta.image)}">
<meta property="og:url" content="${safeUrl}">
<meta property="og:site_name" content="Side Huddle">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(meta.title)}">
<meta name="twitter:description" content="${escapeHtml(meta.description)}">
<meta name="twitter:image" content="${escapeHtml(meta.image)}">
<link rel="canonical" href="${safeUrl}">
</head>
<body>
<a href="${safeUrl}">Open post</a>
<script>window.location.replace("${safeUrl}");</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

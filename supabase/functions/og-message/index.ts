import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

// Social crawler User-Agent patterns (comprehensive for Apple/iMessage)
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
  'MobileSafari',
  'CFNetwork', // iOS URL preview fetcher
  'com.apple.WebKit', // Apple WebKit
];

const DEFAULT_OG_IMAGE = 'https://sidehuddlesports.com/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png';
const SITE_URL = 'https://sidehuddlesports.com';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  try {
    const url = new URL(req.url);
    const messageId = url.searchParams.get('id');

    if (!messageId) {
      return new Response('Missing message ID', { status: 400 });
    }

    const userAgent = req.headers.get('user-agent') || '';
    
    // More aggressive crawler detection - if it looks like any bot, serve OG tags
    const isCrawler = CRAWLER_PATTERNS.some(pattern => 
      userAgent.toLowerCase().includes(pattern.toLowerCase())
    ) || userAgent.includes('bot') || userAgent.includes('Bot') || userAgent.includes('preview');

    console.log(`[og-message] Request for message ${messageId}, UA: ${userAgent.slice(0, 100)}, isCrawler: ${isCrawler}`);

    // For regular browsers, redirect to the SPA
    if (!isCrawler) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${SITE_URL}/message/${messageId}`,
        },
      });
    }

    // For crawlers, fetch data and return OG-rich HTML
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch message
    const { data: message, error: messageError } = await supabase
      .from('huddle_messages')
      .select('id, content, media_url, user_id, huddle_id, created_at')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      console.log(`[og-message] Message not found: ${messageId}`);
      return generateOgHtml({
        title: 'Post from Side Huddle',
        description: 'Join the conversation on Side Huddle',
        image: DEFAULT_OG_IMAGE,
        url: `${SITE_URL}/message/${messageId}`,
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
    
    // Cleaner title format
    const title = `Post from Side Huddle`;
    const description = message.content ? message.content.slice(0, 160) : `@${username} in ${huddleName}`;
    const image = message.media_url || teamLogo || DEFAULT_OG_IMAGE;

    console.log(`[og-message] Serving OG for message ${messageId}: ${title}, image: ${image}`);

    return generateOgHtml({
      title,
      description,
      image,
      url: `${SITE_URL}/message/${messageId}`,
    });

  } catch (error) {
    console.error('[og-message] Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});

function generateOgHtml(meta: {
  title: string;
  description: string;
  image: string;
  url: string;
}): Response {
  // Minimal HTML with proper OG tags for social previews
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
<meta property="og:url" content="${escapeHtml(meta.url)}">
<meta property="og:site_name" content="Side Huddle">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(meta.title)}">
<meta name="twitter:description" content="${escapeHtml(meta.description)}">
<meta name="twitter:image" content="${escapeHtml(meta.image)}">
<link rel="canonical" href="${escapeHtml(meta.url)}">
</head>
<body>
<script>window.location.replace("${escapeHtml(meta.url)}");</script>
<noscript><meta http-equiv="refresh" content="0;url=${escapeHtml(meta.url)}"></noscript>
<p>Redirecting to <a href="${escapeHtml(meta.url)}">Side Huddle</a>...</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
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

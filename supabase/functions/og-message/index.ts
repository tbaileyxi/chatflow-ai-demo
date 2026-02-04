import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Social crawler User-Agent patterns
const CRAWLER_PATTERNS = [
  'Twitterbot',
  'facebookexternalhit',
  'LinkedInBot',
  'Slackbot',
  'Discordbot',
  'TelegramBot',
  'WhatsApp',
  'Googlebot',
  'bingbot',
  'iMessage',
  'Applebot',
];

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
    const isCrawler = CRAWLER_PATTERNS.some(pattern => 
      userAgent.toLowerCase().includes(pattern.toLowerCase())
    );

    console.log(`[og-message] Request for message ${messageId}, UA: ${userAgent.slice(0, 100)}, isCrawler: ${isCrawler}`);

    // For regular browsers, redirect to the SPA
    if (!isCrawler) {
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
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
        title: 'Side Huddle',
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
    const huddleName = huddle?.name || 'a Huddle';
    const title = `@${username} in ${huddleName}`;
    const description = message.content.slice(0, 160);
    const image = message.media_url || teamLogo || DEFAULT_OG_IMAGE;

    console.log(`[og-message] Serving OG for message ${messageId}: ${title}`);

    return generateOgHtml({
      title,
      description,
      image,
      url: `${SITE_URL}/message/${messageId}`,
    });

  } catch (error) {
    console.error('[og-message] Error:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
});

function generateOgHtml(meta: {
  title: string;
  description: string;
  image: string;
  url: string;
}): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(meta.title)} | Side Huddle</title>
  
  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(meta.title)}" />
  <meta property="og:description" content="${escapeHtml(meta.description)}" />
  <meta property="og:image" content="${escapeHtml(meta.image)}" />
  <meta property="og:url" content="${escapeHtml(meta.url)}" />
  <meta property="og:site_name" content="Side Huddle" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
  <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
  <meta name="twitter:image" content="${escapeHtml(meta.image)}" />
  
  <!-- Redirect for browsers that somehow get here -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(meta.url)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(meta.url)}">${escapeHtml(meta.title)}</a>...</p>
  <script>window.location.href = "${escapeHtml(meta.url)}";</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
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

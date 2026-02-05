import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEFAULT_OG_IMAGE = 'https://sidehuddlesports.com/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png';
const SITE_URL = 'https://sidehuddlesports.com';
const SUPABASE_PROJECT_REF = 'dejuwyeypiggvlyfliap';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const messageId = url.searchParams.get('id');
    const cacheBuster = url.searchParams.get('v') || Date.now().toString();

    if (!messageId) {
      return new Response('Missing message ID', { status: 400, headers: corsHeaders });
    }

    const userAgent = req.headers.get('user-agent') || '';
    const destinationUrl =
      normalizeDestinationUrl(url.searchParams.get('u')) || `${SITE_URL}/message/${messageId}`;

    console.log(`[og-message] Request for message ${messageId}, UA: ${userAgent.slice(0, 100)}, dest: ${destinationUrl}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch message
    const { data: message, error: messageError } = await supabase
      .from('huddle_messages')
      .select('id, content, media_url, media_type, user_id, huddle_id, created_at')
      .eq('id', messageId)
      .single();

    let title = 'Post from Side Huddle';
    let description = 'Join the conversation on Side Huddle';
    let image = DEFAULT_OG_IMAGE;

    if (!messageError && message) {
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

      const username = profile?.username || profile?.display_name || 'fan';
      const huddleName = huddle?.name || 'Side Huddle';

      description = message.content
        ? decodeHtmlEntities(String(message.content)).slice(0, 160)
        : `@${username} in ${huddleName}`;

      // Use our image proxy for reliable OG images
      const hasShareableImage = isShareableImageUrl(decodeHtmlEntities(message.media_url), message.media_type);
      image = hasShareableImage
        ? `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/og-message-image?id=${messageId}`
        : DEFAULT_OG_IMAGE;
    }

    console.log(`[og-message] Generating OG for message ${messageId}: ${title}, image: ${image}`);

    // Generate the HTML content
    const html = generateOgHtml({
      title,
      description,
      image,
      url: destinationUrl,
    });

    // Convert HTML string to Uint8Array for proper binary upload
    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(html);

    // Upload to storage bucket as binary with proper content type
    const storagePath = `message/${messageId}.html`;
    const { error: uploadError } = await supabase.storage
      .from('og-pages')
      .upload(storagePath, htmlBytes, {
        contentType: 'text/html; charset=utf-8',
        upsert: true,
        cacheControl: '300',
      });

    if (uploadError) {
      console.error(`[og-message] Failed to upload to storage: ${uploadError.message}`);
      // Fallback: return HTML directly (may not work for iMessage but better than nothing)
      const headers = new Headers();
      headers.set('content-type', 'text/html; charset=utf-8');
      headers.set('cache-control', 'public, max-age=300');
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      return new Response(html, { status: 200, headers });
    }

    // Get public URL and redirect
    const storageUrl = `https://${SUPABASE_PROJECT_REF}.supabase.co/storage/v1/object/public/og-pages/${storagePath}?v=${cacheBuster}`;
    
    console.log(`[og-message] Redirecting to storage: ${storageUrl}`);

    // Return 302 redirect
    return Response.redirect(storageUrl, 302);
  } catch (error) {
    console.error('[og-message] Error:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
});

function normalizeDestinationUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
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

function decodeHtmlEntities(text: string | null): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function isShareableImageUrl(url: string | null, mediaType: string | null): boolean {
  if (!url) return false;
  if (mediaType && mediaType !== 'image') return false;
  return /\.(png|jpe?g|gif|webp)(\?|#|$)/i.test(url) || 
         url.includes('preview.redd.it') ||
         url.includes('i.redd.it') ||
         url.includes('supabase.co/storage');
}

function generateOgHtml(meta: {
  title: string;
  description: string;
  image: string;
  url: string;
}): string {
  const safeUrl = escapeHtml(meta.url);
  const safeTitle = escapeHtml(meta.title);
  const safeDescription = escapeHtml(meta.description);
  const safeImage = escapeHtml(meta.image);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<meta property="og:type" content="website">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:image" content="${safeImage}">
<meta property="og:image:secure_url" content="${safeImage}">
<meta property="og:url" content="${safeUrl}">
<meta property="og:site_name" content="Side Huddle">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${safeImage}">
<link rel="canonical" href="${safeUrl}">
<meta http-equiv="refresh" content="0;url=${safeUrl}">
</head>
<body>
<a href="${safeUrl}">Open post</a>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

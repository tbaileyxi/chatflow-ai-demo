import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_OG_IMAGE = 'https://sidehuddlesports.com/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const messageId = url.searchParams.get('id');

    if (!messageId) {
      return redirectToDefault();
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch message
    const { data: message, error: messageError } = await supabase
      .from('huddle_messages')
      .select('id, media_url, media_type, huddle_id')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      console.log(`[og-message-image] Message not found: ${messageId}`);
      return redirectToDefault();
    }

    // Decode HTML entities in media_url
    let imageUrl = decodeHtmlEntities(message.media_url);

    // Check if it's a valid image URL
    if (!imageUrl || !isImageUrl(imageUrl, message.media_type)) {
      // Try to get team logo as fallback
      const { data: huddle } = await supabase
        .from('huddles')
        .select('team_id')
        .eq('id', message.huddle_id)
        .single();

      if (huddle?.team_id) {
        const { data: team } = await supabase
          .from('teams')
          .select('logo_url')
          .eq('id', huddle.team_id)
          .single();

        if (team?.logo_url) {
          imageUrl = team.logo_url;
        }
      }

      if (!imageUrl || !isImageUrl(imageUrl, null)) {
        return redirectToDefault();
      }
    }

    console.log(`[og-message-image] Proxying image for message ${messageId}: ${imageUrl}`);

    // Fetch the image
    const imageResponse = await fetch(imageUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SideHuddleBot/1.0)',
        'Accept': 'image/*',
      },
    });

    if (!imageResponse.ok) {
      console.error(`[og-message-image] Failed to fetch image: ${imageResponse.status}`);
      return redirectToDefault();
    }

    // Get content type from response or infer from URL
    let contentType = imageResponse.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      contentType = inferContentType(imageUrl);
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    const headers = new Headers();
    headers.set('content-type', contentType);
    headers.set('cache-control', 'public, max-age=86400');
    headers.set('x-content-type-options', 'nosniff');
    Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));

    return new Response(imageBuffer, { status: 200, headers });
  } catch (error) {
    console.error('[og-message-image] Error:', error);
    return redirectToDefault();
  }
});

function redirectToDefault(): Response {
  return Response.redirect(DEFAULT_OG_IMAGE, 302);
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

function isImageUrl(url: string, mediaType: string | null): boolean {
  if (!url) return false;
  if (mediaType && mediaType !== 'image') return false;
  
  // Check for common image patterns
  return /\.(png|jpe?g|gif|webp)(\?|#|$)/i.test(url) || 
         url.includes('preview.redd.it') ||
         url.includes('i.redd.it') ||
         url.includes('supabase.co/storage') ||
         url.includes('imgur.com');
}

function inferContentType(url: string): string {
  const lowered = url.toLowerCase();
  if (lowered.includes('.png')) return 'image/png';
  if (lowered.includes('.gif')) return 'image/gif';
  if (lowered.includes('.webp')) return 'image/webp';
  // Default to JPEG for everything else
  return 'image/jpeg';
}

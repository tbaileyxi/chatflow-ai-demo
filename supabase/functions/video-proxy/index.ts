import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const videoUrl = url.searchParams.get('url');
    
    console.log('[video-proxy] Request for video URL:', videoUrl);

    // Validate URL
    if (!videoUrl) {
      console.error('[video-proxy] No URL parameter provided');
      return new Response('Missing URL parameter', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Only allow ESPN CDN URLs for security
    if (!videoUrl.includes('espn.com') && !videoUrl.includes('video-cdn.espn.com')) {
      console.error('[video-proxy] Invalid URL domain:', videoUrl);
      return new Response('Invalid video URL - only ESPN videos are supported', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    console.log('[video-proxy] Fetching video from ESPN CDN...');

    // Fetch video from ESPN with proper headers to bypass referrer checks
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.espn.com/',
        'Origin': 'https://www.espn.com'
      }
    });

    if (!response.ok) {
      console.error('[video-proxy] Failed to fetch video:', response.status, response.statusText);
      return new Response(`Failed to fetch video: ${response.statusText}`, { 
        status: response.status,
        headers: corsHeaders 
      });
    }

    console.log('[video-proxy] Video fetched successfully, streaming to client...');

    // Stream the video back with proper headers
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'video/mp4',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Accept-Ranges': 'bytes', // Enable video seeking
        'Content-Length': response.headers.get('Content-Length') || '',
      }
    });
  } catch (error) {
    console.error('[video-proxy] Error:', error);
    return new Response(`Video proxy error: ${error.message}`, { 
      status: 502,
      headers: corsHeaders 
    });
  }
});

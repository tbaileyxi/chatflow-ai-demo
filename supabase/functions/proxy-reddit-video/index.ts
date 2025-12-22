import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const videoUrl = url.searchParams.get('url');

    if (!videoUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate it's a Reddit video URL
    if (!videoUrl.includes('v.redd.it') && !videoUrl.includes('reddit.com')) {
      return new Response(JSON.stringify({ error: 'Invalid video URL - must be Reddit' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[proxy-reddit-video] Incoming request`, {
      videoUrl,
      method: req.method,
      range: req.headers.get('Range') || null,
    });

    // Build headers for the upstream request (Reddit is strict; mimic a real browser)
    const upstreamHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.reddit.com/',
      'Origin': 'https://www.reddit.com',
      'DNT': '1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'video',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
    };

    // Forward range header for seeking support
    const rangeHeader = req.headers.get('Range');
    if (rangeHeader) {
      upstreamHeaders['Range'] = rangeHeader;
    }

    const tryFetch = async (targetUrl: string) => {
      const res = await fetch(targetUrl, { headers: upstreamHeaders, redirect: 'follow' });
      console.log(`[proxy-reddit-video] Upstream response`, {
        targetUrl,
        status: res.status,
        statusText: res.statusText,
        contentType: res.headers.get('Content-Type'),
        contentLength: res.headers.get('Content-Length'),
        contentRange: res.headers.get('Content-Range'),
        acceptRanges: res.headers.get('Accept-Ranges'),
      });
      return res;
    };

    let response = await tryFetch(videoUrl);

    // Retry once: Reddit sometimes 403s the ?source=fallback URL but allows the same path without query.
    if (response.status === 403 && videoUrl.includes('?')) {
      const strippedUrl = videoUrl.split('?')[0];
      console.log(`[proxy-reddit-video] 403 from Reddit; retrying without query`, { strippedUrl });
      response = await tryFetch(strippedUrl);
    }

    if (!response.ok) {
      console.error(`[proxy-reddit-video] Failed upstream fetch`, {
        status: response.status,
        statusText: response.statusText,
      });
      return new Response(
        JSON.stringify({
          error: `Failed to fetch video: ${response.status}`,
          status: response.status,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Build response headers
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': response.headers.get('Content-Type') || 'video/mp4',
      'Cache-Control': 'public, max-age=31536000',
      // Force range support for the browser video element
      'Accept-Ranges': 'bytes',
    };

    // Forward important upstream headers (helps playback + seeking)
    const contentLength = response.headers.get('Content-Length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;

    const contentRange = response.headers.get('Content-Range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;

    const etag = response.headers.get('ETag');
    if (etag) responseHeaders['ETag'] = etag;

    const lastModified = response.headers.get('Last-Modified');
    if (lastModified) responseHeaders['Last-Modified'] = lastModified;

    console.log(`[proxy-reddit-video] Streaming response`, {
      status: response.status,
      contentType: responseHeaders['Content-Type'],
      contentLength: responseHeaders['Content-Length'] || null,
      contentRange: responseHeaders['Content-Range'] || null,
    });

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

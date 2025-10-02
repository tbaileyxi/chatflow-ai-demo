/**
 * Utility functions for detecting and parsing embeds
 */

export interface ParsedEmbed {
  type: 'x' | 'iframe' | 'youtube' | 'unknown';
  url?: string;
  tweetId?: string;
  username?: string;
  rawCode: string;
}

/**
 * Detect if embed code is an X/Twitter embed
 */
export const isXEmbed = (embedCode: string): boolean => {
  if (!embedCode) return false;
  return (
    /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\//.test(embedCode) ||
    /twitter-tweet/.test(embedCode) ||
    /platform\.twitter\.com\/widgets/.test(embedCode)
  );
};

/**
 * Extract tweet ID and username from X embed code
 */
export const parseXEmbed = (embedCode: string): { tweetId: string; username: string } | null => {
  if (!embedCode || typeof embedCode !== 'string') {
    return null;
  }

  // Clean input - remove quotes, whitespace, newlines
  const cleaned = embedCode.trim().replace(/^["'`]|["'`]$/g, '').replace(/\n/g, '');
  
  // Pattern 1: Direct URL - https://twitter.com/user/status/123 or https://x.com/user/status/123
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/i;
  const urlMatch = cleaned.match(urlPattern);
  
  if (urlMatch) {
    console.log('[parseXEmbed] ✅ Parsed URL:', { username: urlMatch[1], tweetId: urlMatch[2] });
    return {
      username: urlMatch[1],
      tweetId: urlMatch[2]
    };
  }

  // Pattern 2: Blockquote HTML - <blockquote class="twitter-tweet">...</blockquote>
  const blockquotePattern = /<blockquote[^>]*class="twitter-tweet"[^>]*>.*?href="https?:\/\/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/is;
  const blockquoteMatch = cleaned.match(blockquotePattern);
  
  if (blockquoteMatch) {
    console.log('[parseXEmbed] ✅ Parsed blockquote:', { username: blockquoteMatch[1], tweetId: blockquoteMatch[2] });
    return {
      username: blockquoteMatch[1],
      tweetId: blockquoteMatch[2]
    };
  }

  console.warn('[parseXEmbed] ❌ Failed to parse:', cleaned.substring(0, 100));
  return null;
};

/**
 * Detect if embed is YouTube
 */
export const isYouTubeEmbed = (embedCode: string): boolean => {
  if (!embedCode) return false;
  return /(?:youtube\.com|youtu\.be)/.test(embedCode);
};

/**
 * Detect if embed is generic iframe
 */
export const isIframeEmbed = (embedCode: string): boolean => {
  if (!embedCode) return false;
  return /<iframe/i.test(embedCode);
};

/**
 * Parse embed code and return structured data
 */
export const parseEmbed = (embedCode: string): ParsedEmbed => {
  if (!embedCode) {
    return { type: 'unknown', rawCode: embedCode };
  }

  if (isXEmbed(embedCode)) {
    const parsed = parseXEmbed(embedCode);
    return {
      type: 'x',
      tweetId: parsed?.tweetId,
      username: parsed?.username,
      url: parsed ? `https://twitter.com/${parsed.username}/status/${parsed.tweetId}` : undefined,
      rawCode: embedCode
    };
  }

  if (isYouTubeEmbed(embedCode)) {
    return { type: 'youtube', rawCode: embedCode };
  }

  if (isIframeEmbed(embedCode)) {
    return { type: 'iframe', rawCode: embedCode };
  }

  return { type: 'unknown', rawCode: embedCode };
};

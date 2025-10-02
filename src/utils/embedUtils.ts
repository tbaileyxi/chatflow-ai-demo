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
 * Handles: direct URLs, blockquote HTML, script tags, x.com variants
 */
export const parseXEmbed = (embedCode: string): { tweetId: string; username: string } | null => {
  if (!embedCode || typeof embedCode !== 'string') {
    console.warn('[parseXEmbed] Invalid input:', typeof embedCode);
    return null;
  }

  // Aggressive cleaning - remove all extra characters, newlines, quotes
  const cleaned = embedCode
    .trim()
    .replace(/[\r\n\t]+/g, ' ')  // Replace newlines/tabs with spaces
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .replace(/^["'`]+|["'`]+$/g, ''); // Remove surrounding quotes

  console.log('[parseXEmbed] Cleaned input:', cleaned.substring(0, 150));

  // Pattern 1: Direct URL (most common)
  // Matches: https://twitter.com/user/status/123, https://x.com/user/status/123
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status(?:es)?\/(\d+)/i;
  const urlMatch = cleaned.match(urlPattern);
  
  if (urlMatch && urlMatch[1] && urlMatch[2]) {
    console.log('[parseXEmbed] ✅ Direct URL match:', { username: urlMatch[1], tweetId: urlMatch[2] });
    return {
      username: urlMatch[1],
      tweetId: urlMatch[2]
    };
  }

  // Pattern 2: Blockquote HTML (from database embed_code)
  // Matches: <blockquote class="twitter-tweet">...<a href="https://twitter.com/user/status/123">
  const blockquotePattern = /<blockquote[^>]*(?:class=["']twitter-tweet["']|twitter-tweet)[^>]*>.*?(?:href=["'])?(https?:\/\/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status(?:es)?\/(\d+))/is;
  const blockquoteMatch = cleaned.match(blockquotePattern);
  
  if (blockquoteMatch && blockquoteMatch[2] && blockquoteMatch[3]) {
    console.log('[parseXEmbed] ✅ Blockquote HTML match:', { username: blockquoteMatch[2], tweetId: blockquoteMatch[3] });
    return {
      username: blockquoteMatch[2],
      tweetId: blockquoteMatch[3]
    };
  }

  // Pattern 3: Script tag embed (legacy format)
  // Extract URL from script or blockquote even if malformed
  const scriptUrlPattern = /(?:https?:\/\/)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status(?:es)?\/(\d+)/i;
  const scriptMatch = cleaned.match(scriptUrlPattern);
  
  if (scriptMatch && scriptMatch[1] && scriptMatch[2]) {
    console.log('[parseXEmbed] ✅ Script/fallback match:', { username: scriptMatch[1], tweetId: scriptMatch[2] });
    return {
      username: scriptMatch[1],
      tweetId: scriptMatch[2]
    };
  }

  console.error('[parseXEmbed] ❌ All patterns failed for:', cleaned.substring(0, 200));
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

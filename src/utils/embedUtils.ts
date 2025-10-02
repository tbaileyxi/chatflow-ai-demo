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
  if (!embedCode) return null;

  let tweetId: string | null = null;
  let username: string | null = null;

  // First, try direct URL format (most common now - stored as plain URLs in DB)
  const directUrlMatch = embedCode.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(?:@)?(\w+)\/status\/(\d+)/);
  if (directUrlMatch) {
    username = directUrlMatch[1];
    tweetId = directUrlMatch[2];
    console.log('[parseXEmbed] Parsed direct URL:', { username, tweetId, embedCode });
    return { tweetId, username };
  }

  // Fallback: Try to extract from blockquote format (legacy format)
  const blockquoteMatch = embedCode.match(/<blockquote[^>]*class="twitter-tweet"[^>]*>(.*?)<\/blockquote>/is);
  if (blockquoteMatch) {
    const urlMatch = embedCode.match(/href="https:\/\/(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/i);
    if (urlMatch) {
      username = urlMatch[1];
      tweetId = urlMatch[2];
      console.log('[parseXEmbed] Parsed blockquote format:', { username, tweetId });
      return { tweetId, username };
    }
  }

  console.warn('[parseXEmbed] Failed to parse embed code:', embedCode);
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

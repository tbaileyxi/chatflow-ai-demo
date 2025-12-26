/**
 * Utility functions for Spotlight content processing
 */

/**
 * Strips URLs from content for cleaner display
 */
export function stripUrlsFromContent(content: string): string {
  // Remove markdown-style links [text](url)
  let cleaned = content.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1');
  
  // Remove plain URLs (http/https)
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
  
  // Remove reddit-style source links
  cleaned = cleaned.replace(/🔗\s*\[?Source\]?[^\n]*/gi, '');
  cleaned = cleaned.replace(/\[Source\]/gi, '');
  
  // Clean up extra whitespace and newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  
  return cleaned;
}

/**
 * Truncates text at word boundary with ellipsis
 */
export function truncateAtWordBoundary(text: string, maxLength: number): { truncated: string; wasClipped: boolean } {
  if (text.length <= maxLength) {
    return { truncated: text, wasClipped: false };
  }
  
  // Find the last space before maxLength
  let truncateIndex = maxLength;
  while (truncateIndex > 0 && text[truncateIndex] !== ' ') {
    truncateIndex--;
  }
  
  // If no space found, just cut at maxLength
  if (truncateIndex === 0) {
    truncateIndex = maxLength;
  }
  
  // Remove trailing punctuation except quotes
  let truncated = text.substring(0, truncateIndex).trimEnd();
  
  // Remove trailing incomplete punctuation (comma, etc.)
  truncated = truncated.replace(/[,;:\-]$/, '').trimEnd();
  
  return { truncated: truncated + '…', wasClipped: true };
}

/**
 * Cleans content for Spotlight display: removes double-wrapped quotes, strips URLs, normalizes whitespace
 */
export function cleanSpotlightContent(content: string): string {
  let cleaned = stripUrlsFromContent(content);
  
  // Remove emoji prefixes that are often duplicated
  cleaned = cleaned.replace(/^[🔥👀📰🏈💪🗣️📱⚡🎬📢]\s*/g, '');
  
  // Remove "From r/..." prefix if present
  cleaned = cleaned.replace(/^From r\/\w+:\s*/i, '');
  
  // Remove double-wrapped quotes (""text"" -> "text")
  cleaned = cleaned.replace(/^"+"(.*)"+$/s, '"$1"');
  
  // Clean up excessive quotes
  cleaned = cleaned.replace(/"{2,}/g, '"');
  
  return cleaned.trim();
}

/**
 * Extracts source URL from content (for Source button)
 */
export function extractSourceUrlFromContent(content: string): string | null {
  // Match markdown link to Reddit
  const markdownMatch = content.match(/\[Source\]\((https?:\/\/[^)]+)\)/i);
  if (markdownMatch) return markdownMatch[1];
  
  // Match plain Reddit URL
  const redditMatch = content.match(/(https?:\/\/(?:www\.)?reddit\.com\/r\/[^\s]+)/i);
  if (redditMatch) return redditMatch[1];
  
  // Match any URL
  const urlMatch = content.match(/(https?:\/\/[^\s]+)/);
  if (urlMatch) return urlMatch[1];
  
  return null;
}

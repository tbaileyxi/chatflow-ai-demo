/**
 * Reddit Media Utilities
 * 
 * Handles classification and validation of Reddit media to ensure
 * only genuine media content is rendered, not link preview thumbnails.
 */

export interface RedditMediaClassification {
  type: 'image' | 'video' | 'link' | 'text';
  hasGuaranteedMedia: boolean;
  isExternalLink: boolean;
  mediaUrl: string | null;
  postUrl: string | null;
}

/**
 * Checks if a URL is a genuine Reddit-hosted image (not a preview thumbnail)
 */
export function isGenuineRedditImage(url: string | undefined | null): boolean {
  if (!url) return false;
  
  const normalizedUrl = url.toLowerCase();
  
  // i.redd.it images are guaranteed genuine user-uploaded media
  if (normalizedUrl.includes('i.redd.it')) {
    return true;
  }
  
  // i.imgur.com images are also genuine
  if (normalizedUrl.includes('i.imgur.com')) {
    return true;
  }
  
  // preview.redd.it are often link preview thumbnails - NOT guaranteed media
  if (normalizedUrl.includes('preview.redd.it')) {
    return false;
  }
  
  // external.preview.redd.it is definitely a link preview
  if (normalizedUrl.includes('external.preview.redd.it')) {
    return false;
  }
  
  // Reddit static assets (logos, defaults) - not real media
  if (normalizedUrl.includes('redditstatic.com') || 
      normalizedUrl.includes('redditmedia.com') ||
      normalizedUrl.includes('default') ||
      normalizedUrl.includes('thinking-snoo')) {
    return false;
  }
  
  return false;
}

/**
 * Checks if a URL is a Reddit-hosted video with potentially valid thumbnail
 */
export function isRedditVideo(url: string | undefined | null): boolean {
  if (!url) return false;
  
  const normalizedUrl = url.toLowerCase();
  return normalizedUrl.includes('v.redd.it') || 
         (normalizedUrl.includes('reddit') && (normalizedUrl.includes('.mp4') || normalizedUrl.includes('.webm')));
}

/**
 * Checks if a thumbnail URL is a valid video thumbnail (not a generic placeholder)
 */
export function hasValidVideoThumbnail(thumbnailUrl: string | undefined | null): boolean {
  if (!thumbnailUrl) return false;
  
  const normalized = thumbnailUrl.toLowerCase();
  
  // Reject known placeholders
  if (normalized.includes('thinking-snoo') ||
      normalized.includes('redditstatic.com') ||
      normalized.includes('default') ||
      normalized.includes('nsfw') ||
      normalized.includes('spoiler') ||
      normalized.includes('self') ||
      normalized === 'self' ||
      normalized === 'default' ||
      normalized === 'nsfw' ||
      normalized === 'spoiler') {
    return false;
  }
  
  // Must be an actual image URL
  if (!normalized.startsWith('http')) {
    return false;
  }
  
  // preview.redd.it is typically valid for video thumbnails
  if (normalized.includes('preview.redd.it')) {
    return true;
  }
  
  // i.redd.it is valid
  if (normalized.includes('i.redd.it')) {
    return true;
  }
  
  return false;
}

/**
 * Checks if a post links to an external site (not Reddit-hosted content)
 */
export function isExternalLinkPost(url: string | undefined | null): boolean {
  if (!url) return false;
  
  const normalized = url.toLowerCase();
  
  // If it's Reddit-hosted content, it's not an external link
  if (normalized.includes('reddit.com') ||
      normalized.includes('redd.it') ||
      normalized.includes('i.redd.it') ||
      normalized.includes('v.redd.it')) {
    return false;
  }
  
  // Otherwise it's an external link
  return normalized.startsWith('http');
}

/**
 * Classifies Reddit media to determine how it should be rendered
 * 
 * Rules:
 * 1. Only render media container for i.redd.it images or v.redd.it videos with valid thumbnails
 * 2. Link posts with preview images should be text-only with link badge
 * 3. Never render empty or broken media containers
 */
export function classifyRedditMedia(
  mediaUrl: string | undefined | null,
  mediaType: string | undefined | null,
  embeds: any,
  postUrl: string | undefined | null
): RedditMediaClassification {
  // Check if it's a video type
  const isVideo = mediaType === 'reddit_video' || mediaType === 'video' || isRedditVideo(mediaUrl);
  
  if (isVideo) {
    // For videos, check if we have a valid thumbnail
    const thumbnail = embeds?.thumbnail || mediaUrl;
    const hasValidThumb = hasValidVideoThumbnail(thumbnail);
    
    return {
      type: 'video',
      hasGuaranteedMedia: hasValidThumb,
      isExternalLink: false,
      mediaUrl: hasValidThumb ? thumbnail : null,
      postUrl: embeds?.post_url || postUrl || null
    };
  }
  
  // Check if it's a genuine image
  if (isGenuineRedditImage(mediaUrl)) {
    return {
      type: 'image',
      hasGuaranteedMedia: true,
      isExternalLink: false,
      mediaUrl: mediaUrl,
      postUrl: postUrl || null
    };
  }
  
  // Check if it's an external link with a preview thumbnail
  if (isExternalLinkPost(postUrl)) {
    return {
      type: 'link',
      hasGuaranteedMedia: false,
      isExternalLink: true,
      mediaUrl: null, // Don't use preview thumbnails as media
      postUrl: postUrl
    };
  }
  
  // If we have a preview.redd.it URL but it's not a genuine image,
  // treat it as a link preview (not media)
  if (mediaUrl && mediaUrl.toLowerCase().includes('preview.redd.it')) {
    return {
      type: 'link',
      hasGuaranteedMedia: false,
      isExternalLink: isExternalLinkPost(postUrl),
      mediaUrl: null,
      postUrl: postUrl || null
    };
  }
  
  // Default to text-only if no valid media
  return {
    type: 'text',
    hasGuaranteedMedia: false,
    isExternalLink: false,
    mediaUrl: null,
    postUrl: postUrl || null
  };
}

/**
 * Extract source URL from social buzz content (for link badge)
 */
export function extractSourceUrl(content: string): string | null {
  // Look for markdown links
  const markdownMatch = /\\[Source\\]\(([^)]+)\)/i.exec(content);
  if (markdownMatch) return markdownMatch[1];
  
  // Look for plain URLs
  const urlMatch = /https?:\/\/(?:www\.)?([^\s]+)/i.exec(content);
  if (urlMatch) return urlMatch[0];
  
  return null;
}

/**
 * Get display domain from URL for link badge
 */
export function getDisplayDomain(url: string | null): string | null {
  if (!url) return null;
  
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    // Shorten common domains
    if (domain.includes('reddit.com')) return 'reddit';
    if (domain.length > 20) return domain.substring(0, 17) + '...';
    return domain;
  } catch {
    return null;
  }
}

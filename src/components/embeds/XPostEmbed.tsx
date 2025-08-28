import React, { memo } from "react";

interface XPostEmbedProps {
  embedCode: string;
}

export const XPostEmbed = memo(function XPostEmbed({ embedCode }: XPostEmbedProps) {
  // Completely static - no dynamic loading to prevent flashing
  
  // Check if it's a Twitter/X URL and show static placeholder
  if (embedCode.includes('twitter.com') || embedCode.includes('x.com')) {
    const urlMatch = embedCode.match(/https?:\/\/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/);
    if (urlMatch) {
      const tweetUrl = urlMatch[0];
      return (
        <div 
          className="twitter-embed x-embed-container w-full"
          style={{
            contain: 'strict',
            position: 'relative',
            minHeight: '200px',
            maxHeight: '400px',
            WebkitTransform: 'translateZ(0)',
            transform: 'translateZ(0)',
            overflow: 'hidden',
            background: 'hsl(var(--muted))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div className="text-center p-4">
            <div className="text-sm text-muted-foreground mb-2">Twitter/X Post</div>
            <a 
              href={tweetUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm"
            >
              View on X
            </a>
          </div>
        </div>
      );
    }
  }

  // For oEmbed HTML, show static placeholder
  return (
    <div 
      className="embed-content x-embed-container w-full"
      style={{ 
        maxWidth: '100%', 
        minWidth: 0,
        contain: 'strict',
        position: 'relative',
        minHeight: '200px',
        maxHeight: '400px',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
        overflow: 'hidden',
        background: 'hsl(var(--muted))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div className="text-center p-4">
        <div className="text-sm text-muted-foreground">Embed Content</div>
      </div>
    </div>
  );
}, () => true); // Never re-render
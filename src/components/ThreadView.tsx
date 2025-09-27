import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { XPostEmbed } from '@/components/embeds/XPostEmbed';
import { cn } from '@/lib/utils';

interface ThreadEmbed {
  commentary: string;
  embed_code: string;
  embed_type: 'x' | 'iframe' | 'youtube';
}

interface ThreadViewProps {
  content: string;
  embeds?: ThreadEmbed[];
  className?: string;
  maxPreviewEmbeds?: number;
}

export const ThreadView: React.FC<ThreadViewProps> = ({ 
  content, 
  embeds = [], 
  className = '',
  maxPreviewEmbeds = 2 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!embeds || embeds.length === 0) {
    return (
      <div className={className}>
        <div className="whitespace-pre-wrap break-words">{content}</div>
      </div>
    );
  }

  const previewEmbeds = embeds.slice(0, maxPreviewEmbeds);
  const remainingEmbeds = embeds.slice(maxPreviewEmbeds);
  const hasMoreContent = remainingEmbeds.length > 0;

  const renderEmbed = (embed: ThreadEmbed, index: number) => {
    console.log('Rendering embed:', embed); // Debug log
    
    return (
      <div key={index} className="mt-4 space-y-2">
        {embed.commentary && embed.commentary.trim() && (
          <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border-l-4 border-secondary/30">
            {embed.commentary}
          </div>
        )}
        <div className="rounded-lg overflow-hidden embed-container">
          {(embed.embed_type === 'x' || embed.embed_code.includes('twitter.com') || embed.embed_code.includes('x.com')) ? (
            <XPostEmbed embedCode={embed.embed_code} />
          ) : (embed.embed_type === 'youtube' || embed.embed_code.includes('youtube.com') || embed.embed_code.includes('youtu.be')) ? (
            <div className="aspect-video bg-muted/20 rounded-lg overflow-hidden">
              <iframe
                src={embed.embed_code.includes('watch?v=') 
                  ? embed.embed_code.replace('watch?v=', 'embed/').replace('youtube.com/', 'youtube.com/').replace('http://', 'https://') 
                  : embed.embed_code.includes('youtu.be/') 
                  ? embed.embed_code.replace('youtu.be/', 'youtube.com/embed/').replace('http://', 'https://')
                  : embed.embed_code.replace('http://', 'https://')
                }
                className="w-full h-full border-0"
                allowFullScreen
                title="YouTube video"
                loading="lazy"
              />
            </div>
          ) : (
            <div
              className="w-full embed-content"
              dangerouslySetInnerHTML={{ __html: embed.embed_code }}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Main content */}
      {content && (
        <div className="whitespace-pre-wrap break-words">{content}</div>
      )}
      
      {/* Preview embeds (always shown) */}
      {previewEmbeds.map((embed, index) => renderEmbed(embed, index))}
      
      {/* Expandable section for remaining embeds */}
      {hasMoreContent && (
        <>
          {isExpanded && remainingEmbeds.map((embed, index) => 
            renderEmbed(embed, index + maxPreviewEmbeds)
          )}
          
            <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-3 text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1 px-0"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show {remainingEmbeds.length} more {remainingEmbeds.length === 1 ? 'post' : 'posts'}
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
};
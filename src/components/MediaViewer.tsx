import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Maximize, X } from 'lucide-react';

interface MediaViewerProps {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  className?: string;
  showLightbox?: boolean; // For images (default true), for videos we keep inline by default
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  mediaUrl,
  mediaType,
  className = '',
  showLightbox = false
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (mediaType === 'image') {
    const imageEl = (
      <img
        src={mediaUrl}
        alt="Media image"
        className={`w-full h-auto rounded-lg object-cover ${className}`}
        loading="lazy"
      />
    );

    if (!showLightbox) return imageEl;

    return (
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <div className="relative cursor-zoom-in" onClick={() => setLightboxOpen(true)}>
          {imageEl}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 z-10 h-8 w-8 p-0 rounded-full bg-black/50 text-white hover:bg-black/70"
            aria-label="Expand image"
          >
            <Maximize className="w-4 h-4" />
          </Button>
        </div>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-black/95 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 z-50 h-10 w-10 p-0 rounded-full bg-black/50 text-white hover:bg-black/70"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </Button>
          <img src={mediaUrl} alt="Media image" className="w-full h-full object-contain" />
        </DialogContent>
      </Dialog>
    );
  }

  // Video: always inline by default, no overlay controls/lightbox to avoid conflicts
  return (
    <div className={`media-inline ${className}`}>
      <video
        src={mediaUrl}
        className="w-full h-full object-contain"
        preload="metadata"
        controls
        playsInline
        // @ts-ignore - iOS inline playback
        webkit-playsinline="true"
        controlsList="nodownload"
      />
    </div>
  );
};

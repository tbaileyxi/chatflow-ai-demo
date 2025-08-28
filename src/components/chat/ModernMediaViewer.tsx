import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModernMediaViewerProps {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  className?: string;
  showLightbox?: boolean;
}

export const ModernMediaViewer = ({ 
  mediaUrl, 
  mediaType, 
  className,
  showLightbox = true
}: ModernMediaViewerProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);

  const handleVideoToggle = () => {
    if (videoRef) {
      if (videoPlaying) {
        videoRef.pause();
      } else {
        videoRef.play();
      }
      setVideoPlaying(!videoPlaying);
    }
  };

  const handleMuteToggle = () => {
    if (videoRef) {
      videoRef.muted = !videoMuted;
      setVideoMuted(!videoMuted);
    }
  };

  if (mediaType === 'image') {
    return (
      <>
        <div 
          className={cn(
            "relative group cursor-pointer overflow-hidden rounded-xl",
            "hover:shadow-lg transition-all duration-200",
            className
          )}
          onClick={() => showLightbox && setLightboxOpen(true)}
        >
          <img 
            src={mediaUrl} 
            alt="Shared image" 
            className="w-full h-auto object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
          {showLightbox && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
              <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </div>
          )}
        </div>

        {showLightbox && (
          <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-black/95 backdrop-blur-sm">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 right-4 z-50 h-10 w-10 p-0 rounded-full bg-black/50 text-white hover:bg-black/70"
                onClick={() => setLightboxOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
              <img 
                src={mediaUrl} 
                alt="Shared image" 
                className="w-full h-full object-contain"
              />
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  return (
    <>
      <div 
        className={cn(
          "relative group overflow-hidden rounded-xl bg-black",
          "hover:shadow-lg transition-all duration-200",
          className
        )}
      >
        <video
          ref={setVideoRef}
          src={mediaUrl}
          className="w-full h-auto object-cover"
          muted={videoMuted}
          loop
          playsInline
          onPlay={() => setVideoPlaying(true)}
          onPause={() => setVideoPlaying(false)}
          onLoadedMetadata={() => {
            // Auto-play on hover for inline videos
            if (videoRef && !lightboxOpen) {
              videoRef.currentTime = 0;
            }
          }}
        />
        
        {/* Video controls overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 rounded-full bg-black/50 text-white hover:bg-black/70"
              onClick={handleVideoToggle}
            >
              {videoPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 rounded-full bg-black/50 text-white hover:bg-black/70"
              onClick={handleMuteToggle}
            >
              {videoMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            {showLightbox && (
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 rounded-full bg-black/50 text-white hover:bg-black/70"
                onClick={() => setLightboxOpen(true)}
              >
                <Maximize2 className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {showLightbox && (
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-black/95 backdrop-blur-sm">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 z-50 h-10 w-10 p-0 rounded-full bg-black/50 text-white hover:bg-black/70"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
            <video
              src={mediaUrl}
              className="w-full h-full object-contain"
              autoPlay
              controls
              muted={videoMuted}
              loop
              playsInline
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
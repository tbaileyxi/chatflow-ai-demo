import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX, Maximize, X } from 'lucide-react';

interface MediaViewerProps {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  className?: string;
  showLightbox?: boolean;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  mediaUrl,
  mediaType,
  className = '',
  showLightbox = true
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);

  const togglePlayPause = () => {
    if (videoRef) {
      if (isPlaying) {
        videoRef.pause();
      } else {
        videoRef.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef) {
      videoRef.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVideoLoad = (video: HTMLVideoElement | null) => {
    setVideoRef(video);
    if (video) {
      video.addEventListener('play', () => setIsPlaying(true));
      video.addEventListener('pause', () => setIsPlaying(false));
      video.addEventListener('ended', () => setIsPlaying(false));
    }
  };

  if (mediaType === 'image') {
    const imageElement = (
      <img
        src={mediaUrl}
        alt="Media"
        className={`rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity ${className}`}
      />
    );

    if (showLightbox) {
      return (
        <Dialog>
          <DialogTrigger asChild>
            {imageElement}
          </DialogTrigger>
          <DialogContent className="max-w-4xl w-full p-0 bg-black/90">
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 right-4 z-10 bg-black/50 text-white hover:bg-black/70 rounded-full w-8 h-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  const dialog = e.currentTarget.closest('[role="dialog"]');
                  if (dialog) {
                    const event = new KeyboardEvent('keydown', { key: 'Escape' });
                    dialog.dispatchEvent(event);
                  }
                }}
              >
                <X className="w-4 h-4" />
              </Button>
              <img
                src={mediaUrl}
                alt="Media"
                className="w-full h-auto max-h-[90vh] object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      );
    }

    return imageElement;
  }

  if (mediaType === 'video') {
    const videoElement = (
      <div className={`relative rounded-lg overflow-hidden bg-black ${className}`}>
        <video
          ref={handleVideoLoad}
          src={mediaUrl}
          className="w-full h-auto"
          controls
          muted={isMuted}
          playsInline
        />
        
        {/* Custom video controls overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={togglePlayPause}
              className="bg-black/50 hover:bg-black/70 text-white"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleMute}
              className="bg-black/50 hover:bg-black/70 text-white"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    );

    if (showLightbox) {
      return (
        <Dialog>
          <DialogTrigger asChild>
            <div className="cursor-pointer">
              {videoElement}
            </div>
          </DialogTrigger>
          <DialogContent className="max-w-4xl w-full p-0 bg-black/90">
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 right-4 z-10 bg-black/50 text-white hover:bg-black/70 rounded-full w-8 h-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  const dialog = e.currentTarget.closest('[role="dialog"]');
                  if (dialog) {
                    const event = new KeyboardEvent('keydown', { key: 'Escape' });
                    dialog.dispatchEvent(event);
                  }
                }}
              >
                <X className="w-4 h-4" />
              </Button>
              <video
                src={mediaUrl}
                className="w-full h-auto max-h-[90vh] object-contain"
                controls
                autoPlay
                playsInline
              />
            </div>
          </DialogContent>
        </Dialog>
      );
    }

    return videoElement;
  }

  return null;
};
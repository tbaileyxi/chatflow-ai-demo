import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Play, ChevronDown, ChevronUp, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PulseMomentProps {
  id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  pulse_source?: 'youtube' | 'x' | 'reddit' | 'instagram';
  pulse_expires_at?: string;
  boost_amount?: number;
  created_at: string;
  onBoost?: (id: string) => void;
}

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  youtube: { label: 'YouTube', color: 'bg-red-500/20 text-red-400' },
  x: { label: '𝕏', color: 'bg-zinc-500/20 text-zinc-300' },
  reddit: { label: 'Reddit', color: 'bg-orange-500/20 text-orange-400' },
  instagram: { label: 'IG', color: 'bg-pink-500/20 text-pink-400' },
};

export const PulseMoment = ({
  id,
  content,
  media_url,
  media_type,
  pulse_source,
  pulse_expires_at,
  boost_amount = 0,
  created_at,
  onBoost,
}: PulseMomentProps) => {
  const [expanded, setExpanded] = useState(false);
  
  // Calculate opacity based on age (auto-dim after 15 min)
  const opacity = useMemo(() => {
    if (!pulse_expires_at) return 1;
    const now = Date.now();
    const expires = new Date(pulse_expires_at).getTime();
    const created = new Date(created_at).getTime();
    const total = expires - created;
    const elapsed = now - created;
    const remaining = Math.max(0, 1 - (elapsed / total));
    return Math.max(0.4, remaining);
  }, [pulse_expires_at, created_at]);

  const timeAgo = useMemo(() => 
    formatDistanceToNow(new Date(created_at), { addSuffix: true }),
    [created_at]
  );

  const sourceBadge = pulse_source ? SOURCE_BADGES[pulse_source] : null;
  const isVideo = media_type === 'video' || media_url?.includes('youtube') || media_url?.includes('youtu.be');
  
  // Extract headline (first line or first 100 chars)
  const headline = content.split('\n')[0].slice(0, 100);
  const hasMoreContent = content.length > headline.length;

  // Extract YouTube video ID for thumbnail
  const youtubeId = useMemo(() => {
    if (!media_url) return null;
    const match = media_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match?.[1];
  }, [media_url]);

  const thumbnailUrl = youtubeId 
    ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
    : media_url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative rounded-xl border overflow-hidden transition-all duration-300",
        "bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm",
        boost_amount > 0 
          ? "border-yellow-500/50 shadow-lg shadow-yellow-500/20 ring-2 ring-yellow-500/30" 
          : "border-primary/20 hover:border-primary/40",
        expanded ? "max-h-none" : "max-h-48"
      )}
    >
      {/* Boost glow effect */}
      {boost_amount > 0 && (
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-yellow-500/10 pointer-events-none" />
      )}

      {/* Media Thumbnail (16:9) */}
      {thumbnailUrl && !expanded && (
        <div className="relative aspect-video w-full bg-black/50">
          <img 
            src={thumbnailUrl} 
            alt=""
            className="w-full h-full object-cover"
          />
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                <Play className="w-6 h-6 text-black ml-1" />
              </div>
            </div>
          )}
          {/* Source badge overlay */}
          {sourceBadge && (
            <Badge className={cn("absolute top-2 right-2 text-xs", sourceBadge.color)}>
              {sourceBadge.label}
            </Badge>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        {/* Headline */}
        <p className={cn(
          "font-medium text-foreground",
          expanded ? "whitespace-pre-wrap" : "line-clamp-2"
        )}>
          {expanded ? content : headline}
        </p>

        {/* Meta row */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{timeAgo}</span>
            {!thumbnailUrl && sourceBadge && (
              <Badge variant="secondary" className={cn("text-xs", sourceBadge.color)}>
                {sourceBadge.label}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Boost indicator */}
            {boost_amount > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-400 text-xs font-bold">
                <Flame className="w-3 h-3 mr-1" />
                +${boost_amount}
              </Badge>
            )}

            {/* Expand/collapse */}
            {hasMoreContent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-6 px-2"
              >
                {expanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Expanded: embed inline */}
        {expanded && youtubeId && (
          <div className="mt-3 aspect-video rounded-lg overflow-hidden">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?playsinline=1`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {expanded && media_url && !youtubeId && (
          <a
            href={media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            View source
          </a>
        )}
      </div>
    </motion.div>
  );
};

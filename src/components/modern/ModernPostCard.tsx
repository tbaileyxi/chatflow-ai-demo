
import React, { useState, useCallback, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Share2, Play, Volume2, VolumeX, MoreHorizontal, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { MediaViewer } from "@/components/MediaViewer";
import { XPostEmbed } from "@/components/embeds/XPostEmbed";
import { ReportButton } from "@/components/ReportButton";

interface ModernPostCardProps {
  post: any;
  isSpotlight?: boolean;
  index?: number;
  disableReply?: boolean;
  className?: string;
}

export const ModernPostCard = React.memo(({ 
  post, 
  isSpotlight = false, 
  index = 0,
  disableReply = false,
  className 
}: ModernPostCardProps) => {
  const { toast } = useToast();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.post_reactions?.length || 0);
  const [isMuted, setIsMuted] = useState(true);
  const [copied, setCopied] = useState(false);

  // Calculate stagger delay for animations
  const staggerDelay = Math.min(index * 50, 500);

  const formattedTime = useMemo(() => {
    return formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  }, [post.created_at]);

  const handleLike = useCallback(() => {
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
  }, [isLiked]);

  const handleShare = useCallback(async () => {
    const postUrl = `${window.location.origin}/spotlight/${post.id}`;
    const shareText = post.content?.slice(0, 100) + (post.content?.length > 100 ? '...' : '');
    const shareTitle = `${post.team?.name || post.author?.display_name || 'Post'} on Side Huddle`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: postUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(postUrl);
        setCopied(true);
        toast({
          title: "Link copied!",
          description: "Share this post with friends",
        });
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast({
          title: "Copy failed",
          description: "Please copy the URL manually",
          variant: "destructive",
        });
      }
    }
  }, [post, toast]);

  const displayName = post.author?.display_name || post.team?.name || 'Unknown';
  const avatarUrl = post.author?.avatar_url || post.team?.logo_url;

  return (
    <div 
      className={cn(
        "bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300",
        "animate-in slide-in-from-bottom-4 fade-in-0",
        className
      )}
      style={{
        animationDelay: `${staggerDelay}ms`,
        animationFillMode: 'both'
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 ring-2 ring-border">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="bg-muted text-muted-foreground">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">
                {displayName}
              </h3>
              {post.team?.sponsor && (
                <Badge variant="secondary" className="text-xs">
                  {post.team.sponsor}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {formattedTime}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ReportButton postId={post.id} postContent={post.content} />
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <div className="mb-4">
          <p className="text-foreground leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
        </div>
      )}

      {/* Media */}
      {post.media_url && (
        <div className="mb-4 rounded-lg overflow-hidden">
          <MediaViewer 
            mediaUrl={post.media_url} 
            mediaType={post.media_type || 'image'}
            showLightbox={post.media_type === 'image'}
            className="w-full max-h-[400px] object-cover"
          />
        </div>
      )}

      {/* Embedded Content - New embeds array format */}
      {post.embeds && post.embeds.length > 0 && (
        <div className="mb-4 space-y-3">
          {post.embeds.map((embed: any, idx: number) => (
            <div key={idx}>
              {embed.embed_type === 'x' && embed.embed_code && (
                <XPostEmbed embedCode={embed.embed_code} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legacy embed_code format for backward compatibility */}
      {!post.embeds && post.embed_code && (
        <div className="mb-4">
          <XPostEmbed embedCode={post.embed_code} />
        </div>
      )}

      {/* Poll */}
      {post.poll_data && (
        <div className="mb-4 space-y-3">
          <h4 className="font-medium text-foreground">{post.poll_data.question}</h4>
          <div className="space-y-2">
            {post.poll_data.options?.map((option: any, idx: number) => (
              <Button
                key={idx}
                variant="outline"
                className="w-full justify-start text-left h-auto py-2 px-3"
              >
                {option.text}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 transition-colors",
              isLiked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
            )}
            onClick={handleLike}
          >
            <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
            <span className="text-sm">{likeCount}</span>
          </Button>

          {!disableReply && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">Reply</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 transition-colors",
              copied ? "text-green-500" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={handleShare}
          >
            {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          </Button>
        </div>

        {isSpotlight && (
          <Badge variant="outline" className="bg-spotlight/10 text-spotlight border-spotlight/20">
            Spotlight
          </Badge>
        )}
      </div>
    </div>
  );
});

ModernPostCard.displayName = 'ModernPostCard';

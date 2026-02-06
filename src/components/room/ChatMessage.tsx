import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, Laugh, Eye, Reply, Share2, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { UserBadgeIcon } from '@/components/badges/UserBadgeIcon';
import { FadeMessageAction } from './FadeMessageAction';
import { useToast } from '@/hooks/use-toast';

// Maximum character length before truncating
const MAX_CONTENT_LENGTH = 280;
interface Profile {
  display_name: string;
  username: string;
  avatar_url: string;
}

interface UserBadge {
  team_id: string;
  tier: 'basic' | 'superfan';
  team_name?: string;
  team_logo_url?: string;
}

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  media_url?: string;
  media_type?: string;
  message_type?: string;
  boost_amount?: number;
  is_bot_message?: boolean;
  pulse_source?: string;
  embed_code?: string;
  reply_to_id?: string;
}

interface TeamSponsor {
  name: string;
  url?: string;
}

interface ReactionCount {
  [emoji: string]: number;
}

// Simplified reactions: 👍 = agree, 😂 = funny, 👀 = watching
const REACTIONS = [
  { emoji: '👍', label: 'Agree', Icon: ThumbsUp },
  { emoji: '😂', label: 'Funny', Icon: Laugh },
  { emoji: '👀', label: 'Watching', Icon: Eye }
];

interface ChatMessageProps {
  message: Message;
  profile?: Profile;
  isOwn: boolean;
  reactionCounts: ReactionCount;
  onReaction: (emoji: string) => void;
  onReply?: (message: Message) => void;
  sponsor?: TeamSponsor | null;
  badge?: UserBadge | null;
  onBadgeClick?: (emoji: string) => void;
  huddleId?: string;
  isPrivate?: boolean;
  onCashModeRequired?: () => void;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  profile,
  isOwn,
  reactionCounts,
  onReaction,
  onReply,
  sponsor,
  badge,
  onBadgeClick,
  huddleId,
  isPrivate,
  onCashModeRequired
}: ChatMessageProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const displayName = profile?.display_name || profile?.username || 'Anonymous';
  const avatarUrl = profile?.avatar_url;
  const isCoach = message.is_bot_message || message.message_type === 'coach_response';
  const isPulse = message.pulse_source || message.message_type === 'pulse';
  const isFadeNotification = message.message_type === 'fade_notification';
  
  // Check if content needs truncation
  const shouldTruncate = message.content && message.content.length > MAX_CONTENT_LENGTH;
  const displayContent = shouldTruncate && !isExpanded 
    ? message.content.slice(0, MAX_CONTENT_LENGTH) + '...'
    : message.content;
  const handleReplyClick = useCallback(() => {
    onReply?.(message);
  }, [onReply, message]);

  const handleShare = useCallback(async () => {
    const cacheBuster = encodeURIComponent(message.created_at);
    // Share via Cloudflare Worker URL — serves proper text/html for iMessage previews
    // TODO: Replace YOUR_SUBDOMAIN with your actual Cloudflare workers.dev subdomain
    const shareUrl = `https://sh-og.ty-eb5.workers.dev/message/${message.id}?v=${cacheBuster}`;

    // Pre-warm the OG page generation (fire and forget)
    const supabaseOgUrl = `https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/og-message?id=${message.id}&raw=1`;
    fetch(supabaseOgUrl, { method: 'HEAD' }).catch(() => {});

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Link copied!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }, [message.id, message.created_at, toast]);
  
  // Extract media from pulse content OR user uploads
  const hasInlineMedia = message.media_url && (
    message.media_url.includes('youtube.com') ||
    message.media_url.includes('youtu.be') ||
    message.media_url.includes('.jpg') ||
    message.media_url.includes('.png') ||
    message.media_url.includes('.gif') ||
    message.media_url.includes('.jpeg') ||
    message.media_url.includes('.webp') ||
    message.media_url.includes('preview.redd.it') ||
    message.media_url.includes('supabase.co/storage') // Supabase storage uploads
  );

  // Extract YouTube video ID
  const getYouTubeId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const youtubeId = message.media_url ? getYouTubeId(message.media_url) : null;

  // REMOVED: Source badges - no longer showing "via X" etc per spec

  const handleReactionClick = useCallback((emoji: string) => {
    onReaction(emoji);
  }, [onReaction]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        "mb-4",
        isOwn && "flex flex-col items-end"
      )}
    >
      {/* Message Row */}
      <div className={cn(
        "flex gap-2 max-w-[85%]",
        isOwn && "flex-row-reverse"
      )}>
        {/* Avatar with Badge Overlay */}
        <div className="relative flex-shrink-0">
          <Avatar className={cn(
            "h-8 w-8",
            isCoach && "ring-2 ring-yellow-500 shadow-lg shadow-yellow-500/30"
          )}>
            {isCoach ? (
              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xs">
                🤖
              </AvatarFallback>
            ) : (
              <>
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback className="text-xs bg-muted">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </>
            )}
          </Avatar>
          {/* Badge Overlay - bottom-right corner of avatar */}
          {badge && !isCoach && (
            <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5 shadow-sm border border-border/50">
              <UserBadgeIcon 
                tier={badge.tier} 
                teamName={badge.team_name}
                teamLogoUrl={badge.team_logo_url}
                size="sm"
                onClick={onBadgeClick ? () => onBadgeClick('🦬') : undefined}
              />
            </div>
          )}
        </div>

        {/* Bubble */}
        <div className={cn(
          "rounded-2xl px-4 py-2.5 shadow-sm",
          isOwn ? "rounded-br-md" : "rounded-bl-md",
          isOwn 
            ? "bg-primary text-primary-foreground" 
            : "bg-card border border-border/50",
          isCoach && "bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/10",
          isPulse && !isCoach && "bg-muted/50 border border-border/30"
        )}>
          {/* Name + Time (badge is now on avatar) */}
          <div className={cn(
            "flex items-center gap-1.5 mb-1 flex-wrap",
            isOwn && "justify-end"
          )}>
            <span className={cn(
              "text-xs font-semibold",
              isOwn ? "text-primary-foreground/80" : "text-foreground",
              isCoach && "text-cyan-400 font-bold"
            )}>
              {isCoach ? '@coach' : displayName}
            </span>
            
            <span className={cn(
              "text-[10px]",
              isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
            )}>
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: false })}
            </span>
          </div>

          {/* Content with Read More */}
          <div>
            <p className={cn(
              "text-sm leading-relaxed whitespace-pre-wrap",
              isCoach && "font-medium"
            )}>
              {displayContent}
            </p>
            
            {/* Read More / Show Less button */}
            {shouldTruncate && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                  "text-xs font-medium mt-1 transition-colors",
                  isOwn 
                    ? "text-primary-foreground/70 hover:text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>

          {/* Inline Media */}
          {hasInlineMedia && (
            <div className="mt-2">
              {youtubeId ? (
                <a 
                  href={message.media_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block relative rounded-lg overflow-hidden"
                >
                  <img
                    src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                    alt="YouTube thumbnail"
                    className="w-full rounded-lg"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                      <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1" />
                    </div>
                  </div>
                </a>
              ) : message.media_url && !message.media_url.includes('youtube') ? (
                <img
                  src={message.media_url}
                  alt=""
                  className="max-w-full rounded-lg"
                  loading="lazy"
                />
              ) : null}
            </div>
          )}

          {/* Sponsor Line (only for team-directed @coach messages) */}
          {sponsor && (
            <div className="mt-2 pt-2 border-t border-border/20">
              {sponsor.url ? (
                <a 
                  href={sponsor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sponsored by {sponsor.name}
                </a>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  Sponsored by {sponsor.name}
                </span>
              )}
            </div>
          )}

          {/* Fade Action Button - embedded in chat bubble */}
          {isFadeNotification && huddleId && (
            <FadeMessageAction
              messageContent={message.content}
              huddleId={huddleId}
              isPrivate={isPrivate}
              onCashModeRequired={onCashModeRequired}
            />
          )}
        </div>
      </div>

      {/* Inline Reactions + Reply + Share */}
      <div className={cn(
        "flex items-center gap-1 mt-1.5 px-10",
        isOwn && "justify-end"
      )}>
        {/* Reply button */}
        {onReply && (
          <button
            onClick={handleReplyClick}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all hover:bg-muted active:scale-95 text-muted-foreground hover:text-foreground"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Share button */}
        <button
          onClick={handleShare}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all hover:bg-muted active:scale-95",
            copied ? "text-green-500" : "text-muted-foreground hover:text-foreground"
          )}
          title="Share"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
        </button>
        
        {REACTIONS.map(({ emoji, label }) => {
          const count = reactionCounts[emoji] || 0;
          return (
            <button
              key={emoji}
              onClick={() => handleReactionClick(emoji)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all",
                "hover:bg-muted active:scale-95",
                count > 0 ? "bg-muted/70" : "bg-transparent hover:bg-muted/50"
              )}
              title={label}
            >
              <span className="text-sm">{emoji}</span>
              {count > 0 && (
                <span className="text-muted-foreground font-medium">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.isOwn === nextProps.isOwn &&
    prevProps.profile?.display_name === nextProps.profile?.display_name &&
    prevProps.profile?.avatar_url === nextProps.profile?.avatar_url &&
    JSON.stringify(prevProps.reactionCounts) === JSON.stringify(nextProps.reactionCounts) &&
    prevProps.sponsor?.name === nextProps.sponsor?.name &&
    prevProps.badge?.tier === nextProps.badge?.tier &&
    prevProps.badge?.team_id === nextProps.badge?.team_id
  );
});

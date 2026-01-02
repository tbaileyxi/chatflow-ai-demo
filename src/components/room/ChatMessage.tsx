import React, { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ThumbsUp, Laugh, Eye } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Profile {
  display_name: string;
  username: string;
  avatar_url: string;
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
  sponsor?: TeamSponsor | null;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  profile,
  isOwn,
  reactionCounts,
  onReaction,
  sponsor
}: ChatMessageProps) {
  const displayName = profile?.display_name || profile?.username || 'Anonymous';
  const avatarUrl = profile?.avatar_url;
  const isCoach = message.is_bot_message || message.message_type === 'coach_response';
  const isPulse = message.pulse_source || message.message_type === 'pulse';
  
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
        {/* Avatar */}
        <Avatar className={cn(
          "h-8 w-8 flex-shrink-0",
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
          {/* Name + Source + Time */}
          <div className={cn(
            "flex items-center gap-2 mb-1 flex-wrap",
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

          {/* Content */}
          <p className={cn(
            "text-sm leading-relaxed whitespace-pre-wrap",
            isCoach && "font-medium"
          )}>
            {message.content}
          </p>

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
        </div>
      </div>

      {/* Inline Reactions */}
      <div className={cn(
        "flex items-center gap-1 mt-1.5 px-10",
        isOwn && "justify-end"
      )}>
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
    prevProps.sponsor?.name === nextProps.sponsor?.name
  );
});

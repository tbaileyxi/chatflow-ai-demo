import React, { memo, useMemo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { Heart, Smile, ThumbsUp, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    is_bot_message?: boolean;
    media_url?: string;
    media_type?: string;
    embed_code?: string;
    reactions?: any[];
    poll_data?: any;
    source?: {
      posterName?: string;
      posterAvatar?: string;
    };
  };
  user: {
    id: string;
    display_name: string;
    avatar_url?: string;
    username?: string;
  } | null;
  currentUserId?: string;
  teamName?: string;
  teamLogoUrl?: string;
  onAddReaction?: (messageId: string, emoji: string) => void;
  onPollVote?: (messageId: string, optionId: number) => void;
  isStreaming?: boolean;
  isConsecutive?: boolean;
  previousMessage?: {
    user_id: string;
  } | null;
}

const StreamingCaret = memo(() => (
  <span className="inline-block w-2 h-5 bg-primary ml-1 animate-pulse" />
));

StreamingCaret.displayName = 'StreamingCaret';

const ReactionsBar = memo<{ 
  messageId: string; 
  onAddReaction: (messageId: string, emoji: string) => void;
  visible: boolean;
}>(({ messageId, onAddReaction, visible }) => {
  const reactions = ['👍', '😂', '🔥'];
  
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
          className="flex gap-1 mt-1"
        >
          {reactions.map((emoji) => (
            <Button
              key={emoji}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted"
              onClick={() => onAddReaction(messageId, emoji)}
            >
              {emoji}
            </Button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

ReactionsBar.displayName = 'ReactionsBar';

export const MessageBubble = memo<MessageBubbleProps>(({
  message,
  user,
  currentUserId,
  teamName,
  teamLogoUrl,
  onAddReaction,
  onPollVote,
  isStreaming = false,
  isConsecutive = false,
  previousMessage = null
}) => {
  const [showReactions, setShowReactions] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  
  const isOwnMessage = currentUserId === message.user_id;
  const isTeamAgent = message.is_bot_message;
  const shouldShowAvatar = !isConsecutive && (!previousMessage || previousMessage.user_id !== message.user_id);

  const formattedTime = useMemo(() => {
    return formatDistanceToNow(new Date(message.created_at), { addSuffix: true });
  }, [message.created_at]);

  const displayName = useMemo(() => {
    if (message.source?.posterName) return message.source.posterName;
    if (isTeamAgent && teamName) return `${teamName} Bot`;
    return user?.display_name || user?.username || 'Unknown User';
  }, [message.source?.posterName, isTeamAgent, teamName, user]);

  const avatarUrl = useMemo(() => {
    if (message.source?.posterAvatar) return message.source.posterAvatar;
    if (isTeamAgent && teamLogoUrl) return teamLogoUrl;
    return user?.avatar_url;
  }, [message.source?.posterAvatar, isTeamAgent, teamLogoUrl, user]);

  const handleReaction = useCallback((emoji: string) => {
    onAddReaction?.(message.id, emoji);
  }, [message.id, onAddReaction]);

  const handleLongPress = useCallback(() => {
    // Copy message to clipboard
    navigator.clipboard?.writeText(message.content);
    setShowReactions(true);
    setTimeout(() => setShowReactions(false), 3000);
  }, [message.content]);

  const handleMouseDown = useCallback(() => {
    const timer = setTimeout(() => {
      handleLongPress();
    }, 500);
    setLongPressTimer(timer);
  }, [handleLongPress]);

  const handleMouseUp = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  const sanitizeEmbedCode = useCallback((embedCode: string) => {
    return DOMPurify.sanitize(embedCode, {
      ALLOWED_TAGS: ['blockquote', 'a', 'p', 'div', 'span', 'iframe', 'script', 'img', 'video', 'source'],
      ALLOWED_ATTR: ['href', 'class', 'src', 'width', 'height', 'frameborder', 'allowfullscreen', 'data-tweet-id', 'data-theme', 'controls', 'preload', 'poster', 'alt'],
      ALLOW_DATA_ATTR: true,
      ADD_ATTR: ['allowfullscreen']
    });
  }, []);

  // Debounced content rendering for streaming
  const renderedContent = useMemo(() => {
    const content = message.content;
    return (
      <div className="whitespace-pre-wrap break-words">
        {content}
        {isStreaming && <StreamingCaret />}
      </div>
    );
  }, [message.content, isStreaming]);

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-1 hover:bg-muted/30 transition-colors group",
        isOwnMessage ? "flex-row-reverse" : "flex-row"
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
    >
      {shouldShowAvatar && (
        <Avatar className="h-8 w-8 shrink-0 object-cover">
          <AvatarImage 
            src={avatarUrl} 
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
          <AvatarFallback className="text-xs bg-muted">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn(
        "flex-1 min-w-0 max-w-[85%]",
        shouldShowAvatar ? "" : "ml-11",
        isOwnMessage && shouldShowAvatar ? "mr-0" : "",
        isOwnMessage && !shouldShowAvatar ? "mr-11" : ""
      )}>
        {shouldShowAvatar && (
          <div className={cn(
            "flex items-center gap-2 mb-1",
            isOwnMessage ? "justify-end" : "justify-start"
          )}>
            <span className="font-medium text-sm text-muted-foreground opacity-60 truncate">
              {displayName}
            </span>
            {isTeamAgent && (
              <Badge variant="secondary" className="text-xs h-5">
                Bot
              </Badge>
            )}
            <span className="text-xs text-muted-foreground opacity-60 shrink-0">
              {formattedTime}
            </span>
          </div>
        )}
        
        {message.content && (
          <div className={cn(
            "rounded-xl px-3 py-2 max-w-fit",
            isOwnMessage 
              ? "bg-primary text-primary-foreground ml-auto" 
              : "bg-muted text-foreground",
            shouldShowAvatar && !isConsecutive 
              ? "rounded-xl" 
              : isOwnMessage 
                ? "rounded-l-xl rounded-tr-md rounded-br-xl"
                : "rounded-r-xl rounded-tl-md rounded-bl-xl"
          )}>
            <div className="text-base font-normal leading-snug">
              {renderedContent}
            </div>
          </div>
        )}

        {/* Embedded Content */}
        {message.embed_code && (
          <div 
            className="rounded-xl overflow-hidden my-2 max-w-[85%] shadow"
            style={{ pointerEvents: 'auto' }}
          >
            <div 
              className="w-full h-auto aspect-video"
              dangerouslySetInnerHTML={{ 
                __html: sanitizeEmbedCode(message.embed_code) 
              }}
            />
          </div>
        )}

        {message.media_url && (
          <div className="mt-2">
            {message.media_type === 'image' ? (
              <img
                src={message.media_url}
                alt="Shared media"
                className="max-w-xs rounded-lg shadow-sm"
                loading="lazy"
              />
            ) : (
              <video
                src={message.media_url}
                controls
                className="max-w-xs rounded-lg shadow-sm"
                preload="metadata"
              />
            )}
          </div>
        )}

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex gap-1 mt-2">
            {message.reactions.map((reaction, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => handleReaction(reaction.emoji)}
              >
                {reaction.emoji} {reaction.count}
              </Button>
            ))}
          </div>
        )}

        {/* Reactions Bar */}
        {onAddReaction && (
          <ReactionsBar
            messageId={message.id}
            onAddReaction={onAddReaction}
            visible={showReactions}
          />
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Memoization comparison
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.embed_code === nextProps.message.embed_code &&
    prevProps.message.reactions?.length === nextProps.message.reactions?.length &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.isConsecutive === nextProps.isConsecutive &&
    prevProps.currentUserId === nextProps.currentUserId &&
    prevProps.previousMessage?.user_id === nextProps.previousMessage?.user_id
  );
});

MessageBubble.displayName = 'MessageBubble';
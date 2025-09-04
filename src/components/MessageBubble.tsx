import React, { memo, useMemo, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { Heart, Smile, ThumbsUp, Flame, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';
import { XPostEmbed } from '@/components/embeds/XPostEmbed';
import { extractVideoFrame } from '@/utils/videoThumbnail';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { shouldShowProfile } from '@/utils/chatMessage';
import { PickEmCard } from '@/components/pickem/PickEmCard';

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    is_bot_message?: boolean;
    is_team_agent_message?: boolean;
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
  onViewPickEm?: (instanceId: string) => void;
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
  previousMessage = null,
  onViewPickEm
}) => {
  const [showReactions, setShowReactions] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [videoPoster, setVideoPoster] = useState<string | null>(null);
  const { toast } = useToast();
  
  const isOwnMessage = currentUserId === message.user_id;
  const isGameBot = message.is_bot_message;
  const isTeamAgent = message.is_team_agent_message;
  const shouldShowAvatar = shouldShowProfile(message, previousMessage);

  const formattedTime = useMemo(() => {
    return formatDistanceToNow(new Date(message.created_at), { addSuffix: true });
  }, [message.created_at]);

  const displayName = useMemo(() => {
    if (message.source?.posterName) return message.source.posterName;
    if (isGameBot) return 'Game Bot';
    if (isTeamAgent && teamName) return teamName;
    return user?.display_name || user?.username || 'Unknown User';
  }, [message.source?.posterName, isGameBot, isTeamAgent, teamName, user]);

  const avatarUrl = useMemo(() => {
    if (message.source?.posterAvatar) return message.source.posterAvatar;
    if (isGameBot) return '/sh-logo-updated.png';
    if (isTeamAgent && teamLogoUrl) return teamLogoUrl;
    return user?.avatar_url;
  }, [message.source?.posterAvatar, isGameBot, isTeamAgent, teamLogoUrl, user]);

  const handleReaction = useCallback((emoji: string) => {
    onAddReaction?.(message.id, emoji);
  }, [message.id, onAddReaction]);

  const handleMakePublic = useCallback(async () => {
    try {
      await supabase
        .from('posts')
        .insert({
          content: message.content,
          media_url: message.media_url,
          media_type: message.media_type,
          user_id: message.user_id,
        });
      
      toast({
        title: "Success",
        description: "Message posted to Spotlight!",
      });
    } catch (error) {
      console.error('Error making post public:', error);
      toast({
        title: "Error",
        description: "Failed to post to Spotlight",
        variant: "destructive",
      });
    }
  }, [message, toast]);

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

  const isXEmbed = useMemo(() => {
    const code = message.embed_code || '';
    return /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\//.test(code) || /twitter-tweet/.test(code);
  }, [message.embed_code]);

  // Generate video poster for messages with video media
  useEffect(() => {
    if (message.media_url && message.media_type === 'video') {
      extractVideoFrame(message.media_url)
        .then(setVideoPoster)
        .catch(console.warn);
    }
  }, [message.media_url, message.media_type]);

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

  // Handle Pick 'Em card rendering (from embed_code)
  if (message.embed_code) {
    try {
      const embedData = JSON.parse(message.embed_code);
      if (embedData.type === 'pickem_card' && onViewPickEm) {
        return (
          <div className="px-4 py-2">
            <PickEmCard
              instanceId={embedData.instanceId}
              title={embedData.title}
              gameCount={embedData.gameCount}
              onViewDetails={onViewPickEm}
            />
          </div>
        );
      }
    } catch (e) {
      // Not a Pick 'Em card, continue
    }
  }

  // Handle Pick 'Em card rendering (from content JSON)
  if (message.content) {
    try {
      const contentData = JSON.parse(message.content);
      if (contentData?.type === 'pickem_card' && onViewPickEm) {
        return (
          <div className="px-4 py-2">
            <PickEmCard
              instanceId={contentData.instanceId}
              title={contentData.title}
              gameCount={contentData.gameCount}
              onViewDetails={onViewPickEm}
            />
          </div>
        );
      }
    } catch (e) {
      // Content is not JSON; continue
    }
  }

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-1 hover:bg-muted/30 transition-colors group relative",
        isOwnMessage ? "flex-row-reverse" : "flex-row"
      )}
      data-message-id={message.id}
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
      {/* Make Public Button - Only show for own messages */}
      {isOwnMessage && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMakePublic}
          className="absolute top-2 right-2 h-6 w-6 p-0 rounded-full bg-black/80 text-white border border-white/30 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="Make Public to Spotlight"
        >
          <Megaphone className="w-3 h-3" />
        </Button>
      )}
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
            {isGameBot && (
              <Badge variant="secondary" className="text-xs h-5">
                Bot
              </Badge>
            )}
            {message.source?.posterName && (
              <span className="text-xs text-muted-foreground opacity-40">
                via broadcast
              </span>
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
          isXEmbed ? (
            <XPostEmbed embedCode={message.embed_code} />
          ) : (
            <div
              className="rounded-xl overflow-hidden my-2 max-w-[85%] shadow [&>iframe]:w-full [&>iframe]:h-auto"
              style={{ pointerEvents: 'auto' }}
              dangerouslySetInnerHTML={{ __html: sanitizeEmbedCode(message.embed_code) }}
            />
          )
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
                poster={videoPoster || undefined}
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
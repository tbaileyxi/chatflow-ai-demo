import React, { memo, useMemo, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageSquare, Share } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    is_bot_message?: boolean;
    media_url?: string;
    media_type?: string;
    reactions?: any[];
    poll_data?: any;
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
}

const StreamingCaret = memo(() => (
  <span className="inline-block w-2 h-5 bg-primary ml-1 animate-pulse" />
));

StreamingCaret.displayName = 'StreamingCaret';

export const MessageBubble = memo<MessageBubbleProps>(({
  message,
  user,
  currentUserId,
  teamName,
  teamLogoUrl,
  onAddReaction,
  onPollVote,
  isStreaming = false,
  isConsecutive = false
}) => {
  const isOwnMessage = currentUserId === message.user_id;
  const isTeamAgent = message.is_bot_message;

  const formattedTime = useMemo(() => {
    return formatDistanceToNow(new Date(message.created_at), { addSuffix: true });
  }, [message.created_at]);

  const displayName = useMemo(() => {
    if (isTeamAgent && teamName) return `${teamName} Bot`;
    return user?.display_name || user?.username || 'Unknown User';
  }, [isTeamAgent, teamName, user]);

  const avatarUrl = useMemo(() => {
    if (isTeamAgent && teamLogoUrl) return teamLogoUrl;
    return user?.avatar_url;
  }, [isTeamAgent, teamLogoUrl, user]);

  const handleReaction = useCallback((emoji: string) => {
    onAddReaction?.(message.id, emoji);
  }, [message.id, onAddReaction]);

  const handleLongPress = useCallback(() => {
    // Copy message to clipboard
    navigator.clipboard?.writeText(message.content);
  }, [message.content]);

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
        "flex gap-3 px-4 py-2 hover:bg-muted/50 transition-colors group",
        isOwnMessage && "bg-muted/30"
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
      }}
    >
      {!isConsecutive && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="text-xs">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn("flex-1 min-w-0", isConsecutive && "ml-11")}>
        {!isConsecutive && (
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">
              {displayName}
            </span>
            {isTeamAgent && (
              <Badge variant="secondary" className="text-xs h-5">
                Bot
              </Badge>
            )}
            <span className="text-xs text-muted-foreground shrink-0">
              {formattedTime}
            </span>
          </div>
        )}
        
        <div className="text-sm leading-relaxed">
          {renderedContent}
        </div>

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

        {/* Quick reaction buttons on hover */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 mt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => handleReaction('❤️')}
          >
            <Heart className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => handleReaction('👍')}
          >
            👍
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => handleReaction('😂')}
          >
            😂
          </Button>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Memoization comparison
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.reactions?.length === nextProps.message.reactions?.length &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.isConsecutive === nextProps.isConsecutive &&
    prevProps.currentUserId === nextProps.currentUserId
  );
});

MessageBubble.displayName = 'MessageBubble';
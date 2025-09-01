import React, { memo, useMemo, useState, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { LazyEmbed } from '@/components/chat/LazyEmbed';
import { XPostEmbed } from '@/components/embeds/XPostEmbed';
import { MakePublicButton } from '@/components/MakePublicButton';
import { supabase } from '@/integrations/supabase/client';

interface ModernChatBubbleProps {
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
    origin_teams?: {
      name: string;
      logo_url?: string;
    };
  };
  user: {
    id: string;
    display_name: string;
    avatar_url?: string;
  } | null;
  currentUserId?: string;
  teamName?: string;
  teamLogoUrl?: string;
  teamId?: string;
  isConsecutive?: boolean;
  previousMessage?: {
    user_id: string;
  } | null;
}

const REACTIONS = ['👍', '🔥', '😂'];

export const ModernChatBubble = memo<ModernChatBubbleProps>(({
  message,
  user,
  currentUserId,
  teamName,
  teamLogoUrl,
  teamId,
  isConsecutive = false,
  previousMessage = null
}) => {
  const [showReactions, setShowReactions] = useState(false);
  const [doubleTapTimer, setDoubleTapTimer] = useState<NodeJS.Timeout | null>(null);
  
  const isOwnMessage = currentUserId === message.user_id;
  const isTeamBot = message.is_bot_message;
  const shouldShowAvatar = !isConsecutive && (!previousMessage || previousMessage.user_id !== message.user_id);

  const formattedTime = useMemo(() => {
    return formatDistanceToNow(new Date(message.created_at), { addSuffix: true });
  }, [message.created_at]);

  const displayName = useMemo(() => {
    if (message.is_team_agent_message && message.origin_teams?.name) {
      return `${message.origin_teams.name} Agent`;
    }
    if (isTeamBot && teamName) return `${teamName} Bot`;
    return user?.display_name || 'Unknown User';
  }, [message.is_team_agent_message, message.origin_teams, isTeamBot, teamName, user]);

  const avatarUrl = useMemo(() => {
    if (message.is_team_agent_message && message.origin_teams?.logo_url) {
      return message.origin_teams.logo_url;
    }
    if (isTeamBot && teamLogoUrl) return teamLogoUrl;
    return user?.avatar_url;
  }, [message.is_team_agent_message, message.origin_teams, isTeamBot, teamLogoUrl, user]);

  const handleReaction = useCallback(async (emoji: string) => {
    if (!currentUserId) return;

    try {
      // Check if user already reacted with this emoji
      const { data: existingReaction } = await supabase
        .from('huddle_message_reactions')
        .select('id')
        .eq('message_id', message.id)
        .eq('user_id', currentUserId)
        .eq('emoji', emoji)
        .single();

      if (existingReaction) {
        // Remove reaction
        await supabase
          .from('huddle_message_reactions')
          .delete()
          .eq('id', existingReaction.id);
      } else {
        // Add reaction
        await supabase
          .from('huddle_message_reactions')
          .insert({
            message_id: message.id,
            user_id: currentUserId,
            emoji: emoji
          });
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  }, [currentUserId, message.id]);

  const handleTap = useCallback(() => {
    if (doubleTapTimer) {
      // Double tap detected - add thumbs up
      clearTimeout(doubleTapTimer);
      setDoubleTapTimer(null);
      handleReaction('👍');
    } else {
      // First tap - start timer
      const timer = setTimeout(() => {
        setDoubleTapTimer(null);
      }, 300);
      setDoubleTapTimer(timer);
    }
  }, [doubleTapTimer, handleReaction]);

  const handleLongPress = useCallback(() => {
    setShowReactions(true);
  }, []);

  return (
    <div className={cn(
      "flex gap-3 px-4 py-2 group relative",
      isOwnMessage ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      {shouldShowAvatar && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage 
            src={avatarUrl} 
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
          <AvatarFallback className="text-xs bg-muted text-muted-foreground">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      
      {/* Message content */}
      <div className={cn(
        "flex-1 min-w-0 max-w-[85%]",
        shouldShowAvatar ? "" : "ml-11",
        isOwnMessage && shouldShowAvatar ? "mr-0" : "",
        isOwnMessage && !shouldShowAvatar ? "mr-11" : ""
      )}>

        {/* Reactions overlay */}
        {showReactions && (
          <div className={cn(
            "absolute top-0 z-10 flex items-center gap-2 p-2 bg-background/95 backdrop-blur-sm rounded-lg border shadow-lg",
            isOwnMessage ? "right-0" : "left-0"
          )}>
            {REACTIONS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-lg hover:scale-110 transition-transform"
                onClick={() => {
                  handleReaction(emoji);
                  setShowReactions(false);
                }}
              >
                {emoji}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm" 
              className="h-8 w-8 p-0 text-sm"
              onClick={() => setShowReactions(false)}
            >
              ✕
            </Button>
          </div>
        )}
        {/* Message header */}
        {shouldShowAvatar && (
          <div className={cn(
            "flex items-center gap-2 mb-1",
            isOwnMessage ? "justify-end" : "justify-start"
          )}>
            <span className="font-medium text-sm text-muted-foreground">
              {displayName}
            </span>
            {(isTeamBot || message.is_team_agent_message) && (
              <div className="flex items-center gap-1">
                <Bot className="h-3 w-3 text-accent" />
                <Badge variant="secondary" className="text-xs h-5 bg-accent/20 text-accent border-accent/30">
                  {message.is_team_agent_message ? 'Agent' : 'Bot'}
                </Badge>
              </div>
            )}
            <span className="text-xs text-muted-foreground/60">
              {formattedTime}
            </span>
          </div>
        )}
        
        {/* Combined message content and embed */}
        {(message.content || message.embed_code) && (
          <div 
            className={cn(
              "max-w-fit break-words cursor-pointer",
              (isTeamBot || message.is_team_agent_message) 
                ? "max-w-[95%]" 
                : isOwnMessage 
                  ? "ml-auto max-w-[85%]" 
                  : "max-w-[85%]"
            )}
            onClick={handleTap}
            onTouchStart={(e) => {
              const timer = setTimeout(handleLongPress, 500);
              const cleanup = () => clearTimeout(timer);
              e.currentTarget.addEventListener('touchend', cleanup, { once: true });
              e.currentTarget.addEventListener('touchmove', cleanup, { once: true });
            }}
          >
            {/* Text content */}
            {message.content && (
              <div className={cn(
                "rounded-2xl px-4 py-3 relative",
                isOwnMessage 
                  ? "bg-primary text-primary-foreground" 
                  : isTeamBot || message.is_team_agent_message
                    ? "glass-bot-bubble text-foreground"
                    : "glass-bubble text-foreground",
                shouldShowAvatar && !isConsecutive 
                  ? "rounded-2xl" 
                  : isOwnMessage 
                    ? "rounded-l-2xl rounded-tr-md rounded-br-2xl"
                    : "rounded-r-2xl rounded-tl-md rounded-bl-2xl",
                message.embed_code ? "mb-3" : ""
              )}>
                <div className="text-base leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </div>
                
                {/* Make Public Button for own messages */}
                {isOwnMessage && (
                  <div className="absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MakePublicButton
                      messageId={message.id}
                      messageContent={message.content || ''}
                      mediaUrl={message.media_url}
                      mediaType={message.media_type}
                      embedCode={message.embed_code}
                      teamId={teamId}
                      isOwner={true}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Embedded content */}
            {message.embed_code && (
              <div className="rounded-xl overflow-hidden w-full">
                <LazyEmbed>
                  <XPostEmbed embedCode={message.embed_code} />
                </LazyEmbed>
              </div>
            )}
          </div>
        )}

        {/* Media content */}
        {message.media_url && (
          <div className="mt-2 rounded-xl overflow-hidden max-w-xs">
            {message.media_type === 'image' ? (
              <img
                src={message.media_url}
                alt="Shared media"
                className="w-full h-auto rounded-xl"
                loading="lazy"
              />
            ) : (
              <video
                src={message.media_url}
                controls
                className="w-full h-auto rounded-xl"
                preload="metadata"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
});

ModernChatBubble.displayName = 'ModernChatBubble';
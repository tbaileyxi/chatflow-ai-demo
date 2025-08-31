import React, { memo, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { LazyEmbed } from '@/components/chat/LazyEmbed';
import DOMPurify from 'dompurify';

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
  isConsecutive?: boolean;
  previousMessage?: {
    user_id: string;
  } | null;
}

export const ModernChatBubble = memo<ModernChatBubbleProps>(({
  message,
  user,
  currentUserId,
  teamName,
  teamLogoUrl,
  isConsecutive = false,
  previousMessage = null
}) => {
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

  return (
    <div className={cn(
      "flex gap-3 px-4 py-2 group",
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
        
        {/* Message bubble */}
        {message.content && (
          <div className={cn(
            "rounded-2xl px-4 py-3 max-w-fit break-words",
            isOwnMessage 
              ? "bg-primary text-primary-foreground ml-auto" 
              : isTeamBot
                ? "glass-bot-bubble text-foreground"
                : "glass-bubble text-foreground",
            shouldShowAvatar && !isConsecutive 
              ? "rounded-2xl" 
              : isOwnMessage 
                ? "rounded-l-2xl rounded-tr-md rounded-br-2xl"
                : "rounded-r-2xl rounded-tl-md rounded-bl-2xl"
          )}>
            <div className="text-base leading-relaxed whitespace-pre-wrap">
              {message.content}
            </div>
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

        {/* Embedded content */}
        {message.embed_code && (
          <div className="mt-2 rounded-xl overflow-hidden max-w-sm">
            <LazyEmbed>
              <div
                className="embed-container rounded-xl overflow-hidden w-full max-w-full"
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(message.embed_code, {
                    ADD_TAGS: ['iframe', 'blockquote', 'script'],
                    ADD_ATTR: ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'class', 'id']
                  })
                }}
              />
            </LazyEmbed>
          </div>
        )}
      </div>
    </div>
  );
});

ModernChatBubble.displayName = 'ModernChatBubble';
import React, { useState, useCallback, memo, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { MediaViewer } from "@/components/MediaViewer";
import { LazyEmbed } from "@/components/chat/LazyEmbed";
import { MakePublicButton } from "@/components/MakePublicButton";
import { cn } from "@/lib/utils";
import { XPostEmbed } from "@/components/embeds/XPostEmbed";
import { supabase } from "@/integrations/supabase/client";
import { shouldShowProfile, parsePickEmMessage } from "@/utils/chatMessage";
import { PickEmCard } from "@/components/pickem/PickEmCard";
interface ModernChatBubbleProps {
  message: any;
  currentUserId?: string;
  teamId?: string;
  teamLogoUrl?: string;
  previousMessage?: any;
  onReaction?: (messageId: string, emoji: string) => void;
  onViewPickEm?: (instanceId: string) => void;
}

const QUICK_REACTIONS = ['👍', '😂', '🔥'];

const ModernChatBubble = ({ message, currentUserId, teamId, teamLogoUrl, previousMessage, onReaction, onViewPickEm }: ModernChatBubbleProps) => {
  const [reactionPopoverOpen, setReactionPopoverOpen] = useState(false);
  const [hovering, setHovering] = useState(false);

  const isOwnMessage = message.user_id === currentUserId;
  const showProfile = shouldShowProfile(message, previousMessage);
  const handleReaction = useCallback((emoji: string) => {
    if (onReaction) {
      onReaction(message.id, emoji);
    }
    setReactionPopoverOpen(false);
  }, [onReaction, message.id]);

  const handleLongPress = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setReactionPopoverOpen(true);
  }, []);

  const handleMakePublic = useCallback(async () => {
    if (!currentUserId || currentUserId !== message.user_id) {
      console.error('Cannot make public: not owner');
      return;
    }

    try {
      // Determine message_type based on content
      let messageType = 'text';
      if (message.embed_code) {
        messageType = 'embed';
      } else if (message.media_url) {
        messageType = 'upload';
      }

      const { error } = await supabase
        .from('posts')
        .insert({
          content: message.content || '',
          media_url: message.media_url,
          message_type: messageType,
          embed_code: message.embed_code,
          team_id: teamId,
          author_id: currentUserId,
          target_audience: ['spotlight'],
          delivery_status: 'sent',
          is_spotlight: true
        });

      if (error) {
        console.error("Error making post public:", error);
        throw error;
      }

      console.log("Post made public successfully");
    } catch (error) {
      console.error("Failed to make post public:", error);
    }
  }, [message, currentUserId, teamId]);

  // Handle Pick 'Em card rendering using centralized parser
  const pickemData = parsePickEmMessage(message);
  if (pickemData && onViewPickEm) {
    return (
      <div className="px-4 py-2">
        <PickEmCard
          instanceId={pickemData.instanceId}
          title={pickemData.title}
          gameCount={pickemData.gameCount}
          onViewDetails={onViewPickEm}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex gap-4 py-2 px-6 transition-colors duration-200",
        "hover:bg-muted/30",
        isOwnMessage ? "flex-row-reverse" : "flex-row"
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Avatar with online status or spacer for consecutive messages */}
      {showProfile ? (
        <div className="relative">
          <Avatar className="h-10 w-10 shrink-0 border-2 border-border">
            <AvatarImage
              src={
                message.is_bot_message 
                  ? '/sh-logo-updated.png'
                  : message.is_team_agent_message
                    ? (message.origin_teams?.logo_url || teamLogoUrl)
                    : message.profiles?.avatar_url
              }
              className="object-cover"
            />
            <AvatarFallback className={cn(
              "text-sm font-medium",
              message.is_bot_message || message.is_team_agent_message ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              {message.is_bot_message
                ? 'GB'
                : message.is_team_agent_message
                  ? (message.origin_teams?.name?.[0] || 'T')
                  : (message.profiles?.display_name?.[0] || message.profiles?.username?.[0] || 'U')
              }
            </AvatarFallback>
          </Avatar>
          {/* Online status dot */}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-background rounded-full" />
        </div>
      ) : (
        <div className="w-10 shrink-0" aria-hidden="true" />
      )}

      {/* Message Content */}
      <div
        className={cn(
          "flex-1 min-w-0",
          isOwnMessage ? "text-right" : "text-left"
        )}
        style={{
          '--avatar-width': '3rem',
          width: message.embed_code ? 'calc(100% - var(--avatar-width))' : 'auto',
          maxWidth: message.embed_code ? '90%' : '75%'
        } as React.CSSProperties}
      >
        {/* User info with timestamp */}
        {showProfile && (
          <div className={cn(
            "flex items-center gap-3 mb-2 flex-wrap",
            isOwnMessage ? "justify-end" : "justify-start"
          )}>
            <span className="text-sm font-semibold text-foreground">
              {message.is_bot_message
                ? 'Game Bot'
                : message.is_team_agent_message
                  ? (message.origin_teams?.name || 'Team')
                  : (message.profiles?.display_name || message.profiles?.username || `User ${message.user_id.slice(0, 8)}`)
              }
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
          </div>
        )}

        {/* Message bubble with enhanced styling */}
        <Popover open={reactionPopoverOpen} onOpenChange={setReactionPopoverOpen}>
          <PopoverTrigger asChild>
            <div
              className={cn(
                "inline-block max-w-full rounded-2xl px-4 py-3",
                "text-base cursor-pointer select-text transition-all duration-200",
                "relative group/bubble",
                isOwnMessage
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-muted/80 backdrop-blur-sm text-foreground shadow-sm",
                hovering && "shadow-md transform scale-[1.02]"
              )}
              onContextMenu={handleLongPress}
              onTouchStart={(e) => {
                const timer = setTimeout(() => handleLongPress(e), 500);
                const cleanup = () => clearTimeout(timer);
                e.currentTarget.addEventListener('touchend', cleanup, { once: true });
                e.currentTarget.addEventListener('touchmove', cleanup, { once: true });
              }}
            >
              {/* Reaction button (shows on hover) */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "absolute -top-2 h-6 w-6 p-0 rounded-full bg-background border border-border shadow-sm",
                  "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                  isOwnMessage ? "-left-8" : "-right-8"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setReactionPopoverOpen(true);
                }}
              >
                <span className="text-xs">😊</span>
              </Button>

              {/* Text Content */}
              <div
                className="whitespace-pre-wrap break-words leading-relaxed"
                dangerouslySetInnerHTML={{ __html: message.content }}
              />

              {/* Media Content with layout shift prevention */}
              {message.media_url && (
                <div className="mt-3">
                  <MediaViewer
                    mediaUrl={message.media_url}
                    mediaType={message.media_type || 'image'}
                    showLightbox={message.media_type === 'image'}
                    className="rounded-xl"
                  />
                </div>
              )}

              {/* Embed Content with layout shift prevention - only render if not Pick 'Em */}
              {message.embed_code && !parsePickEmMessage(message) && (
                <div
                  className="mt-3 embed-chat rounded-xl x-embed-container"
                  style={{
                    contain: 'layout',
                    contentVisibility: 'auto',
                    WebkitOverflowScrolling: 'auto',
                    overflowX: 'hidden',
                    display: 'flex',
                    position: 'relative',
                    minHeight: 0,
                    WebkitTransform: 'translateZ(0)',
                    transform: 'translateZ(0)',
                    width: 'calc(100% - var(--avatar-width))'
                  }}
                >
                  <LazyEmbed>
                    <XPostEmbed embedCode={message.embed_code} />
                  </LazyEmbed>
                </div>
              )}
            </div>
          </PopoverTrigger>

          {/* Enhanced Reaction Picker */}
          <PopoverContent
            className="w-auto p-3 bg-background/95 backdrop-blur-sm border border-border shadow-xl"
            align={isOwnMessage ? "end" : "start"}
          >
            <div className="flex gap-1">
              {QUICK_REACTIONS.map((emoji) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 text-xl hover:bg-muted hover:scale-110 transition-all duration-200"
                  onClick={() => handleReaction(emoji)}
                >
                  {emoji}
                </Button>
              ))}
              {/* Add Make Public to reactions for own messages */}
              {isOwnMessage && (
                <MakePublicButton
                  messageId={message.id}
                  messageContent={message.content || ''}
                  mediaUrl={message.media_url}
                  mediaType={message.media_type}
                  embedCode={message.embed_code}
                  teamId={teamId}
                  isOwner={true}
                />
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Enhanced Reactions Display */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className={cn(
            "flex flex-wrap gap-2 mt-2",
            isOwnMessage ? "justify-end" : "justify-start"
          )}>
            {Object.entries(message.reactions).map(([emoji, data]: [string, any]) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-3 text-sm rounded-full transition-all duration-200",
                  "bg-muted/50 hover:bg-muted border border-border",
                  "hover:scale-105"
                )}
                onClick={() => handleReaction(emoji)}
              >
                <span className="mr-1">{emoji}</span>
                <span className="text-xs font-medium">{data.count}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModernChatBubble;

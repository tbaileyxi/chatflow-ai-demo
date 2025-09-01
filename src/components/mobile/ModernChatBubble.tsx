import React, { memo, useMemo, useState, useCallback, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, ThumbsUp, Flame, Smile, Camera, Image as ImageIcon, X, Megaphone, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MakePublicButton } from '@/components/MakePublicButton';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { LazyEmbed } from '@/components/chat/LazyEmbed';
import { XPostEmbed } from '@/components/embeds/XPostEmbed';

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
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isLongPress, setIsLongPress] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const handleMakePublic = async () => {
    try {
      await supabase
        .from('posts')
        .insert({
          content: message.content,
          media_url: message.media_url,
          media_type: message.media_type,
          user_id: message.user_id,
          team_id: teamId
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
    setShowReactionPicker(false);
  };
  
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
    if (tapTimeoutRef.current) {
      // Double tap detected - add thumbs up
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
      handleReaction('👍');
    } else {
      // First tap - start timer
      const timer = setTimeout(() => {
        tapTimeoutRef.current = null;
      }, 300);
      tapTimeoutRef.current = timer;
    }
  }, [handleReaction]);

  const handleLongPress = () => {
    if (isLongPress) return;
    setIsLongPress(true);
    setShowReactionPicker(true);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setShowReactionPicker(false);
      setIsLongPress(false);
    }, 5000);
  };

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
        {showReactionPicker && (
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
                  setShowReactionPicker(false);
                }}
              >
                {emoji}
              </Button>
            ))}
            {isOwnMessage && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-muted"
                onClick={handleMakePublic}
                title="Make Public to Spotlight"
              >
                <Megaphone className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm" 
              className="h-8 w-8 p-0 text-sm"
              onClick={() => setShowReactionPicker(false)}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMakePublic}
                      className="h-6 w-6 p-0 rounded-full bg-black/80 text-white border border-white/30 shadow-sm opacity-70 hover:opacity-100 transition-opacity"
                      title="Make Public to Spotlight"
                    >
                      <Megaphone className="w-3 h-3" />
                    </Button>
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
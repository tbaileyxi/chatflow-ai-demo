import React, { memo, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Megaphone, Star, Copy, Heart, ThumbsUp, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RetroMessageBubbleProps {
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
    embeds?: Array<{
      commentary: string;
      embed_code: string;
      embed_type: 'x' | 'iframe' | 'youtube';
    }>;
  };
  user: {
    id: string;
    display_name: string;
    avatar_url?: string;
    username?: string;
  } | null;
  currentUserId?: string;
  isAdmin?: boolean;
  onMegaphone?: (messageId: string) => void;
  onHighlight?: (messageId: string) => void;
  onCopyCallout?: (messageId: string, content: string) => void;
  className?: string;
}

const RetroReactionButtons = memo<{
  messageId: string;
  onReact: (emoji: string) => void;
  visible: boolean;
}>(({ messageId, onReact, visible }) => {
  const reactions = [
    { emoji: '👍', color: 'hsl(var(--team-primary))' },
    { emoji: '🔥', color: 'hsl(var(--team-secondary))' },
    { emoji: '⚡', color: 'hsl(var(--team-accent))' }
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex gap-1 mt-2"
        >
          {reactions.map(({ emoji, color }) => (
            <Button
              key={emoji}
              variant="ghost"
              size="sm"
              className="retro-reaction h-7 w-7 p-0"
              style={{ 
                '--reaction-color': color,
                borderColor: color,
                backgroundColor: `${color.replace(')', ' / 0.1)')}` 
              } as React.CSSProperties}
              onClick={() => onReact(emoji)}
            >
              <span className="text-sm">{emoji}</span>
            </Button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

RetroReactionButtons.displayName = 'RetroReactionButtons';

export const RetroMessageBubble = memo<RetroMessageBubbleProps>(({
  message,
  user,
  currentUserId,
  isAdmin = false,
  onMegaphone,
  onHighlight,
  onCopyCallout,
  className
}) => {
  const [showReactions, setShowReactions] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const { toast } = useToast();

  const isOwnMessage = currentUserId === message.user_id;
  const isBot = message.is_bot_message || message.is_team_agent_message;

  const formattedTime = useMemo(() => {
    return formatDistanceToNow(new Date(message.created_at), { addSuffix: true });
  }, [message.created_at]);

  const displayName = useMemo(() => {
    if (isBot) return 'Game Bot';
    return user?.display_name || user?.username || `User ${message.user_id.slice(0, 8)}`;
  }, [isBot, user, message.user_id]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast({
        title: "Copied!",
        description: "Message copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [message.content, toast]);

  const handleCallout = useCallback(() => {
    onCopyCallout?.(message.id, message.content);
    toast({
      title: "Called Out!",
      description: "Message added to highlights",
    });
  }, [message.id, message.content, onCopyCallout, toast]);

  const handleMegaphone = useCallback(() => {
    onMegaphone?.(message.id);
    toast({
      title: "Broadcasting!",
      description: "Message sent to Spotlight Feed",
    });
  }, [message.id, onMegaphone, toast]);

  const handleHighlight = useCallback(() => {
    onHighlight?.(message.id);
    toast({
      title: "Highlighted!",
      description: "Message added to highlights sidebar",
    });
  }, [message.id, onHighlight, toast]);

  const handleReaction = useCallback((emoji: string) => {
    // Handle team-colored reactions
    console.log(`Reacting with ${emoji} to message ${message.id}`);
    setShowReactions(false);
  }, [message.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group relative px-4 py-2 hover:bg-muted/20 transition-all duration-200",
        className
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactions(false);
      }}
    >
      {/* Action Buttons */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute right-2 top-2 flex gap-1 z-10"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 w-6 p-0 bg-background/80 border border-border hover:bg-muted"
              title="Copy Message"
            >
              <Copy className="w-3 h-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCallout}
              className="h-6 w-6 p-0 bg-background/80 border border-border hover:bg-muted"
              title="Call Out to Highlights"
            >
              <Star className="w-3 h-3" />
            </Button>

            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMegaphone}
                  className="retro-megaphone h-6 w-6 p-0"
                  title="Broadcast to Spotlight"
                >
                  <Megaphone className="w-3 h-3" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleHighlight}
                  className="h-6 w-6 p-0 bg-team-secondary/20 border border-team-secondary/40 hover:bg-team-secondary/30"
                  title="Force Highlight"
                >
                  <Flame className="w-3 h-3 text-team-secondary" />
                </Button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Content */}
      <div className={cn(
        "flex gap-3",
        isOwnMessage ? "flex-row-reverse" : "flex-row"
      )}>
        {/* Avatar */}
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={user?.avatar_url} alt={displayName} />
          <AvatarFallback className="text-xs font-pixel">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Message Bubble */}
        <div className="flex-1 max-w-[70%]">
          {/* Header */}
          <div className={cn(
            "flex items-center gap-2 mb-1",
            isOwnMessage ? "justify-end" : "justify-start"
          )}>
            <span className="font-chat font-medium text-sm opacity-80 truncate">
              {displayName}
            </span>
            {isBot && (
              <Badge variant="secondary" className="text-xs h-4 font-pixel">
                BOT
              </Badge>
            )}
            <span className="text-xs text-muted-foreground font-arcade">
              {formattedTime}
            </span>
          </div>

          {/* Content */}
          <div className={cn(
            "relative rounded-xl px-4 py-3 transition-all duration-200",
            isOwnMessage 
              ? "retro-bubble own ml-auto" 
              : isBot
              ? "bg-gradient-to-r from-team-primary/10 to-team-accent/10 border border-team-primary/20"
              : "retro-bubble",
            "hover:scale-[1.02] hover:shadow-lg"
          )}>
            <div className="font-chat text-sm leading-relaxed whitespace-pre-wrap break-words contrast-text">
              {message.content}
            </div>

            {/* Embed Content */}
            {(message.embeds && message.embeds.length > 0) || message.embed_code ? (
              <div className="mt-3">
                <div className="retro-embed overflow-hidden">
                  {message.embed_code && (
                    <div 
                      className="w-full"
                      dangerouslySetInnerHTML={{ __html: message.embed_code }}
                    />
                  )}
                </div>
              </div>
            ) : null}

            {/* Media */}
            {message.media_url && (
              <div className="mt-3">
                {message.media_type === 'image' ? (
                  <img
                    src={message.media_url}
                    alt="Shared media"
                    className="max-w-full rounded-lg shadow-sm retro-embed"
                    loading="lazy"
                  />
                ) : (
                  <video
                    src={message.media_url}
                    controls
                    className="max-w-full rounded-lg shadow-sm retro-embed"
                    preload="metadata"
                  />
                )}
              </div>
            )}

            {/* Reaction Button */}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "absolute -bottom-2 h-6 w-6 p-0 rounded-full bg-background border border-border shadow-sm transition-all duration-200",
                "opacity-0 group-hover:opacity-100",
                isOwnMessage ? "-left-8" : "-right-8"
              )}
              onClick={() => setShowReactions(!showReactions)}
            >
              <span className="text-xs">⚡</span>
            </Button>
          </div>

          {/* Reactions */}
          <RetroReactionButtons
            messageId={message.id}
            onReact={handleReaction}
            visible={showReactions}
          />
        </div>
      </div>
    </motion.div>
  );
});

RetroMessageBubble.displayName = 'RetroMessageBubble';
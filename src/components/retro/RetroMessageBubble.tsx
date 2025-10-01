import React, { memo, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Megaphone, Star, Copy, Heart, ThumbsUp, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
    { emoji: '🔥', label: 'Fire' },
    { emoji: '⚡', label: 'Electric' },
    { emoji: '💪', label: 'Strong' },
    { emoji: '🦬', label: 'Buffalo' },
    { emoji: '⭐', label: 'Star' },
    { emoji: '💯', label: 'Hundred' }
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex gap-1 mt-1"
        >
          {reactions.map(({ emoji, label }) => (
            <Button
              key={emoji}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-team-primary/10 border border-team-primary/30 hover:bg-team-primary/20 hover:scale-110 transition-all duration-200"
              onClick={() => onReact(emoji)}
              title={label}
            >
              <span className="text-xs">{emoji}</span>
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
  const [activeReactions, setActiveReactions] = useState<string[]>([]);
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

  // Auto-adjust text color based on background
  const getContrastTextColor = (isOwnMessage: boolean, isBot: boolean) => {
    if (isBot) return 'text-foreground'; // Bot messages use gradient, keep default
    if (isOwnMessage) return 'text-white'; // Own messages on dark background
    return 'text-foreground'; // Other messages on light background
  };

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
    setActiveReactions(prev => 
      prev.includes(emoji) 
        ? prev.filter(r => r !== emoji)
        : [...prev, emoji]
    );
    setShowReactions(false);
    toast({
      title: "Reacted!",
      description: `Added ${emoji} reaction`,
    });
  }, [toast]);

  const handleLongPress = useCallback(() => {
    setShowReactions(true);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "group relative py-1 px-2 hover:bg-muted/10 transition-all duration-200",
        className
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactions(false);
      }}
      onTouchStart={handleLongPress}
    >
      {/* Action Buttons */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-2 top-1 flex gap-1 z-10"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-5 w-5 p-0 bg-background/80 border border-border hover:bg-muted"
              title="Copy Message"
            >
              <Copy className="w-2.5 h-2.5" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCallout}
              className="h-5 w-5 p-0 bg-background/80 border border-border hover:bg-muted"
              title="Call Out to Highlights"
            >
              <Star className="w-2.5 h-2.5" />
            </Button>

            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMegaphone}
                  className="retro-megaphone h-5 w-5 p-0"
                  title="Broadcast to Spotlight"
                >
                  <Megaphone className="w-2.5 h-2.5" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleHighlight}
                  className="h-5 w-5 p-0 bg-team-secondary/20 border border-team-secondary/40 hover:bg-team-secondary/30"
                  title="Force Highlight"
                >
                  <Flame className="w-2.5 h-2.5 text-team-secondary" />
                </Button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Content - Left-aligned like real messaging apps */}
      <div className="flex gap-2 items-start">
        {/* Avatar */}
        <Avatar className="h-8 w-8 shrink-0 mt-0.5 border border-team-primary/40">
          <AvatarImage src={user?.avatar_url} alt={displayName} />
          <AvatarFallback className="text-xs font-pixel bg-team-primary/20 text-team-primary border border-team-primary/30">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          {/* Header with name and time */}
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-exo2 font-medium text-xs text-foreground/90 truncate">
              {displayName}
            </span>
            {isBot && (
              <Badge variant="secondary" className="text-xs h-3.5 px-1 font-pixel">
                BOT
              </Badge>
            )}
            <span className="text-xs text-muted-foreground font-pixel ml-auto shrink-0">
              {formattedTime}
            </span>
          </div>

          {/* Message Bubble - Real chat app style with proper contrast */}
          <div className={cn(
            "relative inline-block max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed transition-all duration-200",
            isBot 
              ? "bg-gradient-to-r from-yellow-400/80 to-amber-500/80 border-2 border-yellow-500/50 text-black font-bold shadow-lg shadow-yellow-500/30" 
              : isOwnMessage
              ? "bg-team-primary/90 text-white border border-team-primary/50"
              : "bg-muted/80 text-foreground border border-border",
            "hover:shadow-lg hover:scale-[1.01]"
          )}>
            <div className="font-exo2 whitespace-pre-wrap break-words">
              {message.content}
            </div>

            {/* Inline Embeds */}
            {(message.embeds && message.embeds.length > 0) || message.embed_code ? (
              <div className="mt-2 -mx-1">
                <div className="retro-embed overflow-hidden rounded-lg border border-team-primary/30 bg-background/50">
                  {message.embed_code && (
                    <div 
                      className="w-full p-2"
                      dangerouslySetInnerHTML={{ __html: message.embed_code }}
                    />
                  )}
                </div>
              </div>
            ) : null}

            {/* Media */}
            {message.media_url && (
              <div className="mt-2 -mx-1">
                {message.media_type === 'image' ? (
                  <img
                    src={message.media_url}
                    alt="Shared media"
                    className="max-w-full rounded-lg shadow-sm"
                    loading="lazy"
                  />
                ) : (
                  <video
                    src={message.media_url}
                    controls
                    className="max-w-full rounded-lg shadow-sm"
                    preload="metadata"
                  />
                )}
              </div>
            )}

            {/* Highlight Button - replacing duplicate "+" */}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "absolute -bottom-1 -right-1 h-5 w-5 p-0 rounded-full bg-team-secondary/20 border border-team-secondary/40 shadow-sm transition-all duration-200",
                "opacity-0 group-hover:opacity-100 hover:scale-110 retro-button-glow"
              )}
              onClick={() => handleHighlight()}
              title="Highlight Message"
            >
              <span className="text-xs">⭐</span>
            </Button>
          </div>

          {/* Active Reactions - Display inline with team colors */}
          {activeReactions.length > 0 && (
            <div className="flex gap-1 mt-2">
              {activeReactions.map((emoji, index) => (
                <motion.span 
                  key={index}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-team-primary/30 border border-team-primary/50 rounded-full retro-button-glow"
                >
                  {emoji} <span className="text-xs font-pixel text-team-primary font-bold">1</span>
                </motion.span>
              ))}
            </div>
          )}

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
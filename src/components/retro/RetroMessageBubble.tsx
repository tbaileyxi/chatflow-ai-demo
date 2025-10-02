import React, { memo, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDistanceToNow } from 'date-fns';
import { Megaphone, Copy, Trophy } from 'lucide-react';
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
  isGrouped?: boolean;
  onMegaphone?: (messageId: string) => void;
  onHighlight?: (messageId: string) => void;
  onCopyCallout?: (messageId: string, content: string) => void;
  className?: string;
}

// Simplified reactions - only 3 static emojis for mobile-first (Lightning = Heat Check)
const SIMPLE_REACTIONS = ['⚡', '👍', '😂'];

export const RetroMessageBubble = memo<RetroMessageBubbleProps>(({
  message,
  user,
  currentUserId,
  isAdmin = false,
  isGrouped = false,
  onMegaphone,
  onHighlight,
  onCopyCallout,
  className
}) => {
  const [showActions, setShowActions] = useState(false);
  const [broadcastPopoverOpen, setBroadcastPopoverOpen] = useState(false);
  const [includeHighlight, setIncludeHighlight] = useState(false);
  const [reactions, setReactions] = useState<{ emoji: string; count: number }[]>([]);
  const [showReactions, setShowReactions] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

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
      title: "Saved to Highlights!",
      description: "Message added to highlights sidebar",
    });
  }, [message.id, message.content, onCopyCallout, toast]);

  const handleBroadcast = useCallback(() => {
    onMegaphone?.(message.id);
    if (includeHighlight) {
      onHighlight?.(message.id);
    }
    toast({
      title: "Broadcasted!",
      description: includeHighlight 
        ? "Message sent to Spotlight and saved to Highlights"
        : "Message sent to Spotlight Feed",
    });
    setBroadcastPopoverOpen(false);
    setIncludeHighlight(false);
  }, [message.id, includeHighlight, onMegaphone, onHighlight, toast]);

  const handleReaction = useCallback((emoji: string) => {
    setReactions(prev => {
      const existing = prev.find(r => r.emoji === emoji);
      if (existing) {
        return prev.map(r => r.emoji === emoji ? { ...r, count: r.count + 1 } : r);
      }
      return [...prev, { emoji, count: 1 }];
    });
    toast({
      title: "Reacted!",
      description: `Added ${emoji} reaction`,
    });
  }, [toast]);

  // Bot messages = full-width updates with solid text
  if (isBot) {
    return (
      <div className="w-full px-2 py-1">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="retro-megaphone p-3 sm:p-4 rounded-lg border-2 border-yellow-600/60 bg-gradient-to-r from-yellow-400 to-amber-500 shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
              <span className="font-bold text-xs tracking-wider uppercase text-black">Live Update</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              {formattedTime}
            </div>
          </div>
          
          {/* Fixed: Solid background instead of gradient for better readability */}
          <div className="px-3 py-1.5 rounded-lg bg-background border border-team-primary/30">
            <p className="text-sm font-medium text-foreground">
              {message.content}
            </p>
          </div>
          
          {message.embed_code && (
            <div 
              className="mt-3 retro-embed" 
              dangerouslySetInnerHTML={{ __html: message.embed_code }}
            />
          )}

          {/* Bot message actions - simplified */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 text-xs hover:bg-team-primary/20 text-team-primary rounded-lg"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Regular user messages - mobile-first design
  const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowReactions(true);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <motion.div
      className={cn(
        "group flex gap-2 sm:gap-3 hover:bg-team-primary/5 p-1 sm:p-2 rounded-lg transition-colors",
        "relative touch-manipulation"
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={handleLongPressStart}
      onTouchEnd={handleLongPressEnd}
    >
      {/* Avatar - hidden if grouped */}
      {!isGrouped && (
        <Avatar className="h-7 w-7 sm:h-8 sm:w-8 ring-2 ring-team-primary/30 shrink-0">
          <AvatarImage src={user?.avatar_url} />
          <AvatarFallback className="bg-team-primary/20 text-team-primary text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      {isGrouped && <div className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" />}

      {/* Content - full width on mobile */}
      <div className="flex-1 min-w-0">
        {/* Header - hidden if grouped */}
        {!isGrouped && (
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <span className="font-semibold text-team-primary text-xs sm:text-sm truncate">
              {displayName}
            </span>
            <span className="text-xs text-muted-foreground/60 shrink-0">
              {formattedTime}
            </span>
          </div>
        )}

        {/* Message content - mobile optimized padding */}
        <div className="retro-bubble p-2 rounded-lg border border-team-primary/30 bg-gradient-to-br from-background/80 to-team-primary/5 backdrop-blur-sm relative">
          <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap break-words">
            {message.content}
          </p>

          {/* Media - responsive sizing */}
          {message.media_url && (
            <div className="mt-2 rounded-lg overflow-hidden border border-team-primary/20">
              {message.media_type === 'image' ? (
                <img 
                  src={message.media_url} 
                  alt="Shared media" 
                  className="w-full h-auto max-h-60 sm:max-h-96 object-contain bg-black/20"
                />
              ) : (
                <video 
                  src={message.media_url} 
                  controls 
                  className="w-full h-auto max-h-60 sm:max-h-96 bg-black/20"
                />
              )}
            </div>
          )}

          {/* Embeds */}
          {message.embed_code && (
            <div className="mt-2">
              <div 
                className="retro-embed"
                dangerouslySetInnerHTML={{ __html: message.embed_code }}
              />
            </div>
          )}
        </div>

        {/* Reactions - mobile-friendly touch targets */}
        {reactions.length > 0 && (
          <motion.div 
            className="flex gap-1.5 mt-2 flex-wrap"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            {reactions.map((reaction, idx) => (
              <motion.div
                key={idx}
                className="px-2.5 py-1 rounded-full bg-team-primary/20 border border-team-primary/30 text-xs flex items-center gap-1 min-h-[28px] touch-manipulation"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: idx * 0.05, type: "spring" }}
              >
                <span className="text-base">{reaction.emoji}</span>
                <span className="text-team-primary font-medium">{reaction.count}</span>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Action buttons - simplified mobile-friendly */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              className="flex items-center gap-1 sm:gap-1.5 mt-2 flex-wrap"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Simple static reactions - mobile-first */}
            {/* Simple static reactions - desktop only */}
            <div className="hidden sm:flex items-center gap-1">
              {SIMPLE_REACTIONS.map((emoji) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 sm:h-9 sm:w-9 p-0 text-lg sm:text-xl hover:bg-team-primary/20 hover:scale-110 transition-all rounded-full touch-manipulation"
                  onClick={() => handleReaction(emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>

              {/* Copy */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 px-2 sm:px-3 text-xs hover:bg-team-primary/20 text-muted-foreground rounded-full touch-manipulation"
              >
                <Copy className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Copy</span>
              </Button>

              {/* Admin broadcast - mobile optimized */}
              {isAdmin && (
                <Popover open={broadcastPopoverOpen} onOpenChange={setBroadcastPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 sm:px-3 text-xs hover:bg-destructive/20 text-destructive rounded-full touch-manipulation"
                    >
                      <Megaphone className="h-3 w-3 sm:mr-1" />
                      <span className="hidden sm:inline">Broadcast</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3 bg-background/95 backdrop-blur-sm border-team-primary/30" align="end">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="includeHighlight"
                          checked={includeHighlight}
                          onChange={(e) => setIncludeHighlight(e.target.checked)}
                          className="h-4 w-4 touch-manipulation"
                        />
                        <label htmlFor="includeHighlight" className="text-sm">
                          Also add to highlights
                        </label>
                      </div>
                      <Button
                        onClick={() => {
                          handleBroadcast();
                          setBroadcastPopoverOpen(false);
                        }}
                        className="w-full bg-destructive hover:bg-destructive/90 touch-manipulation min-h-[44px]"
                        size="sm"
                      >
                        <Megaphone className="h-3 w-3 mr-2" />
                        Confirm Broadcast
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

RetroMessageBubble.displayName = 'RetroMessageBubble';
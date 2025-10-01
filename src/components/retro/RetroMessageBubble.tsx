import React, { memo, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDistanceToNow } from 'date-fns';
import { Megaphone, Copy, Smile } from 'lucide-react';
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

// Emoji reactions for inline display
const TEAM_EMOJIS = ['🔥', '⚡', '💪', '🎯', '🏈', '👏', '💯', '🚀'];

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
  const [showActions, setShowActions] = useState(false);
  const [activeReactions, setActiveReactions] = useState<string[]>([]);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [alsoHighlight, setAlsoHighlight] = useState(false);
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
    if (alsoHighlight) {
      onHighlight?.(message.id);
    }
    toast({
      title: "Broadcasted!",
      description: alsoHighlight 
        ? "Message sent to Spotlight and saved to Highlights"
        : "Message sent to Spotlight Feed",
    });
    setBroadcastOpen(false);
    setAlsoHighlight(false);
  }, [message.id, alsoHighlight, onMegaphone, onHighlight, toast]);

  const handleReaction = useCallback((emoji: string) => {
    setActiveReactions(prev => 
      prev.includes(emoji) 
        ? prev.filter(r => r !== emoji)
        : [...prev, emoji]
    );
    toast({
      title: "Reacted!",
      description: `Added ${emoji} reaction`,
    });
  }, [toast]);

  // Bot messages = full-width embeds
  if (isBot) {
    return (
      <div className="w-full px-2 py-1">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.005, rotateX: 0.5 }}
          transition={{ duration: 0.2 }}
          className="retro-megaphone p-4 rounded-lg border-2 border-yellow-600/60 bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-[0_0_20px_rgba(251,191,36,0.4)]"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
            <span className="font-arcade text-[10px] tracking-wider uppercase">Live Update</span>
            <span className="font-pixel text-xs opacity-70 ml-auto">
              {formattedTime}
            </span>
          </div>
          
          <div className="font-orbitron text-sm font-bold leading-relaxed">
            {message.content}
          </div>
          
          {message.embed_code && (
            <div 
              className="mt-3 retro-embed" 
              dangerouslySetInnerHTML={{ __html: message.embed_code }}
            />
          )}

          {/* Bot message actions */}
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-black/20">
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-black/10 rounded transition-colors"
              title="Copy"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCallout}
              className="p-1.5 hover:bg-black/10 rounded transition-colors"
              title="Save to Highlights"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Regular user messages - left-aligned, tight spacing
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn(
        "group relative py-0.5 px-2 hover:bg-team-primary/5 transition-all duration-200 rounded",
        className
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Message Content - Left-aligned */}
      <div className="flex gap-2 items-start">
        {/* Avatar */}
        <Avatar className="h-7 w-7 shrink-0 mt-0.5 border border-team-primary/30">
          <AvatarImage src={user?.avatar_url} alt={displayName} />
          <AvatarFallback className="text-xs font-pixel bg-team-primary/20 text-team-primary">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          {/* Header with name and time */}
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-chat font-semibold text-xs text-team-primary truncate">
              {displayName}
            </span>
            <span className="text-[10px] text-muted-foreground font-pixel ml-auto shrink-0">
              {formattedTime}
            </span>
          </div>

          {/* Message Bubble */}
          <div className={cn(
            "relative inline-block max-w-[85%] px-3 py-1.5 rounded-xl text-sm leading-relaxed transition-all duration-200",
            "bg-muted/60 text-foreground border border-border/50",
            "hover:bg-muted/70 hover:shadow-md"
          )}>
            <div className="font-chat whitespace-pre-wrap break-words">
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
          </div>

          {/* Active Reactions - Inline with burst animation */}
          {activeReactions.length > 0 && (
            <div className="flex gap-1 mt-1">
              {activeReactions.map((emoji, index) => (
                <motion.span 
                  key={index}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-team-primary/20 border border-team-primary/40 rounded-full shadow-sm"
                >
                  {emoji} <span className="text-xs font-pixel text-team-primary font-bold">1</span>
                </motion.span>
              ))}
            </div>
          )}

          {/* Action Buttons - Show on hover */}
          <AnimatePresence>
            {showActions && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1 mt-1"
              >
                {/* Emoji Reaction Picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="p-1 hover:bg-team-primary/20 rounded transition-colors"
                      title="React"
                    >
                      <Smile className="w-3 h-3 text-team-primary" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2 bg-background/95 backdrop-blur border-team-primary/30">
                    <div className="flex gap-1">
                      {TEAM_EMOJIS.map((emoji) => (
                        <motion.button
                          key={emoji}
                          onClick={() => handleReaction(emoji)}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          className="text-lg p-1 hover:bg-team-primary/10 rounded transition-colors"
                        >
                          {emoji}
                        </motion.button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Copy Button */}
                <button
                  onClick={handleCopy}
                  className="p-1 hover:bg-team-primary/20 rounded transition-colors"
                  title="Copy"
                >
                  <Copy className="w-3 h-3 text-team-primary" />
                </button>

                {/* Call Out (Save to Highlights) */}
                <button
                  onClick={handleCallout}
                  className="p-1 hover:bg-team-primary/20 rounded transition-colors font-arcade text-[10px]"
                  title="Save to Highlights"
                >
                  ⭐
                </button>

                {/* Admin Broadcast with Highlight Toggle */}
                {isAdmin && (
                  <Popover open={broadcastOpen} onOpenChange={setBroadcastOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className="p-1 hover:bg-team-primary/20 rounded transition-colors"
                        title="Broadcast to Spotlight"
                      >
                        <Megaphone className="w-3 h-3 text-team-primary" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 bg-background/95 backdrop-blur border-team-primary/30 p-4">
                      <div className="space-y-3">
                        <h4 className="font-orbitron text-sm text-team-primary font-bold">Broadcast Message</h4>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="highlight-toggle"
                            checked={alsoHighlight}
                            onCheckedChange={(checked) => setAlsoHighlight(checked as boolean)}
                          />
                          <label
                            htmlFor="highlight-toggle"
                            className="text-sm font-chat cursor-pointer"
                          >
                            Also save to Highlights
                          </label>
                        </div>
                        <Button
                          onClick={handleBroadcast}
                          className="w-full retro-megaphone"
                          size="sm"
                        >
                          <Megaphone className="w-3 h-3 mr-2" />
                          Broadcast
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
});

RetroMessageBubble.displayName = 'RetroMessageBubble';

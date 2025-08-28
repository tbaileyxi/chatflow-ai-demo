import { useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { MediaViewer } from "@/components/MediaViewer";
import { TwitterEmbed } from "@/components/PostCard";
import { LazyEmbed } from "./LazyEmbed";
import { MakePublicButton } from "@/components/MakePublicButton";
import { cn } from "@/lib/utils";

interface ModernMessageBubbleProps {
  message: any;
  previousMessage?: any;
  isConsecutive?: boolean;
  onAddReaction?: (messageId: string, emoji: string) => void;
  currentUserId?: string;
  teamName?: string;
  teamLogoUrl?: string;
  teamId?: string;
  originTeamName?: string;
  onPollVote?: (messageId: string, optionId: number) => void;
  pollVotes?: Array<{ option_id: number; user_id: string }>;
  userVote?: number | null;
}

const QUICK_REACTIONS = ['👍', '👎', '❤️', '😂', '😮', '😢', '🔥', '💯'];

export const ModernMessageBubble = ({ 
  message, 
  previousMessage, 
  isConsecutive = false,
  onAddReaction,
  currentUserId,
  teamName,
  teamLogoUrl,
  teamId,
  originTeamName,
  onPollVote,
  pollVotes,
  userVote
}: ModernMessageBubbleProps) => {
  const [reactionPopoverOpen, setReactionPopoverOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hovering, setHovering] = useState(false);
  
  const isOwnMessage = message.user_id === currentUserId;
  const isTeamAgent = !!message.is_team_agent_message;
  const showProfile = !isConsecutive || previousMessage?.user_id !== message.user_id;
  const reactionsEnabled = !message.poll_data;
  const showContent = message.content && !(message.poll_data && typeof message.poll_data.question === 'string' && message.content.trim() === message.poll_data.question.trim());
  
  // Extract tags from content
  const extractTags = (content: string) => {
    const tagRegex = /#[\w]+/g;
    return content.match(tagRegex) || [];
  };
  
  const tags = extractTags(message.content || '');
  const contentWithoutTags = (message.content || '').replace(/#[\w]+/g, '').trim();
  
  const handleReaction = useCallback((emoji: string) => {
    if (onAddReaction) {
      onAddReaction(message.id, emoji);
    }
    setReactionPopoverOpen(false);
  }, [onAddReaction, message.id]);

  const handleLongPress = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (reactionsEnabled) {
      setReactionPopoverOpen(true);
    }
  }, [reactionsEnabled]);

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
      {/* Avatar with online status */}
      {showProfile && (
        <div className="relative">
          <Avatar className="h-10 w-10 shrink-0 border-2 border-border">
            <AvatarImage 
              src={isTeamAgent ? (message.origin_teams?.logo_url || teamLogoUrl) : message.profiles?.avatar_url} 
              className="object-cover"
            />
            <AvatarFallback className="text-sm font-medium bg-muted">
              {isTeamAgent
                ? ((message.origin_teams?.name || teamName)?.[0] || 'T')
                : (message.profiles?.display_name?.[0] || message.profiles?.username?.[0] || 'U')}
            </AvatarFallback>
          </Avatar>
          {/* Online status dot */}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-background rounded-full" />
        </div>
      )}
      
      {/* Spacer for consecutive messages */}
      {!showProfile && <div className="w-10 shrink-0" />}

      {/* Message Content */}
      <div className={cn(
        "flex-1 min-w-0 max-w-[75%]",
        isOwnMessage ? "text-right" : "text-left"
      )}>
        {/* User info with timestamp */}
        {showProfile && (
          <div className={cn(
            "flex items-center gap-3 mb-2 flex-wrap",
            isOwnMessage ? "justify-end" : "justify-start"
          )}>
            <span className="text-sm font-semibold text-foreground">
              {message.is_team_agent_message
                ? `${message.origin_teams?.name || originTeamName || teamName || 'Team'} Agent`
                : (message.profiles?.display_name || message.profiles?.username || 'Unknown User')}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
            {message.is_bot_message && (
              <Badge variant="outline" className="text-xs px-2 py-1 bg-primary/10">
                Game Bot
              </Badge>
            )}
            {/* Tags */}
            {tags.length > 0 && (
              <div className={cn(
                "flex gap-1 flex-wrap",
                isOwnMessage ? "order-first" : "ml-auto"
              )}>
                {tags.map((tag, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="text-xs px-2 py-1 bg-accent text-accent-foreground"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
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
                if (!reactionsEnabled) return;
                const timer = setTimeout(() => handleLongPress(e), 500);
                const cleanup = () => clearTimeout(timer);
                e.currentTarget.addEventListener('touchend', cleanup, { once: true });
                e.currentTarget.addEventListener('touchmove', cleanup, { once: true });
              }}
            >
              {/* Reaction button (shows on hover) */}
              {reactionsEnabled && (
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
              )}

              {/* Text Content */}
              {showContent && (
                <div 
                  className="whitespace-pre-wrap break-words leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: contentWithoutTags }}
                />
              )}

              {/* Media Content */}
              {message.media_url && (
                <div className="mt-3">
                  <MediaViewer 
                    mediaUrl={message.media_url} 
                    mediaType={message.media_type || 'image'}
                    className="rounded-xl overflow-hidden"
                  />
                </div>
              )}

              {/* Embed Content */}
              {message.embed_code && (
                <div className="mt-3">
                  <LazyEmbed>
                    <TwitterEmbed embedCode={message.embed_code} />
                  </LazyEmbed>
                </div>
              )}

              {/* Poll Content */}
              {message.poll_data && (
                <div className="mt-3 mb-2">
                  <h4 className="font-semibold mb-3 text-lg">{message.poll_data.question}</h4>
                  <div className="space-y-3">
                    {message.poll_data.options?.map((option: any) => {
                      const count = (pollVotes || []).filter(v => v.option_id === option.id).length;
                      const total = (pollVotes || []).length;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      const isUserVoted = userVote === option.id;
                      const isPreSelected = selectedOption === option.id;
                      
                      return (
                        <div key={option.id} className="relative">
                          <Button
                            variant={isUserVoted ? "default" : isPreSelected ? "secondary" : "outline"}
                            size="lg"
                            className={cn(
                              "w-full justify-between text-left h-auto py-3 px-4",
                              "transition-all duration-200 hover:scale-[1.02]"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (userVote === null) {
                                setSelectedOption(option.id);
                              }
                            }}
                            disabled={userVote !== null}
                          >
                            <span className="truncate font-medium">{option.text}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm opacity-80">{count}</span>
                              <span className="text-xs opacity-60">({pct}%)</span>
                            </div>
                          </Button>
                          {/* Vote percentage bar */}
                          {total > 0 && (
                            <div className="absolute bottom-0 left-0 h-1 bg-primary/30 rounded-b-lg transition-all duration-500"
                                 style={{ width: `${pct}%` }} />
                          )}
                        </div>
                      );
                    })}
                    {userVote === null && selectedOption !== null && (
                      <Button
                        size="lg"
                        className="w-full font-semibold"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPollVote?.(message.id, selectedOption);
                          setSelectedOption(null);
                        }}
                      >
                        SUBMIT VOTE
                      </Button>
                    )}
                    <p className="text-sm text-muted-foreground text-center pt-2">
                      {(pollVotes || []).length} total votes
                    </p>
                  </div>
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
            </div>
            {isOwnMessage && (
              <div className="mt-2 pt-2 border-t border-border flex justify-end">
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
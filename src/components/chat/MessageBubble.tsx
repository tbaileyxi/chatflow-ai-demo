import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { MediaViewer } from "@/components/MediaViewer";
import { TwitterEmbed } from "@/components/PostCard";
import { LazyEmbed } from "./LazyEmbed";
import { MakePublicButton } from "@/components/MakePublicButton";

interface MessageBubbleProps {
  message: any;
  previousMessage?: any;
  isConsecutive?: boolean;
  onAddReaction?: (messageId: string, emoji: string) => void;
  currentUserId?: string;
  teamName?: string;
  teamLogoUrl?: string;
  teamId?: string;
  onPollVote?: (messageId: string, optionId: number) => void;
  pollVotes?: Array<{ option_id: number; user_id: string }>;
  userVote?: number | null;
}

const QUICK_REACTIONS = ['👍', '👎', '❤️', '😂', '😮', '😢'];

export const MessageBubble = ({ 
  message, 
  previousMessage, 
  isConsecutive = false,
  onAddReaction,
  currentUserId,
  teamName,
  teamLogoUrl,
  teamId,
  onPollVote,
  pollVotes,
  userVote
}: MessageBubbleProps) => {
  const [reactionPopoverOpen, setReactionPopoverOpen] = useState(false);
  
  const isOwnMessage = message.user_id === currentUserId;
  const isTeamAgent = !!message.is_team_agent_message;
  const showProfile = !isConsecutive || previousMessage?.user_id !== message.user_id;
  const reactionsEnabled = !message.poll_data;
  const showContent = message.content && !(message.poll_data && typeof message.poll_data.question === 'string' && message.content.trim() === message.poll_data.question.trim());
  
  const handleReaction = (emoji: string) => {
    if (onAddReaction) {
      onAddReaction(message.id, emoji);
    }
    setReactionPopoverOpen(false);
  };

  const handleLongPress = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setReactionPopoverOpen(true);
  };

  return (
    <div className={`group flex gap-3 py-1 px-4 hover:bg-muted/50 ${
      isOwnMessage ? 'flex-row-reverse' : 'flex-row'
    }`}>
      {/* Avatar - only show for first message in sequence */}
      {showProfile && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={isTeamAgent ? teamLogoUrl : message.profiles?.avatar_url} />
          <AvatarFallback className="text-xs">
            {isTeamAgent
              ? (teamName?.[0] || 'T')
              : (message.profiles?.display_name?.[0] || message.profiles?.username?.[0] || 'U')}
          </AvatarFallback>
        </Avatar>
      )}
      
      {/* Invisible spacer for consecutive messages */}
      {!showProfile && <div className="w-8 shrink-0" />}

      {/* Message Content */}
      <div className={`flex-1 min-w-0 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
        {/* User info - only show for first message in sequence */}
        {showProfile && (
          <div className={`flex items-center gap-2 mb-1 ${
            isOwnMessage ? 'justify-end' : 'justify-start'
          }`}>
            <span className="text-sm font-medium">
              {message.is_team_agent_message
                ? `${teamName || 'Team'} Agent`
                : (message.profiles?.display_name || message.profiles?.username || 'Unknown User')}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
            {message.is_team_agent_message && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                Team Bot
              </Badge>
            )}
            {message.is_bot_message && (
              <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                Game Bot
              </Badge>
            )}
          </div>
        )}

        {/* Message bubble */}
        <Popover open={reactionPopoverOpen} onOpenChange={setReactionPopoverOpen}>
          <PopoverTrigger asChild>
            <div
              className={`inline-block max-w-[85%] rounded-2xl px-4 py-2 text-base cursor-pointer select-text ${
                isOwnMessage
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
              onPointerDown={(e) => {
                // Prevent opening emoji popover on normal taps/clicks when polls are present
                if (!reactionsEnabled) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onContextMenu={(e) => {
                if (!reactionsEnabled) return;
                handleLongPress(e);
              }}
              onTouchStart={(e) => {
                if (!reactionsEnabled) return;
                // Handle long press on touch devices
                const timer = setTimeout(() => handleLongPress(e), 500);
                const cleanup = () => clearTimeout(timer);
                e.currentTarget.addEventListener('touchend', cleanup, { once: true });
                e.currentTarget.addEventListener('touchmove', cleanup, { once: true });
              }}
            >
              {/* Text Content */}
              {showContent && (
                <div 
                  className="whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{ __html: message.content }}
                />
              )}

              {/* Media Content */}
              {message.media_url && (
                <div className="mt-2">
                  <MediaViewer 
                    mediaUrl={message.media_url} 
                    mediaType={message.media_type || 'image'} 
                  />
                </div>
              )}

              {/* Embed Content */}
              {message.embed_code && (
                <LazyEmbed>
                  <TwitterEmbed embedCode={message.embed_code} />
                </LazyEmbed>
              )}

              {/* Poll Content */}
              {message.poll_data && (
                <div className="mt-3">
                  <h4 className="font-medium mb-2">{message.poll_data.question}</h4>
                  <div className="space-y-2">
                    {message.poll_data.options?.map((option: any, index: number) => {
                      const count = (pollVotes || []).filter(v => v.option_id === index).length;
                      const isSelected = userVote === index;
                      return (
                        <Button
                          key={index}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="w-full justify-between text-left"
                          onPointerDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onPollVote?.(message.id, index);
                          }}
                        >
                          <span className="truncate">{option.text}</span>
                          <span className="ml-2 text-xs opacity-80">{count} vote{count !== 1 ? 's' : ''}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </PopoverTrigger>
          
          {/* Reaction Picker */}
          <PopoverContent className="w-auto p-2" align={isOwnMessage ? "end" : "start"}>
            <div className="flex gap-1">
              {QUICK_REACTIONS.map((emoji) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-lg hover:bg-muted"
                  onClick={() => handleReaction(emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>
            {isOwnMessage && (
              <div className="mt-1 flex justify-end">
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

        {/* Reactions */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${
            isOwnMessage ? 'justify-end' : 'justify-start'
          }`}>
            {Object.entries(message.reactions).map(([emoji, data]: [string, any]) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs rounded-full bg-muted/50 hover:bg-muted"
                onClick={() => handleReaction(emoji)}
              >
                {emoji} {data.count}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
import React, { useCallback, useMemo, memo } from "react";
import { VirtualizedChat } from "@/components/chat/VirtualizedChat";
import { ModernMessageBubble } from "@/components/chat/ModernMessageBubble";
import { MessageSkeleton } from "@/components/chat/MessageSkeleton";

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  [key: string]: any;
}

interface OptimizedVirtualizedChatProps {
  messages: Message[];
  currentUserId?: string;
  teamName?: string;
  teamLogoUrl?: string;
  teamId?: string;
  loading?: boolean;
  hasMore?: boolean;
  loadMoreTop?: () => Promise<void>;
  onAddReaction?: (messageId: string, emoji: string) => void;
  onPollVote?: (messageId: string, optionId: number) => void;
  pollVotes?: Array<{ option_id: number; user_id: string; post_id: string }>;
  userVotes?: { [messageId: string]: number | null };
}

export const OptimizedVirtualizedChat = memo(({
  messages,
  currentUserId,
  teamName,
  teamLogoUrl,
  teamId,
  loading = false,
  hasMore = false,
  loadMoreTop,
  onAddReaction,
  onPollVote,
  pollVotes = [],
  userVotes = {}
}: OptimizedVirtualizedChatProps) => {
  
  // Memoize message-specific poll votes to prevent unnecessary recalculations
  const getMessagePollVotes = useCallback((messageId: string) => {
    return pollVotes.filter(vote => vote.post_id === messageId);
  }, [pollVotes]);

  // Memoize the item content renderer to prevent re-renders
  const itemContent = useCallback((index: number, message: Message) => {
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const isConsecutive = previousMessage?.user_id === message.user_id;
    const messagePollVotes = getMessagePollVotes(message.id);
    const userVote = userVotes[message.id] || null;

    return (
      <ModernMessageBubble
        key={message.id}
        message={message}
        previousMessage={previousMessage}
        isConsecutive={isConsecutive}
        currentUserId={currentUserId}
        teamName={teamName}
        teamLogoUrl={teamLogoUrl}
        teamId={teamId}
        onAddReaction={onAddReaction}
        onPollVote={onPollVote}
        pollVotes={messagePollVotes}
        userVote={userVote}
      />
    );
  }, [messages, currentUserId, teamName, teamLogoUrl, teamId, onAddReaction, onPollVote, getMessagePollVotes, userVotes]);

  // Memoize the getItemKey function for stable virtualization
  const getItemKey = useCallback((message: Message) => message.id, []);

  // Show loading skeletons while messages are being fetched
  const loadingSkeletons = useMemo(() => {
    if (!loading) return null;
    
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <MessageSkeleton 
            key={`skeleton-${i}`} 
            showAvatar={i === 0 || Math.random() > 0.6}
            isOwnMessage={Math.random() > 0.5}
          />
        ))}
      </div>
    );
  }, [loading]);

  if (loading && messages.length === 0) {
    return loadingSkeletons;
  }

  return (
    <VirtualizedChat
      items={messages}
      loadMoreTop={hasMore ? loadMoreTop : undefined}
      itemContent={itemContent}
      getItemKey={getItemKey}
      defaultItemHeight={120} // Estimated height for better performance
      overscan={200} // Reduced overscan for better performance
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo optimization
  return (
    prevProps.messages.length === nextProps.messages.length &&
    prevProps.messages.every((msg, index) => 
      msg.id === nextProps.messages[index]?.id &&
      msg.content === nextProps.messages[index]?.content
    ) &&
    prevProps.currentUserId === nextProps.currentUserId &&
    prevProps.loading === nextProps.loading &&
    prevProps.hasMore === nextProps.hasMore &&
    JSON.stringify(prevProps.pollVotes) === JSON.stringify(nextProps.pollVotes) &&
    JSON.stringify(prevProps.userVotes) === JSON.stringify(nextProps.userVotes)
  );
});
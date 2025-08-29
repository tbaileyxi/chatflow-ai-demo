import React, { useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { JumpToLatest } from '@/components/JumpToLatest';

interface ChatListProps {
  messages: any[];
  loadOlderMessages: () => Promise<void>;
  renderMessage: (index: number, message: any) => React.ReactNode;
  hasMore: boolean;
  isLoadingMore?: boolean;
}

export interface ChatListRef {
  scrollToBottom: (behavior?: 'smooth' | 'auto') => void;
}

export const ChatList = forwardRef<ChatListRef, ChatListProps>(({
  messages,
  loadOlderMessages,
  renderMessage,
  hasMore,
  isLoadingMore
}, ref) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = React.useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = React.useState(false);

  useImperativeHandle(ref, () => ({
    scrollToBottom: (behavior = 'smooth') => {
      if (virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({
          index: messages.length - 1,
          behavior,
          align: 'end'
        });
      }
    }
  }));

  const handleStartReached = useCallback(async () => {
    if (hasMore && !isLoadingMore) {
      await loadOlderMessages();
    }
  }, [hasMore, isLoadingMore, loadOlderMessages]);

  const handleAtBottomStateChange = useCallback((bottom: boolean) => {
    setAtBottom(bottom);
    setShowJumpToLatest(!bottom && messages.length > 0);
  }, [messages.length]);

  const jumpToLatest = useCallback(() => {
    if (virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: messages.length - 1,
        behavior: 'smooth',
        align: 'end'
      });
    }
  }, [messages.length]);

  return (
    <div className="relative flex-1 h-full">
      <Virtuoso
        ref={virtuosoRef}
        data={messages}
        totalCount={messages.length}
        itemContent={(index, message) => (
          <div key={message.id || index}>
            {renderMessage(index, message)}
          </div>
        )}
        followOutput="auto"
        startReached={handleStartReached}
        atBottomStateChange={handleAtBottomStateChange}
        initialTopMostItemIndex={messages.length - 1}
        alignToBottom
        style={{ height: '100%' }}
        className="h-full"
        components={{
          Header: hasMore ? () => (
            <div className="flex justify-center py-4">
              {isLoadingMore ? (
                <div className="text-sm text-muted-foreground">Loading older messages...</div>
              ) : (
                <div className="text-sm text-muted-foreground">Scroll up for older messages</div>
              )}
            </div>
          ) : undefined
        }}
      />
      
      <JumpToLatest
        visible={showJumpToLatest}
        onClick={jumpToLatest}
      />
    </div>
  );
});

ChatList.displayName = 'ChatList';
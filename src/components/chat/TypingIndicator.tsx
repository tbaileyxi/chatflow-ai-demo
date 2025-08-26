import React from 'react';

interface TypingIndicatorProps {
  typingUsers: string[];
}

export const TypingIndicator = ({ typingUsers }: TypingIndicatorProps) => {
  if (typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0]} is typing`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0]} and ${typingUsers[1]} are typing`;
    } else {
      return `${typingUsers.length} people are typing`;
    }
  };

  return (
    <div className="px-4 py-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        {/* iMessage-like bubble with animated dots */}
        <div className="inline-flex items-center gap-2 rounded-2xl bg-muted px-3 py-1.5">
          <div className="flex items-center gap-1">
            <span className="sr-only">Typing indicator</span>
            <span className="block w-2 h-2 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="block w-2 h-2 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '120ms' }} />
            <span className="block w-2 h-2 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '240ms' }} />
          </div>
          <span className="text-xs opacity-90">{getTypingText()}…</span>
        </div>
      </div>
    </div>
  );
};
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface EnhancedTypingIndicatorProps {
  typingUsers: Array<{ id: string; name: string; avatar?: string }>;
}

export const EnhancedTypingIndicator = ({ typingUsers }: EnhancedTypingIndicatorProps) => {
  if (typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].name} is typing`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].name} and ${typingUsers[1].name} are typing`;
    } else {
      return `${typingUsers.length} people are typing`;
    }
  };

  return (
    <div className="px-6 py-3 animate-fade-in">
      <div className="flex items-center gap-3">
        {/* Show up to 3 avatars */}
        <div className="flex -space-x-2">
          {typingUsers.slice(0, 3).map((user, index) => (
            <Avatar 
              key={user.id} 
              className={cn(
                "h-6 w-6 border-2 border-background ring-1 ring-border",
                "animate-pulse"
              )}
              style={{ animationDelay: `${index * 200}ms` }}
            >
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="text-xs bg-muted">
                {user.name[0]}
              </AvatarFallback>
            </Avatar>
          ))}
          {typingUsers.length > 3 && (
            <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">
                +{typingUsers.length - 3}
              </span>
            </div>
          )}
        </div>

        {/* Enhanced typing bubble */}
        <div className="flex items-center gap-2 bg-muted/80 backdrop-blur-sm rounded-2xl px-4 py-2 border border-border shadow-sm">
          <div className="flex items-center gap-1">
            <span className="sr-only">Typing indicator</span>
            <span 
              className="block w-2 h-2 rounded-full bg-primary animate-bounce" 
              style={{ animationDelay: '0ms', animationDuration: '1.4s' }} 
            />
            <span 
              className="block w-2 h-2 rounded-full bg-primary animate-bounce" 
              style={{ animationDelay: '200ms', animationDuration: '1.4s' }} 
            />
            <span 
              className="block w-2 h-2 rounded-full bg-primary animate-bounce" 
              style={{ animationDelay: '400ms', animationDuration: '1.4s' }} 
            />
          </div>
          <span className="text-sm text-muted-foreground font-medium">
            {getTypingText()}…
          </span>
        </div>
      </div>
    </div>
  );
};
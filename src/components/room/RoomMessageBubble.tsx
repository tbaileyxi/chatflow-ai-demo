import React from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Profile {
  display_name: string;
  username: string;
  avatar_url: string;
}

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  media_url?: string;
  media_type?: string;
  message_type?: string;
  boost_amount?: number;
  is_bot_message?: boolean;
}

interface RoomMessageBubbleProps {
  message: Message;
  profile?: Profile;
  isOwn: boolean;
  isCoach: boolean;
}

export function RoomMessageBubble({ message, profile, isOwn, isCoach }: RoomMessageBubbleProps) {
  const displayName = profile?.display_name || profile?.username || 'Anonymous';
  const avatarUrl = profile?.avatar_url;
  const isBoosted = (message.boost_amount || 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        "flex gap-2 mb-3",
        isOwn && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <Avatar className={cn(
        "h-8 w-8 flex-shrink-0",
        isCoach && "ring-2 ring-yellow-500"
      )}>
        {isCoach ? (
          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xs">
            🤖
          </AvatarFallback>
        ) : (
          <>
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="text-xs">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </>
        )}
      </Avatar>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2",
          "shadow-sm",
          // Softer rounded corners
          isOwn ? "rounded-br-md" : "rounded-bl-md",
          // Base styles
          isOwn 
            ? "bg-primary text-primary-foreground" 
            : "bg-card border border-border/50",
          // Coach styling - yellow glow + bold
          isCoach && "bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/20",
          // Boost glow effect
          isBoosted && "ring-2 ring-orange-500/50 shadow-lg shadow-orange-500/30"
        )}
      >
        {/* Name + Time */}
        <div className={cn(
          "flex items-center gap-2 mb-1",
          isOwn && "justify-end"
        )}>
          <span className={cn(
            "text-xs font-semibold",
            isOwn ? "text-primary-foreground/80" : "text-foreground",
            isCoach && "text-cyan-400 font-bold"
          )}>
            {isCoach ? '@coach' : displayName}
          </span>
          <span className={cn(
            "text-[10px]",
            isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
          )}>
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: false })}
          </span>
        </div>

        {/* Content */}
        <p className={cn(
          "text-sm leading-relaxed",
          isCoach && "font-medium"
        )}>
          {message.content}
        </p>

        {/* Media */}
        {message.media_url && message.media_type === 'image' && (
          <img
            src={message.media_url}
            alt=""
            className="mt-2 rounded-lg max-w-full"
          />
        )}

        {/* Boost Badge */}
        {isBoosted && (
          <div className="flex items-center gap-1 mt-2 text-xs text-orange-500 font-semibold">
            <Flame className="h-3 w-3 fill-orange-500" />
            <span>+${message.boost_amount}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

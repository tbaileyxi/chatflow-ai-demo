import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MessageSkeletonProps {
  showAvatar?: boolean;
  isOwnMessage?: boolean;
}

export const MessageSkeleton = ({ showAvatar = true, isOwnMessage = false }: MessageSkeletonProps) => {
  return (
    <div className={cn(
      "group flex gap-4 py-2 px-6",
      isOwnMessage ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar skeleton */}
      {showAvatar && (
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      )}
      
      {/* Spacer for consecutive messages */}
      {!showAvatar && <div className="w-10 shrink-0" />}

      {/* Message content skeleton */}
      <div className={cn(
        "flex-1 min-w-0 max-w-[75%]",
        isOwnMessage ? "text-right" : "text-left"
      )}>
        {/* User info skeleton */}
        {showAvatar && (
          <div className={cn(
            "flex items-center gap-3 mb-2",
            isOwnMessage ? "justify-end" : "justify-start"
          )}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        )}

        {/* Message bubble skeleton */}
        <div className={cn(
          "inline-block max-w-full rounded-2xl px-4 py-3",
          isOwnMessage ? "bg-primary/20" : "bg-muted/80"
        )}>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
};
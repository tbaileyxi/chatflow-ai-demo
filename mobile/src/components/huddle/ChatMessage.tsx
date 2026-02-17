import { View, Text, Image } from "react-native";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";
import type { HuddleMessage } from "@/hooks/useHuddleMessages";

type Props = {
  message: HuddleMessage;
  isOwnMessage: boolean;
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d`;
}

export function ChatMessage({ message, isOwnMessage }: Props) {
  const displayName =
    message.isBotMessage
      ? "@coach"
      : message.displayName ?? message.username ?? "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View
      className={cn(
        "flex-row gap-2 px-4 py-1.5",
        isOwnMessage && "flex-row-reverse",
      )}
    >
      {/* Avatar */}
      <View
        className={cn(
          "h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-muted",
          message.isBotMessage && "border-2 border-primary",
        )}
      >
        {message.avatarUrl ? (
          <Image
            source={{ uri: message.avatarUrl }}
            className="h-full w-full"
          />
        ) : (
          <Text className="text-xs font-bold text-muted-foreground">
            {initial}
          </Text>
        )}
      </View>

      {/* Bubble */}
      <View className={cn("max-w-[75%] gap-0.5", isOwnMessage && "items-end")}>
        <View className="flex-row items-center gap-1.5">
          <Text
            className={cn(
              "text-xs font-semibold",
              message.isBotMessage ? "text-secondary" : "text-muted-foreground",
            )}
          >
            {displayName}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {formatTime(message.createdAt)}
          </Text>
        </View>

        <View
          className={cn(
            "rounded-2xl px-3 py-2",
            message.isBotMessage
              ? "bg-secondary/20"
              : isOwnMessage
                ? "bg-primary/20"
                : "bg-muted",
          )}
        >
          <Text className="text-sm text-foreground">{message.content}</Text>
        </View>

        {/* Media */}
        {message.mediaUrl && message.mediaType === "image" && (
          <Image
            source={{ uri: message.mediaUrl }}
            className="mt-1 h-48 w-full rounded-lg"
            resizeMode="cover"
          />
        )}
      </View>
    </View>
  );
}

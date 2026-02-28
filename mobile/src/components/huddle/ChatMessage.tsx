import { useRef, useState } from "react";
import { View, Text, Image, Pressable, Share, Modal } from "react-native";
import { MessageSquareReply, Share2, X } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";
import { PredictionCardInMessage } from "@/components/predictions/PredictionCardInMessage";
import type { HuddleMessage } from "@/hooks/useHuddleMessages";
import type { ReactionSummary } from "@/hooks/useMessageReactions";

const REACTION_PICKER_EMOJIS = ["W", "L", "🔥"] as const;

type Props = {
  message: HuddleMessage;
  isOwnMessage: boolean;
  huddleId: string;
  huddleName?: string;
  reactions?: ReactionSummary[];
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  replyTo?: { displayName: string; content: string } | null;
  isReply?: boolean;
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

export function ChatMessage({
  message,
  isOwnMessage,
  huddleId,
  huddleName,
  reactions,
  onReact,
  onReply,
  replyTo,
  isReply,
}: Props) {
  const lastTapRef = useRef<number>(0);
  const [showPicker, setShowPicker] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  const displayName =
    message.isBotMessage
      ? "@coach"
      : message.displayName ?? message.username ?? "User";
  const initial = displayName.charAt(0).toUpperCase();
  const isPredictionCard = message.messageType === "prediction_card";

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onReact?.("W");
    }
    lastTapRef.current = now;
  };

  const handleLongPress = () => {
    setShowPicker(true);
  };

  const handlePickReaction = (emoji: string) => {
    onReact?.(emoji);
    setShowPicker(false);
  };

  const handleShare = () => {
    Share.share({
      message: `${displayName}: "${message.content}"${huddleName ? ` — in ${huddleName} on Side Huddle Sports` : ""}`,
      ...(message.mediaUrl ? { url: message.mediaUrl } : {}),
    });
    setShowPicker(false);
  };

  const handleReply = () => {
    onReply?.();
    setShowPicker(false);
  };

  return (
    <>
      <Pressable onPress={handleDoubleTap} onLongPress={handleLongPress}>
        <View
          className={cn(
            "gap-1 py-2",
            isOwnMessage ? "items-end" : "items-start",
            isReply ? "pl-14 pr-4" : "px-4",
          )}
          style={isReply ? { borderLeftWidth: 2, borderLeftColor: colors.primary + "40", marginLeft: 16 } : undefined}
        >
          <View
            className={cn(
              "flex-row gap-2.5",
              isOwnMessage && "flex-row-reverse",
            )}
          >
            {/* Avatar */}
            <View
              className={cn(
                "h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-muted",
                message.isBotMessage && "border-2 border-primary",
              )}
            >
              {message.avatarUrl ? (
                <Image
                  source={{ uri: message.avatarUrl }}
                  className="h-full w-full"
                />
              ) : (
                <Text className="text-sm font-bold text-muted-foreground">
                  {initial}
                </Text>
              )}
            </View>

            {/* Bubble */}
            <View className={cn("max-w-[75%] gap-1", isOwnMessage && "items-end")}>
              <View className="flex-row items-center gap-2">
                <Text
                  className={cn(
                    "text-sm font-semibold",
                    message.isBotMessage ? "text-secondary" : "text-muted-foreground",
                  )}
                >
                  {displayName}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {formatTime(message.createdAt)}
                </Text>
              </View>

              {/* Prediction Card — render inline market cards */}
              {isPredictionCard ? (
                <PredictionCardInMessage content={message.content} huddleId={huddleId} />
              ) : (
                <View
                  className={cn(
                    "rounded-2xl px-4 py-2.5",
                    message.isBotMessage
                      ? "bg-secondary/20"
                      : isOwnMessage
                        ? "bg-primary/20"
                        : "bg-muted",
                  )}
                >
                  <Text className="text-base text-foreground">{message.content}</Text>
                </View>
              )}

              {/* Media */}
              {message.mediaUrl && message.mediaType === "image" && (
                <Pressable onPress={() => setImageViewerVisible(true)}>
                  <Image
                    source={{ uri: message.mediaUrl }}
                    className="mt-1 w-full rounded-lg"
                    style={{ height: 256, aspectRatio: undefined }}
                    resizeMode="cover"
                  />
                </Pressable>
              )}

              {/* Reactions display — only show when reactions exist */}
              {reactions && reactions.length > 0 && (
                <View className="mt-0.5 flex-row gap-1">
                  {reactions.map((r) => (
                    <Pressable
                      key={r.emoji}
                      className={cn(
                        "flex-row items-center gap-1 rounded-full border px-2 py-0.5",
                        r.hasReacted
                          ? "border-primary bg-primary/10"
                          : "border-border bg-muted",
                      )}
                      onPress={() => onReact?.(r.emoji)}
                    >
                      <Text className="text-sm">{r.emoji}</Text>
                      <Text className="text-sm text-muted-foreground">{r.count}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Long-press reaction picker */}
          {showPicker && (
            <View
              className={cn(
                "absolute top-0 z-50 flex-row items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 shadow-lg",
                isOwnMessage ? "right-14" : "left-14",
              )}
              style={{ elevation: 8 }}
            >
              {REACTION_PICKER_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => handlePickReaction(emoji)}
                  className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
                >
                  <Text className="text-lg font-bold">{emoji}</Text>
                </Pressable>
              ))}
              <View className="mx-0.5 h-6 w-px bg-border" />
              <Pressable
                onPress={handleReply}
                className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
              >
                <MessageSquareReply color={colors.mutedForeground} size={20} />
              </Pressable>
              <Pressable
                onPress={handleShare}
                className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
              >
                <Share2 color={colors.mutedForeground} size={20} />
              </Pressable>
            </View>
          )}
        </View>
      </Pressable>

      {/* Dismiss picker overlay */}
      {showPicker && (
        <Pressable
          className="absolute inset-0 z-40"
          onPress={() => setShowPicker(false)}
        />
      )}

      {/* Full-screen image viewer */}
      {message.mediaUrl && (
        <Modal
          visible={imageViewerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setImageViewerVisible(false)}
        >
          <View className="flex-1 items-center justify-center bg-black/90">
            <Pressable
              className="absolute right-4 top-14 z-10 h-10 w-10 items-center justify-center rounded-full bg-white/20"
              onPress={() => setImageViewerVisible(false)}
            >
              <X color="#fff" size={24} />
            </Pressable>
            <Image
              source={{ uri: message.mediaUrl }}
              className="h-full w-full"
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </>
  );
}

import { useRef, useState, useCallback } from "react";
import { View, Text, Image, Pressable, Share, Modal, Dimensions } from "react-native";
import { MessageSquareReply, Share2, X, Play, Pause, Mic } from "lucide-react-native";
import { Audio } from "expo-av";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";
import { PredictionCardInMessage } from "@/components/predictions/PredictionCardInMessage";
import { PulseBubble } from "@/components/huddle/PulseBubble";
import type { HuddleMessage } from "@/hooks/useHuddleMessages";
import type { ReactionSummary } from "@/hooks/useMessageReactions";

const REACTION_PICKER_EMOJIS = ["W", "L", "🔥"] as const;

function AudioBubble({ uri }: { uri: string }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlayback = async () => {
    if (playing && sound) {
      await sound.pauseAsync();
      setPlaying(false);
      return;
    }

    if (sound) {
      await sound.playAsync();
      setPlaying(true);
      return;
    }

    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setPosition(status.positionMillis ?? 0);
            setDuration(status.durationMillis ?? 0);
            if (status.didJustFinish) {
              setPlaying(false);
              setPosition(0);
              newSound.setPositionAsync(0);
            }
          }
        },
      );
      setSound(newSound);
      setPlaying(true);
    } catch (err) {
      console.error("Playback error:", err);
    }
  };

  const progress = duration > 0 ? position / duration : 0;
  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <Pressable
      onPress={togglePlayback}
      className="flex-row items-center gap-2.5 rounded-2xl bg-primary/15 px-4 py-2.5"
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
        {playing ? (
          <Pause color={colors.primaryForeground} size={14} />
        ) : (
          <Play color={colors.primaryForeground} size={14} style={{ marginLeft: 2 }} />
        )}
      </View>
      <View className="flex-1 gap-1">
        {/* Waveform placeholder / progress bar */}
        <View className="h-2 overflow-hidden rounded-full bg-muted">
          <View
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.max(progress * 100, 2)}%` }}
          />
        </View>
        <Text className="text-xs text-muted-foreground">
          {duration > 0 ? formatMs(playing ? position : duration) : "Voice message"}
        </Text>
      </View>
      <Mic color={colors.primary} size={14} />
    </Pressable>
  );
}

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
  const isPulse =
    message.isPulseMoment ||
    message.messageType === "pulse" ||
    message.messageType === "highlight" ||
    (message.embedCode != null && !isPredictionCard);

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

              {/* Quoted reply context */}
              {replyTo && (
                <View className="rounded-xl border-l-2 border-primary/50 bg-muted/50 px-3 py-1.5 mb-1">
                  <Text className="text-xs font-semibold text-primary" numberOfLines={1}>
                    {replyTo.displayName}
                  </Text>
                  <Text className="text-xs text-muted-foreground" numberOfLines={2}>
                    {replyTo.content}
                  </Text>
                </View>
              )}

              {/* Pulse / Social Embed — X posts, Reddit buzz */}
              {isPulse ? (
                <PulseBubble message={message} />
              ) : isPredictionCard ? (
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
                <Pressable
                  onPress={() => {
                    const now = Date.now();
                    if (now - lastTapRef.current < 300) {
                      onReact?.("W");
                    } else {
                      setImageViewerVisible(true);
                    }
                    lastTapRef.current = now;
                  }}
                  onLongPress={handleLongPress}
                >
                  <Image
                    source={{ uri: message.mediaUrl }}
                    className="mt-1 w-full rounded-lg"
                    style={{ height: 256, aspectRatio: undefined }}
                    resizeMode="cover"
                  />
                </Pressable>
              )}

              {/* Audio / Voice message */}
              {message.mediaUrl && message.mediaType === "audio" && (
                <AudioBubble uri={message.mediaUrl} />
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
                      <Text className="text-sm text-foreground">{r.emoji}</Text>
                      <Text className="text-sm text-muted-foreground">{r.count}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

        </View>
      </Pressable>

      {/* Reaction picker modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setShowPicker(false)}
        >
          <Pressable
            className="flex-row items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 shadow-lg"
            style={{ elevation: 8 }}
            onPress={(e) => e.stopPropagation()}
          >
            {REACTION_PICKER_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => handlePickReaction(emoji)}
                className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
              >
                <Text className="text-lg font-bold text-foreground">{emoji}</Text>
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
          </Pressable>
        </Pressable>
      </Modal>

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

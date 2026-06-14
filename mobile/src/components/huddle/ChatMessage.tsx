import { useRef, useState, useCallback } from "react";
import { View, Text, Image, Pressable, Share, Modal, Dimensions, Linking } from "react-native";
import { MessageSquareReply, Share2, X, Play, Pause, Mic } from "lucide-react-native";
import { Audio } from "expo-av";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";
import { PredictionCardInMessage } from "@/components/predictions/PredictionCardInMessage";
import { PulseBubble } from "@/components/huddle/PulseBubble";
import { YouTubeEmbed, parseYouTubeId } from "@/components/embeds/YouTubeEmbed";
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
      style={{ width: 230 }}
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
  // When true, the parent message is the one directly above — so the quoted
  // context is redundant and we hide it (just show avatar + message).
  hideReplyQuote?: boolean;
  // When true the message follows another from the same sender within ~5 min.
  // Avatar + name row + tight spacing.
  isGroupedWithPrev?: boolean;
};

// Strip raw URLs from bot message content so legacy posts (server fix now puts
// link in embed_code, but older messages have full URL inline) don't render
// as 10 lines of garbage. Keeps the message clean; embed_code becomes the
// 'Read source' chip below.
function cleanBotContent(text: string): string {
  return text
    .replace(/https?:\/\/[^\s)]+/g, "")
    .replace(/\s+\n\s*$/g, "")
    .trim();
}

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
  hideReplyQuote,
  isGroupedWithPrev,
}: Props) {
  const lastTapRef = useRef<number>(0);
  const [showPicker, setShowPicker] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  const isPredictionCard = message.messageType === "prediction_card";
  const youTubeId =
    message.messageType === "youtube_highlight" && message.embedCode
      ? parseYouTubeId(message.embedCode)
      : null;
  const isPulse =
    !youTubeId &&
    (message.isPulseMoment ||
      message.messageType === "pulse" ||
      message.messageType === "highlight" ||
      (message.embedCode != null && !isPredictionCard));

  // Pulse bot messages show source, not "@coach"
  const displayName =
    message.isBotMessage && isPulse
      ? message.pulseSource === "x"
        ? "X Buzz"
        : message.pulseSource === "reddit"
          ? "Reddit"
          : "Buzz"
      : message.isBotMessage
        ? "@coach"
      : message.displayName ?? message.username ?? "User";
  const initial = message.isBotMessage ? "SH" : displayName.charAt(0).toUpperCase();

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
    // Close the picker FIRST, then present the share sheet on the next tick —
    // iOS silently no-ops Share.share() if a modal is still dismissing.
    setShowPicker(false);
    const body = (message.content || "").trim();
    const text = body
      ? `${displayName}: "${body}"`
      : `${displayName} shared a moment`;
    setTimeout(() => {
      Share.share({
        message: `${text}${huddleName ? ` — in ${huddleName} on Side Huddle Sports` : ""}`,
        ...(message.mediaUrl ? { url: message.mediaUrl } : {}),
      }).catch(() => {});
    }, 350);
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
            // Tighter vertical padding when this is a follow-up message from
            // the same sender (consecutive grouping). Full padding on the
            // first message of a chain.
            isGroupedWithPrev ? "pb-0.5 pt-0" : "gap-1 py-2",
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
            {/* Avatar — hidden on consecutive same-sender messages so chains
                look like a single voice without the repeated circle. */}
            {isGroupedWithPrev ? (
              <View className="h-0 w-9" />
            ) : (
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
            )}

            {/* Bubble */}
            <View className={cn("max-w-[75%] gap-1", isOwnMessage && "items-end")}>
              {!message.isBotMessage && !isGroupedWithPrev ? (
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-semibold text-muted-foreground">
                    {displayName}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {formatTime(message.createdAt)}
                  </Text>
                </View>
              ) : null}

              {/* Quoted reply context — hidden when the parent is the message
                  directly above (redundant). */}
              {replyTo && !hideReplyQuote && (
                <View className="rounded-xl border-l-2 border-primary/50 bg-muted/50 px-3 py-1.5 mb-1">
                  <Text className="text-xs font-semibold text-primary" numberOfLines={1}>
                    {replyTo.displayName}
                  </Text>
                  <Text className="text-xs text-muted-foreground" numberOfLines={2}>
                    {replyTo.content}
                  </Text>
                </View>
              )}

              {/* YouTube highlight — poster + inline player (tap to play) */}
              {youTubeId ? (
                <View
                  className={cn(
                    "rounded-2xl px-3 py-2.5",
                    "border border-primary/30 bg-primary/10",
                  )}
                >
                  <Text className="mb-1 text-base text-foreground">
                    {cleanBotContent(message.content)}
                  </Text>
                  <YouTubeEmbed videoId={youTubeId} />
                </View>
              ) : isPulse ? (
                <PulseBubble message={message} />
              ) : isPredictionCard ? (
                <PredictionCardInMessage content={message.content} huddleId={huddleId} />
              ) : message.mediaUrl &&
                (!message.content?.trim() ||
                  message.content === "📷 Photo" ||
                  message.content === "🎤 Voice message") ? null : (
                <View
                  className={cn(
                    "rounded-2xl px-4 py-2.5",
                    message.isBotMessage
                      ? "border border-primary/30 bg-primary/10"
                      : isOwnMessage
                        ? "bg-primary/20"
                        : "bg-muted",
                  )}
                >
                  <Text className="text-base text-foreground">
                    {message.isBotMessage
                      ? cleanBotContent(message.content)
                      : message.content}
                  </Text>
                  {/* News-style 'Read source' chip when an embed URL exists.
                      Keeps the raw URL off the bubble while preserving access. */}
                  {message.isBotMessage && message.embedCode &&
                   /^https?:\/\//.test(message.embedCode) ? (
                    <Pressable
                      onPress={() => Linking.openURL(message.embedCode!).catch(() => {})}
                      className="mt-2 flex-row items-center gap-1.5 self-start rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1"
                    >
                      <Text className="text-[11px] font-bold uppercase tracking-wider text-primary">
                        Read source
                      </Text>
                    </Pressable>
                  ) : null}
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
                  {/* Fixed box — percentage widths collapse to 0 inside the
                      intrinsic-width bubble container (blank image bug). */}
                  <Image
                    source={{ uri: message.mediaUrl }}
                    className="mt-1 rounded-xl"
                    style={{ width: 230, height: 230 }}
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

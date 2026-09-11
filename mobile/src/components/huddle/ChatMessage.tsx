import { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Share,
  Modal,
  Dimensions,
  Linking,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Flag,
  MessageSquareReply,
  Mic,
  Pause,
  Play,
  Share2,
  Share2 as ShareIcon,
  Trash2,
  X,
} from "lucide-react-native";
import { Audio, Video, ResizeMode } from "expo-av";
import { Type } from "@/components/ui/Type";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { blockUser, reportMessage } from "@/lib/moderation";
import { shareMedia } from "@/lib/shareMedia";
import { colors } from "@/theme/colors";
import { FadeCardInMessage } from "@/components/huddle/FadeCardInMessage";
import { PulseBubble } from "@/components/huddle/PulseBubble";
import { AdminWelcomeCard } from "@/components/huddle/AdminWelcomeCard";
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
      className="flex-row items-center gap-2.5 rounded-2xl bg-card px-4 py-2.5"
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
        <Type variant="caption" tone="muted">
          {duration > 0 ? formatMs(playing ? position : duration) : "Voice message"}
        </Type>
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
  // Opens the invite sheet. Only the admin_welcome card uses this — it's the
  // single action on the highest-leverage message in the product.
  onInvite?: () => void;
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

// The publisher appends "\n\n— presented by X" to ~1-in-5 bot messages. Pull it
// off the body so it can be rendered as a small, muted, italic credit line
// instead of looking like part of the bot's sentence.
function splitSponsorCredit(text: string): { body: string; sponsor: string | null } {
  const m = text.match(/\n+\s*—?\s*presented by\s+(.+?)\s*$/i);
  if (!m || m.index == null) return { body: text, sponsor: null };
  return { body: text.slice(0, m.index).trim(), sponsor: m[1].trim() };
}

// Friendly outlet name from a URL host: "https://www.amazinavenue.com/x" →
// "amazinavenue.com". Keeps attribution tiny without a "source:" label.
function outletName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return "link";
  }
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
  onInvite,
}: Props) {
  const lastTapRef = useRef<number>(0);
  const [showPicker, setShowPicker] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  // Hooks above, early return below — legacy prediction cards render nothing.
  if (message.messageType === "prediction_card") return null;

  // Retired. The yes/no market card asked a room of Yankees fans whether the
  // Yankees would win — everyone taps YES, nobody argues, and the card sat
  // there being a worse version of the fade prop below it. New ones stopped
  // posting when the kalshi-post-predictions cron was unscheduled; the
  // thousands already in message history are hidden here rather than deleted,
  // so nobody's room gains a hole where a card used to be. Without this branch
  // they fall through to the plain text renderer and print raw JSON.
  const isFadeProp = message.messageType === "fade_prop";
  const youTubeId =
    message.messageType === "youtube_highlight" && message.embedCode
      ? parseYouTubeId(message.embedCode)
      : null;
  // News & live-play are ALWAYS the gold-accented "@coach" bubble (+ a 'Read
  // source' chip when embed_code holds a link). They were leaking into the
  // catch-all below — any embed_code routed them to the plain muted PulseBubble
  // card with no gold accent, which is exactly why the gold looked
  // inconsistent ("on some chats and not others"). Pin them out first.
  const isNewsOrPlay =
    message.messageType === "news" ||
    message.messageType === "live_play" ||
    // The Coach answering a question or posting a recap is the same voice as
    // the news/play bubble and must get the same gold treatment. Pinned here
    // for the same reason the others are: anything with an embed_code was
    // leaking into the plain muted PulseBubble below.
    message.messageType === "coach_answer" ||
    message.messageType === "coach_recap";
  const isAdminWelcome = message.messageType === "admin_welcome";
  const isPulse =
    !youTubeId &&
    !isNewsOrPlay &&
    !isAdminWelcome &&
    (message.isPulseMoment ||
      message.messageType === "pulse" ||
      message.messageType === "highlight" ||
      message.embedCode != null);

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
  const navigation = useNavigation<any>();

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

  /**
   * Report, block, or remove — the three things guideline 1.2 asks for.
   *
   * All of them one long-press from the content itself. Blocking is
   * user-level and enforced by RLS (see RUN_THIS_UGC_POLICY.sql): a client
   * filter is a suggestion, a policy is an answer.
   */
  const handleReport = () => {
    setShowPicker(false);
    setTimeout(() => {
      Alert.alert(
        "Report this?",
        `We'll review it. You can also block ${displayName} so you never see them again, in any room.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Report",
            style: "destructive",
            onPress: async () => {
              await reportMessage({
                messageId: message.id,
                huddleId,
                reportedUserId: message.userId,
              });
              Alert.alert("Reported", "Thanks — we'll take a look.");
            },
          },
          {
            text: `Block ${displayName}`,
            style: "destructive",
            onPress: async () => {
              await blockUser(message.userId);
              Alert.alert(
                "Blocked",
                `You won't see ${displayName} anywhere in Side Huddle.`,
              );
            },
          },
        ],
      );
    }, 250);
  };

  const handleDeleteOwn = () => {
    setShowPicker(false);
    setTimeout(() => {
      Alert.alert("Delete this message?", "It'll be gone for everyone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await supabase.from("huddle_messages").delete().eq("id", message.id);
          },
        },
      ]);
    }, 250);
  };

  const handleShare = () => {
    // Close the picker FIRST, then present the share sheet on the next tick —
    // iOS silently no-ops Share.share() if a modal is still dismissing.
    setShowPicker(false);
    const body = (message.content || "").trim();
    // NO WRAPPING QUOTES, and no name on a bot message.
    //
    // A clip caption already arrives quoted and attributed — "Cruising to The
    // Rock" — @IUHoosiers — so wrapping it again produced
    // `@coach: ""Cruising to The Rock" — @IUHoosiers"`, which reads as broken
    // before anyone gets to the link.
    const text = body
      ? (message.isBotMessage ? body : `${displayName}: ${body}`)
      : `${displayName} shared a moment`;
    // Share a link to the ROOM, not the picture. `url` used to be
    // message.mediaUrl, so a shared Giants post arrived as a bare JPEG on
    // pbs.twimg.com — the recipient got the image and no way back to the app
    // or the room it came from. /h/:huddleId deep-links installed users
    // straight to the room and sends everyone else to the App Store.
    // ?m=<id> so the PREVIEW shows what was shared rather than the room it came
    // from. Without it a clip, a take and a joke all previewed as the same room
    // background — the card showed the door instead of what was behind it. The
    // destination is unchanged: it still opens this room.
    const roomUrl = huddleId
      ? `https://www.sidehuddlesports.com/h/${huddleId}?m=${message.id}`
      : undefined;
    setTimeout(() => {
      Share.share({
        // The link goes in `url` ONLY. Putting it in the message as well made
        // iOS send both, so a shared moment arrived with the same URL printed
        // twice under it.
        // The preview card already carries the room name and Side Huddle, so
        // repeating them under the text was a third line saying nothing.
        message: text,
        ...(roomUrl ? { url: roomUrl } : {}),
      }).catch(() => {});
    }, 350);
  };

  const handleReply = () => {
    onReply?.();
    setShowPicker(false);
  };

  // Highlights were removed (junk search results + Error 153 embeds). Hide any
  // legacy youtube_highlight messages entirely so they stop polluting the feed.
  if (message.messageType === "youtube_highlight") {
    return null;
  }

  return (
    <>
      <Pressable onPress={handleDoubleTap} onLongPress={handleLongPress}>
        <View
          className={cn(
            // Tighter vertical padding when this is a follow-up message from
            // the same sender (consecutive grouping). Full padding on the
            // first message of a chain.
            isGroupedWithPrev ? "pb-0.5 pt-0" : "gap-1 py-2",
            // Everyone sits on the left, including you. Right-aligned bubbles
            // are a two-person convention: in a room of eight they turn the
            // thread into a zigzag and halve the usable width for no gain,
            // since the name already says who spoke.
            "items-start",
            isReply ? "pl-14 pr-4" : "px-4",
          )}
          style={isReply ? { borderLeftWidth: 2, borderLeftColor: colors.primary + "40", marginLeft: 16 } : undefined}
        >
          <View
            className={cn("flex-row gap-2.5")}
          >
            {/* Avatar — hidden on consecutive same-sender messages so chains
                look like a single voice without the repeated circle. */}
            {isGroupedWithPrev ? (
              <View className="h-0 w-9" />
            ) : (
              // Tapping whoever said it opens their profile. The name above a
              // message was the only place you met a stranger, and it went
              // nowhere.
              <Pressable
                disabled={message.isBotMessage}
                onPress={() =>
                  navigation.navigate("PublicProfile", {
                    userId: message.userId,
                    knownAs: displayName,
                  })
                }
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
                  <Type variant="captionStrong" tone="muted">
                    {initial}
                  </Type>
                )}
              </Pressable>
            )}

            {/* Bubble */}
            {/* Was max-w-[75%] and end-aligned for your own messages. Full
                width now: with nothing right-aligned there is no facing edge
                to leave room for, and a long message shouldn't wrap early to
                preserve a gutter nobody is using. */}
            <View className="flex-1 gap-1">
              {!message.isBotMessage && !isGroupedWithPrev ? (
                <View className="flex-row items-center gap-2">
                  {/* With the bubbles gone this is the only thing marking where
                      one message stops and the next starts, so it carries more
                      weight than it used to — and your own name is gold, which
                      is how you find yourself in a fast-moving room now that
                      nothing is right-aligned. */}
                  <Text
                    className={cn(
                      "text-[13px] font-black",
                      isOwnMessage ? "text-primary" : "text-foreground",
                    )}
                  >
                    {displayName}
                  </Text>
                  <Type variant="caption" tone="muted">
                    {formatTime(message.createdAt)}
                  </Type>
                </View>
              ) : null}

              {/* Quoted reply context — hidden when the parent is the message
                  directly above (redundant). */}
              {replyTo && !hideReplyQuote && (
                <View className="rounded-xl border-l-2 border-primary/50 bg-muted px-3 py-1.5 mb-1">
                  <Type variant="captionStrong" tone="primary"  numberOfLines={1}>
                    {replyTo.displayName}
                  </Type>
                  <Type variant="caption" tone="muted"  numberOfLines={2}>
                    {replyTo.content}
                  </Type>
                </View>
              )}

              {/* YouTube highlight — poster + inline player (tap to play) */}
              {youTubeId ? (
                <View
                  className="rounded-2xl bg-card px-3 py-2.5"
                  style={{ borderLeftWidth: 3, borderLeftColor: colors.primary }}
                >
                  <Type variant="body" className="mb-1">
                    {cleanBotContent(message.content)}
                  </Type>
                  <YouTubeEmbed videoId={youTubeId} />
                </View>
              ) : isAdminWelcome ? (
                <AdminWelcomeCard
                  content={message.content}
                  onInvite={onInvite}
                />
              ) : isPulse ? (
                <PulseBubble message={message} />
              ) : isFadeProp ? (
                <FadeCardInMessage
                  content={message.content}
                  huddleId={huddleId}
                  messageId={message.id}
                />
              ) : message.mediaUrl &&
                (!message.content?.trim() ||
                  message.content === "📷 Photo" ||
                  message.content === "🎤 Voice message") ? null : (
                <View
                  className={cn(
                    // A person's words sit on the room, not in a container.
                    // Bubbles were doing a job the name above already does —
                    // saying where one message ends and the next begins — and
                    // charging ~24px of horizontal padding per message for it.
                    // The bot keeps its card and gold rule, because THAT
                    // distinction is real: it separates a machine from the
                    // people, which is worth spending chrome on.
                    message.isBotMessage && "rounded-2xl bg-card",
                    message.isBotMessage
                      ? isReply
                        ? "px-3 py-1.5"
                        : "px-4 py-2.5"
                      : "py-0.5",
                  )}
                  style={
                    message.isBotMessage
                      ? { borderLeftWidth: 3, borderLeftColor: colors.primary }
                      : undefined
                  }
                >
                  {(() => {
                    if (!message.isBotMessage) {
                      return (
                        <Text
                          className={isReply ? "text-sm" : "text-base"}
                          style={{
                            // Was primaryForeground for your own messages —
                            // dark ink meant to sit on the gold bubble. With
                            // the bubble gone that is near-invisible on the
                            // room's background.
                            color: colors.foreground,
                            lineHeight: isReply ? 19 : 22,
                          }}
                        >
                          {message.content}
                        </Text>
                      );
                    }
                    const { body, sponsor } = splitSponsorCredit(
                      cleanBotContent(message.content),
                    );
                    return (
                      <>
                        <Type variant="body"  style={{ color: colors.foreground }}>
                          {body}
                        </Type>
                        {sponsor ? (
                          <Text
                            style={{
                              marginTop: 6,
                              fontSize: 11,
                              fontStyle: "italic",
                              letterSpacing: 0.2,
                              color: colors.primary,
                              opacity: 0.75,
                            }}
                          >
                            presented by {sponsor}
                          </Text>
                        ) : null}
                      </>
                    );
                  })()}
                  {/* Tiny outlet attribution — just the publication, no "source"
                      label and no chunky chip. Taps through to the article. */}
                  {message.isBotMessage && message.embedCode &&
                   /^https?:\/\//.test(message.embedCode) ? (
                    <Pressable
                      onPress={() => Linking.openURL(message.embedCode!).catch(() => {})}
                      hitSlop={6}
                      className="mt-1.5 self-start"
                    >
                      <Type variant="data" className="text-muted-foreground/70">
                        {outletName(message.embedCode)} ↗
                      </Type>
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

                  {/* One button, the OS sheet behind it. The person just made
                      something they feel strongly about; a menu of four choices
                      is where that feeling goes to die. Instagram, Messages,
                      AirDrop and Save Image are already on the sheet, in the
                      order this particular person uses them. */}
                  <Pressable
                    onPress={() =>
                      shareMedia({ url: message.mediaUrl!, type: message.mediaType })
                    }
                    hitSlop={8}
                    className="absolute right-2 top-3 h-8 w-8 items-center justify-center rounded-full active:opacity-70"
                    style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
                  >
                    <ShareIcon color="#FFFFFF" size={15} />
                  </Pressable>
                </Pressable>
              )}

              {/* Video — X clips from the daily media drop. Same 230px box as
                  a photo so a mixed feed doesn't jump around. Tap to play;
                  muted by default because a highlight that starts shouting in
                  a quiet room is a reason to close the app. */}
              {message.mediaUrl && message.mediaType === "video" && (
                <Pressable onLongPress={handleLongPress}>
                  <Video
                    source={{ uri: message.mediaUrl }}
                    style={{ width: 230, height: 230, borderRadius: 12, marginTop: 4 }}
                    resizeMode={ResizeMode.COVER}
                    useNativeControls
                    isLooping
                    isMuted
                    // Autoplay, muted. Without shouldPlay the view renders a
                    // black rectangle until someone taps it — the URL was
                    // always fine, the player was simply paused on frame zero
                    // with no poster behind it. Muted autoplay is what every
                    // social feed does and it is why they never show a black
                    // box.
                    shouldPlay
                  />

                  {/* The proof of what caused the face.
                      The design asked for front and back cameras at once, so
                      the clip would carry a shot of the TV. No simultaneous
                      multi-cam exists in this stack — but filming the screen
                      was never the point, PROVING what you reacted to was, and
                      the app already knows the score to the second. So it's
                      rendered from data: sharper than a phone pointed across a
                      room, and free.

                      Captured at record time, not read at render time. Looking
                      it up later would relabel every old reaction with the
                      final score and destroy the only thing that makes them
                      worth keeping. */}
                  {message.messageType === "face_reaction" && message.content ? (
                    <View
                      className="absolute bottom-2 left-2 right-2 rounded-lg px-2 py-1"
                      style={{ backgroundColor: "rgba(0,0,0,0.62)" }}
                      pointerEvents="none"
                    >
                      <Type variant="dataStrong"
                        
                        numberOfLines={1}>
                        {message.content}
                      </Type>
                    </View>
                  ) : null}

                  {/* One button, the OS sheet behind it. The person just made
                      something they feel strongly about; a menu of four choices
                      is where that feeling goes to die. Instagram, Messages,
                      AirDrop and Save Image are already on the sheet, in the
                      order this particular person uses them. */}
                  <Pressable
                    onPress={() =>
                      shareMedia({ url: message.mediaUrl!, type: message.mediaType })
                    }
                    hitSlop={8}
                    className="absolute right-2 top-3 h-8 w-8 items-center justify-center rounded-full active:opacity-70"
                    style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
                  >
                    <ShareIcon color="#FFFFFF" size={15} />
                  </Pressable>
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
                      <Type variant="caption">{r.emoji}</Type>
                      <Type variant="caption" tone="muted">{r.count}</Type>
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
                <Type variant="heading">{emoji}</Type>
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

            {/* App Store guideline 1.2: an app carrying user content needs
                reporting, blocking and removal reachable FROM the content —
                not buried in a settings screen nobody opens. Every message
                already long-presses to this menu, so it belongs here.

                Your own message gets delete instead; you don't report
                yourself. */}
            {!message.isBotMessage ? (
              <>
                <View className="mx-0.5 h-6 w-px bg-border" />
                {isOwnMessage ? (
                  <Pressable
                    onPress={handleDeleteOwn}
                    className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
                  >
                    <Trash2 color={colors.destructive} size={19} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleReport}
                    className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
                  >
                    <Flag color={colors.destructive} size={19} />
                  </Pressable>
                )}
              </>
            ) : null}
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

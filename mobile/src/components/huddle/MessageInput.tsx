import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Image,
  Animated,
  Keyboard,
  Modal,
} from "react-native";
import {
  Send,
  X,
  Camera,
  ImageIcon,
  Mic,
  Square,
  Plus,
  Sparkles,
  BarChart3,
  HelpCircle,
  Video,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { Type } from "@/components/ui/Type";
import { colors } from "@/theme/colors";

type MediaAttachment = {
  uri: string;
  type: "image" | "audio" | "video";
};

export type Mentionable = { key: string; label: string; sublabel?: string };

type Props = {
  onSend: (
    content: string,
    replyToId?: string,
    media?: MediaAttachment,
  ) => Promise<{ error: any }>;
  disabled?: boolean;
  replyTo?: { id: string; displayName: string; content: string } | null;
  onCancelReply?: () => void;
  onFocus?: () => void;
  onTypingChange?: (isTyping: boolean) => void;
  /** Room members, for the @ autocomplete. Coach is pinned above these. */
  mentionables?: Mentionable[];
  /** Records a short video of your face. Only passed while a game is live —
      a "reaction" out of season is reacting to nothing. */
  onFaceReaction?: () => void;
};

// The Coach is always first in the @ list. Typing "@" is still the fast path
// for anyone who knows it — but it is no longer the ONLY path: collapsing
// camera, library and mic into the ＋ freed the room this comment used to say
// didn't exist, and Ask Coach now sits at the top of that sheet.
const COACH_MENTION: Mentionable = {
  key: "coach",
  label: "coach",
  sublabel: "ask about the game or this chat",
};

/**
 * Find an in-progress @mention at the caret.
 *
 * Only matches at a word boundary so an email address or a mid-word @ doesn't
 * pop the sheet.
 */
function activeMentionQuery(text: string): string | null {
  const m = /(?:^|\s)@([\w-]*)$/.exec(text);
  return m ? m[1] : null;
}

export function MessageInput({
  onSend,
  disabled,
  replyTo,
  onCancelReply,
  onFocus,
  onTypingChange,
  mentionables = [],
  onFaceReaction,
}: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showPlus, setShowPlus] = useState(false);
  const [media, setMedia] = useState<MediaAttachment | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulsing animation while recording
  useEffect(() => {
    if (isRecording) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if ((!trimmed && !media) || sending) return;

    setSending(true);
    setText("");
    onTypingChange?.(false);
    const attachedMedia = media;
    setMedia(null);
    // Media-only sends carry empty content — the image/audio IS the message.
    const { error } = await onSend(trimmed, replyTo?.id, attachedMedia ?? undefined);
    if (error) {
      setText(trimmed);
      onTypingChange?.(trimmed.length > 0);
      setMedia(attachedMedia);
      Alert.alert("Error", "Failed to send message.");
    }
    onCancelReply?.();
    Keyboard.dismiss();
    setSending(false);
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setMedia({ uri: result.assets[0].uri, type: "image" });
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setMedia({ uri: result.assets[0].uri, type: "image" });
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Microphone access is required for voice messages.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(rec);
      setIsRecording(true);
      setRecordingDuration(0);

      durationInterval.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording:", err);
      Alert.alert("Error", "Could not start recording.");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }

    setIsRecording(false);

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setRecording(null);

      if (uri && recordingDuration >= 1) {
        setMedia({ uri, type: "audio" });
      }
    } catch (err) {
      console.error("Failed to stop recording:", err);
      setRecording(null);
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;

    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }

    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch {}
    setRecording(null);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // @ autocomplete. Recomputed on render from `text` so there is no extra
  // state to keep in sync with the input.
  const mentionQuery = activeMentionQuery(text);
  const suggestions =
    mentionQuery === null
      ? []
      : [COACH_MENTION, ...mentionables]
          .filter((m) =>
            mentionQuery === "" ||
            m.label.toLowerCase().startsWith(mentionQuery.toLowerCase()),
          )
          .slice(0, 5);

  const applyMention = (m: Mentionable) => {
    // Replace the partial "@foo" at the caret with the full handle.
    const next = text.replace(/(^|\s)@[\w-]*$/, `$1@${m.label} `);
    setText(next);
    onTypingChange?.(next.trim().length > 0);
  };

  // Everything the ＋ opens. Camera, library and voice were three permanent
  // icons; the Coach had no icon at all and could only be reached by knowing
  // to type "@". One button, and the Coach is finally visible.
  //
  // Poll and Trivia are listed and inert. They're modes somebody activates,
  // and showing where they'll live costs nothing while building them properly
  // is its own piece of work — an empty menu teaches nobody what this button
  // is for.
  // Ask Coach and the camera both have permanent buttons in the row now, so
  // neither is listed here. A sheet row that duplicates a visible button is the
  // two-doors-to-one-place problem that got the Coach tab removed.
  const plusActions: {
    key: string;
    label: string;
    sub: string;
    Icon: any;
    run?: () => void;
    soon?: boolean;
  }[] = [
    {
      key: "library",
      label: "From your library",
      sub: "Photos",
      Icon: ImageIcon,
      run: pickFromLibrary,
    },
    { key: "poll", label: "Poll", sub: "Ask the room", Icon: BarChart3, soon: true },
    { key: "trivia", label: "Trivia", sub: "Start a round", Icon: HelpCircle, soon: true },
  ];

  const canSend = (text.trim() || media) && !sending && !disabled;

  return (
    <View
      className="border-t border-border bg-background"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {/* Reply preview */}
      {replyTo && (
        <View className="flex-row items-center gap-2 border-b border-border px-4 py-2">
          <View className="flex-1">
            <Type variant="captionStrong" tone="primary">
              Replying to {replyTo.displayName}
            </Type>
            <Type variant="caption" tone="muted"  numberOfLines={1}>
              {replyTo.content}
            </Type>
          </View>
          <Pressable onPress={onCancelReply} hitSlop={8}>
            <X color={colors.mutedForeground} size={16} />
          </Pressable>
        </View>
      )}

      {/* Media preview */}
      {media && (
        <View className="border-b border-border bg-card px-4 py-3">
          <View className="flex-row items-center gap-3">
            {media.type === "image" ? (
              <Image
                source={{ uri: media.uri }}
                className="h-16 w-16 rounded-xl"
                resizeMode="cover"
              />
            ) : (
              <View className="flex-row items-center gap-2 rounded-lg bg-muted px-3 py-2">
                <Mic color={colors.primary} size={16} />
                <Type variant="caption">Voice message</Type>
              </View>
            )}
            <View className="flex-1">
              <Type variant="captionStrong">
                {media.type === "image" ? "Photo ready" : "Voice message ready"}
              </Type>
              <Type variant="caption" tone="muted" className="mt-0.5">
                Tap Send to post it to the room.
              </Type>
            </View>
            <Pressable
              onPress={() => setMedia(null)}
              className="h-9 w-9 items-center justify-center rounded-full bg-muted"
              hitSlop={8}
            >
              <X color={colors.mutedForeground} size={16} />
            </Pressable>
            <Pressable
              onPress={handleSend}
              disabled={sending || disabled}
              className="h-9 w-20 flex-row items-center justify-center gap-1 rounded-full bg-primary active:opacity-80"
              style={{ opacity: sending || disabled ? 0.5 : 1 }}
            >
              <Send color={colors.primaryForeground} size={14} />
              <Type variant="captionStrong" tone="onPrimary">
                Send
              </Type>
            </Pressable>
          </View>
        </View>
      )}

      {/* Recording state */}
      {isRecording ? (
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: "#EF4444",
            }}
          />
          <Type variant="captionStrong" tone="danger" className="flex-1">
            Recording {formatDuration(recordingDuration)}
          </Type>
          <Pressable
            onPress={cancelRecording}
            className="h-10 w-10 items-center justify-center rounded-full bg-muted"
          >
            <X color={colors.mutedForeground} size={18} />
          </Pressable>
          <Pressable
            onPress={stopRecording}
            className="h-10 w-10 items-center justify-center rounded-full bg-destructive"
          >
            <Square color="#fff" size={16} />
          </Pressable>
        </View>
      ) : (
        <>
          {/* @ autocomplete — collapses to nothing when not mentioning, so it
              costs no permanent chrome. */}
          {suggestions.length > 0 && (
            <View className="border-t border-border bg-card">
              {suggestions.map((m) => (
                <Pressable
                  key={m.key}
                  onPress={() => applyMention(m)}
                  className="flex-row items-center gap-3 px-4 py-2.5 active:bg-muted"
                >
                  <View
                    className="h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      backgroundColor:
                        m.key === "coach" ? colors.primary : colors.muted,
                    }}
                  >
                    <Type variant="captionStrong"
                      
                      style={{
                        color:
                          m.key === "coach"
                            ? colors.primaryForeground
                            : colors.mutedForeground,
                      }}>
                      {m.key === "coach" ? "SH" : m.label.charAt(0).toUpperCase()}
                    </Type>
                  </View>
                  <Type variant="bodyStrong">@{m.label}</Type>
                  {m.sublabel ? (
                    <Type variant="caption" tone="muted" className="flex-1" numberOfLines={1}>
                      {m.sublabel}
                    </Type>
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}

        <View className="flex-row items-end gap-2 px-3 py-3">
          {/* Camera, library and mic were three separate 40px icons sitting
              permanently in front of the text field. Collapsing them into one
              ＋ is what makes room for everything else that wants to be here —
              the Coach especially, which until now had no visible entry point
              at all and could only be found by knowing to type "@". */}
          {/* THE CAMERA, BIG, ON THE LEFT. The rendering's ◉ — a white disc,
              the most prominent thing in the row, because capture is the point
              of being in a room with a game on.

              It was a ＋ opening a sheet, which put the camera three taps and a
              menu away from a moment that lasts two seconds. Tap for a photo,
              hold to record — the same gesture as the capture screen itself.

              Long-press-and-hold on the ＋ still reaches the rest (library,
              poll, trivia) via the small chevron beside it. */}
          <Pressable
            onPress={onFaceReaction ?? takePhoto}
            onLongPress={() => {
              Keyboard.dismiss();
              setShowPlus(true);
            }}
            delayLongPress={260}
            className="h-11 w-11 items-center justify-center rounded-full active:opacity-80"
            style={{ backgroundColor: colors.foreground }}
            hitSlop={4}
          >
            <Camera color="#000000" size={20} />
          </Pressable>

          {/* The rest of the ＋ sheet is still reachable, just no longer the
              first thing your thumb lands on. */}
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setShowPlus(true);
            }}
            className="h-8 w-8 items-center justify-center rounded-full active:opacity-70"
            style={{ backgroundColor: colors.muted }}
            hitSlop={6}
          >
            <Plus color={colors.mutedForeground} size={16} />
          </Pressable>

          {/* Text input */}
          <TextInput
            className="min-h-[44px] max-h-[120px] flex-1 rounded-2xl border-2 bg-muted px-4 py-2.5 text-base text-foreground"
            style={{ borderColor: colors.primary + "4D" }}
            placeholder="Message..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={(value) => {
              setText(value);
              onTypingChange?.(value.trim().length > 0);
            }}
            multiline
            editable={!disabled}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
            onFocus={onFocus}
            onBlur={() => onTypingChange?.(false)}
          />

          {/* ＋ · text · RECORD, and the record button becomes Send once there
              is something to send.

              A Send button greyed out at 40% is the most common state of this
              row and it does nothing — meanwhile the voice note, which is the
              fastest way to say something while a game is on, was three taps
              down inside the ＋ sheet. One button, and it is always the one
              that applies. */}
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full active:opacity-80"
            onPress={
              canSend
                ? handleSend
                : () => {
                    const next = text.trim() ? `${text.trim()} @coach ` : "@coach ";
                    setText(next);
                    onTypingChange?.(true);
                  }
            }
            disabled={disabled}
            style={{
              backgroundColor: canSend ? colors.primary : "rgba(245,197,24,0.14)",
              borderWidth: canSend ? 0 : 1,
              borderColor: "rgba(245,197,24,0.4)",
            }}
          >
            {canSend ? (
              <Send color={colors.primaryForeground} size={18} />
            ) : (
              <Type variant="dataStrong" tone="primary" style={{ fontSize: 15 }}>
                @
              </Type>
            )}
          </Pressable>
        </View>
        </>
      )}

      <Modal
        visible={showPlus}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlus(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/60"
          onPress={() => setShowPlus(false)}
        >
          {/* Stops a tap inside the sheet from closing it. */}
          <Pressable
            onPress={() => {}}
            className="rounded-t-3xl border-t border-border bg-card px-4 pb-8 pt-3"
          >
            <View className="mb-3 h-1 w-9 self-center rounded-full bg-muted" />

            {plusActions.map((a) => (
              <Pressable
                key={a.key}
                disabled={a.soon}
                onPress={() => {
                  setShowPlus(false);
                  a.run?.();
                }}
                className="flex-row items-center gap-3 py-3 active:opacity-70"
                style={a.soon ? { opacity: 0.4 } : undefined}
              >
                <View
                  className={
                    a.key === "coach"
                      ? "h-10 w-10 items-center justify-center rounded-xl bg-primary"
                      : "h-10 w-10 items-center justify-center rounded-xl bg-muted"
                  }
                >
                  <a.Icon
                    color={
                      a.key === "coach"
                        ? colors.primaryForeground
                        : colors.foreground
                    }
                    size={19}
                  />
                </View>
                <View className="flex-1">
                  <Type variant="bodyStrong">
                    {a.label}
                  </Type>
                  <Type variant="caption" tone="muted" className="mt-0.5">
                    {a.sub}
                  </Type>
                </View>
                {a.soon ? (
                  <Type variant="eyebrow" tone="muted">
                    Soon
                  </Type>
                ) : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

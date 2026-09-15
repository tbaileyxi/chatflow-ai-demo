import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Image,
  Keyboard,
  Modal,
} from "react-native";
import {
  Send,
  X,
  Camera,
  ImageIcon,
  Plus,
  Sparkles,
  BarChart3,
  HelpCircle,
  Video,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { shrinkPhoto } from "@/lib/shrinkImage";
import { Type } from "@/components/ui/Type";
import { colors } from "@/theme/colors";
import { type } from "@/theme/type";

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
  // An action picked from the ＋ sheet, held until the sheet has finished
  // closing — see the sheet's onPress for why it can't run straight away.
  const pendingActionRef = useRef<(() => void) | null>(null);
  const runPendingAction = () => {
    const run = pendingActionRef.current;
    pendingActionRef.current = null;
    run?.();
  };
  const [media, setMedia] = useState<MediaAttachment | null>(null);
  const inputRef = useRef<TextInput>(null);

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
      // Resized BEFORE it is attached, so the upload is a few hundred KB
      // rather than a few MB. See lib/shrinkImage.
      const small = await shrinkPhoto(result.assets[0].uri);
      setMedia({ uri: small.uri, type: "image" });
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
      const small = await shrinkPhoto(result.assets[0].uri);
      setMedia({ uri: small.uri, type: "image" });
    }
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
  const plusActions: {
    key: string;
    label: string;
    sub: string;
    Icon: any;
    run?: () => void;
    soon?: boolean;
  }[] = [
    {
      // ASK COACH, AT THE TOP. The sheet's render has always had a branch for
      // it — gold tile, white glyph — and the entry itself was missing, so the
      // Coach's only door was still knowing to type "@coach" at it. That is
      // the thing this button exists to stop being true.
      key: "coach",
      label: "Ask the Coach",
      sub: "Line, injury, who's hot",
      Icon: Sparkles,
      run: () => {
        setText((t) => (t.trim() ? `${t.trim()} @coach ` : "@coach "));
        // Hand over a live cursor. Dropping the text in with the keyboard down
        // makes you tap the field to finish the thought you just asked the app
        // to start.
        setTimeout(() => inputRef.current?.focus(), 80);
      },
    },
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
      className="border-t border-border"
      style={{
        backgroundColor: colors.huddleGroundAlt,
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
            <Image
              source={{ uri: media.uri }}
              className="h-16 w-16 rounded-xl"
              resizeMode="cover"
            />
            <View className="flex-1">
              <Type variant="captionStrong">
                Photo ready
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

        {/* ONE PILL. The renderings draw the whole composer as a single
            rounded container on #111113 with the controls sitting inside it,
            not a row of loose circles either side of a field. Radius 26 in a
            290px frame is 36 here — see rendering-scale-factors.

            ＋ · ◉ · field · Send. The ＋ carries the library, Ask Coach, poll
            and trivia; the ◉ is capture, which is the point of being in a room
            with a game on; Send is a send. */}
        <View className="px-3 pb-3 pt-2">
          <View
            className="flex-row items-center gap-2.5 px-2.5 py-2"
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: text.trim() ? "rgba(245,197,24,0.45)" : "#24242A",
              borderRadius: 36,
            }}
          >
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                setShowPlus(true);
              }}
              className="items-center justify-center rounded-full active:opacity-70"
              style={{ height: 40, width: 40, backgroundColor: colors.muted }}
              hitSlop={4}
            >
              <Plus color={colors.mutedForeground} size={20} />
            </Pressable>

            {/* ◉, not a camera glyph. A camera icon says "attach a file"; a
                record dot says "capture this, now", and this is the button for
                a moment that lasts two seconds. Tap for a photo, hold to
                record. */}
            <Pressable
              onPress={onFaceReaction ?? takePhoto}
              delayLongPress={260}
              className="items-center justify-center rounded-full active:opacity-80"
              style={{ height: 50, width: 50, backgroundColor: colors.foreground }}
              hitSlop={4}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 3,
                  borderColor: "#000",
                }}
              />
            </Pressable>

            <TextInput
              ref={inputRef}
              className="max-h-[110px] flex-1"
              style={{
                color: colors.foreground,
                fontFamily: type.body.fontFamily,
                fontSize: 19,
                lineHeight: 25,
                paddingVertical: 6,
              }}
              placeholder="Message…"
              placeholderTextColor={colors.textTertiary}
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

            <Pressable
              className="items-center justify-center rounded-full active:opacity-80"
              style={{
                height: 44,
                width: 44,
                backgroundColor: colors.primary,
                opacity: canSend ? 1 : 0.3,
              }}
              onPress={handleSend}
              disabled={!canSend || disabled}
            >
              <Send color={colors.primaryForeground} size={20} />
            </Pressable>
          </View>

          {/* The renderings carry this line under the dock. It is the only
              place the double-tap gesture is ever taught. */}
          <Type
            center
            variant="eyebrow"
            tone="tertiary"
            style={{ fontSize: 12, letterSpacing: 0.6, marginTop: 8, textTransform: "none" }}
          >
            Double-tap any message to 🔥
          </Type>
        </View>
      </>

      <Modal
        visible={showPlus}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlus(false)}
        onDismiss={runPendingAction}
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
                  // Close first, act once the sheet is gone. iOS will not
                  // present the photo picker over a modal that is still
                  // animating closed — it drops the request with no error, so
                  // "From your library" closed the sheet and did nothing.
                  pendingActionRef.current = a.run ?? null;
                  setShowPlus(false);
                  // onDismiss is iOS-only; this covers Android and any case
                  // where it doesn't fire. Whichever runs first clears the ref.
                  setTimeout(runPendingAction, 450);
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

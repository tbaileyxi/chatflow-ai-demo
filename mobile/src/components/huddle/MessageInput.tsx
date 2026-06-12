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
} from "react-native";
import { Send, X, Camera, ImageIcon, Mic, Square } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { colors } from "@/theme/colors";

type MediaAttachment = {
  uri: string;
  type: "image" | "audio";
};

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
};

export function MessageInput({
  onSend,
  disabled,
  replyTo,
  onCancelReply,
  onFocus,
  onTypingChange,
}: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
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
            <Text className="text-sm font-semibold text-primary">
              Replying to {replyTo.displayName}
            </Text>
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {replyTo.content}
            </Text>
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
                <Text className="text-sm text-foreground">Voice message</Text>
              </View>
            )}
            <View className="flex-1">
              <Text className="text-sm font-bold text-foreground">
                {media.type === "image" ? "Photo ready" : "Voice message ready"}
              </Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">
                Tap Send to post it to the room.
              </Text>
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
              <Text className="text-xs font-bold text-primary-foreground">
                Send
              </Text>
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
          <Text className="flex-1 text-sm font-semibold text-destructive">
            Recording {formatDuration(recordingDuration)}
          </Text>
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
        <View className="flex-row items-end gap-1.5 px-3 py-3">
          {/* Media action icons */}
          <Pressable
            onPress={takePhoto}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
            hitSlop={4}
          >
            <Camera color={colors.mutedForeground} size={20} />
          </Pressable>
          <Pressable
            onPress={pickFromLibrary}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
            hitSlop={4}
          >
            <ImageIcon color={colors.mutedForeground} size={20} />
          </Pressable>
          <Pressable
            onPress={startRecording}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
            hitSlop={4}
          >
            <Mic color={colors.mutedForeground} size={20} />
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

          {/* Send button */}
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-primary active:opacity-80"
            onPress={handleSend}
            disabled={!canSend}
            style={{ opacity: canSend ? 1 : 0.4 }}
          >
            <Send color={colors.primaryForeground} size={18} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { Send, X } from "lucide-react-native";
import { colors } from "@/theme/colors";

type Props = {
  onSend: (content: string, replyToId?: string) => Promise<{ error: any }>;
  disabled?: boolean;
  replyTo?: { id: string; displayName: string; content: string } | null;
  onCancelReply?: () => void;
};

export function MessageInput({ onSend, disabled, replyTo, onCancelReply }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setText("");
    const { error } = await onSend(trimmed, replyTo?.id);
    if (error) {
      setText(trimmed);
      Alert.alert("Error", "Failed to send message.");
    }
    onCancelReply?.();
    setSending(false);
  };

  return (
    <View
      className="border-t border-border bg-background"
      style={{ shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
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

      <View className="flex-row items-end gap-2 px-4 py-3">
        <TextInput
          className="min-h-[56px] max-h-[120px] flex-1 rounded-2xl border-2 bg-muted px-4 py-3 text-base text-foreground"
          style={{ borderColor: colors.primary + "4D" }}
          placeholder="Message..."
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={setText}
          multiline
          editable={!disabled}
        />
        <Pressable
          className="h-12 w-12 items-center justify-center rounded-full bg-primary active:opacity-80"
          onPress={handleSend}
          disabled={!text.trim() || sending || disabled}
          style={{ opacity: text.trim() && !sending ? 1 : 0.4 }}
        >
          <Send color={colors.primaryForeground} size={20} />
        </Pressable>
      </View>
    </View>
  );
}

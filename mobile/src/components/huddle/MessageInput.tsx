import { useState } from "react";
import { View, TextInput, Pressable, Alert } from "react-native";
import { Send } from "lucide-react-native";
import { colors } from "@/theme/colors";

type Props = {
  onSend: (content: string) => Promise<{ error: any }>;
  disabled?: boolean;
};

export function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setText("");
    const { error } = await onSend(trimmed);
    if (error) {
      setText(trimmed);
      Alert.alert("Error", "Failed to send message.");
    }
    setSending(false);
  };

  return (
    <View className="flex-row items-end gap-2 border-t border-border bg-background px-4 py-2">
      <TextInput
        className="min-h-[40px] max-h-[100px] flex-1 rounded-2xl border border-border bg-muted px-4 py-2 text-sm text-foreground"
        placeholder="Message..."
        placeholderTextColor={colors.mutedForeground}
        value={text}
        onChangeText={setText}
        multiline
        editable={!disabled}
      />
      <Pressable
        className="h-10 w-10 items-center justify-center rounded-full bg-primary active:opacity-80"
        onPress={handleSend}
        disabled={!text.trim() || sending || disabled}
        style={{ opacity: text.trim() && !sending ? 1 : 0.4 }}
      >
        <Send color={colors.primaryForeground} size={18} />
      </Pressable>
    </View>
  );
}

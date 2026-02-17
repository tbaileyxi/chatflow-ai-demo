import { View, Text, TextInput, type TextInputProps } from "react-native";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";

type TextareaProps = TextInputProps & {
  label?: string;
  error?: string;
  className?: string;
};

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <View className="gap-1.5">
      {label && (
        <Text className="text-sm font-medium text-foreground">{label}</Text>
      )}
      <TextInput
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        className={cn(
          "min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
          error && "border-destructive",
          className,
        )}
        placeholderTextColor={colors.mutedForeground}
        {...props}
      />
      {error && (
        <Text className="text-xs text-destructive">{error}</Text>
      )}
    </View>
  );
}

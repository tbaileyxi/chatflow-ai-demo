import { View, Text, TextInput, type TextInputProps } from "react-native";
import { Type } from "@/components/ui/Type";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  className?: string;
};

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <View className="gap-1.5">
      {label && (
        <Type variant="captionStrong">{label}</Type>
      )}
      <TextInput
        className={cn(
          "h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground",
          error && "border-destructive",
          className,
        )}
        placeholderTextColor={colors.mutedForeground}
        {...props}
      />
      {error && (
        <Type variant="caption" tone="danger">{error}</Type>
      )}
    </View>
  );
}

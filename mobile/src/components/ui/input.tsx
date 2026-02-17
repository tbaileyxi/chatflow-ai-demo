import { View, Text, TextInput, type TextInputProps } from "react-native";
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
        <Text className="text-sm font-medium text-foreground">{label}</Text>
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
        <Text className="text-xs text-destructive">{error}</Text>
      )}
    </View>
  );
}

import { View, Text, TextInput, type TextInputProps } from "react-native";
import { Type } from "@/components/ui/Type";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  className?: string;
};

export function Input({ label, error, className, style, ...props }: InputProps) {
  return (
    <View className="gap-1.5">
      {label && (
        <Type variant="captionStrong">{label}</Type>
      )}
      <TextInput
        className={cn(
          // MIN height, not a fixed one. It was h-10 — 40px, locked — and any
          // caller that set a bigger font and its own padding (Create a huddle
          // sets 21pt with 14px top and bottom, which needs about 55) had its
          // text pushed out of a 40px box. What was left on screen was the
          // caret, which is how you get a field you can type into and cannot
          // read.
          "min-h-10 rounded-md border border-input bg-background px-3 text-sm",
          error && "border-destructive",
          className,
        )}
        placeholderTextColor={colors.mutedForeground}
        // COLOUR IN STYLE, ahead of the caller's. text-foreground as a class
        // is one NativeWind resolution away from a TextInput rendering in the
        // platform default, which on this ground is black on black. A typed
        // character has to be visible; that is not a thing to leave to a
        // class name.
        style={[{ color: colors.foreground }, style]}
        {...props}
      />
      {error && (
        <Type variant="caption" tone="danger">{error}</Type>
      )}
    </View>
  );
}

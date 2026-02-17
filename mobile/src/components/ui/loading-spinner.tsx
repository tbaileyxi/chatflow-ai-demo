import { ActivityIndicator, View, type ActivityIndicatorProps } from "react-native";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";

type LoadingSpinnerProps = ActivityIndicatorProps & {
  className?: string;
};

export function LoadingSpinner({
  color = colors.primary,
  size = "small",
  className,
  ...props
}: LoadingSpinnerProps) {
  return (
    <View className={cn("items-center justify-center", className)}>
      <ActivityIndicator color={color} size={size} {...props} />
    </View>
  );
}

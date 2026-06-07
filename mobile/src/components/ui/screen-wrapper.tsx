import { Platform, View, ScrollView, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";

type ScreenWrapperProps = ViewProps & {
  scroll?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function ScreenWrapper({
  scroll = false,
  className,
  children,
  ...props
}: ScreenWrapperProps) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      {scroll ? (
        <ScrollView
          contentContainerClassName="flex-grow"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
        >
          <View className={cn("flex-1 px-4", className)} {...props}>
            {children}
          </View>
        </ScrollView>
      ) : (
        <View className={cn("flex-1 px-4", className)} {...props}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

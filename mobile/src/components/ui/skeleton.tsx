import { useEffect, useRef } from "react";
import { Animated, View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

type SkeletonProps = ViewProps & {
  className?: string;
};

export function Skeleton({ className, style, ...props }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View className={cn("rounded-md overflow-hidden", className)} {...props}>
      <Animated.View
        style={[{ flex: 1, backgroundColor: "#e5e7eb", opacity }, style]}
      />
    </View>
  );
}

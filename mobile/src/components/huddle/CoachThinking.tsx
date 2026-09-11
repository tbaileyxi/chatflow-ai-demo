import { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";
import { Type } from "@/components/ui/Type";
import { colors } from "@/theme/colors";

/**
 * "@coach is looking that up" with three pulsing dots.
 *
 * An answer takes time — the scan runs on a cron and there is a model call
 * behind it. With no sign of life the room reads as broken, so people ask
 * again, and the thread fills with the same question. This is the cheapest
 * possible fix: proof that something heard you.
 */
function Dot({ delay }: { delay: number }) {
  const o = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(o, { toValue: 1, duration: 320, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.25, duration: 320, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(640 - delay),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, o]);
  return (
    <Animated.View
      style={{ opacity: o, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }}
    />
  );
}

export function CoachThinking() {
  return (
    <View className="flex-row items-center gap-2 px-4 py-2">
      <View
        className="h-7 w-7 items-center justify-center rounded-full"
        style={{ borderWidth: 1.5, borderColor: colors.primary }}
      >
        <Type variant="dataStrong"  style={{ color: colors.primary }}>SH</Type>
      </View>
      <View className="flex-row items-center gap-2 rounded-2xl bg-white/5 px-3 py-2">
        <Type variant="caption" tone="muted">@coach is looking that up</Type>
        <View className="flex-row items-center gap-1">
          <Dot delay={0} />
          <Dot delay={160} />
          <Dot delay={320} />
        </View>
      </View>
    </View>
  );
}

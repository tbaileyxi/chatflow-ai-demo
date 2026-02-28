import { View, Text, Image, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { colors } from "@/theme/colors";
import type { PresenceUser } from "@/hooks/useHuddlePresence";

type Props = {
  users: PresenceUser[];
  entryBanner: string | null;
};

export function PresenceBar({ users, entryBanner }: Props) {
  const bannerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (entryBanner) {
      // Flash in
      Animated.sequence([
        Animated.timing(bannerOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(bannerOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [entryBanner, bannerOpacity]);

  if (users.length === 0) return null;

  const maxAvatars = 8;
  const visibleUsers = users.slice(0, maxAvatars);
  const overflow = users.length - maxAvatars;

  return (
    <View>
      {/* Avatar strip */}
      <View className="flex-row items-center gap-1 px-4 py-2 bg-muted/30">
        <View className="h-2 w-2 rounded-full bg-success" />
        <Text className="text-xs font-medium text-muted-foreground mr-1">
          {users.length}
        </Text>
        {visibleUsers.map((u, i) => (
          <View
            key={u.userId}
            className="h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-muted"
            style={i > 0 ? { marginLeft: -6 } : undefined}
          >
            {u.avatarUrl ? (
              <Image
                source={{ uri: u.avatarUrl }}
                className="h-full w-full"
                resizeMode="cover"
              />
            ) : (
              <Text className="text-xs font-bold text-muted-foreground">
                {u.displayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
        ))}
        {overflow > 0 && (
          <View
            className="h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted"
            style={{ marginLeft: -6 }}
          >
            <Text className="text-xs font-bold text-muted-foreground">
              +{overflow}
            </Text>
          </View>
        )}
      </View>

      {/* Animated entry banner — absolute positioned so it doesn't shift layout */}
      {entryBanner && (
        <Animated.View
          style={{ opacity: bannerOpacity, position: "absolute", left: 0, right: 0, top: 0, zIndex: 50 }}
          pointerEvents="none"
        >
          <View
            className="mx-4 my-1 items-center rounded-full py-1.5 px-4"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-xs font-semibold text-primary-foreground">
              {entryBanner}
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

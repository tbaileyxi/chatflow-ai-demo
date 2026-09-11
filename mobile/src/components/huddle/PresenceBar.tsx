import { View, Text, Image, Animated, Pressable, ScrollView } from "react-native";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Type } from "@/components/ui/Type";
import { colors } from "@/theme/colors";
import type { PresenceUser } from "@/hooks/useHuddlePresence";
import type { HuddleMember } from "@/hooks/useHuddleMembers";

type Props = {
  /** In the room right now. */
  users: PresenceUser[];
  /** Everyone in the room, present or not. */
  members?: HuddleMember[];
  entryBanner: string | null;
  /** Opens the full member list, which is also where inviting lives. */
  onSeeAll?: () => void;
  // Optional action rendered on the same row, right-aligned (e.g. the ping pill).
  rightSlot?: ReactNode;
};

type Face = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  here: boolean;
};

/**
 * Who's in the room, as faces you can actually tell apart.
 *
 * This was an overlapping stack of 28px circles with a number in front of it —
 * so it said "7" and showed you seven slivers, and the one fact worth carrying
 * (WHO) was the one thing it couldn't express. Overlapping avatars are a
 * space-saving device, and after the header collapsed there is space.
 *
 * Now: a scrolling row, no overlap, first name under each, present people
 * lit and members who aren't dimmed. A room shows the truth about itself —
 * four of nine here — instead of just counting the four.
 */
export function PresenceBar({
  users,
  members,
  entryBanner,
  onSeeAll,
  rightSlot,
}: Props) {
  const bannerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (entryBanner) {
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

  const faces = useMemo<Face[]>(() => {
    const hereIds = new Set(users.map((u) => u.userId));

    const present: Face[] = users.map((u) => ({
      userId: u.userId,
      name: u.displayName,
      avatarUrl: u.avatarUrl,
      here: true,
    }));

    // Members who aren't here. Dimmed rather than hidden: "nobody else is in
    // here" and "this room has nobody else in it" are very different facts,
    // and only one of them is a reason to invite somebody.
    const away: Face[] = (members ?? [])
      .filter((m) => !hereIds.has(m.userId))
      .map((m) => ({
        userId: m.userId,
        name: m.displayName ?? m.username ?? "Someone",
        avatarUrl: m.avatarUrl,
        here: false,
      }));

    return [...present, ...away];
  }, [users, members]);

  if (faces.length === 0 && !rightSlot) return null;

  // Enough to fill the row; the rest live behind See all rather than making
  // this scroll forever.
  const visible = faces.slice(0, 12);
  const overflow = faces.length - visible.length;

  return (
    <View>
      <View className="flex-row items-center bg-muted/30 py-1.5">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            alignItems: "flex-start",
            gap: 10,
            paddingHorizontal: 16,
          }}
        >
          {visible.map((f) => (
            <View key={f.userId} className="w-11 items-center">
              <View
                className="rounded-full p-[1.5px]"
                style={{
                  backgroundColor: f.here ? colors.primary : colors.border,
                  opacity: f.here ? 1 : 0.5,
                }}
              >
                <View className="h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-muted">
                  {f.avatarUrl ? (
                    <Image
                      source={{ uri: f.avatarUrl }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Type variant="dataStrong" tone="muted">
                      {f.name.charAt(0).toUpperCase()}
                    </Type>
                  )}
                </View>
              </View>
              <Text
                className={`mt-1 text-[9px] ${
                  f.here
                    ? "font-bold text-foreground"
                    : "font-medium text-muted-foreground"
                }`}
                numberOfLines={1}
              >
                {f.name.split(/\s+/)[0]}
              </Text>
            </View>
          ))}

          {onSeeAll ? (
            <Pressable
              onPress={onSeeAll}
              className="w-11 items-center active:opacity-70"
            >
              <View className="h-8 w-8 items-center justify-center rounded-full border border-border bg-muted">
                <Type variant="dataStrong" tone="primary">
                  {overflow > 0 ? `+${overflow}` : "•••"}
                </Type>
              </View>
              <Type variant="dataStrong" tone="primary" className="mt-1" numberOfLines={1}>
                See all
              </Type>
            </Pressable>
          ) : null}
        </ScrollView>

        {rightSlot ? <View className="px-3">{rightSlot}</View> : null}
      </View>

      {/* Animated entry banner — absolute positioned so it doesn't shift layout */}
      {entryBanner && (
        <Animated.View
          style={{
            opacity: bannerOpacity,
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            zIndex: 50,
          }}
          pointerEvents="none"
        >
          <View
            className="mx-4 my-1 items-center rounded-full px-4 py-1.5"
            style={{ backgroundColor: colors.primary }}
          >
            <Type variant="captionStrong" tone="onPrimary">
              {entryBanner}
            </Type>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

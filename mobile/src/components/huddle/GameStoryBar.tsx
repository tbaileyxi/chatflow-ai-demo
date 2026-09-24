// The way into the game story, and the way to make it go away.
//
// It appears in the room once the story is worth watching and not before —
// useGameStory decides that, and below the threshold this renders nothing at
// all rather than an empty shelf.
//
// DISMISSAL IS PER GAME, NOT FOREVER. A bar you cannot close is a bar people
// resent by the third week, and one that closes forever is a feature nobody
// sees again. The dismissal is keyed to the game, so closing it clears the
// room for the rest of today and next Saturday's story still announces
// itself. Reopening is always possible from the room's own menu.

import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Play, X } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { colors } from "@/theme/colors";
import type { GameStory } from "@/hooks/useGameStory";

const DISMISS_PREFIX = "game-story-dismissed";

export function GameStoryBar({
  story,
  onOpen,
}: {
  story: GameStory;
  onOpen: () => void;
}) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!story.key) {
      setDismissed(true);
      return;
    }
    (async () => {
      try {
        const v = await AsyncStorage.getItem(`${DISMISS_PREFIX}:${story.key}`);
        if (!cancelled) setDismissed(v === "1");
      } catch {
        // Storage refusing is not a reason to hide the story.
        if (!cancelled) setDismissed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [story.key]);

  const close = async () => {
    setDismissed(true);
    try {
      if (story.key) await AsyncStorage.setItem(`${DISMISS_PREFIX}:${story.key}`, "1");
    } catch {
      // Closed for this session is close enough.
    }
  };

  // Unknown (still reading storage) hides it too, so it never flashes in and
  // straight back out.
  if (!story.ready || dismissed !== false) return null;

  const clips = story.items.filter((i) => i.isVideo).length;
  const shots = story.items.length - clips;
  const parts = [
    shots > 0 ? `${shots} ${shots === 1 ? "shot" : "shots"}` : null,
    clips > 0 ? `${clips} ${clips === 1 ? "clip" : "clips"}` : null,
  ].filter(Boolean);

  return (
    <View
      className="mx-3 mb-2 flex-row items-center gap-3 rounded-2xl border px-3 py-2.5"
      style={{ borderColor: colors.primary, backgroundColor: colors.card }}
    >
      <Pressable
        onPress={onOpen}
        className="flex-1 flex-row items-center gap-3"
        accessibilityLabel="Watch the game story"
      >
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.primary }}
        >
          <Play color={colors.primaryForeground} size={16} fill={colors.primaryForeground} />
        </View>
        <View className="flex-1">
          <Type variant="captionStrong">Your game story is ready</Type>
          <Type variant="caption" tone="muted">
            {parts.join(" · ")} from {story.people} of you
          </Type>
        </View>
      </Pressable>
      <Pressable
        onPress={close}
        hitSlop={10}
        accessibilityLabel="Hide the game story"
        className="h-8 w-8 items-center justify-center"
      >
        <X color={colors.mutedForeground} size={18} />
      </Pressable>
    </View>
  );
}

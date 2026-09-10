import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import type { LiveReaction } from "@/hooks/useHuddlePresence";

/**
 * The reaction primitive.
 *
 * Watching a game with people is not a composing activity. Nobody writes a
 * sentence about a touchdown while it is happening — they make a noise. The
 * keyboard is the wrong default for the loudest thirty seconds of the night,
 * so the rail sits above it: four full-width targets, one thumb, no aim.
 *
 * IMPORTANT — the rail reacts to THE MOMENT, not to a message. That was the
 * ambiguity in the first design: a row of emoji floating above a thread looks
 * like it should attach to something, and there was no answer to "attach to
 * what". It doesn't attach. It says "what just happened on my TV", which is
 * why it can float free at the bottom and why it writes nothing down.
 *
 * Reacting to a MESSAGE is a different gesture and still lives where it was:
 * double-tap or long-press the message itself.
 */

export const RAIL_EMOJIS = ["🔥", "😱", "😂", "😤"] as const;

export function ReactionRail({
  onReact,
  disabled,
}: {
  onReact: (emoji: string) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row gap-2 px-3 pb-1 pt-2">
      {RAIL_EMOJIS.map((e) => (
        <RailButton key={e} emoji={e} onPress={() => onReact(e)} disabled={disabled} />
      ))}
    </View>
  );
}

function RailButton({
  emoji,
  onPress,
  disabled,
}: {
  emoji: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const fire = () => {
    if (disabled) return;
    // Punch out and settle. The button has to acknowledge the tap in its own
    // right — the emoji it launches starts at the far side of the screen, so
    // without this the thumb gets no confirmation it did anything.
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.28,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 180,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };

  return (
    <Pressable
      onPress={fire}
      disabled={disabled}
      className="h-12 flex-1 items-center justify-center rounded-2xl border border-border bg-card active:opacity-70"
      style={disabled ? { opacity: 0.4 } : undefined}
    >
      <Animated.Text style={{ fontSize: 24, transform: [{ scale }] }}>
        {emoji}
      </Animated.Text>
    </Pressable>
  );
}

/**
 * Reactions in flight, drifting up the right edge and fading out.
 *
 * They cost the thread nothing, which was the whole objection to writing them
 * down: a close fourth quarter produces hundreds and they would bury the
 * conversation under its own applause. You see the room react in real time and
 * none of it is there tomorrow.
 *
 * The path is deliberately not a straight line. Emoji rising in a column read
 * as a progress bar; drifting sideways and rotating slightly reads as a crowd.
 */
export function FloatingReactions({
  reactions,
}: {
  reactions: LiveReaction[];
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        right: 10,
        bottom: 0,
        width: 92,
        height: 340,
        overflow: "hidden",
      }}
    >
      {reactions.map((r) => (
        <FloatingOne key={r.id} reaction={r} />
      ))}
    </View>
  );
}

function FloatingOne({ reaction }: { reaction: LiveReaction }) {
  const progress = useRef(new Animated.Value(0)).current;
  // Fixed per instance so the same emoji fired twice doesn't trace the same
  // path. Randomised once, on mount, never on re-render.
  const drift = useRef({
    startX: 18 + Math.random() * 44,
    sway: (Math.random() - 0.5) * 46,
    tilt: (Math.random() - 0.5) * 26,
    size: 22 + Math.random() * 8,
  }).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 4000,
      easing: Easing.bezier(0.2, 0.6, 0.35, 1),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: drift.startX,
        bottom: 0,
        fontSize: drift.size,
        opacity: progress.interpolate({
          inputRange: [0, 0.08, 0.62, 1],
          outputRange: [0, 1, 0.7, 0],
        }),
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [10, -300],
            }),
          },
          {
            translateX: progress.interpolate({
              inputRange: [0, 0.4, 0.75, 1],
              outputRange: [0, drift.sway, -drift.sway * 0.6, drift.sway * 0.3],
            }),
          },
          {
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", `${drift.tilt}deg`],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 0.12, 1],
              outputRange: [0.6, 1.12, 0.85],
            }),
          },
        ],
      }}
    >
      {reaction.emoji}
    </Animated.Text>
  );
}

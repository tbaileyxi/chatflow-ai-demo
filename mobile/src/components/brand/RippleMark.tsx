/**
 * The mark, emitting itself.
 *
 * The ((•)) already sitting in the app's header is a ripple — concentric rings
 * spreading from a point. That is also, exactly, what a reaction moving through
 * a room looks like. The brand already contained the product's core gesture;
 * nothing needed inventing, only animating.
 *
 * So the signed-out screen doesn't show a logo, it shows the logo being made,
 * and tapping anywhere fires a ring from your finger instead of from the
 * centre. Someone performs the app's primary gesture before they know what the
 * app is, which is a better introduction than any sentence.
 *
 * Signed-out only. Tapping through a splash every time you come back from the
 * fridge is hostile, and once you have an account the app opens on Home.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { colors } from "@/theme/colors";

const RING_COUNT = 4;
const CYCLE_MS = 3400;
const MAX_SIZE = 300;

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (!cancelled) setReduce(on);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (on) => setReduce(on),
    );
    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

/** One expanding ring. Progress 0→1 is small-and-bright to large-and-gone. */
function Ring({
  progress,
  size = MAX_SIZE,
}: {
  progress: Animated.Value;
  size?: number;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: colors.primary,
        opacity: progress.interpolate({
          // Snaps in, lingers, fades out — a flat fade reads like a loading
          // spinner rather than something being emitted.
          inputRange: [0, 0.08, 0.7, 1],
          outputRange: [0, 1, 0.45, 0],
        }),
        transform: [
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.08, 1],
            }),
          },
        ],
      }}
    />
  );
}

export function RippleMark({
  children,
  /** Fires a ring wherever the screen is touched. */
  tappable = true,
  onTap,
}: {
  children?: ReactNode;
  tappable?: boolean;
  /** What a tap does, after the ring has fired. */
  onTap?: () => void;
}) {
  const reduceMotion = useReduceMotion();

  // Ambient rings, chasing each other out from the centre.
  const rings = useRef(
    Array.from({ length: RING_COUNT }, () => new Animated.Value(0)),
  ).current;
  const core = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      // Still show the mark, just at rest: rings parked at staggered sizes so
      // the shape reads as a ripple without anything moving.
      rings.forEach((r, i) => r.setValue((i + 1) / (RING_COUNT + 1)));
      return;
    }

    const loops = rings.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((CYCLE_MS / RING_COUNT) * i),
          Animated.timing(value, {
            toValue: 1,
            duration: CYCLE_MS,
            easing: Easing.bezier(0.15, 0.6, 0.3, 1),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    const corePulse = Animated.loop(
      Animated.sequence([
        Animated.timing(core, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(core, {
          toValue: 0,
          duration: 480,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(CYCLE_MS - 700),
      ]),
    );

    loops.forEach((l) => l.start());
    corePulse.start();
    return () => {
      loops.forEach((l) => l.stop());
      corePulse.stop();
    };
  }, [reduceMotion, rings, core]);

  // Rings fired by touching the screen. Each one owns its Animated.Value and
  // removes itself when it finishes, so nothing accumulates.
  const [taps, setTaps] = useState<
    { id: number; x: number; y: number; progress: Animated.Value }[]
  >([]);
  const nextId = useRef(0);

  const fireAt = (x: number, y: number) => {
    if (reduceMotion) return;
    const id = nextId.current++;
    const progress = new Animated.Value(0);
    setTaps((current) => [...current, { id, x, y, progress }]);
    Animated.timing(progress, {
      toValue: 1,
      duration: 1500,
      easing: Easing.bezier(0.15, 0.6, 0.3, 1),
      useNativeDriver: true,
    }).start(() => {
      setTaps((current) => current.filter((t) => t.id !== id));
    });
  };

  const body = (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Ambient, centred */}
      <View style={styles.centre} pointerEvents="none">
        {rings.map((progress, i) => (
          <Ring key={i} progress={progress} />
        ))}
        <Animated.View
          style={[
            styles.core,
            {
              transform: [
                {
                  scale: core.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.55],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      {/* Fired by touch, positioned at the finger */}
      {taps.map((t) => (
        <View
          key={t.id}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: t.x - MAX_SIZE / 2,
            top: t.y - MAX_SIZE / 2,
            width: MAX_SIZE,
            height: MAX_SIZE,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ring progress={t.progress} size={MAX_SIZE * 0.75} />
        </View>
      ))}

      {children}
    </View>
  );

  if (!tappable) return body;

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPressIn={(e) =>
        fireAt(e.nativeEvent.locationX, e.nativeEvent.locationY)
      }
      // The ripple fires on press-in so it tracks the finger; onTap runs on
      // release, after you have seen the ring you made. Without onTap the
      // screen says "tap anywhere" and nothing happens, which is the first
      // promise the app breaks.
      onPress={onTap}
      accessible={!!onTap}
      accessibilityRole={onTap ? "button" : undefined}
      accessibilityLabel={onTap ? "Get started" : undefined}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centre: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  core: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.8,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
});

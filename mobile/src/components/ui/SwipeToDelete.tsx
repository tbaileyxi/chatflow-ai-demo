import { useRef } from "react";
import { Animated, PanResponder, View } from "react-native";
import { Trash2 } from "lucide-react-native";
import { colors } from "@/theme/colors";

/**
 * Swipe left to delete a row.
 *
 * BUILT ON PanResponder, not react-native-gesture-handler. The project does
 * not have gesture-handler, and pulling in a native dependency that also
 * wants to wrap the navigation root is a large change to make for one swipe.
 * PanResponder ships with React Native and is enough for a horizontal drag.
 *
 * The threshold is deliberately past halfway: a notification list is scrolled
 * far more often than it is pruned, and a row that deletes itself on a
 * careless flick is worse than one that needs a deliberate pull.
 */
export function SwipeToDelete({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const width = useRef(0);

  const responder = useRef(
    PanResponder.create({
      // Only claim the gesture once it is clearly horizontal, or the list
      // stops scrolling.
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) x.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        const far = width.current * 0.45;
        if (g.dx < -far) {
          Animated.timing(x, {
            toValue: -width.current,
            duration: 160,
            useNativeDriver: true,
          }).start(onDelete);
        } else {
          Animated.spring(x, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <View onLayout={(e) => (width.current = e.nativeEvent.layout.width)}>
      {/* Behind the row, so the further you pull the more of it you see. */}
      <View
        className="absolute bottom-0 right-0 top-0 flex-row items-center justify-end rounded-xl px-5"
        style={{ left: 0, backgroundColor: colors.destructive }}
        pointerEvents="none"
      >
        <Trash2 color="#FFFFFF" size={18} />
      </View>

      <Animated.View style={{ transform: [{ translateX: x }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

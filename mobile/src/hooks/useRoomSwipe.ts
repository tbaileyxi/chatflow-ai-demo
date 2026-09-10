import { useMemo, useRef } from "react";
import { PanResponder } from "react-native";

/**
 * Swipe sideways to the next room.
 *
 * Replaces the JUMP rail — a horizontal strip of pills that sat under the
 * header eating ~40px of every room, on every screen, whether or not anybody
 * wanted to leave. Moving rooms is a navigation gesture, not a piece of
 * furniture, and it should cost no pixels at all until you use it.
 *
 * Built on PanResponder from react-native core rather than
 * react-native-gesture-handler, which isn't a dependency of this app.
 * Adding one would mean a native rebuild, and this needs to survive an EAS
 * build without new native surface area.
 *
 * The interesting part is not the swipe, it's not stealing the FlatList's
 * vertical scroll: the responder only claims a gesture that is clearly
 * sideways, and stays out of the way otherwise.
 */

// Deliberately strict. A message list is scrolled vertically hundreds of times
// per session and hijacked sideways maybe twice, so the cost of a false
// positive is far higher than the cost of a missed swipe.
const MIN_DISTANCE = 28;
const HORIZONTAL_BIAS = 2;
const TRIGGER = 70;

export function useRoomSwipe({
  roomIds,
  currentId,
  onNavigate,
  enabled = true,
}: {
  /** Ordered, as the user sees them elsewhere. */
  roomIds: string[];
  currentId: string;
  onNavigate: (huddleId: string) => void;
  enabled?: boolean;
}) {
  // Kept in a ref so the responder — created once — always reads current
  // values instead of closing over the first render's list.
  const state = useRef({ roomIds, currentId, onNavigate, enabled });
  state.current = { roomIds, currentId, onNavigate, enabled };

  return useMemo(
    () =>
      PanResponder.create({
        // Never claim the gesture on touch-down: that would swallow taps on
        // messages, reactions and every control in the thread.
        onStartShouldSetPanResponder: () => false,

        onMoveShouldSetPanResponder: (_evt, g) => {
          if (!state.current.enabled) return false;
          if (state.current.roomIds.length < 2) return false;
          return (
            Math.abs(g.dx) > MIN_DISTANCE &&
            Math.abs(g.dx) > Math.abs(g.dy) * HORIZONTAL_BIAS
          );
        },

        onPanResponderRelease: (_evt, g) => {
          const { roomIds, currentId, onNavigate, enabled } = state.current;
          if (!enabled || roomIds.length < 2) return;
          if (Math.abs(g.dx) < TRIGGER) return;

          const index = roomIds.indexOf(currentId);
          if (index === -1) return;

          // Wraps at both ends. A room list is a ring, not a document — there
          // is no "past the last one" that means anything to a person.
          const next =
            g.dx < 0
              ? roomIds[(index + 1) % roomIds.length]
              : roomIds[(index - 1 + roomIds.length) % roomIds.length];

          if (next && next !== currentId) onNavigate(next);
        },
      }).panHandlers,
    [],
  );
}

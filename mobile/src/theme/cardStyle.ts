import type { ViewStyle } from "react-native";
import { colors } from "@/theme/colors";

/**
 * The border language, in one place.
 *
 * EVERY CARD HAS A VISIBLE EDGE. The old default was #232329 — two shades off
 * the card it was drawing around — so a screen of cards read as one grey
 * column and nothing told you where one stopped. A plain light stroke costs
 * nothing and does the whole job.
 *
 * Then two states earn a colour, and only two:
 *
 *   LIVE       solid gold. A game is on. Loudest thing on any screen.
 *   SIDE       dashed gold. Also live — same game, fewer people — and it
 *              ends at 2am. Dashed says temporary; gold says still on.
 *   QUIET      the plain stroke. Nothing playing, nothing shouting.
 *
 * No left bars. A gradient stripe down the edge of a card was decoration
 * pretending to be information, and it is not in here.
 */

/** The plain stroke. White at 20% rather than a grey hex, so it sits the same
 *  distance off every surface it is drawn on. */
export const CARD_EDGE = "rgba(255,255,255,0.20)";
export const CARD_EDGE_GOLD = "rgba(245,197,24,0.62)";

export type CardState = "live" | "side" | "quiet";

export function cardStyle(state: CardState): ViewStyle {
  if (state === "live") {
    return {
      backgroundColor: "#151412",
      borderWidth: 1.5,
      borderColor: CARD_EDGE_GOLD,
    };
  }
  if (state === "side") {
    return {
      backgroundColor: "#131211",
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: CARD_EDGE_GOLD,
    };
  }
  return {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: CARD_EDGE,
  };
}

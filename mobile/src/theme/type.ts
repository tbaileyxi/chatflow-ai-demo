import { Platform, type TextStyle } from "react-native";

/**
 * The type system, taken from the design studies — AT THE RIGHT SCALE.
 *
 * THE MISTAKE THIS FILE EXISTS TO NOT REPEAT. The studies draw a phone inside
 * a frame about 292px wide. A real iPhone is 402pt. Reading `font-size:14.5px`
 * out of that CSS and setting 14.5 in the app makes everything **38% smaller
 * than drawn** — which is exactly what shipped, and why the built screens read
 * as a settings list next to a design that shouts.
 *
 * Every size here is the study's value × 1.38. If you are ever taking a number
 * out of one of those files, scale it.
 *
 * THE FACES ARE NOT A CHOICE EITHER. Outfit for display, Manrope for interface,
 * DM Mono for data — named in the renderings. Picking your own is the other way
 * the design never lands.
 *
 * Never set fontWeight alongside these. iOS synthesises weight when a family
 * and a weight disagree, and a synthesised bold on a face that already has one
 * looks like a smear. The family IS the weight.
 */

export const fonts = {
  display: "Outfit_800ExtraBold",
  displayBold: "Outfit_700Bold",
  displaySemi: "Outfit_600SemiBold",

  extrabold: "Manrope_800ExtraBold",
  bold: "Manrope_700Bold",
  semibold: "Manrope_600SemiBold",
  medium: "Manrope_500Medium",
  regular: "Manrope_400Regular",

  mono: "DMMono_400Regular",
  monoMedium: "DMMono_500Medium",
} as const;

export const type = {
  /** The wordmark, and nothing else on a screen. */
  display: {
    fontFamily: fonts.display,
    fontSize: 41,
    lineHeight: 45,
    letterSpacing: -1.0,
  },
  /** Screen titles. */
  title: {
    fontFamily: fonts.display,
    fontSize: 29,
    lineHeight: 33,
    letterSpacing: -0.6,
  },
  /** A room name, a section heading. */
  heading: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.3,
  },
  /**
   * WHAT PEOPLE SAY. 14.5 in the rendering — dense on purpose, because with no
   * bubbles the density costs nothing and a room is a lot of short lines.
   */
  message: {
    fontFamily: fonts.regular,
    fontSize: 20,
    lineHeight: 27,
    letterSpacing: -0.3,
  },
  /**
   * A SHOUT. Someone typed in capitals and meant it.
   *
   * 19px and heavy — noticeably bigger than a sentence, not a different
   * document. "THAT'S THE GAME" is the loudest thing in the thread and it
   * should look it without taking the screen over.
   */
  shout: {
    fontFamily: fonts.extrabold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.8,
  },
  /** A person's name above what they said. Small, heavy, in their colour. */
  speaker: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: 0.1,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 20,
    lineHeight: 27,
    letterSpacing: 0,
  },
  bodyStrong: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 27,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: 0,
  },
  captionStrong: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: 0,
  },
  /**
   * SECTION LABELS. Mono, uppercase, tracked far out — the broadcast
   * lower-third convention, and the thing that makes a screen read as designed
   * rather than assembled.
   */
  eyebrow: {
    fontFamily: fonts.monoMedium,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 1.9,
    textTransform: "uppercase",
  },
  /** Clocks, scores, counts, timestamps. */
  data: {
    fontFamily: fonts.mono,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  dataStrong: {
    fontFamily: fonts.monoMedium,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: 0.1,
  },
  /**
   * A SCORELINE. The only digits allowed to be loud, and tabular so they don't
   * shuffle sideways as they change.
   */
  score: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 25,
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  button: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
} satisfies Record<string, TextStyle>;

/**
 * Spacing steps. Four-point grid, named by intent rather than size so a row gap
 * and a section gap can't drift apart screen to screen.
 */
export const space = {
  hair: 2,
  tight: 4,
  snug: 8,
  base: 12,
  row: 16,
  block: 24,
  section: 32,
} as const;

/** From the renderings: 15 on a reaction tile, 13 on a card, 26 on a composer. */
export const radius = {
  chip: 999,
  control: 13,
  tile: 15,
  card: 14,
  sheet: 26,
} as const;

export const lift = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  default: { elevation: 8 },
}) as TextStyle;

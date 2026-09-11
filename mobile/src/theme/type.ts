import { Platform, type TextStyle } from "react-native";

/**
 * The type system, taken from the design studies rather than invented.
 *
 * THE FACES ARE NOT A CHOICE I GET TO MAKE. They are in the renderings:
 * Outfit for display, Manrope for interface, DM Mono for data. An earlier
 * version of this file used Archivo and JetBrains Mono because I picked them
 * myself, and that is the single reason the built screens didn't look like the
 * design — the structure was right, the voice was somebody else's.
 *
 * WHAT EACH ONE IS FOR.
 *
 * Outfit is the display face: geometric, heavy, and it holds a shout. It is
 * used sparingly — wordmarks, screen titles, a score, a message somebody typed
 * in capitals. Everything else is Manrope.
 *
 * Manrope is the interface and the thread. It is what people read.
 *
 * DM Mono is the instrument panel: eyebrows, clocks, scores, counts. The
 * monospaced digits are the reason — a clock in a proportional face jitters as
 * it counts down and a column of scores never lines up.
 *
 * SIZES COME FROM THE RENDERINGS TOO. A message is 14.5px and a shout is 19px,
 * because that is what "Before, During, After" sets them at. I had guessed 19
 * and 27 and made the thread look like a children's book.
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
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.75,
  },
  /** Screen titles. */
  title: {
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 25,
    letterSpacing: -0.42,
  },
  /** A room name, a section heading. */
  heading: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.16,
  },
  /**
   * WHAT PEOPLE SAY. 14.5 in the rendering — dense on purpose, because with no
   * bubbles the density costs nothing and a room is a lot of short lines.
   */
  message: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 21,
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
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.19,
  },
  /** A person's name above what they said. Small, heavy, in their colour. */
  speaker: {
    fontFamily: fonts.extrabold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.11,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 21,
  },
  bodyStrong: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    lineHeight: 21,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
  },
  captionStrong: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    lineHeight: 17,
  },
  /**
   * SECTION LABELS. Mono, uppercase, tracked far out — the broadcast
   * lower-third convention, and the thing that makes a screen read as designed
   * rather than assembled.
   */
  eyebrow: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.7,
    textTransform: "uppercase",
  },
  /** Clocks, scores, counts, timestamps. */
  data: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.1,
  },
  dataStrong: {
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  /**
   * A SCORELINE. The only digits allowed to be loud, and tabular so they don't
   * shuffle sideways as they change.
   */
  score: {
    fontFamily: fonts.display,
    fontSize: 14,
    lineHeight: 17,
    letterSpacing: -0.14,
    fontVariant: ["tabular-nums"],
  },
  button: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    lineHeight: 19,
    letterSpacing: -0.1,
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

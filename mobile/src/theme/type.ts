import { Platform, type TextStyle } from "react-native";

/**
 * The type system. One place that decides what a heading is.
 *
 * WHY THIS EXISTS. Every screen was picking its own size and weight inline —
 * 151 uses of font-black, 126 of font-bold, sizes from text-[9] to text-5xl,
 * and no custom face loaded at all. The app rendered in system San Francisco
 * throughout, which is why the built screens never looked like the design: the
 * structure changed and the voice never did.
 *
 * TWO FACES, DOING DIFFERENT JOBS.
 *
 * Archivo is the voice. A grotesque that holds up at 900 without turning into
 * a slab, which matters because this app shouts — scores, names, THAT'S THE
 * GAME — and a face that softens at heavy weights makes shouting look
 * apologetic.
 *
 * JetBrains Mono is the instrument panel: eyebrows, clocks, scores, counts,
 * anything a broadcast graphic would set. Monospaced digits are the real
 * reason — a clock in a proportional face jitters as it counts down, and a
 * column of scores never lines up.
 *
 * Never set fontWeight alongside these. iOS synthesises weight when a family
 * and a weight disagree, and a synthesised 900 on a face that already has one
 * looks like a smear. The family IS the weight.
 */

export const fonts = {
  display: "Archivo_900Black",
  bold: "Archivo_700Bold",
  semibold: "Archivo_600SemiBold",
  medium: "Archivo_500Medium",
  regular: "Archivo_400Regular",
  mono: "JetBrainsMono_500Medium",
  monoBold: "JetBrainsMono_700Bold",
} as const;

/**
 * A scale, not a pile of numbers. Each step is a job.
 *
 * The jumps are deliberately large between display and body: a room is scanned,
 * not read, and near-adjacent sizes read as a mistake rather than a hierarchy.
 */
export const type = {
  /** The one thing on screen that is the screen. Home's wordmark, a score. */
  display: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
  },
  /** Screen titles. */
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  /** A room name, a person's name above what they said. */
  heading: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  /** What people actually say. The most-rendered style in the app. */
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
  },
  bodyStrong: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
  },
  /** Second lines: who's in a room, when a game starts. */
  caption: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 17,
  },
  captionStrong: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 17,
  },
  /**
   * SECTION LABELS. Mono, uppercase, tracked out — the broadcast lower-third
   * convention, and the thing that makes a screen read as designed rather than
   * assembled. Always paired with `textTransform: "uppercase"`.
   */
  eyebrow: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  /** Clocks, scores, counts. Tabular by construction. */
  data: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  dataStrong: {
    fontFamily: fonts.monoBold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.2,
  },
  /** Buttons. */
  button: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
} satisfies Record<string, TextStyle>;

/**
 * Spacing steps. Four-point grid, named by intent rather than size so a row
 * gap and a section gap can't drift apart screen to screen.
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

export const radius = {
  chip: 999,
  control: 12,
  card: 16,
  sheet: 24,
} as const;

/**
 * Shadows are for the one thing that floats, not for every card. Android
 * elevation and iOS shadow are different enough that a shared helper is the
 * only way they stay in step.
 */
export const lift = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  default: { elevation: 8 },
}) as TextStyle;

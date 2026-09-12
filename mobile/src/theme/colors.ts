/**
 * Resolved hex color constants from the web app's dark theme CSS variables.
 * Use these for imperative styling (e.g. StatusBar, NavigationContainer theme).
 */
export const colors = {
  background: "#0A0A0B",
  foreground: "#F0F0F2",

  primary: "#F5C518",
  primaryForeground: "#0A0A0B",

  secondary: "#111113",
  secondaryForeground: "#F0F0F2",

  accent: "#18181B",
  accentForeground: "#F0F0F2",

  destructive: "#E8453C",
  destructiveForeground: "#FFFFFF",

  muted: "#18181B",
  mutedForeground: "#A0A0A8",

  /**
   * THE ROOM HAS ITS OWN GROUND. #141418, not the app's #0A0A0B.
   *
   * Straight from the shipped-palette prototype, and the reason the built
   * room read as "dull grey on black" while the design did not: a thread on
   * the same near-black as every other screen has nothing to sit on, so the
   * messages float and the whole surface goes flat. One step up and the room
   * becomes a place you walked into.
   */
  huddleGround: "#141418",
  huddleGroundAlt: "#1A1A1F",
  /** Somebody else's message. Yours is `primary`. */
  bubbleOther: "#222226",

  card: "#111113",
  cardForeground: "#F0F0F2",

  popover: "#18181B",
  popoverForeground: "#F0F0F2",

  border: "#2A2A2F",
  input: "#222226",
  ring: "#F5C518",

  success: "#22C55E",
  successForeground: "#FFFFFF",
  info: "#3B82F6",
  textTertiary: "#505058",

  huddle: {
    primary: "#F5C518",
    secondary: "#3B82F6",
  },

  verified: {
    primary: "#22C55E",
    background: "#14532D",
    border: "#16A34A",
  },
} as const;

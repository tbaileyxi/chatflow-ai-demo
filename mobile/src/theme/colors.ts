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

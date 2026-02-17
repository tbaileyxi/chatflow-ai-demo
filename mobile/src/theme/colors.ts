/**
 * Resolved hex color constants from the web app's dark theme CSS variables.
 * Use these for imperative styling (e.g. StatusBar, NavigationContainer theme).
 */
export const colors = {
  background: "#0A0A0A",
  foreground: "#FAFAFA",

  primary: "#FFD700",
  primaryForeground: "#0A0A0A",

  secondary: "#00D4FF",
  secondaryForeground: "#0A0A0A",

  accent: "#FF8C00",
  accentForeground: "#0A0A0A",

  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",

  muted: "#262626",
  mutedForeground: "#999999",

  card: "#0A0A0A",
  cardForeground: "#FAFAFA",

  popover: "#1F1F1F",
  popoverForeground: "#FAFAFA",

  border: "#262626",
  input: "#262626",
  ring: "#FFD700",

  success: "#00CC00",
  successForeground: "#FFFFFF",

  huddle: {
    primary: "#FFD700",
    secondary: "#00D4FF",
  },

  verified: {
    primary: "#22C55E",
    background: "#14532D",
    border: "#16A34A",
  },
} as const;

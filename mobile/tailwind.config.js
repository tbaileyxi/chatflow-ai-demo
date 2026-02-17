/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Resolved from HSL CSS vars in the web dark theme
        border: "#262626",
        input: "#262626",
        ring: "#FFD700",
        background: "#0A0A0A",
        foreground: "#FAFAFA",

        primary: {
          DEFAULT: "#FFD700", // hsl(51, 100%, 50%) — neon gold
          foreground: "#0A0A0A",
        },
        secondary: {
          DEFAULT: "#00D4FF", // hsl(191, 100%, 50%) — teal
          foreground: "#0A0A0A",
        },
        destructive: {
          DEFAULT: "#EF4444", // hsl(0, 84%, 60%)
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#262626", // hsl(0, 0%, 15%)
          foreground: "#999999", // hsl(0, 0%, 60%)
        },
        accent: {
          DEFAULT: "#FF8C00", // hsl(30, 100%, 50%) — orange
          foreground: "#0A0A0A",
        },
        popover: {
          DEFAULT: "#1F1F1F", // hsl(0, 0%, 12%)
          foreground: "#FAFAFA",
        },
        card: {
          DEFAULT: "#0A0A0A", // hsl(0, 0%, 4%)
          foreground: "#FAFAFA",
        },
        success: {
          DEFAULT: "#00CC00", // hsl(120, 100%, 40%)
          foreground: "#FFFFFF",
        },
        huddle: {
          primary: "#FFD700",
          secondary: "#00D4FF",
        },
        verified: {
          primary: "#22C55E", // hsl(142, 76%, 36%)
          background: "#14532D", // hsl(142, 76%, 15%)
          border: "#16A34A", // hsl(142, 76%, 30%)
        },
      },
      borderRadius: {
        lg: 12,
        md: 10,
        sm: 8,
      },
    },
  },
  plugins: [],
};

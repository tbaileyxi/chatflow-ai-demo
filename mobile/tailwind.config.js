/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        border: "#2A2A2F",
        input: "#222226",
        ring: "#F5C518",
        background: "#0A0A0B",
        foreground: "#F0F0F2",

        primary: {
          DEFAULT: "#F5C518",
          foreground: "#0A0A0B",
        },
        secondary: {
          DEFAULT: "#111113",
          foreground: "#F0F0F2",
        },
        destructive: {
          DEFAULT: "#E8453C",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#18181B",
          foreground: "#A0A0A8",
        },
        accent: {
          DEFAULT: "#18181B",
          foreground: "#F0F0F2",
        },
        popover: {
          DEFAULT: "#18181B",
          foreground: "#F0F0F2",
        },
        card: {
          DEFAULT: "#111113",
          foreground: "#F0F0F2",
        },
        success: {
          DEFAULT: "#22C55E",
          foreground: "#FFFFFF",
        },
        info: "#3B82F6",
        huddle: {
          primary: "#F5C518",
          secondary: "#3B82F6",
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

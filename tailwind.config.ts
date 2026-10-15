import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: "#000000",
        surface: {
          DEFAULT: "#0A0A0A",
          elevated: "#121212",
          card: "#0E0E0E",
        },
        interactive: {
          DEFAULT: "#171717",
          hover: "#222222",
          active: "#2A2A2A",
        },
        darkorange: {
          DEFAULT: "#ea580c",
          deep: "#c2410c",
          deeper: "#9a3412",
          muted: "#fff7ed",
          border: "rgba(234, 88, 12, 0.22)",
        },
      },
      borderRadius: {
        squircle: "22px",
        "squircle-sm": "14px",
        "squircle-lg": "32px",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "ui-monospace",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        glow: "0 0 25px -5px rgba(255, 255, 255, 0.12)",
        "subtle-card": "0 8px 32px 0 rgba(0, 0, 0, 0.6)",
        ios: "0 10px 30px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        "orange-glow": "0 0 25px -5px rgba(234, 88, 12, 0.28)",
        "orange-ios": "0 10px 30px -10px rgba(234, 88, 12, 0.2), 0 0 0 1px rgba(234, 88, 12, 0.2)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-up": "scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleUp: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant("light", "html.light &");
    }),
  ],
};

export default config;

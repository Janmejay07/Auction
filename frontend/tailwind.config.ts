import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        pitch: {
          900: "#062817",
          800: "#0b4226",
          700: "#0e5a34",
          500: "#10b981",
          400: "#34d399",
        },
        arena: {
          950: "#080c14",
          900: "#0d131f",
          850: "#121a2b",
          800: "#182238",
          700: "#22314e",
          600: "#33456b",
        },
        gold: {
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-fast": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 15px rgba(16, 185, 129, 0.3)" },
          "100%": { boxShadow: "0 0 30px rgba(16, 185, 129, 0.8)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

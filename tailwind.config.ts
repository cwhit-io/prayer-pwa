import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-body)",
          "Roboto Condensed",
          "Arial Narrow",
          "Arial",
          "sans-serif"
        ],
        reading: ["var(--font-reading)", "Roboto", "Arial", "sans-serif"],
        display: ["Impact", "Haettenschweiler", "Arial Narrow Bold", "sans-serif"]
      },
      colors: {
        yellow: {
          DEFAULT: "#ffd300",
          deep: "#f2b900",
          hover: "#ffe04a",
          active: "#e8b900"
        },
         night: "#101010",
         "night-deep": "#0b0b0b",
         surface: {
           DEFAULT: "#000000",
           raised: "#141414",
           hover: "#1d1d1d"
         },
         paper: "#f5f5f5",
         muted: "#bdbdbd",
         scripture: "#e5e7eb",
        success: "#55c878",
        warning: "#f2b900",
        danger: "#e46a6a",
        focus: "#ffe45c",
        disabled: "#666666"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(19, 34, 56, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;

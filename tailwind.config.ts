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
        night: "#151515",
        "night-deep": "#111111",
        surface: {
          DEFAULT: "#1d1d1d",
          raised: "#252525",
          hover: "#2c2c2c"
        },
        paper: "#f2f0eb",
        muted: "#b8b8b8",
        scripture: "#e8e4db",
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

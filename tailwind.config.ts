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
        ink: {
          DEFAULT: "#0b1220",
          soft: "#1a2332",
        },
        paper: {
          DEFAULT: "#f7f4ef",
          elevated: "#fffcf7",
        },
        line: "#e6e0d6",
        muted: "#6b6560",
        gold: {
          DEFAULT: "#b8922e",
          soft: "#f3e6c0",
        },
        forest: {
          DEFAULT: "#0f3d2e",
          soft: "#e8f0ec",
        },
        primary: {
          50: "#f7f4ef",
          100: "#ebe6dc",
          200: "#d4cdc0",
          300: "#b0a898",
          400: "#8a8170",
          500: "#6b6560",
          600: "#4a453f",
          700: "#1a2332",
          800: "#121a28",
          900: "#0b1220",
          950: "#060a12",
        },
        ghana: {
          red: "#CE1126",
          gold: "#FCD116",
          green: "#006B3F",
        },
      },
      fontFamily: {
        sans: ['"Instrument Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Newsreader"', "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 0 rgba(11,18,32,0.04), 0 12px 40px rgba(11,18,32,0.06)",
        lift: "0 20px 50px rgba(11,18,32,0.12)",
      },
    },
  },
  plugins: [],
};
export default config;

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
        primary: {
          50: "#e8f5ee",
          100: "#c5e6d4",
          200: "#9fd5b7",
          300: "#6fbf94",
          400: "#3da870",
          500: "#006b3f",
          600: "#005c36",
          700: "#004d2c",
          800: "#003d23",
          900: "#002e1a",
          950: "#001a0f",
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
    },
  },
  plugins: [],
};
export default config;

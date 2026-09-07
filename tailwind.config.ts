// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./public/**/*.html",
  ],
  theme: {
    extend: {
      colors: {
        "base": "#F5F2EB",
        "secondary": "#A3907C",
        "accent": "#1F2421",
      },
      fontFamily: {
        serif: ["Playfair Display", "serif"],
        sans: ["Outfit", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

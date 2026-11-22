import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#090909",
        card: "#171717",
        brand: "#D71920",
        gold: "#FFC629",
        mute: "#929292",
        line: "#2a2a2a",
      },
    },
  },
  plugins: [],
};
export default config;

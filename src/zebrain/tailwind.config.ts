import type { Config } from "tailwindcss";

// Colours are CSS variables (RGB channels) so the light and dark themes in globals.css swap them, and opacity
// modifiers like bg-paper/60 still work.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: v("ink"), // page
        panel: v("panel"), // raised surfaces, inputs
        line: v("line"), // hairlines
        mute: v("mute"), // secondary text
        paper: v("paper"), // primary text
        accent: v("accent"), // the one brand colour: buttons, links in focus, the light beam
        bad: v("bad"),
        good: v("good"),
      },
      fontFamily: {
        display: ["var(--font-body)", "Helvetica Neue", "Arial", "sans-serif"],
        sans: ["var(--font-body)", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo", "monospace"],
        pixel: ["var(--font-pixel)", "var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;

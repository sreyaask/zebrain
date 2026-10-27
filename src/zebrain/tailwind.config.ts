import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#000000", // page
        panel: "#0c0f17", // raised surfaces, inputs
        line: "#1e2433", // hairlines
        mute: "#8a93a8", // secondary text
        paper: "#f4f6fb", // primary text
        accent: "#3d7bff", // the one brand colour: buttons, links in focus, the light beam
        bad: "#ff8a80",
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

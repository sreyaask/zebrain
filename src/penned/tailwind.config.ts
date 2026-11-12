import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Penned's theme (from the "handwriting AI company" infographic): near-black page, dark cards with hairline borders,
      // warm copper accent. `accent` is the copper for text, borders and rings (5.9:1 on the page); `accent-deep` is the
      // fill behind white text (6:1). Paper renderings (notebook previews, the pen demo) stay cream: `sheet` / `sheet-ink`.
      colors: {
        paper: "#070707",
        ink: "#F2EFEA",
        accent: { DEFAULT: "#C88660", deep: "#8C5233", soft: "#22160F" },
        line: "#2A2826",
        muted: "#A8A39C",
        surface: "#121212",
        danger: "#F07A6E",
        success: "#5BBF87",
        sheet: { DEFAULT: "#F4EFE7", ink: "#1A1A1A", line: "#CBD5E8" },
        pen: { blue: "#22409A", black: "#1A1A1A" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "ui-sans-serif", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        hand: ["var(--font-caveat)", "cursive"],
      },
      borderRadius: { card: "12px" },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        write: { from: { clipPath: "inset(0 100% 0 0)" }, to: { clipPath: "inset(0 0 0 0)" } },
        "tile-in": { from: { opacity: "0", transform: "scale(.96) translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        "step-forward": { from: { opacity: "0", transform: "translateX(24px)" }, to: { opacity: "1", transform: "none" } },
        "step-back": { from: { opacity: "0", transform: "translateX(-24px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "fade-in": "fade-in 400ms ease-out both",
        "slide-up": "slide-up 450ms cubic-bezier(.2,.7,.2,1) both",
        write: "write 1400ms steps(28, end) both",
        "tile-in": "tile-in 220ms cubic-bezier(.2,.7,.2,1) both",
        "step-forward": "step-forward 260ms cubic-bezier(.2,.7,.2,1) both",
        "step-back": "step-back 260ms cubic-bezier(.2,.7,.2,1) both",
      },
    },
  },
  plugins: [],
};
export default config;

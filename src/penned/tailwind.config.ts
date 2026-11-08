import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF9F6",
        ink: "#111111",
        accent: { DEFAULT: "#1E3A8A", soft: "#E8ECF6" },
        line: "#E6E3DC",
        muted: "#55534E",
        surface: "#FFFFFF",
        danger: "#B42318",
        success: "#1F6F43",
        pen: { blue: "#1E3A8A", black: "#1A1A1A" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
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

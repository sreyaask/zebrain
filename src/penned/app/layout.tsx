import type { Metadata, Viewport } from "next";
import { Caveat, Inter, Newsreader } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });
const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif", display: "swap", weight: ["500"], adjustFontFallback: false, preload: false }); // wordmark only

export const metadata: Metadata = {
  title: { default: "Penned: handwritten notes, ready to study from", template: "%s · Penned" },
  description:
    "Penned makes neat, handwritten copies of your notes so you can revise from a clean notebook, catch up after absences, or keep a tidy record of lessons.",
};

export const viewport: Viewport = { themeColor: "#FAF9F6", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${caveat.variable} ${serif.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}

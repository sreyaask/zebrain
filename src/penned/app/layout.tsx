import type { Metadata, Viewport } from "next";
import { Caveat, Inter, Newsreader } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });
const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif", display: "swap", weight: ["500"], adjustFontFallback: false, preload: false }); // wordmark only

export const metadata: Metadata = {
  title: { default: "Penned · Your handwriting, written for you", template: "%s · Penned" },
  description: "Notes, letters and cards written in your handwriting with a real pen, delivered in Hyderabad in 2–3 hours.",
};

export const viewport: Viewport = { themeColor: "#FAF9F6", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${caveat.variable} ${serif.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}

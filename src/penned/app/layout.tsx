import type { Metadata, Viewport } from "next";
import { Caveat, Inter, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });
const display = Manrope({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["300", "400", "500"] }); // headings and the wordmark

export const metadata: Metadata = {
  title: { default: "Penned: a handwriting AI company", template: "%s · Penned" },
  description:
    "Penned's AI learns your handwriting, reads your notes and drives machines that write every page with a real pen. Notes, letters, thank-you cards and business mail, delivered in Hyderabad.",
};

export const viewport: Viewport = { themeColor: "#070707", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${caveat.variable} ${display.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}

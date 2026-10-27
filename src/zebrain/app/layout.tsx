import type { Metadata } from "next";
import "./globals.css";
import Header from "./Header";
import OutOfService from "./OutOfService";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Silkscreen&family=Geist+Mono:wght@400;500&display=swap";

export const metadata: Metadata = {
  title: "Zebrain",
  description: "Make your own LLM. Fine-tune an open model on your free Kaggle GPU and publish it to your Hugging Face account.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <Header />
        <OutOfService />
        {children}
      </body>
    </html>
  );
}

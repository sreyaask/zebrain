import type { Metadata } from "next";
import "./globals.css";
import Header from "./Header";
import OutOfService from "./OutOfService";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Silkscreen&family=Geist+Mono:wght@400;500&display=swap";

const THEME_SCRIPT = `try{var t=localStorage.getItem("zebrain.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export const metadata: Metadata = {
  title: "Zebrain",
  description: "Make your own LLM. Fine-tune an open model on your free Kaggle GPU and publish it to your Hugging Face account.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint so a light-theme user never sees a dark flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
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

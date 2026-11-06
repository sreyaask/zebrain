import type { Metadata } from "next";

export const metadata: Metadata = { title: "My orders" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

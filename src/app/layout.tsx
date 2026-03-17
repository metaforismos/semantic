import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Semantic Analysis — myHotel Labs",
  description: "Three-axis semantic analysis engine for hotel guest reviews",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg text-text antialiased">
        <Nav />
        <main className="mx-auto max-w-[1400px] px-6 pb-16">{children}</main>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { PromptProvider } from "@/components/PromptContext";

export const metadata: Metadata = {
  title: "Semantic Analysis — myHotel Labs",
  description: "Three-axis semantic analysis engine for hotel guest reviews",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg text-text antialiased">
        <PromptProvider>
          <Sidebar />
          <main className="lg:ml-56 min-h-screen">
            <div className="mx-auto max-w-[1200px] px-6 pb-16">{children}</div>
          </main>
        </PromptProvider>
      </body>
    </html>
  );
}

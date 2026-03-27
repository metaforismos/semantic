import type { Metadata } from "next";
import "./globals.css";
import { SidebarProvider } from "@/components/Sidebar";
import { PromptProvider } from "@/components/PromptContext";
import { AnalysisProvider } from "@/components/concierge/AnalysisContext";
import { MainContent } from "@/components/MainContent";

export const metadata: Metadata = {
  title: "myHotel Labs - Beta Tools for myHotel Team",
  description: "Beta tools and experimental features for the myHotel team",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text antialiased">
        <PromptProvider>
          <AnalysisProvider>
            <SidebarProvider>
              <MainContent>{children}</MainContent>
            </SidebarProvider>
          </AnalysisProvider>
        </PromptProvider>
      </body>
    </html>
  );
}

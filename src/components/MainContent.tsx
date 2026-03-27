"use client";

import { useSidebarCollapsed } from "@/components/Sidebar";

export function MainContent({ children }: { children: React.ReactNode }) {
  const { desktopCollapsed } = useSidebarCollapsed();

  return (
    <main className={`${desktopCollapsed ? "lg:ml-14" : "lg:ml-56"} min-h-screen transition-[margin-left] duration-200 ease-in-out`}>
      <div className="mx-auto max-w-[1200px] px-6 pb-16">{children}</div>
    </main>
  );
}

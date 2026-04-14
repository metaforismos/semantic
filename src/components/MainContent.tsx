"use client";

import { usePathname } from "next/navigation";
import { useSidebarCollapsed } from "@/components/Sidebar";

const PUBLIC_ROUTES = ["/iniciativas"];

export function MainContent({ children }: { children: React.ReactNode }) {
  const { desktopCollapsed } = useSidebarCollapsed();
  const pathname = usePathname();
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <main className={`${desktopCollapsed ? "lg:ml-14" : "lg:ml-56"} min-h-screen transition-[margin-left] duration-200 ease-in-out`}>
      <div className="mx-auto max-w-[1200px] px-6 pb-16">{children}</div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavSection {
  label: string;
  items: { href: string; label: string }[];
}

const sections: NavSection[] = [
  {
    label: "Semantic",
    items: [
      { href: "/", label: "Analysis" },
      { href: "/proposals", label: "Proposals" },
      { href: "/explorer", label: "Pool Explorer" },
      { href: "/prompts", label: "Prompts" },
    ],
  },
  {
    label: "Concierge",
    items: [
      { href: "/concierge/pilot-report", label: "Pilot Report" },
      { href: "/concierge/meta-id", label: "Meta ID" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="lg:hidden fixed top-3 left-3 z-[60] p-2 bg-surface border border-border rounded-md"
        aria-label="Toggle sidebar"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
          {collapsed ? (
            <>
              <path d="M2 4h12" /><path d="M2 8h12" /><path d="M2 12h12" />
            </>
          ) : (
            <>
              <path d="M4 4l8 8" /><path d="M12 4l-8 8" />
            </>
          )}
        </svg>
      </button>

      {/* Overlay for mobile */}
      {!collapsed && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-56 bg-surface border-r border-border flex flex-col transition-transform lg:translate-x-0 ${
          collapsed ? "-translate-x-full" : "translate-x-0"
        }`}
      >
        {/* Brand */}
        <div className="px-4 h-14 flex items-center gap-2.5 border-b border-border shrink-0">
          <Link href="/" className="flex items-center gap-2 group" onClick={() => setCollapsed(true)}>
            <span className="text-sm font-bold tracking-tight text-text-muted group-hover:text-text transition-colors">
              myHotel
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] bg-labs-yellow-bg text-labs-yellow px-1.5 py-0.5 rounded">
              Labs
            </span>
          </Link>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {sections.map((section) => (
            <div key={section.label} className="mb-5">
              <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setCollapsed(true)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                        isActive
                          ? "bg-accent/15 text-accent-light"
                          : "text-text-muted hover:text-text hover:bg-surface-2"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          <span className="text-[10px] text-text-dim">Semantic Analysis Engine</span>
        </div>
      </aside>
    </>
  );
}

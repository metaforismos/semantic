"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Analysis" },
  { href: "/proposals", label: "Proposals" },
  { href: "/explorer", label: "Pool Explorer" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto max-w-[1400px] px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="text-sm font-bold tracking-tight text-text-muted group-hover:text-text transition-colors">
              myHotel
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] bg-labs-yellow/15 text-labs-yellow px-1.5 py-0.5 rounded">
              Labs
            </span>
          </Link>
          <span className="text-border-light mx-1">|</span>
          <span className="text-sm font-medium text-text">Semantic Analysis</span>
        </div>

        <nav className="flex items-center gap-1">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                  isActive
                    ? "bg-accent/15 text-accent-light"
                    : "text-text-muted hover:text-text hover:bg-surface-2"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

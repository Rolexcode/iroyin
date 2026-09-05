"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./brand-mark";

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="site-shell header-inner">
        <Link href="/" className="brand-link">
          <BrandMark />
        </Link>
        <nav aria-label="Primary navigation" className="main-nav">
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>Workspace</Link>
          <Link href="/benchmark" aria-current={pathname.startsWith("/benchmark") ? "page" : undefined}>Benchmark</Link>
          <Link href="/privacy" aria-current={pathname === "/privacy" ? "page" : undefined}>Privacy</Link>
        </nav>
      </div>
    </header>
  );
}

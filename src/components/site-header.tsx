import Link from "next/link";
import { BrandMark } from "./brand-mark";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-shell header-inner">
        <Link href="/" className="brand-link">
          <BrandMark />
        </Link>
        <nav aria-label="Primary navigation" className="main-nav">
          <Link href="/#report">Make a report</Link>
          <Link href="/benchmark">Benchmark lab</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </div>
    </header>
  );
}

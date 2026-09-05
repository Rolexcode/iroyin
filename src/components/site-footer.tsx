import Link from "next/link";
import { BrandMark } from "./brand-mark";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-shell footer-grid">
        <div>
          <BrandMark compact />
          <p className="footer-note">Speak naturally. Understand. Express. Report.</p>
        </div>
        <div className="footer-links" aria-label="Footer navigation">
          <Link href="/benchmark/methodology">Methodology</Link>
          <Link href="/privacy">Privacy & safety</Link>
          <a href="https://docs.voice.intron.io/docs/stt/supported-languages" target="_blank" rel="noreferrer">
            Sahara language support
          </a>
        </div>
        <p className="footer-disclaimer">AI can make mistakes. Review important details.<br />Reports are never submitted automatically.</p>
      </div>
    </footer>
  );
}

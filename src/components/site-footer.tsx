import Link from "next/link";
import { BrandMark } from "./brand-mark";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-shell footer-grid">
        <div>
          <BrandMark compact />
          <p className="footer-note">Voice-first incident reporting for Nigerian public and legal services.</p>
        </div>
        <div className="footer-links" aria-label="Footer navigation">
          <Link href="/benchmark/methodology">Methodology</Link>
          <Link href="/privacy">Privacy & safety</Link>
          <a href="https://docs.voice.intron.io/docs/stt/supported-languages" target="_blank" rel="noreferrer">
            Sahara language support
          </a>
        </div>
        <p className="footer-disclaimer">Ìròyìn structures information you provide. It does not give legal advice or submit complaints for you.</p>
      </div>
    </footer>
  );
}

import { AudioLines } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup" aria-label="Ìròyìn home">
      <span className="brand-symbol" aria-hidden="true">
        <AudioLines size={18} strokeWidth={2.2} />
      </span>
      <span className="brand-word">Ìròyìn</span>
      {!compact && <span className="brand-meaning">report</span>}
    </span>
  );
}

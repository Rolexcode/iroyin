export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup" aria-label="Ìròyìn home">
      <span className="brand-symbol" aria-hidden="true">
        <span className="brand-glyph">ÌR</span>
      </span>
      <span className="brand-word">Ìròyìn</span>
      {!compact && <span className="brand-meaning">understanding layer</span>}
    </span>
  );
}

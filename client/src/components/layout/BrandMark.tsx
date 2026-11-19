// OSSATURE mark: two linked frames — the company (teal) and its teams (copper).
// They interlock like chain links: copper passes over teal at the top right,
// and under it at the bottom left.
export const BRAND = 'OSSATURE';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} aria-hidden="true">
      <rect x="8" y="8" width="54" height="54" rx="13" stroke="var(--teal)" strokeWidth="12" />
      <rect x="38" y="38" width="54" height="54" rx="13" stroke="var(--copper)" strokeWidth="12" />
      <path d="M30 62h16" stroke="var(--teal)" strokeWidth="12" />
    </svg>
  );
}

/** Same mark as a standalone SVG string (icons, printed documents). */
export const brandSvg = (teal = '#2A9D8F', copper = '#C8782A') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect x="8" y="8" width="54" height="54" rx="13" stroke="${teal}" stroke-width="12"/><rect x="38" y="38" width="54" height="54" rx="13" stroke="${copper}" stroke-width="12"/><path d="M30 62h16" stroke="${teal}" stroke-width="12"/></svg>`;

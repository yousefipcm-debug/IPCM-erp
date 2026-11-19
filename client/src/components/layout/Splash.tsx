import { useEffect, useState } from 'react';
import { BRAND } from './BrandMark';

// Opening animation, played once per app launch (per tab):
// 1. the teal frame draws itself, 2. the copper frame draws and links into it,
// 3. the name appears, 4. everything fades into the app.
// Click or any key skips it. Reduced-motion users get a short static version.
const KEY = 'ossature-splash-seen';

export function Splash() {
  const [phase, setPhase] = useState<'play' | 'leave' | 'done'>(() => {
    try { return sessionStorage.getItem(KEY) ? 'done' : 'play'; } catch { return 'play'; }
  });

  useEffect(() => {
    if (phase !== 'play') return;
    try { sessionStorage.setItem(KEY, '1'); } catch { /* */ }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t1 = window.setTimeout(() => setPhase('leave'), reduced ? 500 : 1900);
    const skip = () => setPhase('leave');
    window.addEventListener('keydown', skip, { once: true });
    return () => { clearTimeout(t1); window.removeEventListener('keydown', skip); };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'leave') return;
    const t = window.setTimeout(() => setPhase('done'), 450);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'done') return null;
  return (
    <div className={`splash ${phase === 'leave' ? 'splash-leave' : ''}`} onClick={() => setPhase('leave')} role="presentation" aria-hidden="true">
      <div className="splash-inner">
        <svg viewBox="0 0 100 100" fill="none" className="splash-mark">
          <rect className="splash-a" x="8" y="8" width="54" height="54" rx="13" stroke="var(--teal)" strokeWidth="12" pathLength={1} />
          <rect className="splash-b" x="38" y="38" width="54" height="54" rx="13" stroke="var(--copper)" strokeWidth="12" pathLength={1} />
          <path className="splash-link" d="M30 62h16" stroke="var(--teal)" strokeWidth="12" />
        </svg>
        <p className="splash-word">{BRAND.split('').map((c, i) => <span key={i} style={{ animationDelay: `${0.95 + i * 0.045}s` }}>{c}</span>)}</p>
        <p className="splash-sub">IPCM BOUTEMA</p>
      </div>
    </div>
  );
}

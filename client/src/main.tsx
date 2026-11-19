import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';

if (import.meta.env.VITE_DEMO) {
  // The online viewer may set data-theme; otherwise follow the system.
  const t = document.documentElement.dataset.theme;
  let saved: string | null = null; try { saved = localStorage.getItem('arcis-theme'); } catch { /* */ }
  const dark = saved ? saved === 'dark' : t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// Installable app: register the service worker (network-first, never serves stale data).
if ('serviceWorker' in navigator && import.meta.env.PROD && !import.meta.env.VITE_DEMO) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

import { Link, useLocation } from 'react-router-dom';
import { Hammer } from 'lucide-react';
import { NAV } from '@/nav';

export function ComingSoonPage() {
  const { pathname } = useLocation();
  const item = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))).find((i) => i.to === pathname);
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-copper-soft text-copper-strong"><Hammer className="size-5" /></div>
      <h1 className="text-xl font-semibold">{item?.label || 'Module'} arrive à la prochaine étape</h1>
      <p className="mt-2 text-[13.5px] text-ink-3">Ce module ({item?.group}) est en cours de reconstruction. Toutes les données existantes ont été conservées et converties : elles apparaîtront ici dès sa mise en ligne.</p>
      <Link to="/" className="mt-6 inline-block text-[13.5px] font-medium text-copper-strong hover:underline">Retour à l’accueil</Link>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-semibold">Page introuvable</h1>
      <p className="mt-2 text-[13.5px] text-ink-3">Le lien est peut-être ancien ou mal saisi.</p>
      <Link to="/" className="mt-6 inline-block text-[13.5px] font-medium text-copper-strong hover:underline">Retour à l’accueil</Link>
    </div>
  );
}

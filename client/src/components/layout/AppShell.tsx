import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from '@/lib/cn';
import { Command } from 'cmdk';
import * as RD from '@radix-ui/react-dialog';
import { KeyRound, LogOut, Menu as MenuIcon, Moon, Search, Sun, X, CloudOff, RefreshCw, Plus, BookOpen, FileText, Users, Truck } from 'lucide-react';
import { useAuth, ROLE_LABELS } from '@/lib/auth';
import { navFor, type NavGroup } from '@/nav';
import { store, useCollection, useSyncStatus } from '@/lib/data';
import { relativeTime } from '@/lib/format';
import { Button, Initials } from '../ui/ui';
import { Menu } from '../ui/pickers';
import { ChangePasswordDialog } from '@/pages/ChangePassword';
import { BrandMark, BRAND } from './BrandMark';
import { IS_DEMO } from '@/lib/api';

// ───────── Theme ─────────
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('arcis-theme', next ? 'dark' : 'light'); } catch { /* */ }
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', next ? '#0f1113' : '#f5f6f7');
    setDark(next);
  };
  return { dark, toggle };
}

// Quick actions are pages that open a "new" dialog via ?new=1
export const QUICK_ACTIONS = [
  { label: 'Nouveau mouvement de caisse', to: '/dfc/journaux?new=caisse', icon: <BookOpen />, roles: ['admin', 'finance'] },
  { label: 'Nouveau mouvement de banque', to: '/dfc/journaux?new=banque', icon: <BookOpen />, roles: ['admin', 'finance'] },
  { label: 'Nouvelle situation client', to: '/dfc/situations?new=1', icon: <FileText />, roles: ['admin', 'finance'] },
  { label: 'Nouvelle facture fournisseur', to: '/dfc/fournisseurs?new=invoice', icon: <Truck />, roles: ['admin', 'finance'] },
  { label: 'Nouveau client', to: '/dfc/clients?new=1', icon: <Users />, roles: ['admin', 'finance'] },
];

function SidebarNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  return (
    <nav className="scroll-thin flex-1 overflow-y-auto px-2.5 pb-4" aria-label="Navigation principale">
      {groups.map((g) => (
        <div key={g.id} className="mt-4 first:mt-1">
          <p className="px-2.5 pb-1 text-[12px] font-medium text-ink-3">{g.label}</p>
          <ul className="space-y-px">
            {g.items.map((it) => (
              <li key={it.to}>
                <NavLink to={it.to} end={it.to === '/'} onClick={onNavigate}
                  className={({ isActive }) => clsx('group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors',
                    isActive ? 'bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--line)]' : 'text-ink-2 hover:bg-surface/70 hover:text-ink')}>
                  {({ isActive }) => (<>
                    {isActive && <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full bg-copper" />}
                    <span className={clsx(isActive ? 'text-copper' : 'text-ink-3 group-hover:text-ink-2')}>{it.icon}</span>
                    <span className="truncate">{it.label}</span>
                    {it.soon && <span className="ml-auto text-[10.5px] text-ink-3">bientôt</span>}
                  </>)}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SyncIndicator() {
  const { status, lastSync } = useSyncStatus();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  const offline = status === 'offline';
  return (
    <button onClick={() => store.sync().catch(() => {})} title="Synchroniser maintenant"
      className={clsx('flex items-center gap-1.5 rounded-md px-2 py-1 text-xs', offline ? 'text-neg hover:bg-neg-soft' : 'text-ink-3 hover:bg-surface-2')}>
      {offline ? <CloudOff className="size-3.5" /> : <RefreshCw className={clsx('size-3.5', status === 'syncing' && 'animate-spin')} />}
      <span className="max-sm:hidden">{offline ? 'Hors ligne' : lastSync ? `Synchronisé ${relativeTime(lastSync)}` : 'Synchronisation…'}</span>
    </button>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const groups = useMemo(() => navFor(user!.role), [user]);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [pwd, setPwd] = useState(!!user?.mustChangePassword);
  const { dark, toggle } = useTheme();
  const loc = useLocation();

  useEffect(() => setDrawer(false), [loc.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((v) => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mobileTabs = groups.flatMap((g) => g.items).filter((i) => i.mobile).slice(0, 4);

  const userMenu = (
    <Menu
      trigger={<button className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-surface-2" aria-label="Mon compte">
        <Initials name={user!.name} className="size-7 bg-copper-soft text-copper-strong" />
        <span className="hidden text-left leading-tight lg:block">
          <span className="block max-w-[140px] truncate text-[13px] font-medium">{user!.name}</span>
          <span className="block text-[11.5px] text-ink-3">{ROLE_LABELS[user!.role]}</span>
        </span>
      </button>}
      items={[
        { label: dark ? 'Thème clair' : 'Thème sombre', icon: dark ? <Sun /> : <Moon />, onSelect: toggle },
        { label: 'Changer mon mot de passe', icon: <KeyRound />, onSelect: () => setPwd(true) },
        'sep',
        { label: 'Se déconnecter', icon: <LogOut />, onSelect: logout, danger: true },
      ]} />
  );

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line bg-bg md:flex">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <BrandMark className="size-7 text-ink" />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-[0.16em]">{BRAND}</p>
            <p className="text-[11px] text-ink-3">IPCM BOUTEMA</p>
          </div>
        </div>
        <div className="px-2.5 pb-2">
          <button onClick={() => setPalette(true)} className="flex h-8 w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-[13px] text-ink-3 hover:border-line-strong">
            <Search className="size-4" /> Rechercher
            <kbd className="ml-auto rounded border border-line px-1.5 text-[11px]">Ctrl K</kbd>
          </button>
        </div>
        <SidebarNav groups={groups} />
      </aside>

      {/* Mobile drawer */}
      <RD.Root open={drawer} onOpenChange={setDrawer}>
        <RD.Portal>
          <RD.Overlay className="anim-fade fixed inset-0 z-50 bg-black/40 md:hidden" />
          <RD.Content className="fixed inset-y-0 left-0 z-50 flex w-[84%] max-w-[300px] flex-col bg-bg shadow-pop md:hidden">
            <RD.Title className="sr-only">Menu</RD.Title>
            <RD.Description className="sr-only">Navigation</RD.Description>
            <div className="flex h-14 items-center justify-between px-4">
              <div className="flex items-center gap-2.5"><BrandMark className="size-7" /><span className="font-semibold tracking-[0.16em]">{BRAND}</span></div>
              <RD.Close asChild><Button variant="ghost" size="sm" aria-label="Fermer" icon={<X className="size-4" />} /></RD.Close>
            </div>
            <SidebarNav groups={groups} onNavigate={() => setDrawer(false)} />
          </RD.Content>
        </RD.Portal>
      </RD.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg/85 px-3 backdrop-blur-md sm:px-5">
          <Button variant="ghost" className="md:hidden" aria-label="Ouvrir le menu" onClick={() => setDrawer(true)} icon={<MenuIcon className="size-5" />} />
          <div className="flex items-center gap-2 md:hidden"><BrandMark className="size-6" /><span className="text-sm font-semibold tracking-[0.16em]">{BRAND}</span></div>
          <div className="ml-auto flex items-center gap-1">
            <SyncIndicator />
            <Button variant="ghost" className="md:hidden" aria-label="Rechercher" onClick={() => setPalette(true)} icon={<Search className="size-[18px]" />} />
            <Button variant="ghost" className="max-md:hidden" aria-label={dark ? 'Thème clair' : 'Thème sombre'} onClick={toggle} icon={dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />} />
            {userMenu}
          </div>
        </header>
        {IS_DEMO && <DemoBar />}
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-3 py-5 pb-24 sm:px-6 md:pb-10 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile tab bar */}
      {mobileTabs.length > 1 && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
          style={{ gridTemplateColumns: `repeat(${mobileTabs.length + 1}, 1fr)` }} aria-label="Navigation rapide">
          {mobileTabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => clsx('flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]', isActive ? 'text-copper-strong' : 'text-ink-3')}>
              {t.icon}<span className="max-w-full truncate px-1">{t.short || t.label}</span>
            </NavLink>
          ))}
          <button onClick={() => setDrawer(true)} className="flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-ink-3"><MenuIcon className="size-[17px]" />Plus</button>
        </nav>
      )}

      <CommandPalette open={palette} onOpenChange={setPalette} groups={groups} />
      <ChangePasswordDialog open={pwd} onOpenChange={setPwd} forced={!!user?.mustChangePassword} />
    </div>
  );
}

function CommandPalette({ open, onOpenChange, groups }: { open: boolean; onOpenChange: (v: boolean) => void; groups: NavGroup[] }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const clients = useCollection('clients');
  const suppliers = useCollection('suppliers');
  const go = (to: string) => { onOpenChange(false); nav(to); };
  const actions = QUICK_ACTIONS.filter((a) => a.roles.includes(user!.role));
  const item = 'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-ink-3';
  const heading = '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-ink-3';
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="anim-fade fixed inset-0 z-50 bg-[rgb(15_17_19/0.4)]" />
        <RD.Content className="anim-pop fixed top-[12vh] left-1/2 z-50 w-[calc(100%-24px)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
          <RD.Title className="sr-only">Recherche</RD.Title>
          <RD.Description className="sr-only">Rechercher une page, une action, un client ou un fournisseur</RD.Description>
          <Command loop>
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 text-ink-3" />
              <Command.Input autoFocus placeholder="Page, action, client, fournisseur…" className="h-12 flex-1 bg-transparent text-[15px] outline-none" />
            </div>
            <Command.List className={clsx('scroll-thin max-h-[60vh] overflow-y-auto p-1.5', heading)}>
              <Command.Empty className="p-4 text-center text-[13px] text-ink-3">Aucun résultat</Command.Empty>
              {actions.length > 0 && (
                <Command.Group heading="Créer">
                  {actions.map((a) => <Command.Item key={a.to} className={item} onSelect={() => go(a.to)}><Plus />{a.label}</Command.Item>)}
                </Command.Group>
              )}
              <Command.Group heading="Pages">
                {groups.flatMap((g) => g.items.map((i) => (
                  <Command.Item key={i.to} value={`${g.label} ${i.label}`} className={item} onSelect={() => go(i.to)}>{i.icon}{i.label}<span className="ml-auto text-xs text-ink-3">{g.label}</span></Command.Item>
                )))}
              </Command.Group>
              {clients.length > 0 && (
                <Command.Group heading="Clients">
                  {clients.map((c) => <Command.Item key={c.id} value={`client ${c.name} ${c.legalName || ''}`} className={item} onSelect={() => go(`/dfc/clients/${c.id}`)}><Users />{c.name}</Command.Item>)}
                </Command.Group>
              )}
              {suppliers.length > 0 && (user!.role === 'admin' || user!.role === 'finance') && (
                <Command.Group heading="Fournisseurs">
                  {suppliers.map((s) => <Command.Item key={s.id} value={`fournisseur ${s.name}`} className={item} onSelect={() => go(`/dfc/fournisseurs/${s.id}`)}><Truck />{s.name}</Command.Item>)}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

function DemoBar() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-line bg-copper-soft px-4 py-1.5 text-center text-[12.5px] text-copper-strong">
      <span>Démo en ligne avec des données fictives. Vos essais restent dans ce navigateur.</span>
      <button className="font-medium underline underline-offset-2" onClick={async () => { const { resetDemo } = await import('@/demo/fakeServer'); resetDemo(); location.reload(); }}>Réinitialiser la démo</button>
    </div>
  );
}

export function Placeholder({ children }: { children: ReactNode }) { return <>{children}</>; }

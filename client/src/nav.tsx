import {
  LayoutDashboard, Bell, Building2, BookOpen, FileText, Users, Hourglass, TrendingUp, Receipt, Truck, Calculator, Wallet,
  UserPlus, HardHat, ClipboardCheck, Banknote, FolderOpen, Contact, FileSpreadsheet, ScanLine, Inbox, ShieldCheck, History, Settings,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { Role } from './lib/types';

export interface NavItem { to: string; label: string; icon: ReactNode; roles: Role[]; soon?: boolean; mobile?: boolean; short?: string }
export interface NavGroup { id: string; label: string; items: NavItem[] }

const ALL: Role[] = ['admin', 'finance', 'hr', 'technique', 'commercial'];
const FIN: Role[] = ['admin', 'finance'];
const I = (C: any) => <C className="size-[17px]" strokeWidth={1.75} />;

export const NAV: NavGroup[] = [
  { id: 'pilotage', label: 'Pilotage', items: [
    { to: '/', label: "Vue d'ensemble", short: 'Accueil', icon: I(LayoutDashboard), roles: ALL, mobile: true },
    { to: '/alertes', label: 'Alertes', icon: I(Bell), roles: FIN, mobile: true },
    { to: '/projets', label: 'Projets', icon: I(Building2), roles: FIN },
  ] },
  { id: 'dfc', label: 'Finance', items: [
    { to: '/dfc/journaux', label: 'Journaux', icon: I(BookOpen), roles: FIN, mobile: true },
    { to: '/dfc/situations', label: 'Situations clients', short: 'Situations', icon: I(FileText), roles: FIN, mobile: true },
    { to: '/dfc/clients', label: 'Clients', icon: I(Users), roles: FIN },
    { to: '/dfc/fournisseurs', label: 'Fournisseurs', icon: I(Truck), roles: FIN },
    { to: '/dfc/balance-agee', label: 'Balance âgée', icon: I(Hourglass), roles: FIN },
    { to: '/dfc/previsionnel', label: 'Prévisionnel', icon: I(TrendingUp), roles: FIN },
    { to: '/dfc/charges', label: 'Charges fixes', icon: I(Receipt), roles: FIN },
    { to: '/dfc/simulateur', label: 'Simulateur de paiement', icon: I(Calculator), roles: FIN },
    { to: '/dfc/caisse-terkmane', label: 'Caisse Mme Terkmane', icon: I(Wallet), roles: FIN },
  ] },
  { id: 'rh', label: 'Ressources humaines', items: [
    { to: '/rh/personnel', label: 'Personnel', icon: I(UserPlus), roles: ['admin', 'hr'], soon: true },
    { to: '/rh/chantiers', label: 'Chantiers', icon: I(HardHat), roles: ['admin', 'hr'], soon: true },
    { to: '/rh/pointage', label: 'Pointage', icon: I(ClipboardCheck), roles: ['admin', 'hr'], soon: true },
    { to: '/rh/salaires', label: 'Salaires', icon: I(Banknote), roles: ['admin', 'hr'], soon: true },
  ] },
  { id: 'technique', label: 'Technique', items: [
    { to: '/technique/chantiers', label: 'Chantiers', icon: I(HardHat), roles: ['admin', 'technique'], soon: true },
    { to: '/technique/pointage', label: 'Pointage général', icon: I(ClipboardCheck), roles: ['admin', 'technique'], soon: true },
  ] },
  { id: 'commercial', label: 'Commercial', items: [
    { to: '/commercial/contacts', label: 'Contacts', icon: I(Contact), roles: ['admin', 'commercial'], soon: true },
    { to: '/commercial/facturation', label: 'Facturation', icon: I(FileSpreadsheet), roles: ['admin', 'commercial', 'finance'], soon: true },
  ] },
  { id: 'documents', label: 'Documents', items: [
    { to: '/documents', label: 'Documents', icon: I(FolderOpen), roles: ALL, soon: true },
  ] },
  { id: 'secretariat', label: 'Secrétariat', items: [
    { to: '/secretariat/scanner', label: 'Scanner un document', short: 'Scanner', icon: I(ScanLine), roles: ['secretariat'], soon: true, mobile: true },
    { to: '/secretariat/a-valider', label: 'Documents à valider', icon: I(Inbox), roles: FIN, soon: true },
  ] },
  { id: 'admin', label: 'Administration', items: [
    { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: I(ShieldCheck), roles: ['admin'] },
    { to: '/admin/activite', label: "Journal d'activité", icon: I(History), roles: ['admin'] },
    { to: '/admin/entreprise', label: 'Entreprise', icon: I(Settings), roles: ['admin'] },
  ] },
];

export function navFor(role: Role): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length);
}
export function homeFor(role: Role) {
  if (role === 'admin' || role === 'finance') return '/';
  return navFor(role)[0]?.items[0]?.to || '/';
}

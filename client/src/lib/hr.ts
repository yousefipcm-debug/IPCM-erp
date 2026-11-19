// RH: types and calculations shared by personnel, pointage and salaries.
import { useMemo } from 'react';
import { useCollection } from './data';
import { daysSince, parseISO } from './format';
import type { Rec } from './types';

export interface Worker {
  lastName: string; firstName: string; birthDate: string; position: string; socialSecurityNo: string;
  children: number; bloodGroup: string; maritalStatus: string; health: string;
  contractType: string; entryDate: string; contractEnd: string; address: string; certificates: string;
  phone: string; idCardNo: string; idCardExpiry: string; netSalary: number; baseSalary: number; rib: string;
  photo: string | null; contractHistory: { from: string; to: string; type: string }[]; archived: boolean;
}
export interface WorkSite { name: string; description: string; workerIds: string[]; status: 'active' | 'done'; dailyLogs?: any[]; reports?: any[] }
export interface Attendance { month: string; workerId: string; cells: Record<string, { val: string; bg: string }> }
export interface LegendItem { color: string; label: string }
export interface HrDocument { title: string; date: string; content: string; folder: string; signerLeft: string; signerRight: string; images: string[] }

export const emptyWorker = (): Worker => ({
  lastName: '', firstName: '', birthDate: '', position: '', socialSecurityNo: '', children: 0, bloodGroup: '', maritalStatus: 'Célibataire',
  health: 'Bonne', contractType: 'CDD', entryDate: '', contractEnd: '', address: '', certificates: '', phone: '', idCardNo: '',
  idCardExpiry: '', netSalary: 0, baseSalary: 0, rib: '', photo: null, contractHistory: [], archived: false,
});

export const fullName = (w?: Pick<Worker, 'lastName' | 'firstName'> | null) => w ? `${(w.lastName || '').toUpperCase()} ${w.firstName || ''}`.trim() : '—';
export const age = (birth?: string) => {
  const b = parseISO(birth); if (!b) return null;
  const t = new Date(); let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
};

/** Days until the contract ends (negative = already ended), null = no end date. */
export const contractDaysLeft = (w: Worker) => { const d = daysSince(w.contractEnd); return d === null ? null : -d; };
export type ContractState = 'none' | 'ok' | 'soon' | 'urgent' | 'expired';
export const contractState = (w: Worker): ContractState => {
  const d = contractDaysLeft(w);
  if (d === null) return 'none';
  if (d < 0) return 'expired';
  if (d <= 15) return 'urgent';
  if (d <= 30) return 'soon';
  return 'ok';
};

// ── Pointage rules ──
// Office staff rest on Friday and Saturday (÷22); site workers rest on Friday only (÷26).
export const isRestDay = (date: Date, onSite: boolean) => date.getDay() === 5 || (!onSite && date.getDay() === 6);
export const DIVISOR = { office: 22, site: 26 };
export const daysInMonth = (ym: string) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const shiftMonth = (ym: string, n: number) => { const [y, m] = ym.split('-').map(Number); return monthKey(new Date(y, m - 1 + n, 1)); };

export const CODES = [
  { code: 'P', label: 'Présent', value: 1, tone: 'pos' },
  { code: 'D', label: 'Demi-journée', value: 0.5, tone: 'warn' },
  { code: 'A', label: 'Absent', value: 0, tone: 'neg' },
  { code: 'C', label: 'Congé', value: 0, tone: 'info' },
  { code: 'M', label: 'Maladie', value: 0, tone: 'info' },
  { code: 'R', label: 'Récupération', value: 0, tone: 'neutral' },
] as const;
export const codeValue = (v?: string) => { const c = (v || '').trim().toUpperCase(); return c === 'P' ? 1 : c === 'D' ? 0.5 : 0; };

export function summarize(a: Attendance | undefined, ym: string) {
  let days = 0, extra = 0, absent = 0, filled = 0;
  const n = daysInMonth(ym);
  for (let d = 1; d <= n; d++) {
    const top = a?.cells[`${d}_0`]?.val || '';
    const bot = parseFloat(a?.cells[`${d}_1`]?.val || '');
    if (top.trim()) filled++;
    days += codeValue(top);
    if (top.trim().toUpperCase() === 'A') absent++;
    if (Number.isFinite(bot)) extra += bot;
  }
  return { days, extra, absent, filled, total: Math.round((days + extra / 8) * 100) / 100 };
}

/** Workers, sites and attendance with handy lookups. */
export function useHr() {
  const workers = useCollection('workers') as unknown as Rec<Worker>[];
  const sites = useCollection('workSites') as unknown as Rec<WorkSite>[];
  const attendance = useCollection('attendance') as unknown as Rec<Attendance>[];
  return useMemo(() => {
    const siteOf = new Map<string, Rec<WorkSite>>();
    for (const s of sites) for (const id of s.workerIds || []) if (!siteOf.has(id)) siteOf.set(id, s);
    const att = new Map(attendance.map((a) => [a.id, a]));
    const active = workers.filter((w) => !w.archived).sort((a, b) => fullName(a).localeCompare(fullName(b), 'fr'));
    return { workers, active, sites: [...sites].sort((a, b) => a.name.localeCompare(b.name, 'fr')), siteOf, att, attOf: (month: string, wid: string) => att.get(`${month}:${wid}`) };
  }, [workers, sites, attendance]);
}

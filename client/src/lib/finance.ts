// All financial figures are DERIVED here from the raw records — nothing is
// copied between records, so totals can never drift apart.
//
// A client situation is paid by: its manual payments (recorded outside the
// journals) + every journal transaction that allocates money to it.

import { useMemo } from 'react';
import { useCollection } from './data';
import { daysSince, round2, money } from './format';
import type { Allocation, Rec, Situation, SupplierInvoice, Transaction, Project, Charge, Client, Supplier, PettyCashMove } from './types';

export interface FinanceModel {
  transactions: Rec<Transaction>[];
  situations: (Rec<Situation> & { paid: number; remaining: number; isPaid: boolean; age: number | null })[];
  supplierInvoices: (Rec<SupplierInvoice> & { paid: number; remaining: number; isPaid: boolean; age: number | null })[];
  charges: Rec<Charge>[];
  projects: (Rec<Project> & { received: number; spent: number; margin: number; toReceive: number })[];
  clients: Rec<Client>[];
  suppliers: Rec<Supplier>[];
  pettyCash: Rec<PettyCashMove>[];
  balance: { caisse: number; banque: number; treasury: number; pettyCash: number };
  receivables: number;
  payables: number;
  monthlyCharges: number;
  runwayMonths: number;
  aging: Record<AgingBucket, number>;
  clientById: Map<string, Rec<Client>>;
  supplierById: Map<string, Rec<Supplier>>;
  projectById: Map<string, Rec<Project>>;
}
export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+';

const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + (f(x) || 0), 0);

export function signed(t: Transaction) { return t.type === 'in' ? t.amount : -t.amount; }

export function useFinance(): FinanceModel {
  const transactions = useCollection('transactions');
  const situationsRaw = useCollection('situations');
  const supplierInvRaw = useCollection('supplierInvoices');
  const charges = useCollection('charges');
  const projectsRaw = useCollection('projects');
  const clients = useCollection('clients');
  const suppliers = useCollection('suppliers');
  const pettyCash = useCollection('pettyCash');

  return useMemo(() => {
    const allocated = new Map<string, number>();
    const projIn = new Map<string, number>();
    const projOut = new Map<string, number>();
    let caisse = 0, banque = 0;
    for (const t of transactions) {
      const v = signed(t);
      if (t.journal === 'banque') banque += v; else caisse += v;
      for (const a of t.allocations || []) allocated.set(a.type + ':' + a.id, (allocated.get(a.type + ':' + a.id) || 0) + a.amount);
      if (t.projectId) {
        const m = t.type === 'in' ? projIn : projOut;
        m.set(t.projectId, (m.get(t.projectId) || 0) + t.amount);
      }
    }

    const situations = situationsRaw.map((s) => {
      const paid = round2(sum(s.manualPayments || [], (p) => p.amount) + (allocated.get('situation:' + s.id) || 0));
      const remaining = round2(Math.max(0, (s.amount || 0) - paid));
      return { ...s, paid, remaining, isPaid: remaining <= 0.01, age: daysSince(s.date) };
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const supplierInvoices = supplierInvRaw.map((f) => {
      const paid = round2(sum(f.manualPayments || [], (p) => p.amount) + (allocated.get('supplierInvoice:' + f.id) || 0));
      const remaining = round2(Math.max(0, (f.amount || 0) - paid));
      return { ...f, paid, remaining, isPaid: remaining <= 0.01, age: daysSince(f.date) };
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const projects = projectsRaw.map((p) => {
      const received = round2(sum(p.manualPayments || [], (x) => x.amount) + (projIn.get(p.id) || 0));
      const spent = round2(sum(p.manualExpenses || [], (x) => x.amount) + (projOut.get(p.id) || 0));
      return { ...p, received, spent, margin: round2((p.contractValue || 0) - spent), toReceive: round2((p.contractValue || 0) - received) };
    });

    const aging: Record<AgingBucket, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    for (const s of situations) {
      if (s.isPaid) continue;
      const d = s.age ?? 0;
      aging[d <= 30 ? '0-30' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : '90+'] += s.remaining;
    }

    const treasury = round2(caisse + banque);
    const monthlyCharges = sum(charges, (c) => c.amount);
    return {
      transactions, situations, supplierInvoices, charges, projects, clients, suppliers, pettyCash,
      balance: { caisse: round2(caisse), banque: round2(banque), treasury, pettyCash: round2(sum(pettyCash, (m) => (m.type === 'in' ? m.amount : -m.amount))) },
      receivables: round2(sum(situations, (s) => s.remaining)),
      payables: round2(sum(supplierInvoices, (f) => f.remaining)),
      monthlyCharges,
      runwayMonths: monthlyCharges > 0 ? treasury / monthlyCharges : Infinity,
      aging,
      clientById: new Map(clients.map((c) => [c.id, c])),
      supplierById: new Map(suppliers.map((s) => [s.id, s])),
      projectById: new Map(projectsRaw.map((p) => [p.id, p])),
    };
  }, [transactions, situationsRaw, supplierInvRaw, charges, projectsRaw, clients, suppliers, pettyCash]);
}

/**
 * Splits an amount across open invoices, oldest first.
 * `priorityId` is paid first (when paying a specific situation).
 * `excludeTxId`: when editing a transaction, its own previous allocations
 * must not count as already paid.
 */
export function allocate(
  amount: number,
  open: { id: string; date: string; amount: number; manualPayments: { amount: number }[] }[],
  kind: Allocation['type'],
  transactions: Rec<Transaction>[],
  excludeTxId?: string,
  priorityId?: string,
): { allocations: Allocation[]; unallocated: number } {
  const paidByOthers = new Map<string, number>();
  for (const t of transactions) {
    if (t.id === excludeTxId) continue;
    for (const a of t.allocations || []) if (a.type === kind) paidByOthers.set(a.id, (paidByOthers.get(a.id) || 0) + a.amount);
  }
  const items = open
    .map((o) => ({ id: o.id, date: o.date, rem: round2(o.amount - sum(o.manualPayments || [], (p) => p.amount) - (paidByOthers.get(o.id) || 0)) }))
    .filter((o) => o.rem > 0.01)
    .sort((a, b) => (a.id === priorityId ? -1 : b.id === priorityId ? 1 : (a.date || '').localeCompare(b.date || '')));
  let left = round2(amount);
  const allocations: Allocation[] = [];
  for (const it of items) {
    if (left <= 0.01) break;
    const pay = round2(Math.min(left, it.rem));
    allocations.push({ type: kind, id: it.id, amount: pay });
    left = round2(left - pay);
  }
  return { allocations, unallocated: Math.max(0, left) };
}

export const runwayLabel = (m: number) => {
  if (!Number.isFinite(m)) return 'Illimitée';
  if (m <= 0) return 'Aucune';
  if (m >= 12) { const y = Math.floor(m / 12), r = Math.round(m % 12); return `${y} an${y > 1 ? 's' : ''}${r ? ` et ${r} mois` : ''}`; }
  return `${m.toFixed(1).replace('.', ',')} mois`;
};

export interface Alert { level: 'danger' | 'warn' | 'info'; title: string; detail: string; to?: string }

export function computeAlerts(f: FinanceModel): Alert[] {
  const a: Alert[] = [];
  const { treasury } = f.balance;
  if (f.monthlyCharges > 0) {
    if (treasury < f.monthlyCharges) a.push({ level: 'danger', title: 'Trésorerie inférieure à un mois de charges', detail: `${money(treasury)} disponibles pour ${money(f.monthlyCharges)} de charges mensuelles.`, to: '/dfc/charges' });
    else if (f.runwayMonths < 4) a.push({ level: 'danger', title: 'Trésorerie critique', detail: `Autonomie de ${runwayLabel(f.runwayMonths)}.`, to: '/dfc/previsionnel' });
    else if (f.runwayMonths < 7) a.push({ level: 'warn', title: 'Trésorerie à surveiller', detail: `Autonomie de ${runwayLabel(f.runwayMonths)}.`, to: '/dfc/previsionnel' });
  }
  if (treasury > 0 && f.payables >= treasury * 0.5) {
    const pct = Math.round((100 * f.payables) / treasury);
    a.push({ level: pct >= 80 ? 'danger' : 'warn', title: `Dettes fournisseurs à ${pct} % de la trésorerie`, detail: `${money(f.payables)} dus pour ${money(treasury)} disponibles.`, to: '/dfc/fournisseurs' });
  }
  if (f.aging['90+'] > 0) a.push({ level: 'danger', title: 'Créances de plus de 90 jours', detail: `${money(f.aging['90+'])} à recouvrer. Envisagez une mise en demeure.`, to: '/dfc/balance-agee' });
  if (f.aging['61-90'] > 0) a.push({ level: 'warn', title: 'Créances de 61 à 90 jours', detail: `${money(f.aging['61-90'])} à relancer.`, to: '/dfc/balance-agee' });
  const informal = f.situations.filter((s) => !s.isPaid && s.contractType === 'informel');
  if (informal.length) a.push({ level: 'danger', title: `${informal.length} créance${informal.length > 1 ? 's' : ''} sans contrat`, detail: `${money(informal.reduce((s, x) => s + x.remaining, 0))} non sécurisés juridiquement.`, to: '/dfc/situations' });

  const debtBySupplier = new Map<string, number>();
  for (const inv of f.supplierInvoices) if (inv.supplierId) debtBySupplier.set(inv.supplierId, (debtBySupplier.get(inv.supplierId) || 0) + inv.remaining);
  for (const s of f.suppliers) {
    const d = debtBySupplier.get(s.id) || 0;
    if (s.alertLimit > 0 && d >= s.alertLimit) a.push({ level: 'danger', title: `${s.name} a dépassé son seuil`, detail: `Dette de ${money(d)} pour un seuil de ${money(s.alertLimit)}.`, to: `/dfc/fournisseurs/${s.id}` });
  }

  for (const t of f.transactions) {
    if (t.type !== 'out' || t.invoiceStatus !== 'missing') continue;
    const days = daysSince(t.date) ?? 0;
    const who = f.supplierById.get(t.supplierId || '')?.name || 'Fournisseur non précisé';
    a.push({ level: days >= 15 ? 'danger' : 'warn', title: `Facture manquante : ${who}`, detail: `${money(t.amount)} payés le ${t.date.split('-').reverse().join('/')}, en attente depuis ${days} jour${days > 1 ? 's' : ''}.`, to: '/dfc/journaux?f=missing' });
  }
  const rank = { danger: 0, warn: 1, info: 2 };
  return a.sort((x, y) => rank[x.level] - rank[y.level]);
}

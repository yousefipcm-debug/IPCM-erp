import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import clsx from '@/lib/cn';
import { Hourglass, Pencil, Plus, Printer, Receipt, Trash2 } from 'lucide-react';
import { createRecord, deleteRecord, saveChanges } from '@/lib/data';
import { useFinance, runwayLabel, type AgingBucket } from '@/lib/finance';
import { money, MONTHS, capitalize } from '@/lib/format';
import { printDocument, esc, printedOn } from '@/lib/print';
import type { Charge, Rec } from '@/lib/types';
import { Amount, Button, EmptyState, Field, Input, PageHeader, Panel, Stat } from '@/components/ui/ui';
import { DataTable, type Column } from '@/components/ui/table';
import { MoneyInput, RowMenu } from '@/components/ui/pickers';
import { Dialog, useConfirm } from '@/components/ui/dialog';

const BUCKETS: { key: AgingBucket; label: string }[] = [
  { key: '0-30', label: '0 à 30 jours' }, { key: '31-60', label: '31 à 60 jours' }, { key: '61-90', label: '61 à 90 jours' }, { key: '90+', label: 'Plus de 90 jours' },
];

// ───────────────────────── Balance âgée ─────────────────────────
export function AgingPage() {
  const f = useFinance();
  const nav = useNavigate();
  const rows = useMemo(() => {
    const m = new Map<string, Record<AgingBucket, number> & { id: string; name: string; total: number }>();
    for (const s of f.situations) {
      if (s.isPaid) continue;
      const id = s.clientId || 'none';
      const r = m.get(id) || { id, name: f.clientById.get(id)?.name || 'Client inconnu', total: 0, '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
      const d = s.age ?? 0;
      r[d <= 30 ? '0-30' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : '90+'] += s.remaining;
      r.total += s.remaining;
      m.set(id, r);
    }
    return [...m.values()];
  }, [f]);
  const total = rows.reduce((s, r) => s + r.total, 0);

  const print = () => printDocument({ title: 'Balance âgée des créances', landscape: true, body: `
    <div class="meta"><span>${printedOn()}</span><span>${rows.length} client(s)</span></div><h1>Balance âgée des créances</h1>
    <table><thead><tr><th>Client</th>${BUCKETS.map((b) => `<th class="r">${b.label}</th>`).join('')}<th class="r">Total</th></tr></thead><tbody>
    ${rows.sort((a, b) => b.total - a.total).map((r) => `<tr><td>${esc(r.name)}</td>${BUCKETS.map((b) => `<td class="r">${r[b.key] ? money(r[b.key]) : ''}</td>`).join('')}<td class="r"><b>${money(r.total)}</b></td></tr>`).join('')}
    </tbody><tfoot><tr><td>Total</td>${BUCKETS.map((b) => `<td class="r">${money(f.aging[b.key])}</td>`).join('')}<td class="r">${money(total)}</td></tr></tfoot></table>` });

  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'name', header: 'Client', sort: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    ...BUCKETS.map((b, i) => ({ key: b.key, header: b.label, align: 'right' as const, sort: (r: any) => r[b.key], hideOnMobile: i < 2,
      cell: (r: any) => r[b.key] ? <Amount value={r[b.key]} className={clsx(b.key === '90+' && 'font-medium text-neg', b.key === '61-90' && 'text-warn')} /> : <span className="text-ink-3">—</span> })),
    { key: 'total', header: 'Total', align: 'right', sort: (r) => r.total, cell: (r) => <Amount value={r.total} className="font-semibold" /> },
  ];

  return (
    <>
      <PageHeader title="Balance âgée" description="Créances clients non encaissées, par ancienneté depuis la date de facturation."
        actions={<Button icon={<Printer className="size-4" />} onClick={print} disabled={!rows.length}>Imprimer</Button>} />
      <div className="panel mb-5 grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4">
        {BUCKETS.map((b) => (
          <div key={b.key} className="bg-surface p-4">
            <Stat label={b.label} value={money(f.aging[b.key])} tone={b.key === '90+' && f.aging[b.key] > 0 ? 'neg' : b.key === '61-90' && f.aging[b.key] > 0 ? 'warn' : undefined}
              sub={total ? `${Math.round((100 * f.aging[b.key]) / total)} % du total` : undefined} />
          </div>
        ))}
      </div>
      <div className="panel">
        <DataTable rows={rows} columns={cols} initialSort={{ key: 'total', dir: 'desc' }} onRowClick={(r) => r.id !== 'none' && nav(`/dfc/clients/${r.id}`)}
          empty={<EmptyState icon={<Hourglass className="size-5" />} title="Aucune créance en cours">Toutes les situations sont soldées.</EmptyState>}
          footer={rows.length > 0 && <tr>
            <td className="px-4 py-2.5">Total</td>
            {BUCKETS.map((b, i) => <td key={b.key} className={clsx('px-3 py-2.5 text-right', i < 2 && 'max-md:hidden')}><Amount value={f.aging[b.key]} /></td>)}
            <td className="px-4 py-2.5 text-right"><Amount value={total} /></td>
          </tr>} />
      </div>
    </>
  );
}

// ───────────────────────── Prévisionnel ─────────────────────────
export function ForecastPage() {
  const f = useFinance();
  // Prudent scenario only counts receivables younger than 60 days as collectible within the horizon.
  const collectibleRecent = f.situations.filter((s) => !s.isPaid && (s.age ?? 0) <= 60 && s.contractType !== 'informel').reduce((s, x) => s + x.remaining, 0);
  const [rate, setRate] = useState(70);
  const months = useMemo(() => {
    const now = new Date();
    const out = [];
    let optimistic = f.balance.treasury, prudent = f.balance.treasury;
    const perMonthOpt = f.receivables / 3;
    const perMonthPru = (collectibleRecent * rate) / 100 / 3;
    const payablesPerMonth = f.payables / 3;
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      optimistic += perMonthOpt - f.monthlyCharges - payablesPerMonth;
      prudent += perMonthPru - f.monthlyCharges - payablesPerMonth;
      out.push({ label: capitalize(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`), optimistic, prudent, inOpt: perMonthOpt, inPru: perMonthPru });
    }
    return out;
  }, [f, collectibleRecent, rate]);

  return (
    <>
      <PageHeader title="Prévisionnel" description="Projection de trésorerie sur 3 mois, à partir des créances, des dettes fournisseurs et des charges fixes." />
      <div className="panel mb-5 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <Stat label="Trésorerie actuelle" value={money(f.balance.treasury)} />
        <Stat label="Créances à encaisser" value={money(f.receivables)} tone="pos" />
        <Stat label="Dettes fournisseurs" value={money(f.payables)} tone="neg" />
        <Stat label="Autonomie actuelle" value={runwayLabel(f.runwayMonths)} sub={`${money(f.monthlyCharges)} de charges par mois`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Panel title="Projection mensuelle" bodyClassName="p-0">
          <table className="w-full text-[13.5px]">
            <thead><tr className="border-b border-line text-[12.5px] text-ink-3">
              <th className="h-9 px-4 text-left font-medium">Mois</th>
              <th className="px-3 text-right font-medium">Scénario prudent</th>
              <th className="px-4 text-right font-medium">Tout encaissé</th>
            </tr></thead>
            <tbody>
              <tr className="border-b border-line"><td className="h-11 px-4 text-ink-3">Aujourd’hui</td><td className="px-3 text-right"><Amount value={f.balance.treasury} /></td><td className="px-4 text-right"><Amount value={f.balance.treasury} /></td></tr>
              {months.map((m) => (
                <tr key={m.label} className="border-b border-line last:border-0">
                  <td className="h-12 px-4">{m.label}</td>
                  <td className="px-3 text-right"><Amount value={m.prudent} className={clsx('font-semibold', m.prudent < 0 && 'text-neg')} /><div className="text-xs text-ink-3">+{money(m.inPru, { decimals: false })} encaissés</div></td>
                  <td className="px-4 text-right"><Amount value={m.optimistic} className={clsx('font-semibold', m.optimistic < 0 && 'text-neg')} /><div className="text-xs text-ink-3">+{money(m.inOpt, { decimals: false })} encaissés</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Hypothèses">
          <ul className="space-y-2.5 text-[13px] text-ink-2">
            <li>Les charges fixes ({money(f.monthlyCharges)}) sont payées chaque mois.</li>
            <li>Les dettes fournisseurs sont réglées en trois parts égales.</li>
            <li><b className="font-medium text-ink">Tout encaissé</b> : toutes les créances rentrent sur 3 mois.</li>
            <li><b className="font-medium text-ink">Prudent</b> : seules les créances de moins de 60 jours avec contrat ({money(collectibleRecent)}) rentrent, à hauteur de :</li>
          </ul>
          <div className="mt-3 flex items-center gap-3">
            <input type="range" min={0} max={100} step={5} value={rate} onChange={(e) => setRate(+e.target.value)} className="flex-1 accent-[var(--copper)]" aria-label="Taux d’encaissement prudent" />
            <span className="num w-12 text-right font-semibold">{rate} %</span>
          </div>
        </Panel>
      </div>
    </>
  );
}

// ───────────────────────── Charges fixes ─────────────────────────
export function ChargesPage() {
  const f = useFinance();
  const confirm = useConfirm();
  const [edit, setEdit] = useState<Rec<Charge> | 'new' | null>(null);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of f.charges) m.set(c.category || 'Autre', (m.get(c.category || 'Autre') || 0) + c.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [f.charges]);
  const remove = async (c: Rec<Charge>) => {
    if (await confirm({ title: `Supprimer « ${c.label} » ?`, danger: true, confirmLabel: 'Supprimer' })) { await deleteRecord('charges', c.id); toast.success('Charge supprimée'); }
  };
  const print = () => printDocument({ title: 'Charges fixes mensuelles', body: `
    <div class="meta"><span>${printedOn()}</span></div><h1>Charges fixes mensuelles</h1>
    <table><thead><tr><th>Libellé</th><th>Catégorie</th><th class="r">Montant mensuel</th></tr></thead><tbody>
    ${[...f.charges].sort((a, b) => b.amount - a.amount).map((c) => `<tr><td>${esc(c.label)}</td><td>${esc(c.category)}</td><td class="r">${money(c.amount)}</td></tr>`).join('')}
    </tbody><tfoot><tr><td colspan="2">Total mensuel</td><td class="r">${money(f.monthlyCharges)}</td></tr></tfoot></table>` });
  const cols: Column<Rec<Charge>>[] = [
    { key: 'label', header: 'Libellé', sort: (r) => r.label, cell: (r) => <span className="font-medium">{r.label}</span> },
    { key: 'cat', header: 'Catégorie', sort: (r) => r.category, cell: (r) => <span className="text-ink-2">{r.category || '—'}</span> },
    { key: 'amount', header: 'Par mois', align: 'right', sort: (r) => r.amount, cell: (r) => <Amount value={r.amount} className="font-medium" /> },
    { key: 'year', header: 'Par an', align: 'right', hideOnMobile: true, cell: (r) => <Amount value={r.amount * 12} className="text-ink-3" /> },
    { key: 'a', header: '', width: '44px', align: 'right', cell: (r) => <RowMenu items={[{ label: 'Modifier', icon: <Pencil />, onSelect: () => setEdit(r) }, { label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => remove(r) }]} /> },
  ];
  return (
    <>
      <PageHeader title="Charges fixes" description="Dépenses récurrentes chaque mois : salaires, CNAS, loyers, abonnements. Elles servent au calcul de l’autonomie."
        actions={<><Button icon={<Printer className="size-4" />} onClick={print} disabled={!f.charges.length}>Imprimer</Button><Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEdit('new')}>Nouvelle charge</Button></>} />
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="panel">
          <DataTable rows={f.charges} columns={cols} initialSort={{ key: 'amount', dir: 'desc' }} onRowClick={(r) => setEdit(r)}
            empty={<EmptyState icon={<Receipt className="size-5" />} title="Aucune charge fixe" action={<Button variant="primary" onClick={() => setEdit('new')}>Ajouter une charge</Button>}>Ajoutez vos charges mensuelles pour connaître votre autonomie de trésorerie.</EmptyState>}
            footer={f.charges.length > 0 && <tr><td colSpan={2} className="px-4 py-2.5">Total</td><td className="px-3 py-2.5 text-right"><Amount value={f.monthlyCharges} /></td><td className="px-3 py-2.5 text-right max-md:hidden"><Amount value={f.monthlyCharges * 12} /></td><td /></tr>} />
        </div>
        <Panel title="Répartition">
          <Stat label="Total mensuel" value={money(f.monthlyCharges)} sub={`Autonomie : ${runwayLabel(f.runwayMonths)}`} />
          <ul className="mt-4 space-y-2.5">
            {byCat.map(([cat, v]) => (
              <li key={cat}>
                <div className="mb-1 flex justify-between text-[13px]"><span className="text-ink-2">{cat}</span><span className="num">{money(v, { decimals: false })}</span></div>
                <div className="h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-copper" style={{ width: `${(100 * v) / (f.monthlyCharges || 1)}%` }} /></div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      {edit && <ChargeDialog record={edit === 'new' ? null : edit} onClose={() => setEdit(null)} categories={byCat.map((c) => c[0])} />}
    </>
  );
}

function ChargeDialog({ record, onClose, categories }: { record: Rec<Charge> | null; onClose: () => void; categories: string[] }) {
  const [initial] = useState(() => ({ label: record?.label || '', category: record?.category || '', amount: record?.amount || 0 }));
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!f.label.trim() || f.amount <= 0) return setErr('Le libellé et un montant supérieur à zéro sont requis.');
    setBusy(true);
    try {
      if (record) await saveChanges('charges', record, initial, { ...f, label: f.label.trim() }); else await createRecord('charges', { ...f, label: f.label.trim() });
      toast.success(record ? 'Charge modifiée' : 'Charge ajoutée'); onClose();
    } catch { /* */ } finally { setBusy(false); }
  };
  const suggestions = [...new Set([...categories, 'Salaires', 'CNAS', 'Loyer', 'Électricité', 'Téléphone et internet', 'Carburant', 'Assurance'])];
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} onSubmit={save} size="sm" title={record ? 'Modifier la charge' : 'Nouvelle charge fixe'}
      footer={<><Button onClick={onClose}>Annuler</Button><Button type="submit" variant="primary" loading={busy}>Enregistrer</Button></>}>
      <div className="space-y-3.5">
        <Field label="Libellé" required error={err}><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="ex. Loyer du bureau" /></Field>
        <Field label="Catégorie"><Input list="charge-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="ex. Loyer" /><datalist id="charge-cats">{suggestions.map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="Montant mensuel" required><MoneyInput value={f.amount} onChange={(n) => setF({ ...f, amount: n })} /></Field>
      </div>
    </Dialog>
  );
}

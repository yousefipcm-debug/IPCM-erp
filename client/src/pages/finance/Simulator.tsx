import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from '@/lib/cn';
import { Calculator, Printer, RotateCcw, Wallet } from 'lucide-react';
import { createRecord, store, updateRecord } from '@/lib/data';
import { useFinance } from '@/lib/finance';
import { dateShort, money, round2 } from '@/lib/format';
import { printDocument, esc, printedOn } from '@/lib/print';
import type { SimulatorState } from '@/lib/types';
import { Amount, Button, EmptyState, Initials, PageHeader, Segmented } from '@/components/ui/ui';
import { MoneyInput } from '@/components/ui/pickers';
import { TransactionDialog, type TxPreset } from '@/components/finance/TransactionDialog';

type Mode = { kind: 'count'; n: number } | { kind: 'amount'; v: number };

export function SimulatorPage() {
  const f = useFinance();
  const saved = store.get('simulator', 'state');
  const [plan, setPlan] = useState<Record<string, Mode>>(() => {
    const p: Record<string, Mode> = {};
    for (const [id, n] of Object.entries(saved?.picks || {})) if (n) p[id] = { kind: 'count', n };
    for (const [id, v] of Object.entries(saved?.amounts || {})) if (v) p[id] = { kind: 'amount', v };
    return p;
  });
  const [pay, setPay] = useState<(TxPreset & { sid: string }) | null>(null);

  // Autosave the plan so it is still there tomorrow, on any device.
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const data: SimulatorState = { picks: {}, amounts: {} };
      for (const [id, m] of Object.entries(plan)) { if (m.kind === 'count' && m.n) data.picks[id] = m.n; if (m.kind === 'amount' && m.v) data.amounts[id] = m.v; }
      const cur = store.get('simulator', 'state');
      try { if (cur) await updateRecord('simulator', cur, data); else await createRecord('simulator', data, 'state'); } catch { /* conflict toast handled */ }
    }, 900);
    return () => clearTimeout(timer.current);
  }, [plan]);

  const suppliers = useMemo(() => {
    const m = new Map<string, { id: string; name: string; invoices: typeof f.supplierInvoices; debt: number }>();
    for (const inv of f.supplierInvoices) {
      if (inv.isPaid || !inv.supplierId) continue;
      const s = m.get(inv.supplierId) || { id: inv.supplierId, name: f.supplierById.get(inv.supplierId)?.name || 'Fournisseur', invoices: [], debt: 0 };
      s.invoices.push(inv); s.debt += inv.remaining;
      m.set(inv.supplierId, s);
    }
    return [...m.values()].map((s) => {
      const invoices = s.invoices.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const mode = plan[s.id];
      let left = mode?.kind === 'amount' ? Math.min(mode.v, s.debt) : 0;
      const lines = invoices.map((inv, i) => {
        let pay = 0;
        if (mode?.kind === 'count') pay = i < mode.n ? inv.remaining : 0;
        else if (mode?.kind === 'amount') { pay = Math.min(left, inv.remaining); left = round2(left - pay); }
        return { inv, pay };
      });
      const toPay = round2(lines.reduce((x, l) => x + l.pay, 0));
      return { ...s, invoices, lines, toPay, mode };
    }).sort((a, b) => b.debt - a.debt);
  }, [f, plan]);

  const total = suppliers.reduce((s, x) => s + x.toPay, 0);
  const after = f.balance.treasury - total;

  const print = () => printDocument({ title: 'Plan de paiement fournisseurs', body: `
    <div class="meta"><span>${printedOn()}</span></div><h1>Plan de paiement fournisseurs</h1>
    <div class="sums"><div>Trésorerie actuelle<b>${money(f.balance.treasury)}</b></div><div>Dettes totales<b class="neg">${money(f.payables)}</b></div><div>À payer selon le plan<b>${money(total)}</b></div><div>Trésorerie après<b>${money(after)}</b></div></div>
    <table><thead><tr><th>Fournisseur</th><th>Facture</th><th>Date</th><th class="r">Restant</th><th class="r">À payer</th></tr></thead><tbody>
    ${suppliers.filter((s) => s.toPay > 0).flatMap((s) => s.lines.filter((l) => l.pay > 0).map((l) => `<tr><td>${esc(s.name)}</td><td>${esc(l.inv.reference)}</td><td>${dateShort(l.inv.date)}</td><td class="r">${money(l.inv.remaining)}</td><td class="r"><b>${money(l.pay)}</b></td></tr>`)).join('') || '<tr><td colspan="5" class="c muted">Aucun paiement prévu</td></tr>'}
    </tbody><tfoot><tr><td colspan="4">Total</td><td class="r">${money(total)}</td></tr></tfoot></table>` });

  return (
    <>
      <PageHeader title="Simulateur de paiement" description="Préparez les règlements fournisseurs et voyez l’effet sur la trésorerie. Rien n’est payé tant que vous ne cliquez pas sur Payer."
        actions={<>
          <Button icon={<RotateCcw className="size-4" />} onClick={() => setPlan({})} disabled={!Object.keys(plan).length}>Tout effacer</Button>
          <Button icon={<Printer className="size-4" />} onClick={print}>Imprimer le plan</Button>
        </>} />

      <div className="sticky top-14 z-20 -mx-3 mb-5 bg-bg/90 px-3 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="panel grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4">
          {[['Trésorerie actuelle', f.balance.treasury, ''], ['Dettes fournisseurs', f.payables, 'text-neg'], ['À payer selon le plan', total, 'text-warn'], ['Trésorerie après paiement', after, after < 0 ? 'text-neg' : 'text-pos']].map(([l, v, c]) => (
            <div key={l as string} className="bg-surface px-4 py-3"><p className="text-[13px] text-ink-3">{l}</p><p className={clsx('num text-lg font-semibold tracking-tight', c)}>{money(v as number)}</p></div>
          ))}
        </div>
      </div>

      {suppliers.length === 0 ? <div className="panel"><EmptyState icon={<Calculator className="size-5" />} title="Aucune dette fournisseur">Les factures fournisseurs à régler apparaîtront ici.</EmptyState></div> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {suppliers.map((s) => (
            <article key={s.id} className={clsx('panel', s.toPay > 0 && 'border-copper/60')}>
              <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                <Initials name={s.name} />
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{s.name}</p><p className="text-xs text-ink-3">{s.invoices.length} facture(s), {money(s.debt)}</p></div>
                {s.toPay > 0 && <Button size="sm" variant="primary" icon={<Wallet className="size-4" />} onClick={() => setPay({ sid: s.id, type: 'out', journal: 'banque', supplierId: s.id, amount: s.toPay, description: `Règlement ${s.name}` })}>Payer</Button>}
              </header>
              <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
                <Segmented<'none' | 'count' | 'amount'> size="sm" value={s.mode?.kind || 'none'} onChange={(k) => setPlan((p) => {
                  const n = { ...p };
                  if (k === 'none') delete n[s.id]; else n[s.id] = k === 'count' ? { kind: 'count', n: 1 } : { kind: 'amount', v: 0 };
                  return n;
                })} options={[{ value: 'none', label: 'Rien' }, { value: 'count', label: 'Par facture' }, { value: 'amount', label: 'Montant' }]} />
                {s.mode?.kind === 'count' && (
                  <div className="flex items-center gap-1.5 text-[13px]">
                    <Button size="sm" aria-label="Une facture de moins" onClick={() => setPlan((p) => ({ ...p, [s.id]: { kind: 'count', n: Math.max(0, (p[s.id] as any).n - 1) } }))}>−</Button>
                    <span className="num w-14 text-center">{s.mode.n} / {s.invoices.length}</span>
                    <Button size="sm" aria-label="Une facture de plus" onClick={() => setPlan((p) => ({ ...p, [s.id]: { kind: 'count', n: Math.min(s.invoices.length, (p[s.id] as any).n + 1) } }))}>+</Button>
                  </div>
                )}
                {s.mode?.kind === 'amount' && <div className="w-44"><MoneyInput value={s.mode.v} onChange={(v) => setPlan((p) => ({ ...p, [s.id]: { kind: 'amount', v } }))} /></div>}
              </div>
              <ul className="mt-2 divide-y divide-line">
                {s.lines.map(({ inv, pay }) => (
                  <li key={inv.id} className={clsx('flex items-center gap-3 px-4 py-2 text-[13px]', !pay && 'text-ink-3')}>
                    <span className="num w-[74px] shrink-0 text-xs">{dateShort(inv.date)}</span>
                    <span className="min-w-0 flex-1 truncate">{inv.reference || 'Facture'}</span>
                    {pay > 0 && pay < inv.remaining - 0.01 && <span className="num text-xs text-warn">{money(pay, { decimals: false })} sur</span>}
                    <Amount value={inv.remaining} className={pay ? 'font-medium text-ink' : ''} />
                  </li>
                ))}
              </ul>
              {s.toPay > 0 && <footer className="flex justify-between border-t border-line px-4 py-2.5 text-[13px]"><span className="text-ink-3">Reste après paiement</span><Amount value={s.debt - s.toPay} className="font-medium" /></footer>}
            </article>
          ))}
        </div>
      )}
      {pay && <TransactionDialog open onOpenChange={(v) => !v && setPay(null)} preset={pay} onSaved={() => setPlan((p) => { const n = { ...p }; delete n[pay.sid]; return n; })} />}
    </>
  );
}

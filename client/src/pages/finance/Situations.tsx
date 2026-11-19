import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Download, FileText, HandCoins, Pencil, Plus, Printer, Trash2, Wallet } from 'lucide-react';
import { updateRecord } from '@/lib/data';
import { useFinance } from '@/lib/finance';
import { dateShort, money, todayISO } from '@/lib/format';
import { printDocument, esc, printedOn } from '@/lib/print';
import { downloadCsv } from '@/lib/csv';
import { Amount, Badge, Button, EmptyState, PageHeader, ProgressBar, SearchInput, Segmented, Stat } from '@/components/ui/ui';
import { DataTable, type Column } from '@/components/ui/table';
import { RowMenu } from '@/components/ui/pickers';
import { Dialog, useConfirm } from '@/components/ui/dialog';
import { TransactionDialog, type TxPreset } from '@/components/finance/TransactionDialog';
import { ManualPaymentDialog, SituationDialog, deleteDocWithAllocations, docTitle, paymentsOf } from '@/components/finance/docs';

type S = ReturnType<typeof useFinance>['situations'][number];

export function ageBadge(s: { isPaid: boolean; age: number | null; contractType?: string }) {
  if (s.isPaid) return <Badge tone="pos">Soldée</Badge>;
  if (s.contractType === 'informel') return <Badge tone="neg">Sans contrat</Badge>;
  const d = s.age ?? 0;
  if (d > 90) return <Badge tone="neg">+90 j</Badge>;
  if (d > 60) return <Badge tone="warn">61 à 90 j</Badge>;
  if (d > 30) return <Badge tone="warn">31 à 60 j</Badge>;
  return <Badge tone="info">{d} j</Badge>;
}

export function SituationsPage() {
  const f = useFinance();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<'open' | 'paid' | 'all'>('open');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<S | 'new' | null>(null);
  const [collect, setCollect] = useState<TxPreset | null>(null);
  const [manual, setManual] = useState<S | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => { if (params.get('new')) { setEdit('new'); params.delete('new'); setParams(params, { replace: true }); } }, [params, setParams]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return f.situations
      .filter((x) => status === 'all' || (status === 'open' ? !x.isPaid : x.isPaid))
      .map((x) => ({ ...x, clientName: f.clientById.get(x.clientId || '')?.name || 'Client inconnu' }))
      .filter((x) => !s || [x.clientName, x.project, x.number, String(x.amount)].some((v) => (v || '').toLowerCase().includes(s)));
  }, [f, status, q]);

  const open = f.situations.filter((s) => !s.isPaid);
  const informal = open.filter((s) => s.contractType === 'informel');
  const det = detail ? f.situations.find((s) => s.id === detail) : null;

  const remove = async (s: S) => {
    const pays = paymentsOf('situation', s, f.transactions).filter((p) => p.source === 'journal');
    if (!(await confirm({ title: 'Supprimer cette situation ?', danger: true, confirmLabel: 'Supprimer',
      message: <>{docTitle(s)} pour {money(s.amount)}.{pays.length > 0 && <> {pays.length} encaissement(s) de journal y sont affectés : ils resteront en trésorerie, comme avances non affectées.</>}</> }))) return;
    await deleteDocWithAllocations('situations', s.id, f.transactions);
    toast.success('Situation supprimée');
    setDetail(null);
  };
  const startCollect = (s: S) => setCollect({ type: 'in', journal: 'banque', clientId: s.clientId, amount: s.remaining, priorityId: s.id, description: `Règlement ${s.number || s.project || 'situation'}`.trim() });

  const print = () => printDocument({ title: 'Situations clients', landscape: true, body: `
    <div class="meta"><span>${printedOn()}</span><span>${rows.length} situation(s)</span></div><h1>Situations clients</h1>
    <div class="sums"><div>Facturé<b>${money(rows.reduce((s, r) => s + r.amount, 0))}</b></div><div>Encaissé<b class="pos">${money(rows.reduce((s, r) => s + r.paid, 0))}</b></div><div>Reste à encaisser<b class="neg">${money(rows.reduce((s, r) => s + r.remaining, 0))}</b></div><div>Nombre<b>${rows.length}</b></div></div>
    <table><thead><tr><th>Client</th><th>Projet</th><th>N°</th><th>Date</th><th class="r">Facturé</th><th class="r">Encaissé</th><th class="r">Restant</th><th class="r">Âge</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${esc(r.clientName)}</td><td>${esc(r.project)}</td><td>${esc(r.number)}</td><td>${dateShort(r.date)}</td><td class="r">${money(r.amount)}</td><td class="r pos">${money(r.paid)}</td><td class="r neg">${money(r.remaining)}</td><td class="r">${r.isPaid ? 'soldée' : (r.age ?? 0) + ' j'}</td></tr>`).join('')}
    </tbody></table>` });

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'client', header: 'Client', cell: (r) => <span className="font-medium">{r.clientName}</span>, sort: (r) => r.clientName },
    { key: 'doc', header: 'Situation', cell: (r) => <div className="min-w-[140px]"><div className="truncate">{r.number || '—'}</div><div className="truncate text-xs text-ink-3">{r.project}</div></div>, sort: (r) => r.number },
    { key: 'date', header: 'Date', cell: (r) => <span className="num text-ink-2">{dateShort(r.date)}</span>, sort: (r) => r.date, hideOnMobile: true },
    { key: 'amount', header: 'Facturé', align: 'right', cell: (r) => <Amount value={r.amount} />, sort: (r) => r.amount, hideOnMobile: true },
    { key: 'paid', header: 'Encaissé', align: 'right', cell: (r) => <div className="ml-auto w-[130px]"><Amount value={r.paid} className="text-pos" /><ProgressBar value={r.amount ? r.paid / r.amount : 0} className="mt-1" /></div>, sort: (r) => r.paid, hideOnMobile: true },
    { key: 'rem', header: 'Restant', align: 'right', cell: (r) => <Amount value={r.remaining} className={r.isPaid ? 'text-ink-3' : 'font-semibold'} />, sort: (r) => r.remaining },
    { key: 'age', header: 'État', cell: (r) => ageBadge(r), sort: (r) => (r.isPaid ? -1 : r.age ?? 0) },
    { key: 'act', header: '', width: '44px', align: 'right', cell: (r) => (
      <RowMenu items={[
        !r.isPaid && { label: 'Encaisser', icon: <Wallet />, onSelect: () => startCollect(r) },
        !r.isPaid && { label: 'Règlement hors trésorerie', icon: <HandCoins />, onSelect: () => setManual(r) },
        { label: 'Modifier', icon: <Pencil />, onSelect: () => setEdit(r) },
        { label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => remove(r) },
      ]} />
    ) },
  ];

  return (
    <>
      <PageHeader title="Situations clients" description="Montants facturés aux clients et leur encaissement."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEdit('new')}>Nouvelle situation</Button>} />

      <div className="panel mb-5 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <Stat label="Reste à encaisser" value={money(f.receivables)} />
        <Stat label="Situations impayées" value={open.length} />
        <Stat label="Plus de 90 jours" value={money(f.aging['90+'])} tone={f.aging['90+'] > 0 ? 'neg' : undefined} />
        <Stat label="Sans contrat" value={money(informal.reduce((s, x) => s + x.remaining, 0))} sub={`${informal.length} situation(s)`} tone={informal.length ? 'neg' : undefined} />
      </div>

      <div className="panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <Segmented size="sm" value={status} onChange={setStatus} options={[{ value: 'open', label: 'Impayées' }, { value: 'paid', label: 'Soldées' }, { value: 'all', label: 'Toutes' }]} />
          <SearchInput value={q} onChange={setQ} placeholder="Client, projet, numéro…" className="min-w-[200px] flex-1" />
          <Button icon={<Download className="size-4" />} disabled={!rows.length} onClick={() => downloadCsv(`situations_${todayISO()}.csv`, ['Client', 'Projet', 'N°', 'Date', 'Facturé', 'Encaissé', 'Restant', 'Cadre'], rows.map((r) => [r.clientName, r.project, r.number, r.date, r.amount, r.paid, r.remaining, r.contractType]))}>Excel</Button>
          <Button icon={<Printer className="size-4" />} disabled={!rows.length} onClick={print}>Imprimer</Button>
        </div>
        <DataTable rows={rows} columns={columns} onRowClick={(r) => setDetail(r.id)} initialSort={{ key: 'date', dir: 'asc' }}
          empty={<EmptyState icon={<FileText className="size-5" />} title={status === 'open' && !q ? 'Aucune situation impayée' : 'Aucune situation'}
            action={<Button variant="primary" onClick={() => setEdit('new')}>Nouvelle situation</Button>}>
            {status === 'open' && !q ? 'Tous les clients sont à jour.' : 'Enregistrez les montants facturés pour suivre leur encaissement.'}</EmptyState>} />
      </div>

      {det && (
        <Dialog open onOpenChange={(v) => !v && setDetail(null)} title={docTitle(det)} description={<Link className="text-copper-strong hover:underline" to={`/dfc/clients/${det.clientId}`}>{f.clientById.get(det.clientId || '')?.name}</Link>}
          footer={<>
            <Button icon={<Pencil className="size-4" />} onClick={() => { setEdit(det); setDetail(null); }}>Modifier</Button>
            {!det.isPaid && <Button variant="primary" icon={<Wallet className="size-4" />} onClick={() => { startCollect(det); setDetail(null); }}>Encaisser {money(det.remaining)}</Button>}
          </>}>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Facturé" value={money(det.amount)} />
            <Stat label="Encaissé" value={money(det.paid)} tone="pos" />
            <Stat label="Restant" value={money(det.remaining)} tone={det.remaining > 0 ? 'neg' : undefined} />
          </div>
          <div className="mt-2 flex gap-2">{ageBadge(det)}{det.project && <Badge>{det.project}</Badge>}</div>
          <p className="mt-5 mb-2 text-[13px] font-semibold">Historique des encaissements</p>
          <PaymentList kind="situations" doc={det} />
        </Dialog>
      )}

      {edit && <SituationDialog record={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      {collect && <TransactionDialog open onOpenChange={(v) => !v && setCollect(null)} preset={collect} />}
      {manual && <ManualPaymentDialog kind="situations" record={manual} remaining={manual.remaining} onClose={() => setManual(null)} />}
    </>
  );
}

export function PaymentList({ kind, doc }: { kind: 'situations' | 'supplierInvoices'; doc: any }) {
  const f = useFinance();
  const confirm = useConfirm();
  const lines = paymentsOf(kind === 'situations' ? 'situation' : 'supplierInvoice', doc, f.transactions);
  if (!lines.length) return <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[13px] text-ink-3">Aucun règlement pour l’instant.</p>;
  const removeManual = async (id: string) => {
    if (!(await confirm({ title: 'Supprimer ce règlement ?', danger: true, confirmLabel: 'Supprimer' }))) return;
    await updateRecord(kind as any, doc, { manualPayments: doc.manualPayments.filter((p: any) => p.id !== id) });
  };
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {lines.map((l) => (
        <li key={l.key} className="flex items-center gap-3 px-3 py-2 text-[13px]">
          <span className="num w-[74px] shrink-0 text-xs text-ink-3">{dateShort(l.date)}</span>
          <span className="min-w-0 flex-1 truncate">{l.label}</span>
          {l.source === 'manual' && <Badge>hors trésorerie</Badge>}
          <Amount value={l.amount} className="font-medium" />
          {l.source === 'manual'
            ? <button aria-label="Supprimer" className="rounded p-1 text-ink-3 hover:bg-neg-soft hover:text-neg" onClick={() => removeManual(l.manualId!)}><Trash2 className="size-3.5" /></button>
            : <Link to="/dfc/journaux" title="Voir dans les journaux" className="rounded p-1 text-ink-3 hover:text-ink"><Wallet className="size-3.5" /></Link>}
        </li>
      ))}
    </ul>
  );
}

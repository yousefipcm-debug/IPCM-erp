import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import clsx from '@/lib/cn';
import { BookOpen, Download, FileCheck2, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { deleteRecord, updateRecord } from '@/lib/data';
import { useFinance, signed } from '@/lib/finance';
import { dateShort, money, todayISO } from '@/lib/format';
import { printDocument, esc, printedOn } from '@/lib/print';
import { downloadCsv } from '@/lib/csv';
import type { Rec, Transaction } from '@/lib/types';
import { Amount, Badge, Button, EmptyState, PageHeader, SearchInput, Segmented, Select } from '@/components/ui/ui';
import { DataTable, type Column } from '@/components/ui/table';
import { RowMenu } from '@/components/ui/pickers';
import { useConfirm } from '@/components/ui/dialog';
import { TransactionDialog } from '@/components/finance/TransactionDialog';

type Period = 'all' | 'month' | 'prev' | 'year';
const inPeriod = (d: string, p: Period) => {
  if (p === 'all') return true;
  const now = new Date();
  const ym = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  if (p === 'month') return d.startsWith(ym(now));
  if (p === 'prev') return d.startsWith(ym(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
  return d.startsWith(String(now.getFullYear()));
};

export function JournalsPage() {
  const f = useFinance();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const journal = (params.get('j') as 'caisse' | 'banque' | null) || 'all';
  const missingOnly = params.get('f') === 'missing';
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [dialog, setDialog] = useState<{ editing?: Rec<Transaction>; journal?: 'caisse' | 'banque' } | null>(null);

  useEffect(() => {
    const n = params.get('new');
    if (n === 'caisse' || n === 'banque') { setDialog({ journal: n }); params.delete('new'); setParams(params, { replace: true }); }
  }, [params, setParams]);

  const setParam = (k: string, v: string | null) => { if (v) params.set(k, v); else params.delete(k); setParams(params, { replace: true }); };

  const partyName = (t: Transaction) => (t.type === 'in' ? f.clientById.get(t.clientId || '')?.name : f.supplierById.get(t.supplierId || '')?.name) || '';

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = f.transactions.filter((t) => (journal === 'all' || t.journal === journal) && (!missingOnly || (t.type === 'out' && t.invoiceStatus === 'missing')) && inPeriod(t.date || '', period));
    if (s) list = list.filter((t) => [t.description, partyName(t), t.chequeNo, t.date, dateShort(t.date), String(t.amount), f.projectById.get(t.projectId || '')?.name].some((x) => (x || '').toLowerCase().includes(s)));
    // running balance for a single journal (chronological)
    const chrono = [...list].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a._updatedAt || '').localeCompare(b._updatedAt || ''));
    const before = journal === 'all' || period === 'all' || s || missingOnly ? null
      : f.transactions.filter((t) => t.journal === journal && (t.date || '') < (chrono[0]?.date || '')).reduce((x, t) => x + signed(t), 0);
    let run = before ?? 0;
    const bal = new Map<string, number>();
    for (const t of chrono) { run += signed(t); bal.set(t.id, run); }
    return chrono.reverse().map((t) => ({ ...t, party: partyName(t), balance: before !== null ? bal.get(t.id)! : null }));
  }, [f, journal, missingOnly, q, period]);

  const totals = useMemo(() => ({ in: rows.filter((r) => r.type === 'in').reduce((s, r) => s + r.amount, 0), out: rows.filter((r) => r.type === 'out').reduce((s, r) => s + r.amount, 0) }), [rows]);
  const missingCount = f.transactions.filter((t) => t.type === 'out' && t.invoiceStatus === 'missing').length;
  const showBalance = rows.length > 0 && rows[0].balance !== null;

  const remove = async (t: Rec<Transaction>) => {
    const linked = t.allocations?.length ? ` Il règle actuellement ${t.allocations.length} document(s) : ces documents redeviendront impayés.` : '';
    if (!(await confirm({ title: 'Supprimer ce mouvement ?', message: <>{t.type === 'in' ? 'Entrée' : 'Sortie'} de <b>{money(t.amount)}</b> du {dateShort(t.date)}.{linked}</>, danger: true, confirmLabel: 'Supprimer le mouvement' }))) return;
    await deleteRecord('transactions', t.id);
    toast.success('Mouvement supprimé');
  };
  const markReceived = async (t: Rec<Transaction>) => { await updateRecord('transactions', t, { invoiceStatus: 'ok' }); toast.success('Facture marquée comme reçue'); };

  const title = journal === 'caisse' ? 'Journal de caisse' : journal === 'banque' ? 'Journal de banque' : 'Journaux';

  const exportCsv = () => downloadCsv(`${title.replace(/ /g, '_')}_${todayISO()}.csv`,
    ['Date', 'Journal', 'Sens', 'Libellé', 'Client / fournisseur', 'Référence', 'Projet', 'Montant', 'Facture'],
    rows.map((r) => [r.date, r.journal, r.type === 'in' ? 'Entrée' : 'Sortie', r.description, r.party, r.chequeNo, f.projectById.get(r.projectId || '')?.name, signed(r), r.type === 'out' ? (r.invoiceStatus === 'missing' ? 'Manquante' : 'OK') : '']));

  const print = () => printDocument({ title, landscape: true, body: `
    <div class="meta"><span>${printedOn()}</span><span>${rows.length} mouvement(s)</span></div><h1>${esc(title)}</h1>
    <div class="sums"><div>Entrées<b class="pos">${money(totals.in)}</b></div><div>Sorties<b class="neg">${money(totals.out)}</b></div><div>Solde de la sélection<b>${money(totals.in - totals.out)}</b></div><div>Solde ${journal === 'all' ? 'total' : journal}<b>${money(journal === 'banque' ? f.balance.banque : journal === 'caisse' ? f.balance.caisse : f.balance.treasury)}</b></div></div>
    <table><thead><tr><th>Date</th><th>Journal</th><th>Libellé</th><th>Client / fournisseur</th><th>Réf.</th><th class="r">Entrée</th><th class="r">Sortie</th>${showBalance ? '<th class="r">Solde</th>' : ''}</tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${dateShort(r.date)}</td><td>${r.journal === 'banque' ? 'Banque' : 'Caisse'}</td><td>${esc(r.description)}${r.invoiceStatus === 'missing' && r.type === 'out' ? ' <b class="neg">(facture manquante)</b>' : ''}</td><td>${esc(r.party)}</td><td>${esc(r.chequeNo)}</td><td class="r pos">${r.type === 'in' ? money(r.amount) : ''}</td><td class="r neg">${r.type === 'out' ? money(r.amount) : ''}</td>${showBalance ? `<td class="r">${money(r.balance)}</td>` : ''}</tr>`).join('')}
    </tbody></table>` });

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'date', header: 'Date', cell: (r) => <span className="num text-ink-2">{dateShort(r.date)}</span>, sort: (r) => r.date, width: '104px', hideOnMobile: true },
    { key: 'desc', header: 'Libellé', cell: (r) => (
      <div className="min-w-[180px]">
        <div className="flex items-center gap-2">
          <span className="truncate">{r.description || `${r.type === 'in' ? 'Encaissement' : 'Paiement'}${r.party ? ` ${r.party}` : ''}`}</span>
          {r.type === 'out' && r.invoiceStatus === 'missing' && <Badge tone="neg">Facture manquante</Badge>}
        </div>
        <div className="truncate text-xs text-ink-3">
          {(() => {
            const parts = [r.party, r.projectId && f.projectById.get(r.projectId)?.name ? `Projet ${f.projectById.get(r.projectId)!.name}` : null, r.allocations?.length ? `règle ${r.allocations.length} document${r.allocations.length > 1 ? 's' : ''}` : null].filter(Boolean).join(', ');
            return <><span className="num md:hidden">{dateShort(r.date)}{parts ? ', ' : ''}</span>{parts}</>;
          })()}
        </div>
      </div>
    ), sort: (r) => r.description || '' },
    { key: 'journal', header: 'Journal', cell: (r) => <Badge tone={r.journal === 'banque' ? 'info' : 'neutral'}>{r.journal === 'banque' ? 'Banque' : 'Caisse'}</Badge>, hideOnMobile: true },
    { key: 'ref', header: 'Référence', cell: (r) => <span className="num text-ink-2">{r.chequeNo || ''}</span>, hideOnMobile: true },
    { key: 'amount', header: 'Montant', align: 'right', cell: (r) => <Amount value={r.amount} signedDisplay={r.type} className="font-medium" />, sort: (r) => signed(r) },
    ...(showBalance ? [{ key: 'bal', header: 'Solde', align: 'right' as const, cell: (r: any) => <Amount value={r.balance} className="text-ink-2" />, hideOnMobile: true }] : []),
    { key: 'act', header: '', width: '44px', align: 'right', cell: (r) => (
      <RowMenu items={[
        { label: 'Modifier', icon: <Pencil />, onSelect: () => setDialog({ editing: r }) },
        r.type === 'out' && r.invoiceStatus === 'missing' && { label: 'Facture reçue', icon: <FileCheck2 />, onSelect: () => markReceived(r) },
        { label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => remove(r) },
      ]} />
    ) },
  ];

  return (
    <>
      <PageHeader title={title} description="Chaque entrée ou sortie de caisse et de banque. Les règlements sont affectés automatiquement aux factures les plus anciennes."
        actions={<>
          <Button icon={<Plus className="size-4" />} onClick={() => setDialog({ journal: 'caisse' })}>Caisse</Button>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setDialog({ journal: 'banque' })}>Banque</Button>
        </>} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([['all', 'Trésorerie totale', f.balance.treasury], ['banque', 'Banque', f.balance.banque], ['caisse', 'Caisse', f.balance.caisse]] as const).map(([k, label, v]) => (
          <button key={k} onClick={() => setParam('j', k === 'all' ? null : k)}
            className={clsx('panel px-4 py-3 text-left transition-colors', journal === k ? 'border-copper shadow-[0_0_0_1px_var(--copper)]' : 'hover:border-line-strong')}>
            <p className="text-[13px] text-ink-3">{label}</p>
            <p className={clsx('num text-lg font-semibold tracking-tight', v < 0 && 'text-neg')}>{money(v)}</p>
          </button>
        ))}
        <button onClick={() => setParam('f', missingOnly ? null : 'missing')}
          className={clsx('panel px-4 py-3 text-left transition-colors', missingOnly ? 'border-neg shadow-[0_0_0_1px_var(--neg)]' : 'hover:border-line-strong')}>
          <p className="text-[13px] text-ink-3">Factures manquantes</p>
          <p className={clsx('num text-lg font-semibold', missingCount > 0 && 'text-neg')}>{missingCount}</p>
        </button>
      </div>

      <div className="panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchInput value={q} onChange={setQ} placeholder="Libellé, client, fournisseur, n° de chèque, montant…" className="min-w-[220px] flex-1" />
          <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="w-auto min-w-[150px]" aria-label="Période">
            <option value="all">Toutes les dates</option><option value="month">Ce mois-ci</option><option value="prev">Mois dernier</option><option value="year">Cette année</option>
          </Select>
          <Button icon={<Download className="size-4" />} onClick={exportCsv} disabled={!rows.length}>Excel</Button>
          <Button icon={<Printer className="size-4" />} onClick={print} disabled={!rows.length}>Imprimer</Button>
        </div>
        <DataTable rows={rows} columns={columns} onRowClick={(r) => setDialog({ editing: r })} initialSort={{ key: 'date', dir: 'desc' }}
          rowClassName={(r) => (r.type === 'out' && r.invoiceStatus === 'missing' ? 'bg-neg-soft/40' : undefined)}
          empty={<EmptyState icon={<BookOpen className="size-5" />} title={q || missingOnly || period !== 'all' ? 'Aucun mouvement ne correspond' : 'Aucun mouvement'}
            action={!q && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setDialog({ journal: journal === 'all' ? 'caisse' : journal })}>Saisir un mouvement</Button>}>
            {q || missingOnly || period !== 'all' ? 'Modifiez la recherche ou les filtres.' : 'Les entrées et sorties de caisse et de banque apparaîtront ici.'}</EmptyState>}
          footer={rows.length > 0 && (
            <tr><td colSpan={columns.length} className="px-4 py-2.5 text-right text-[13px]">
              <span className="text-ink-3">{rows.length} mouvement(s)</span>
              <span className="ml-5 text-ink-3">Entrées</span> <Amount value={totals.in} className="text-pos" />
              <span className="ml-5 text-ink-3">Sorties</span> <Amount value={totals.out} className="text-neg" />
            </td></tr>
          )} />
      </div>

      {dialog && <TransactionDialog open onOpenChange={(v) => !v && setDialog(null)} editing={dialog.editing} preset={{ journal: dialog.journal }} />}
    </>
  );
}

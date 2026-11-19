import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Download, HandCoins, Mail, MapPin, Pencil, Phone, Plus, Printer, Trash2, Truck, Users, Wallet, AlertTriangle } from 'lucide-react';
import { deleteRecord } from '@/lib/data';
import { useFinance } from '@/lib/finance';
import { dateShort, money, todayISO } from '@/lib/format';
import { printDocument, esc, printedOn } from '@/lib/print';
import { downloadCsv } from '@/lib/csv';
import type { Client, Rec, Supplier } from '@/lib/types';
import { Amount, Badge, Button, EmptyState, Initials, PageHeader, Panel, ProgressBar, SearchInput, Segmented, Stat } from '@/components/ui/ui';
import { DataTable, type Column } from '@/components/ui/table';
import { RowMenu } from '@/components/ui/pickers';
import { Dialog, useConfirm } from '@/components/ui/dialog';
import { PartyDialog } from '@/components/finance/entities';
import { ManualPaymentDialog, SituationDialog, SupplierInvoiceDialog, deleteDocWithAllocations, docTitle } from '@/components/finance/docs';
import { TransactionDialog, type TxPreset } from '@/components/finance/TransactionDialog';
import { ageBadge, PaymentList } from './Situations';

type Kind = 'clients' | 'suppliers';
const TXT = {
  clients: { title: 'Clients', one: 'client', new: 'Nouveau client', doc: 'situation', docs: 'Situations', due: 'Reste à encaisser', paid: 'Encaissé', billed: 'Facturé', icon: Users, path: '/dfc/clients' },
  suppliers: { title: 'Fournisseurs', one: 'fournisseur', new: 'Nouveau fournisseur', doc: 'facture', docs: 'Factures', due: 'Reste à payer', paid: 'Payé', billed: 'Dû', icon: Truck, path: '/dfc/fournisseurs' },
};

function usePartyStats(kind: Kind) {
  const f = useFinance();
  return useMemo(() => {
    const parties = (kind === 'clients' ? f.clients : f.suppliers) as Rec<Client | Supplier>[];
    const docs = kind === 'clients' ? f.situations : f.supplierInvoices;
    const key = kind === 'clients' ? 'clientId' : 'supplierId';
    const by = new Map<string, { billed: number; paid: number; due: number; open: number; count: number; oldest: number | null; last: string }>();
    for (const d of docs as any[]) {
      const id = d[key]; if (!id) continue;
      const s = by.get(id) || { billed: 0, paid: 0, due: 0, open: 0, count: 0, oldest: null, last: '' };
      s.billed += d.amount; s.paid += d.paid; s.due += d.remaining; s.count++;
      if (!d.isPaid) { s.open++; s.oldest = Math.max(s.oldest ?? 0, d.age ?? 0); }
      if ((d.date || '') > s.last) s.last = d.date;
      by.set(id, s);
    }
    const empty = { billed: 0, paid: 0, due: 0, open: 0, count: 0, oldest: null, last: '' };
    return parties.map((p) => ({ ...p, stats: by.get(p.id) || empty }));
  }, [f, kind]);
}

export function PartiesPage({ kind }: { kind: Kind }) {
  const t = TXT[kind];
  const f = useFinance();
  const nav = useNavigate();
  const rows0 = usePartyStats(kind);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'due' | 'all'>('all');
  const [tab, setTab] = useState<'parties' | 'docs'>('parties');
  const [edit, setEdit] = useState<Rec<any> | 'new' | null>(null);
  const [newDoc, setNewDoc] = useState(false);

  useEffect(() => {
    const n = params.get('new');
    if (n === '1') setEdit('new');
    if (n === 'invoice') { setNewDoc(true); setTab('docs'); }
    if (n) { params.delete('new'); setParams(params, { replace: true }); }
  }, [params, setParams]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows0.filter((r) => (filter === 'all' || r.stats.due > 0.01) && (!s || [r.name, r.legalName, r.phone, r.contactPerson, r.nif, r.activity].some((v) => (v || '').toLowerCase().includes(s))));
  }, [rows0, q, filter]);
  const totalDue = rows0.reduce((s, r) => s + r.stats.due, 0);

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'name', header: 'Nom', sort: (r) => r.name, cell: (r) => (
      <div className="flex min-w-[180px] items-center gap-2.5">
        <Initials name={r.name} />
        <div className="min-w-0"><div className="truncate font-medium">{r.name}</div><div className="truncate text-xs text-ink-3">{r.activity || r.legalName || r.phone || ''}</div></div>
      </div>
    ) },
    { key: 'contact', header: 'Contact', hideOnMobile: true, cell: (r) => <div className="text-[13px] text-ink-2"><div className="truncate">{r.contactPerson}</div><div className="num truncate text-xs text-ink-3">{r.phone}</div></div> },
    { key: 'billed', header: t.billed, align: 'right', hideOnMobile: true, sort: (r) => r.stats.billed, cell: (r) => <Amount value={r.stats.billed} className="text-ink-2" /> },
    { key: 'due', header: t.due, align: 'right', sort: (r) => r.stats.due, cell: (r) => r.stats.due > 0.01 ? <Amount value={r.stats.due} className="font-semibold" /> : <span className="text-[13px] text-ink-3">À jour</span> },
    { key: 'open', header: 'Ouverts', align: 'right', hideOnMobile: true, sort: (r) => r.stats.open, cell: (r) => (
      <span className="inline-flex items-center gap-2">
        {kind === 'suppliers' && (r as any).alertLimit > 0 && r.stats.due >= (r as any).alertLimit && <Badge tone="neg">Seuil dépassé</Badge>}
        <span className="num text-ink-2">{r.stats.open || '—'}</span>
      </span>
    ) },
  ];

  return (
    <>
      <PageHeader title={t.title} description={kind === 'clients' ? 'Fiches clients, situations et encaissements.' : 'Fiches fournisseurs, factures et règlements.'}
        actions={<>
          {kind === 'suppliers' && <Button icon={<Plus className="size-4" />} onClick={() => setNewDoc(true)}>Facture fournisseur</Button>}
          <Button variant={kind === 'clients' ? 'primary' : 'secondary'} icon={<Plus className="size-4" />} onClick={() => setEdit('new')}>{t.new}</Button>
        </>} />

      <div className="panel mb-5 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <Stat label={`Nombre de ${t.one}s`} value={rows0.length} />
        <Stat label={t.due} value={money(totalDue)} tone={kind === 'suppliers' && totalDue > 0 ? 'neg' : undefined} />
        <Stat label={`${t.one.charAt(0).toUpperCase() + t.one.slice(1)}s avec un solde`} value={rows0.filter((r) => r.stats.due > 0.01).length} />
        <Stat label={`${t.docs} ouvertes`} value={rows0.reduce((s, r) => s + r.stats.open, 0)} />
      </div>

      {kind === 'suppliers' && <div className="mb-3"><Segmented size="sm" value={tab} onChange={setTab} options={[{ value: 'parties', label: 'Par fournisseur' }, { value: 'docs', label: 'Toutes les factures' }]} /></div>}

      {tab === 'docs' && kind === 'suppliers' ? <SupplierInvoicesTable /> : (
        <div className="panel">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Tous' }, { value: 'due', label: 'Avec un solde' }]} />
            <SearchInput value={q} onChange={setQ} placeholder="Nom, contact, téléphone, NIF…" className="min-w-[200px] flex-1" />
            <Button icon={<Download className="size-4" />} disabled={!rows.length} onClick={() => downloadCsv(`${kind}_${todayISO()}.csv`, ['Nom', 'Raison sociale', 'Contact', 'Téléphone', 'E-mail', 'Adresse', 'NIF', 'NIS', 'RC', t.billed, t.paid, t.due],
              rows.map((r) => [r.name, r.legalName, r.contactPerson, r.phone, r.email, r.address, r.nif, r.nis, r.rc, r.stats.billed, r.stats.paid, r.stats.due]))}>Excel</Button>
          </div>
          <DataTable rows={rows} columns={columns} onRowClick={(r) => nav(`${t.path}/${r.id}`)} initialSort={{ key: 'due', dir: 'desc' }}
            empty={<EmptyState icon={<t.icon className="size-5" />} title={q ? 'Aucun résultat' : `Aucun ${t.one}`} action={!q && <Button variant="primary" onClick={() => setEdit('new')}>{t.new}</Button>}>
              {q ? 'Modifiez la recherche.' : `Ajoutez vos ${t.one}s pour suivre leurs ${t.docs.toLowerCase()}.`}</EmptyState>} />
        </div>
      )}

      {edit && <PartyDialog kind={kind} open onOpenChange={(v) => !v && setEdit(null)} record={edit === 'new' ? null : edit} onSaved={(id) => edit === 'new' && nav(`${t.path}/${id}`)} />}
      {newDoc && <SupplierInvoiceDialog record={null} onClose={() => setNewDoc(false)} />}
    </>
  );
}

function SupplierInvoicesTable() {
  const f = useFinance();
  const confirm = useConfirm();
  const [status, setStatus] = useState<'open' | 'paid' | 'all'>('open');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<any>(null);
  const [pay, setPay] = useState<TxPreset | null>(null);
  const [manual, setManual] = useState<any>(null);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return f.supplierInvoices.filter((x) => status === 'all' || (status === 'open' ? !x.isPaid : x.isPaid))
      .map((x) => ({ ...x, supplierLabel: f.supplierById.get(x.supplierId || '')?.name || x.supplierName || 'Fournisseur inconnu' }))
      .filter((x) => !s || [x.supplierLabel, x.reference, String(x.amount)].some((v) => (v || '').toLowerCase().includes(s)));
  }, [f, status, q]);
  const remove = async (x: any) => {
    if (!(await confirm({ title: 'Supprimer cette facture fournisseur ?', message: `${docTitle(x)} pour ${money(x.amount)}.`, danger: true, confirmLabel: 'Supprimer' }))) return;
    await deleteDocWithAllocations('supplierInvoices', x.id, f.transactions); toast.success('Facture supprimée');
  };
  const columns: Column<(typeof rows)[number]>[] = [
    { key: 's', header: 'Fournisseur', sort: (r) => r.supplierLabel, cell: (r) => <span className="font-medium">{r.supplierLabel}</span> },
    { key: 'ref', header: 'Référence', sort: (r) => r.reference, cell: (r) => <span className="num">{r.reference || '—'}</span> },
    { key: 'date', header: 'Date', sort: (r) => r.date, cell: (r) => <span className="num text-ink-2">{dateShort(r.date)}</span>, hideOnMobile: true },
    { key: 'amount', header: 'Dû', align: 'right', sort: (r) => r.amount, cell: (r) => <Amount value={r.amount} />, hideOnMobile: true },
    { key: 'rem', header: 'Restant', align: 'right', sort: (r) => r.remaining, cell: (r) => <Amount value={r.remaining} className={r.isPaid ? 'text-ink-3' : 'font-semibold'} /> },
    { key: 'st', header: 'État', cell: (r) => r.isPaid ? <Badge tone="pos">Réglée</Badge> : (r.age ?? 0) > 60 ? <Badge tone="warn">{r.age} j</Badge> : <Badge tone="info">{r.age ?? 0} j</Badge> },
    { key: 'a', header: '', width: '44px', align: 'right', cell: (r) => <RowMenu items={[
      !r.isPaid && { label: 'Payer', icon: <Wallet />, onSelect: () => setPay({ type: 'out', journal: 'banque', supplierId: r.supplierId, amount: r.remaining, priorityId: r.id, description: `Règlement facture ${r.reference}`.trim() }) },
      !r.isPaid && { label: 'Règlement hors trésorerie', icon: <HandCoins />, onSelect: () => setManual(r) },
      { label: 'Modifier', icon: <Pencil />, onSelect: () => setEdit(r) },
      { label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => remove(r) },
    ]} /> },
  ];
  return (
    <div className="panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <Segmented size="sm" value={status} onChange={setStatus} options={[{ value: 'open', label: 'À régler' }, { value: 'paid', label: 'Réglées' }, { value: 'all', label: 'Toutes' }]} />
        <SearchInput value={q} onChange={setQ} placeholder="Fournisseur, référence, montant…" className="min-w-[200px] flex-1" />
      </div>
      <DataTable rows={rows} columns={columns} initialSort={{ key: 'date', dir: 'asc' }} onRowClick={(r) => setEdit(r)}
        empty={<EmptyState icon={<Truck className="size-5" />} title={status === 'open' ? 'Aucune facture à régler' : 'Aucune facture'} />} />
      {edit && <SupplierInvoiceDialog record={edit} onClose={() => setEdit(null)} />}
      {pay && <TransactionDialog open onOpenChange={(v) => !v && setPay(null)} preset={pay} />}
      {manual && <ManualPaymentDialog kind="supplierInvoices" record={manual} remaining={manual.remaining} onClose={() => setManual(null)} />}
    </div>
  );
}

export function PartyDetailPage({ kind }: { kind: Kind }) {
  const t = TXT[kind];
  const { id } = useParams();
  const nav = useNavigate();
  const f = useFinance();
  const confirm = useConfirm();
  const party = (kind === 'clients' ? f.clientById : f.supplierById).get(id || '') as Rec<any> | undefined;
  const [edit, setEdit] = useState(false);
  const [newDoc, setNewDoc] = useState(false);
  const [editDoc, setEditDoc] = useState<any>(null);
  const [tx, setTx] = useState<TxPreset | null>(null);
  const [manual, setManual] = useState<any>(null);
  const [openDoc, setOpenDoc] = useState<string | null>(null);

  const docs = useMemo(() => (kind === 'clients' ? f.situations.filter((s) => s.clientId === id) : f.supplierInvoices.filter((s) => s.supplierId === id)) as any[], [f, id, kind]);
  const txs = useMemo(() => f.transactions.filter((x) => (kind === 'clients' ? x.clientId : x.supplierId) === id).sort((a, b) => b.date.localeCompare(a.date)), [f, id, kind]);

  if (!party) return <EmptyState title={`${t.one.charAt(0).toUpperCase() + t.one.slice(1)} introuvable`} action={<Button onClick={() => nav(t.path)}>Retour à la liste</Button>}>Il a peut-être été supprimé.</EmptyState>;

  const billed = docs.reduce((s, d) => s + d.amount, 0);
  const paid = docs.reduce((s, d) => s + d.paid, 0);
  const due = docs.reduce((s, d) => s + d.remaining, 0);
  const allocatedTotal = txs.reduce((s, x) => s + (x.allocations || []).reduce((a, b) => a + b.amount, 0), 0);
  const advance = Math.max(0, txs.reduce((s, x) => s + x.amount, 0) - allocatedTotal);
  const overLimit = kind === 'suppliers' && party.alertLimit > 0 && due >= party.alertLimit;

  const remove = async () => {
    if (docs.length || txs.length) {
      await confirm({ title: `Impossible de supprimer ${party.name}`, message: `Ce ${t.one} a ${docs.length} document(s) et ${txs.length} mouvement(s) de journal. Supprimez-les d’abord, ou conservez la fiche.`, confirmLabel: 'Compris' });
      return;
    }
    if (!(await confirm({ title: `Supprimer ${party.name} ?`, danger: true, confirmLabel: 'Supprimer' }))) return;
    await deleteRecord(kind, party.id); toast.success(`${t.one.charAt(0).toUpperCase() + t.one.slice(1)} supprimé`); nav(t.path);
  };

  const statement = () => {
    const rows = [
      ...docs.map((d) => ({ date: d.date, label: `${kind === 'clients' ? 'Situation' : 'Facture'} ${d.number || d.reference || ''}${d.project ? ` (${d.project})` : ''}`, debit: d.amount, credit: 0 })),
      ...txs.map((x) => ({ date: x.date, label: `Règlement ${x.journal}${x.chequeNo ? ` n° ${x.chequeNo}` : ''}${x.description ? `, ${x.description}` : ''}`, debit: 0, credit: x.amount })),
      ...docs.flatMap((d) => (d.manualPayments || []).map((p: any) => ({ date: p.date, label: p.note || 'Règlement', debit: 0, credit: p.amount }))),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let run = 0;
    printDocument({ title: `Relevé ${party.name}`, body: `
      <div class="meta"><span>${printedOn()}</span><span></span></div>
      <h1>Relevé de compte ${kind === 'clients' ? 'client' : 'fournisseur'}</h1>
      <div class="box"><b>${esc(party.legalName || party.name)}</b><br>${esc(party.address)}${party.nif ? `<br>NIF ${esc(party.nif)}` : ''}${party.rc ? `&emsp;RC ${esc(party.rc)}` : ''}</div>
      <table><thead><tr><th>Date</th><th>Libellé</th><th class="r">${kind === 'clients' ? 'Facturé' : 'Dû'}</th><th class="r">Réglé</th><th class="r">Solde</th></tr></thead><tbody>
      ${rows.map((r) => { run += r.debit - r.credit; return `<tr><td>${dateShort(r.date)}</td><td>${esc(r.label)}</td><td class="r">${r.debit ? money(r.debit) : ''}</td><td class="r">${r.credit ? money(r.credit) : ''}</td><td class="r">${money(run)}</td></tr>`; }).join('')}
      </tbody><tfoot><tr><td colspan="2">Solde dû au ${dateShort(todayISO())}</td><td class="r">${money(billed)}</td><td class="r">${money(paid)}</td><td class="r">${money(due)}</td></tr></tfoot></table>
      <div class="sig"><div></div><div><div class="line">Cachet et signature</div></div></div>` });
  };

  const removeDoc = async (d: any) => {
    if (!(await confirm({ title: `Supprimer ${docTitle(d)} ?`, danger: true, confirmLabel: 'Supprimer' }))) return;
    await deleteDocWithAllocations(kind === 'clients' ? 'situations' : 'supplierInvoices', d.id, f.transactions); toast.success('Document supprimé');
  };
  const payPreset = (d?: any): TxPreset => kind === 'clients'
    ? { type: 'in', journal: 'banque', clientId: party.id, amount: d ? d.remaining : due, priorityId: d?.id, description: d ? `Règlement ${d.number || d.project || ''}`.trim() : '' }
    : { type: 'out', journal: 'banque', supplierId: party.id, amount: d ? d.remaining : due, priorityId: d?.id, description: d ? `Règlement facture ${d.reference || ''}`.trim() : '' };

  const docCols: Column<any>[] = [
    { key: 'doc', header: kind === 'clients' ? 'Situation' : 'Facture', cell: (d) => <div><div className="font-medium">{d.number || d.reference || '—'}</div>{d.project && <div className="text-xs text-ink-3">{d.project}</div>}</div>, sort: (d) => d.number || d.reference },
    { key: 'date', header: 'Date', cell: (d) => <span className="num text-ink-2">{dateShort(d.date)}</span>, sort: (d) => d.date },
    { key: 'amount', header: t.billed, align: 'right', cell: (d) => <Amount value={d.amount} />, hideOnMobile: true },
    { key: 'rem', header: 'Restant', align: 'right', cell: (d) => <Amount value={d.remaining} className={d.isPaid ? 'text-ink-3' : 'font-semibold'} />, sort: (d) => d.remaining },
    { key: 'st', header: 'État', cell: (d) => ageBadge(d) },
    { key: 'a', header: '', width: '44px', align: 'right', cell: (d) => <RowMenu items={[
      !d.isPaid && { label: kind === 'clients' ? 'Encaisser' : 'Payer', icon: <Wallet />, onSelect: () => setTx(payPreset(d)) },
      !d.isPaid && { label: 'Règlement hors trésorerie', icon: <HandCoins />, onSelect: () => setManual(d) },
      { label: 'Modifier', icon: <Pencil />, onSelect: () => setEditDoc(d) },
      { label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => removeDoc(d) },
    ]} /> },
  ];
  const det = openDoc ? docs.find((d) => d.id === openDoc) : null;

  return (
    <>
      <Link to={t.path} className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink"><ArrowLeft className="size-4" />{t.title}</Link>
      <PageHeader title={<span className="flex items-center gap-3"><Initials name={party.name} className="size-10 text-sm" />{party.name}</span>}
        description={party.legalName || party.activity || undefined}
        actions={<>
          <Button icon={<Printer className="size-4" />} onClick={statement}>Relevé de compte</Button>
          <Button icon={<Pencil className="size-4" />} onClick={() => setEdit(true)}>Modifier la fiche</Button>
          <RowMenu label="Plus d’actions" items={[{ label: `Supprimer le ${t.one}`, icon: <Trash2 />, danger: true, onSelect: remove }]} />
        </>} />

      {overLimit && <div className="mb-4 flex items-center gap-2 rounded-lg bg-neg-soft px-4 py-2.5 text-[13.5px] text-neg"><AlertTriangle className="size-4" />La dette atteint le seuil d’alerte fixé à {money(party.alertLimit)}.</div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <div className="panel grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
            <Stat label={t.billed} value={money(billed)} />
            <Stat label={t.paid} value={money(paid)} tone="pos" />
            <Stat label={t.due} value={money(due)} tone={due > 0 ? 'neg' : undefined} />
            <Stat label="Avance non affectée" value={money(advance)} sub="Règlements sans document" />
            <ProgressBar value={billed ? paid / billed : 0} className="col-span-full" />
          </div>

          <Panel title={t.docs} bodyClassName="p-0" actions={<>
            {due > 0 && <Button size="sm" variant="quiet" icon={<Wallet className="size-4" />} onClick={() => setTx(payPreset())}>{kind === 'clients' ? 'Encaisser' : 'Payer'}</Button>}
            <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setNewDoc(true)}>{kind === 'clients' ? 'Situation' : 'Facture'}</Button>
          </>}>
            <DataTable rows={docs} columns={docCols} initialSort={{ key: 'date', dir: 'desc' }} onRowClick={(d) => setOpenDoc(d.id)}
              empty={<p className="px-4 py-8 text-center text-[13px] text-ink-3">Aucun document enregistré.</p>} />
          </Panel>

          <Panel title="Mouvements de journal" bodyClassName="p-0">
            {txs.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-ink-3">Aucun mouvement lié.</p> : (
              <ul className="divide-y divide-line">
                {txs.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-2.5 text-[13.5px]">
                    <span className="num w-[78px] shrink-0 text-xs text-ink-3">{dateShort(x.date)}</span>
                    <span className="min-w-0 flex-1 truncate">{x.description || (x.type === 'in' ? 'Encaissement' : 'Paiement')}<span className="ml-1.5 text-xs text-ink-3">{x.journal}{x.chequeNo ? `, n° ${x.chequeNo}` : ''}</span></span>
                    <Amount value={x.amount} signedDisplay={x.type} className="font-medium" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel title="Coordonnées">
            <dl className="space-y-2.5 text-[13.5px]">
              {party.contactPerson && <div><dt className="text-xs text-ink-3">Contact</dt><dd>{party.contactPerson}</dd></div>}
              {party.phone && <div className="flex items-center gap-2"><Phone className="size-4 text-ink-3" /><a className="num hover:underline" href={`tel:${party.phone}`}>{party.phone}</a>{party.phone2 && <a className="num text-ink-3 hover:underline" href={`tel:${party.phone2}`}>{party.phone2}</a>}</div>}
              {party.email && <div className="flex items-center gap-2"><Mail className="size-4 text-ink-3" /><a className="truncate hover:underline" href={`mailto:${party.email}`}>{party.email}</a></div>}
              {party.address && <div className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" /><span>{party.address}</span></div>}
              {party.paymentTerms && <div><dt className="text-xs text-ink-3">Conditions de paiement</dt><dd>{party.paymentTerms}</dd></div>}
              {!party.contactPerson && !party.phone && !party.email && !party.address && <p className="text-ink-3">Aucune coordonnée. <button className="text-copper-strong hover:underline" onClick={() => setEdit(true)}>Compléter la fiche</button></p>}
            </dl>
          </Panel>
          <Panel title="Identification">
            <dl className="grid grid-cols-[56px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
              {(['nif', 'nis', 'rc', 'ai', 'tin', 'rib'] as const).filter((k) => k in party).map((k) => (<Fragment key={k}><dt className="text-ink-3">{k.toUpperCase()}</dt><dd className="num truncate">{party[k] || <span className="text-ink-3">—</span>}</dd></Fragment>))}
            </dl>
            {kind === 'suppliers' && <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink-3">Seuil d’alerte : <span className="text-ink">{party.alertLimit > 0 ? money(party.alertLimit) : 'aucun'}</span></p>}
          </Panel>
          {party.notes && <Panel title="Notes"><p className="text-[13.5px] whitespace-pre-wrap text-ink-2">{party.notes}</p></Panel>}
        </aside>
      </div>

      {det && (
        <DocDetail kind={kind} doc={det} onClose={() => setOpenDoc(null)} onPay={() => { setTx(payPreset(det)); setOpenDoc(null); }} />
      )}
      {edit && <PartyDialog kind={kind} open onOpenChange={setEdit} record={party} />}
      {newDoc && (kind === 'clients' ? <SituationDialog record={null} presetClientId={party.id} onClose={() => setNewDoc(false)} /> : <SupplierInvoiceDialog record={null} presetSupplierId={party.id} onClose={() => setNewDoc(false)} />)}
      {editDoc && (kind === 'clients' ? <SituationDialog record={editDoc} onClose={() => setEditDoc(null)} /> : <SupplierInvoiceDialog record={editDoc} onClose={() => setEditDoc(null)} />)}
      {tx && <TransactionDialog open onOpenChange={(v) => !v && setTx(null)} preset={tx} />}
      {manual && <ManualPaymentDialog kind={kind === 'clients' ? 'situations' : 'supplierInvoices'} record={manual} remaining={manual.remaining} onClose={() => setManual(null)} />}
    </>
  );
}

function DocDetail({ kind, doc, onClose, onPay }: { kind: Kind; doc: any; onClose: () => void; onPay: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={docTitle(doc)}
      footer={!doc.isPaid && <Button variant="primary" icon={<Wallet className="size-4" />} onClick={onPay}>{kind === 'clients' ? 'Encaisser' : 'Payer'} {money(doc.remaining)}</Button>}>
      <div className="grid grid-cols-3 gap-3">
        <Stat label={kind === 'clients' ? 'Facturé' : 'Dû'} value={money(doc.amount)} />
        <Stat label="Réglé" value={money(doc.paid)} tone="pos" />
        <Stat label="Restant" value={money(doc.remaining)} tone={doc.remaining > 0 ? 'neg' : undefined} />
      </div>
      <p className="mt-5 mb-2 text-[13px] font-semibold">Règlements</p>
      <PaymentList kind={kind === 'clients' ? 'situations' : 'supplierInvoices'} doc={doc} />
    </Dialog>
  );
}

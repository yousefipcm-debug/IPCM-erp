import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileSignature, Minus, Plus, Printer, Trash2, Wallet } from 'lucide-react';
import { createRecord, deleteRecord, useCollection, useIndex } from '@/lib/data';
import { amountInWordsAR, dateShort, money, monthLabel, todayISO, capitalize, parseISO } from '@/lib/format';
import { printDocument, esc, printedOn, company } from '@/lib/print';
import type { PettyCashMove, Rec } from '@/lib/types';
import { Amount, Badge, Button, Checkbox, EmptyState, Field, Input, PageHeader, Segmented, Select, Stat } from '@/components/ui/ui';
import { DataTable, type Column } from '@/components/ui/table';
import { MoneyInput, RowMenu } from '@/components/ui/pickers';
import { Dialog, useConfirm } from '@/components/ui/dialog';
import { SupplierPicker } from '@/components/finance/entities';

const HOLDER = 'Mme Terkmane';
const sign = (m: PettyCashMove) => (m.type === 'in' ? m.amount : -m.amount);
const chrono = (a: Rec<PettyCashMove>, b: Rec<PettyCashMove>) => (a.date || '').localeCompare(b.date || '') || (a._updatedAt || '').localeCompare(b._updatedAt || '');

export function printDecharge(m: Rec<PettyCashMove>) {
  const c = company();
  const d = parseISO(m.date);
  const dateAr = d ? d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  printDocument({ title: 'وصل استلام مبلغ مالي', dir: 'rtl', extraCss: `
    body{font-size:13pt;line-height:2}.lh{direction:ltr}
    .t{text-align:center;font-size:17pt;font-weight:700;text-decoration:underline;margin:18px 0 22px}
    .amt{border:1px solid #999;padding:10px 14px;margin:14px 0;background:#fafafa}.amt b{font-size:14pt}
    .sig{margin-top:56px}`, body: `
    <p style="direction:ltr;text-align:left;font-size:9pt;color:#555">${printedOn()}</p>
    <div class="t">وصل استلام مبلغ مالي (إبراء ذمة)</div>
    <p>${esc(c.city === 'Blida' ? 'البليدة' : c.city)}، في ${dateAr}</p>
    <p style="margin-top:14px">أنا الموقع(ة) أدناه ${m.supplierId ? 'المؤسسة' : 'السيد(ة)'}: <b>${esc(m.beneficiary)}</b>،<br>أشهد وأقرّ بأنني استلمت من مؤسسة <b>${esc(c.name)}</b> مبلغاً مالياً قدره:</p>
    <div class="amt"><b dir="ltr">${money(m.amount)}</b> (بالأرقام)<br>${amountInWordsAR(m.amount)} (بالحروف)</div>
    ${m.description ? `<p>وذلك مقابل: <b>${esc(m.description)}</b>.</p>` : ''}
    <p>وبهذا أقرّ بصحة استلام هذا المبلغ كاملاً.</p>
    <p style="font-size:10pt;color:#555;margin-top:14px">حرر هذا الوصل لاستعماله عند الحاجة وفي حدود ما يسمح به القانون.</p>
    <div class="sig"><div><b>إمضاء المستلم</b><div class="line">${esc(m.beneficiary)}</div></div><div><b>إمضاء المسؤول عن الصندوق</b><div class="line">${esc(c.name)}</div></div></div>` });
}

function printReport(moves: Rec<PettyCashMove>[], month: string | null, signature: boolean) {
  const all = [...moves].sort(chrono);
  const opening = month ? all.filter((m) => (m.date || '') < month + '-01').reduce((s, m) => s + sign(m), 0) : 0;
  const list = month ? all.filter((m) => (m.date || '').startsWith(month)) : all;
  const totIn = list.filter((m) => m.type === 'in').reduce((s, m) => s + m.amount, 0);
  const totOut = list.filter((m) => m.type === 'out').reduce((s, m) => s + m.amount, 0);
  let run = opening;
  const title = month ? `Rapport de caisse, ${monthLabel(month)}` : 'Rapport global de caisse';
  printDocument({ title, body: `
    <div class="meta"><span>${printedOn()}</span><span>${HOLDER}</span></div>
    <h1>${esc(capitalize(title))}</h1>
    <div class="sums">
      <div>${month ? 'Solde d’ouverture' : 'Mouvements'}<b>${month ? money(opening) : list.length}</b></div>
      <div>Entrées<b class="pos">${money(totIn)}</b></div><div>Retraits<b class="neg">${money(totOut)}</b></div>
      <div>${month ? 'Solde de clôture' : 'Solde actuel'}<b>${money(opening + totIn - totOut)}</b></div>
    </div>
    <table><thead><tr><th>Date</th><th>Type</th><th>Bénéficiaire</th><th>Motif</th><th class="r">Montant</th><th class="r">Solde</th></tr></thead><tbody>
    ${list.map((m) => { run += sign(m); return `<tr><td>${dateShort(m.date)}</td><td>${m.type === 'in' ? 'Entrée' : 'Retrait'}</td><td>${esc(m.type === 'out' ? m.beneficiary : '')}</td><td>${esc(m.description)}</td><td class="r ${m.type === 'in' ? 'pos' : 'neg'}">${m.type === 'in' ? '+' : '−'}${money(m.amount)}</td><td class="r">${money(run)}</td></tr>`; }).join('') || '<tr><td colspan="6" class="c muted">Aucun mouvement sur la période</td></tr>'}
    </tbody></table>
    ${signature ? `<div class="sig"><div></div><div><div class="line">${HOLDER}, responsable de la caisse</div></div></div>` : ''}` });
}

export function PettyCashPage() {
  const moves = useCollection('pettyCash');
  const suppliers = useIndex('suppliers');
  const confirm = useConfirm();
  const [dialog, setDialog] = useState<'in' | 'out' | null>(null);
  const [report, setReport] = useState(false);

  const rows = useMemo(() => {
    let run = 0;
    const bal = new Map<string, number>();
    [...moves].sort(chrono).forEach((m) => { run += sign(m); bal.set(m.id, run); });
    return moves.map((m) => ({ ...m, balance: bal.get(m.id) || 0 }));
  }, [moves]);
  const totIn = moves.filter((m) => m.type === 'in').reduce((s, m) => s + m.amount, 0);
  const totOut = moves.filter((m) => m.type === 'out').reduce((s, m) => s + m.amount, 0);
  const thisMonth = todayISO().slice(0, 7);
  const outMonth = moves.filter((m) => m.type === 'out' && (m.date || '').startsWith(thisMonth)).reduce((s, m) => s + m.amount, 0);

  const remove = async (m: Rec<PettyCashMove>) => {
    if (await confirm({ title: 'Supprimer ce mouvement ?', message: `${m.type === 'in' ? 'Entrée' : 'Retrait'} de ${money(m.amount)} du ${dateShort(m.date)}. Une décharge déjà signée restera valable sur papier.`, danger: true, confirmLabel: 'Supprimer' })) {
      await deleteRecord('pettyCash', m.id); toast.success('Mouvement supprimé');
    }
  };

  const cols: Column<(typeof rows)[number]>[] = [
    { key: 'date', header: 'Date', sort: (r) => r.date, cell: (r) => <span className="num text-ink-2">{dateShort(r.date)}</span>, width: '104px' },
    { key: 'who', header: 'Bénéficiaire ou motif', cell: (r) => (
      <div className="min-w-[160px]">
        <div className="flex items-center gap-2"><span className="truncate">{r.type === 'in' ? (r.description || 'Approvisionnement') : r.beneficiary}</span>{r.supplierId && <Badge tone="info">Fournisseur</Badge>}</div>
        {r.type === 'out' && r.description && <div className="truncate text-xs text-ink-3">{r.description}</div>}
      </div>
    ) },
    { key: 'amount', header: 'Montant', align: 'right', sort: (r) => sign(r), cell: (r) => <Amount value={r.amount} signedDisplay={r.type} className="font-medium" /> },
    { key: 'bal', header: 'Solde après', align: 'right', hideOnMobile: true, cell: (r) => <Amount value={r.balance} className="text-ink-2" /> },
    { key: 'a', header: '', width: '44px', align: 'right', cell: (r) => <RowMenu items={[
      r.type === 'out' && { label: 'Imprimer la décharge', icon: <FileSignature />, onSelect: () => printDecharge(r) },
      { label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => remove(r) },
    ]} /> },
  ];

  return (
    <>
      <PageHeader title={`Caisse ${HOLDER}`} description="Caisse tenue séparément des journaux. Chaque retrait produit une décharge en arabe à faire signer."
        actions={<>
          <Button icon={<Printer className="size-4" />} onClick={() => setReport(true)}>Rapport</Button>
          <Button icon={<Plus className="size-4" />} onClick={() => setDialog('in')}>Entrée</Button>
          <Button variant="primary" icon={<Minus className="size-4" />} onClick={() => setDialog('out')}>Retrait et décharge</Button>
        </>} />
      <div className="panel mb-5 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <Stat label="Solde de la caisse" value={money(totIn - totOut)} tone={totIn - totOut < 0 ? 'neg' : undefined} />
        <Stat label="Retraits ce mois-ci" value={money(outMonth)} />
        <Stat label="Total versé" value={money(totIn)} tone="pos" />
        <Stat label="Total retiré" value={money(totOut)} />
      </div>
      <div className="panel">
        <DataTable rows={rows} columns={cols} initialSort={{ key: 'date', dir: 'desc' }}
          empty={<EmptyState icon={<Wallet className="size-5" />} title="Caisse vide" action={<Button variant="primary" onClick={() => setDialog('in')}>Enregistrer une entrée</Button>}>Commencez par l’approvisionnement de la caisse.</EmptyState>} />
      </div>
      {dialog && <MoveDialog type={dialog} balance={totIn - totOut} onClose={() => setDialog(null)} suppliers={suppliers} />}
      {report && <ReportDialog moves={moves} onClose={() => setReport(false)} />}
    </>
  );
}

function MoveDialog({ type, balance, onClose, suppliers }: { type: 'in' | 'out'; balance: number; onClose: () => void; suppliers: Map<string, any> }) {
  const [mode, setMode] = useState<'person' | 'supplier'>('person');
  const [f, setF] = useState({ amount: 0, date: todayISO(), description: '', lastName: '', firstName: '', supplierId: null as string | null });
  const [printIt, setPrintIt] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const over = type === 'out' && f.amount > balance;
  const save = async () => {
    if (f.amount <= 0) return setErr('Indiquez un montant.');
    let beneficiary = '';
    if (type === 'out') {
      if (mode === 'person') { if (!f.lastName.trim()) return setErr('Indiquez le nom du bénéficiaire.'); beneficiary = `${f.lastName.trim().toUpperCase()} ${f.firstName.trim()}`.trim(); }
      else { if (!f.supplierId) return setErr('Choisissez le fournisseur.'); beneficiary = suppliers.get(f.supplierId)?.name || ''; }
    }
    setBusy(true);
    try {
      const data: PettyCashMove = { type, amount: f.amount, date: f.date, description: f.description.trim(), beneficiary, supplierId: type === 'out' && mode === 'supplier' ? f.supplierId : null };
      const id = await createRecord('pettyCash', data);
      toast.success(type === 'in' ? 'Entrée enregistrée' : 'Retrait enregistré');
      if (type === 'out' && printIt) printDecharge({ ...data, id, _v: 1 });
      onClose();
    } catch { /* */ } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} onSubmit={save} title={type === 'in' ? 'Entrée dans la caisse' : 'Retrait de caisse'}
      description={type === 'out' ? `Solde disponible : ${money(balance)}` : undefined}
      footer={<><Button onClick={onClose}>Annuler</Button><Button type="submit" variant="primary" loading={busy}>{type === 'in' ? 'Enregistrer l’entrée' : printIt ? 'Enregistrer et imprimer la décharge' : 'Enregistrer le retrait'}</Button></>}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {type === 'out' && (
          <Field label="Bénéficiaire" className="sm:col-span-2">
            <Segmented value={mode} onChange={setMode} options={[{ value: 'person', label: 'Une personne' }, { value: 'supplier', label: 'Un fournisseur' }]} />
          </Field>
        )}
        {type === 'out' && mode === 'person' && <>
          <Field label="Nom" required><Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
          <Field label="Prénom"><Input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
        </>}
        {type === 'out' && mode === 'supplier' && <Field label="Fournisseur" required className="sm:col-span-2"><SupplierPicker value={f.supplierId} onChange={(v) => setF({ ...f, supplierId: v })} /></Field>}
        <Field label="Montant" required error={err} hint={over ? 'Ce retrait dépasse le solde de la caisse.' : undefined}><MoneyInput value={f.amount} onChange={(n) => { setF({ ...f, amount: n }); setErr(null); }} /></Field>
        <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label={type === 'in' ? 'Description' : 'Motif'} className="sm:col-span-2"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder={type === 'in' ? 'ex. Approvisionnement de la caisse' : 'ex. Achat de consommables chantier'} /></Field>
        {type === 'out' && <Checkbox className="sm:col-span-2" checked={printIt} onChange={setPrintIt} label="Imprimer la décharge en arabe tout de suite" />}
      </div>
    </Dialog>
  );
}

function ReportDialog({ moves, onClose }: { moves: Rec<PettyCashMove>[]; onClose: () => void }) {
  const months = useMemo(() => [...new Set([todayISO().slice(0, 7), ...moves.map((m) => (m.date || '').slice(0, 7)).filter(Boolean)])].sort().reverse(), [moves]);
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [month, setMonth] = useState(months[0]);
  const [sig, setSig] = useState(true);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} size="sm" title="Imprimer un rapport de caisse"
      footer={<><Button onClick={onClose}>Annuler</Button><Button variant="primary" icon={<Printer className="size-4" />} onClick={() => { printReport(moves, scope === 'month' ? month : null, sig); onClose(); }}>Imprimer</Button></>}>
      <div className="space-y-3.5">
        <Segmented value={scope} onChange={setScope} className="w-full" options={[{ value: 'month', label: 'Un mois' }, { value: 'all', label: 'Depuis le début' }]} />
        {scope === 'month' && <Field label="Mois"><Select value={month} onChange={(e) => setMonth(e.target.value)}>{months.map((m) => <option key={m} value={m}>{capitalize(monthLabel(m))}</option>)}</Select></Field>}
        <Checkbox checked={sig} onChange={setSig} label={`Ajouter une ligne de signature pour ${HOLDER}`} />
      </div>
    </Dialog>
  );
}

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import clsx from '@/lib/cn';
import { Building2, Plus, Trash2, Pencil, CheckCircle2, RotateCcw, Printer } from 'lucide-react';
import { createRecord, deleteRecord, saveChanges, updateRecord } from '@/lib/data';
import { useFinance } from '@/lib/finance';
import { dateShort, money, moneyShort, todayISO, round2 } from '@/lib/format';
import { printDocument, esc, printedOn } from '@/lib/print';
import type { Project, Rec } from '@/lib/types';
import { Amount, Badge, Button, EmptyState, Field, Input, PageHeader, ProgressBar, Segmented, Stat } from '@/components/ui/ui';
import { Dialog, useConfirm } from '@/components/ui/dialog';
import { MoneyInput, RowMenu } from '@/components/ui/pickers';
import { ClientPicker } from '@/components/finance/entities';

type P = ReturnType<typeof useFinance>['projects'][number];

export function ProjectsPage() {
  const f = useFinance();
  const confirm = useConfirm();
  const [status, setStatus] = useState<'active' | 'done' | 'all'>('active');
  const [editing, setEditing] = useState<Rec<Project> | null | 'new'>(null);
  const [entry, setEntry] = useState<{ p: P; kind: 'expense' | 'payment' } | null>(null);
  const list = useMemo(() => f.projects.filter((p) => status === 'all' || p.status === status).sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')), [f.projects, status]);
  const active = f.projects.filter((p) => p.status === 'active');
  const totals = { value: active.reduce((s, p) => s + p.contractValue, 0), received: active.reduce((s, p) => s + p.received, 0), margin: active.reduce((s, p) => s + p.margin, 0) };

  const remove = async (p: P) => {
    if (await confirm({ title: `Supprimer le projet « ${p.name} » ?`, message: 'Les dépenses et paiements saisis directement sur le projet seront supprimés. Les mouvements des journaux restent, sans lien vers ce projet.', danger: true, confirmLabel: 'Supprimer le projet' })) {
      await deleteRecord('projects', p.id); toast.success('Projet supprimé');
    }
  };
  const removeLine = async (p: P, kind: 'manualExpenses' | 'manualPayments', id: string) => {
    if (!(await confirm({ title: 'Supprimer cette ligne ?', danger: true, confirmLabel: 'Supprimer' }))) return;
    await updateRecord('projects', p, { [kind]: (p[kind] as any[]).filter((x) => x.id !== id) } as any);
  };

  const print = (p: P) => {
    const txs = f.transactions.filter((t) => t.projectId === p.id);
    const rows = [
      ...p.manualPayments.map((x) => ({ date: x.date, label: x.reference || 'Paiement', in: x.amount, out: 0 })),
      ...p.manualExpenses.map((x) => ({ date: x.date, label: x.description || 'Dépense', in: 0, out: x.amount })),
      ...txs.map((t) => ({ date: t.date, label: `${t.description || (t.type === 'in' ? 'Entrée' : 'Sortie')} (${t.journal})`, in: t.type === 'in' ? t.amount : 0, out: t.type === 'out' ? t.amount : 0 })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    printDocument({ title: `Projet ${p.name}`, body: `
      <div class="meta"><span>${printedOn()}</span><span>Client : ${esc(f.clientById.get(p.clientId || '')?.name || '—')}</span></div>
      <h1>Projet : ${esc(p.name)}</h1>
      <div class="sums"><div>Valeur du contrat<b>${money(p.contractValue)}</b></div><div>Reçu<b>${money(p.received)}</b></div><div>Dépensé<b>${money(p.spent)}</b></div><div>Marge<b>${money(p.margin)}</b></div></div>
      <table><thead><tr><th>Date</th><th>Libellé</th><th class="r">Recette</th><th class="r">Dépense</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${dateShort(r.date)}</td><td>${esc(r.label)}</td><td class="r pos">${r.in ? money(r.in) : ''}</td><td class="r neg">${r.out ? money(r.out) : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="c muted">Aucune opération</td></tr>'}</tbody></table>` });
  };

  return (
    <>
      <PageHeader title="Projets" description="Valeur du contrat, encaissements et dépenses par projet. Les mouvements de journal liés à un projet sont comptés automatiquement."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Nouveau projet</Button>} />

      <div className="panel mb-5 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <Stat label="Projets actifs" value={active.length} />
        <Stat label="Valeur des contrats actifs" value={money(totals.value)} />
        <Stat label="Déjà encaissé" value={money(totals.received)} tone="pos" />
        <Stat label="Marge prévisionnelle" value={money(totals.margin)} tone={totals.margin < 0 ? 'neg' : undefined} />
      </div>

      <div className="mb-3"><Segmented size="sm" value={status} onChange={setStatus} options={[{ value: 'active', label: 'En cours' }, { value: 'done', label: 'Terminés' }, { value: 'all', label: 'Tous' }]} /></div>

      {list.length === 0 ? (
        <div className="panel"><EmptyState icon={<Building2 className="size-5" />} title={status === 'done' ? 'Aucun projet terminé' : 'Aucun projet en cours'} action={<Button variant="primary" onClick={() => setEditing('new')}>Créer un projet</Button>}>Suivez la rentabilité de chaque chantier : valeur du contrat, encaissements et dépenses.</EmptyState></div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {list.map((p) => {
            const txs = f.transactions.filter((t) => t.projectId === p.id);
            const lines = [
              ...p.manualPayments.map((x) => ({ id: x.id, date: x.date, label: x.reference || 'Paiement reçu', amount: x.amount, type: 'in' as const, kind: 'manualPayments' as const })),
              ...p.manualExpenses.map((x) => ({ id: x.id, date: x.date, label: x.description || 'Dépense', amount: x.amount, type: 'out' as const, kind: 'manualExpenses' as const })),
              ...txs.map((t) => ({ id: t.id, date: t.date, label: t.description || (t.type === 'in' ? 'Entrée' : 'Sortie'), amount: t.amount, type: t.type, kind: null, journal: t.journal })),
            ].sort((a, b) => b.date.localeCompare(a.date));
            const pctIn = p.contractValue > 0 ? p.received / p.contractValue : 0;
            const pctOut = p.contractValue > 0 ? p.spent / p.contractValue : 0;
            return (
              <article key={p.id} className="panel flex flex-col">
                <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold">{p.name}</h3>
                    <p className="text-[12.5px] text-ink-3">{f.clientById.get(p.clientId || '')?.name || 'Sans client'}{p.startDate ? `, depuis le ${dateShort(p.startDate)}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.status === 'done' ? <Badge>Terminé</Badge> : p.margin < 0 ? <Badge tone="neg">Déficitaire</Badge> : p.received > p.spent ? <Badge tone="pos">Rentable</Badge> : <Badge tone="warn">En cours</Badge>}
                    <RowMenu items={[
                      { label: 'Modifier', icon: <Pencil />, onSelect: () => setEditing(p) },
                      { label: 'Imprimer la fiche', icon: <Printer />, onSelect: () => print(p) },
                      { label: p.status === 'active' ? 'Marquer comme terminé' : 'Réactiver', icon: p.status === 'active' ? <CheckCircle2 /> : <RotateCcw />, onSelect: () => updateRecord('projects', p, { status: p.status === 'active' ? 'done' : 'active' }) },
                      { label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => remove(p) },
                    ]} />
                  </div>
                </header>
                <div className="grid grid-cols-2 gap-3 px-4 pt-3.5 sm:grid-cols-4">
                  <Stat label="Contrat" value={moneyShort(p.contractValue)} />
                  <Stat label="Reçu" value={moneyShort(p.received)} tone="pos" sub={`${Math.round(pctIn * 100)} %`} />
                  <Stat label="Dépensé" value={moneyShort(p.spent)} sub={`${Math.round(pctOut * 100)} %`} />
                  <Stat label="Marge" value={moneyShort(p.margin)} tone={p.margin < 0 ? 'neg' : undefined} />
                </div>
                <div className="space-y-1.5 px-4 pt-3">
                  <ProgressBar value={pctIn} tone="pos" />
                  <ProgressBar value={pctOut} tone={pctOut > 1 ? 'neg' : 'copper'} />
                </div>
                <div className="mt-3 flex-1 border-t border-line">
                  {lines.length === 0 ? <p className="px-4 py-4 text-[13px] text-ink-3">Aucune opération. Ajoutez un paiement ou une dépense, ou liez un mouvement de journal à ce projet.</p> : (
                    <ul className="scroll-thin max-h-56 divide-y divide-line overflow-y-auto">
                      {lines.map((l) => (
                        <li key={l.kind + l.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                          <span className="num w-[74px] shrink-0 text-xs text-ink-3">{dateShort(l.date)}</span>
                          <span className="min-w-0 flex-1 truncate">{l.label}{!l.kind && <span className="ml-1.5 text-xs text-ink-3">journal {(l as any).journal}</span>}</span>
                          <Amount value={l.amount} signedDisplay={l.type} className="font-medium" />
                          {l.kind ? <button aria-label="Supprimer" className="rounded p-1 text-ink-3 hover:bg-neg-soft hover:text-neg" onClick={() => removeLine(p, l.kind!, l.id)}><Trash2 className="size-3.5" /></button> : <span className="w-[22px]" />}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <footer className="flex gap-2 border-t border-line px-4 py-2.5">
                  <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setEntry({ p, kind: 'payment' })}>Paiement reçu</Button>
                  <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setEntry({ p, kind: 'expense' })}>Dépense</Button>
                  <span className="ml-auto self-center text-xs text-ink-3">Reste à encaisser <span className="num font-medium text-ink-2">{money(p.toReceive)}</span></span>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {editing && <ProjectDialog record={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {entry && <ProjectEntryDialog p={entry.p} kind={entry.kind} onClose={() => setEntry(null)} />}
    </>
  );
}

function ProjectDialog({ record, onClose }: { record: Rec<Project> | null; onClose: () => void }) {
  const [initial] = useState(() => ({ name: record?.name || '', clientId: record?.clientId || null, contractValue: record?.contractValue || 0, startDate: record?.startDate || todayISO() }));
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!f.name.trim()) return setErr('Donnez un nom au projet.');
    setBusy(true);
    try {
      if (record) await saveChanges('projects', record, initial, { ...f, name: f.name.trim() });
      else await createRecord('projects', { ...f, name: f.name.trim(), status: 'active', manualExpenses: [], manualPayments: [] });
      toast.success(record ? 'Projet modifié' : 'Projet créé');
      onClose();
    } catch { /* */ } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} onSubmit={save} title={record ? 'Modifier le projet' : 'Nouveau projet'}
      footer={<><Button onClick={onClose}>Annuler</Button><Button type="submit" variant="primary" loading={busy}>{record ? 'Enregistrer' : 'Créer le projet'}</Button></>}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Nom du projet" required className="sm:col-span-2" error={err}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="ex. Hangar zone industrielle Blida" /></Field>
        <Field label="Client" className="sm:col-span-2"><ClientPicker value={f.clientId} onChange={(v) => setF({ ...f, clientId: v })} allowClear /></Field>
        <Field label="Valeur du contrat"><MoneyInput value={f.contractValue} onChange={(n) => setF({ ...f, contractValue: n })} /></Field>
        <Field label="Date de début"><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}

function ProjectEntryDialog({ p, kind, onClose }: { p: P; kind: 'expense' | 'payment'; onClose: () => void }) {
  const [amount, setAmount] = useState(0);
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (amount <= 0) return;
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      if (kind === 'expense') await updateRecord('projects', p, { manualExpenses: [...p.manualExpenses, { id, description: label.trim(), amount: round2(amount), date }] });
      else await updateRecord('projects', p, { manualPayments: [...p.manualPayments, { id, reference: label.trim(), amount: round2(amount), date }] });
      toast.success(kind === 'expense' ? 'Dépense ajoutée' : 'Paiement ajouté');
      onClose();
    } catch { /* */ } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} onSubmit={save} size="sm" title={kind === 'expense' ? 'Ajouter une dépense' : 'Ajouter un paiement reçu'}
      description={<>Projet {p.name}. Pour que l’opération apparaisse aussi en caisse ou banque, saisissez-la plutôt dans les journaux en la liant au projet.</>}
      footer={<><Button onClick={onClose}>Annuler</Button><Button type="submit" variant="primary" loading={busy} disabled={amount <= 0}>Ajouter</Button></>}>
      <div className="space-y-3.5">
        <Field label="Montant" required><MoneyInput value={amount} onChange={setAmount} /></Field>
        <Field label={kind === 'expense' ? 'Description' : 'N° de facture ou référence'}><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}

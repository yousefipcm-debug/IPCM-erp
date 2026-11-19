import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { createRecord, updateRecord } from '@/lib/data';
import { allocate, useFinance } from '@/lib/finance';
import { money, todayISO, dateShort } from '@/lib/format';
import type { Journal, Rec, Transaction } from '@/lib/types';
import { Dialog } from '../ui/dialog';
import { Button, Checkbox, Field, Input, Segmented } from '../ui/ui';
import { MoneyInput } from '../ui/pickers';
import { ClientPicker, ProjectPicker, SupplierPicker } from './entities';

export interface TxPreset {
  journal?: Journal; type?: 'in' | 'out'; amount?: number; clientId?: string | null; supplierId?: string | null;
  priorityId?: string; description?: string; date?: string; chequeNo?: string; projectId?: string | null;
}

export function TransactionDialog({ open, onOpenChange, editing, preset, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing?: Rec<Transaction> | null; preset?: TxPreset; onSaved?: () => void;
}) {
  const fin = useFinance();
  const [f, setF] = useState(() => ({
    journal: editing?.journal ?? preset?.journal ?? 'caisse',
    type: editing?.type ?? preset?.type ?? 'out',
    amount: editing?.amount ?? preset?.amount ?? 0,
    date: editing?.date ?? preset?.date ?? todayISO(),
    description: editing?.description ?? preset?.description ?? '',
    clientId: editing?.clientId ?? preset?.clientId ?? null,
    supplierId: editing?.supplierId ?? preset?.supplierId ?? null,
    projectId: editing?.projectId ?? preset?.projectId ?? null,
    chequeNo: editing?.chequeNo ?? preset?.chequeNo ?? '',
    invoiceStatus: editing?.invoiceStatus ?? 'ok' as 'ok' | 'missing',
    autoAllocate: editing ? (editing.allocations?.length ?? 0) > 0 || !(editing.clientId || editing.supplierId) : true,
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const up = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const partyId = f.type === 'in' ? f.clientId : f.supplierId;

  const preview = useMemo(() => {
    if (!partyId || !f.autoAllocate || f.amount <= 0) return null;
    const open = f.type === 'in'
      ? fin.situations.filter((s) => s.clientId === partyId)
      : fin.supplierInvoices.filter((s) => s.supplierId === partyId);
    const kind = f.type === 'in' ? 'situation' as const : 'supplierInvoice' as const;
    const res = allocate(f.amount, open, kind, fin.transactions, editing?.id, preset?.priorityId);
    const byId = new Map<string, any>(open.map((o: any) => [o.id, o]));
    return { ...res, kind, items: res.allocations.map((a) => ({ ...a, doc: byId.get(a.id) })) };
  }, [partyId, f.autoAllocate, f.amount, f.type, fin, editing?.id, preset?.priorityId]);

  const save = async () => {
    if (f.amount <= 0) return setErr('Indiquez un montant supérieur à zéro.');
    if (!f.date) return setErr('Indiquez la date.');
    setBusy(true);
    const data: Transaction = {
      journal: f.journal, type: f.type, amount: f.amount, date: f.date, description: f.description.trim(),
      clientId: f.type === 'in' ? f.clientId : null,
      supplierId: f.type === 'out' ? f.supplierId : null,
      projectId: f.projectId, chequeNo: f.chequeNo.trim(),
      invoiceStatus: f.type === 'out' ? f.invoiceStatus : 'ok',
      allocations: preview?.allocations ?? [],
    };
    try {
      if (editing) await updateRecord('transactions', editing, data);
      else await createRecord('transactions', data);
      toast.success(editing ? 'Mouvement modifié' : 'Mouvement enregistré', {
        description: `${f.type === 'in' ? 'Entrée' : 'Sortie'} de ${money(f.amount)} en ${f.journal === 'banque' ? 'banque' : 'caisse'}`,
      });
      onSaved?.();
      onOpenChange(false);
    } catch { /* toast already shown */ } finally { setBusy(false); }
  };

  const docLabel = (d: any) => d ? (preview?.kind === 'situation' ? (d.number || d.project || 'Situation') : (d.reference || 'Facture')) + ` du ${dateShort(d.date)}` : 'Document';

  return (
    <Dialog open={open} onOpenChange={onOpenChange} onSubmit={save} title={editing ? 'Modifier le mouvement' : 'Nouveau mouvement'}
      footer={<><Button onClick={() => onOpenChange(false)}>Annuler</Button><Button type="submit" variant="primary" loading={busy}>{editing ? 'Enregistrer les modifications' : 'Enregistrer le mouvement'}</Button></>}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Journal">
          <Segmented value={f.journal} onChange={(v) => up({ journal: v })} options={[{ value: 'caisse', label: 'Caisse' }, { value: 'banque', label: 'Banque' }]} />
        </Field>
        <Field label="Sens">
          <Segmented value={f.type} onChange={(v) => up({ type: v })} options={[
            { value: 'in', label: <span className="inline-flex items-center gap-1"><ArrowDownLeft className="size-3.5" />Entrée</span>, tone: 'pos' },
            { value: 'out', label: <span className="inline-flex items-center gap-1"><ArrowUpRight className="size-3.5" />Sortie</span>, tone: 'neg' },
          ]} />
        </Field>
        <Field label="Montant" required error={err}><MoneyInput value={f.amount} onChange={(n) => { up({ amount: n }); setErr(null); }} invalid={!!err} /></Field>
        <Field label="Date" required><Input type="date" value={f.date} onChange={(e) => up({ date: e.target.value })} /></Field>
        <Field label="Libellé" className="sm:col-span-2"><Input value={f.description} onChange={(e) => up({ description: e.target.value })} placeholder={f.type === 'in' ? 'ex. Règlement situation n°3' : 'ex. Achat de tôles'} /></Field>

        {f.type === 'in'
          ? <Field label="Client"><ClientPicker value={f.clientId} onChange={(v) => up({ clientId: v })} allowClear /></Field>
          : <Field label="Fournisseur"><SupplierPicker value={f.supplierId} onChange={(v) => up({ supplierId: v })} allowClear /></Field>}
        <Field label={f.journal === 'banque' ? 'N° de chèque ou virement' : 'Référence'}><Input value={f.chequeNo} onChange={(e) => up({ chequeNo: e.target.value })} className="num" /></Field>
        <Field label="Projet" className="sm:col-span-2" hint="Le montant sera compté dans les recettes ou dépenses du projet."><ProjectPicker value={f.projectId} onChange={(v) => up({ projectId: v })} /></Field>

        {f.type === 'out' && (
          <Field label="Justificatif" className="sm:col-span-2">
            <Segmented value={f.invoiceStatus} onChange={(v) => up({ invoiceStatus: v })} options={[{ value: 'ok', label: 'Facture reçue ou non nécessaire' }, { value: 'missing', label: 'Facture manquante' }]} />
          </Field>
        )}
      </div>

      {partyId && (
        <div className="mt-4 rounded-lg border border-line bg-surface-2/60 p-3">
          <Checkbox checked={f.autoAllocate} onChange={(v) => up({ autoAllocate: v })}
            label={<span className="font-medium">{f.type === 'in' ? 'Régler les situations impayées de ce client' : 'Régler les factures impayées de ce fournisseur'}</span>} />
          {f.autoAllocate && preview && (
            <div className="mt-2.5 space-y-1 text-[13px]">
              {preview.items.length === 0 && <p className="text-ink-3">Aucun document impayé : le montant restera une avance.</p>}
              {preview.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-ink-2">{docLabel(i.doc)}</span>
                  <span className="num font-medium whitespace-nowrap">{money(i.amount)}{i.doc && i.amount >= i.doc.remaining - 0.01 && !(editing && i.doc.isPaid) ? <span className="ml-1.5 text-pos">soldé</span> : null}</span>
                </div>
              ))}
              {preview.unallocated > 0 && preview.items.length > 0 && (
                <div className="flex justify-between border-t border-line pt-1.5 text-warn"><span>Avance non affectée</span><span className="num">{money(preview.unallocated)}</span></div>
              )}
            </div>
          )}
          {f.autoAllocate && !preview && f.amount <= 0 && <p className="mt-2 text-[13px] text-ink-3">Saisissez le montant pour voir la répartition.</p>}
        </div>
      )}
    </Dialog>
  );
}

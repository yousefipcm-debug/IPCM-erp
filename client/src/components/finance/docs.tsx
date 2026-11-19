// Dialogs for client situations and supplier invoices + shared helpers.
import { useState } from 'react';
import { toast } from 'sonner';
import { createRecord, saveChanges, store, stripMeta, updateRecord } from '@/lib/data';
import { round2, todayISO, money, dateShort } from '@/lib/format';
import type { Rec, Situation, SupplierInvoice, Transaction } from '@/lib/types';
import { Dialog } from '../ui/dialog';
import { Button, Field, Input, Segmented } from '../ui/ui';
import { MoneyInput } from '../ui/pickers';
import { ClientPicker, SupplierPicker } from './entities';

export function SituationDialog({ record, onClose, presetClientId }: { record: Rec<Situation> | null; onClose: () => void; presetClientId?: string | null }) {
  const [initial] = useState(() => ({
    clientId: record?.clientId ?? presetClientId ?? null, project: record?.project || '', number: record?.number || '',
    amount: record?.amount || 0, date: record?.date || todayISO(), contractType: record?.contractType || 'formel' as Situation['contractType'],
  }));
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.clientId) e.client = 'Choisissez le client.';
    if (f.amount <= 0) e.amount = 'Indiquez le montant facturé.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (record) await saveChanges('situations', record, initial, f);
      else await createRecord('situations', { ...f, invoiceId: null, manualPayments: [] });
      toast.success(record ? 'Situation modifiée' : 'Situation enregistrée');
      onClose();
    } catch { /* */ } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} onSubmit={save} title={record ? 'Modifier la situation' : 'Nouvelle situation client'}
      description="Une situation est un montant facturé au client, à encaisser."
      footer={<><Button onClick={onClose}>Annuler</Button><Button type="submit" variant="primary" loading={busy}>Enregistrer</Button></>}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Client" required className="sm:col-span-2" error={err.client}><ClientPicker value={f.clientId} onChange={(v) => setF({ ...f, clientId: v })} invalid={!!err.client} /></Field>
        <Field label="Projet ou chantier"><Input value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })} placeholder="ex. Hangar Blida" /></Field>
        <Field label="Numéro"><Input value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} placeholder="ex. Situation n°3" /></Field>
        <Field label="Montant facturé (TTC)" required error={err.amount}><MoneyInput value={f.amount} onChange={(n) => setF({ ...f, amount: n })} invalid={!!err.amount} /></Field>
        <Field label="Date de facturation"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Cadre" className="sm:col-span-2" hint={f.contractType === 'informel' ? 'Sans contrat signé, la créance est difficile à recouvrer en justice : elle sera signalée dans les alertes.' : undefined}>
          <Segmented value={f.contractType} onChange={(v) => setF({ ...f, contractType: v })} options={[{ value: 'formel', label: 'Contrat et facture' }, { value: 'informel', label: 'Sans contrat' }]} />
        </Field>
      </div>
    </Dialog>
  );
}

export function SupplierInvoiceDialog({ record, onClose, presetSupplierId, preset }: { record: Rec<SupplierInvoice> | null; onClose: () => void; presetSupplierId?: string | null; preset?: Partial<SupplierInvoice> }) {
  const [initial] = useState(() => ({
    supplierId: record?.supplierId ?? presetSupplierId ?? preset?.supplierId ?? null, reference: record?.reference ?? preset?.reference ?? '',
    amount: record?.amount ?? preset?.amount ?? 0, date: record?.date ?? preset?.date ?? todayISO(),
  }));
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.supplierId) e.supplier = 'Choisissez le fournisseur.';
    if (f.amount <= 0) e.amount = 'Indiquez le montant dû.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (record) await saveChanges('supplierInvoices', record, initial, f);
      else await createRecord('supplierInvoices', { ...f, manualPayments: [] });
      toast.success(record ? 'Facture modifiée' : 'Facture fournisseur enregistrée');
      onClose();
    } catch { /* */ } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} onSubmit={save} title={record ? 'Modifier la facture fournisseur' : 'Nouvelle facture fournisseur'}
      description="Montant dû à un fournisseur, à régler."
      footer={<><Button onClick={onClose}>Annuler</Button><Button type="submit" variant="primary" loading={busy}>Enregistrer</Button></>}>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Fournisseur" required className="sm:col-span-2" error={err.supplier}><SupplierPicker value={f.supplierId} onChange={(v) => setF({ ...f, supplierId: v })} invalid={!!err.supplier} /></Field>
        <Field label="N° de facture ou référence"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className="num" /></Field>
        <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Montant dû (TTC)" required error={err.amount}><MoneyInput value={f.amount} onChange={(n) => setF({ ...f, amount: n })} invalid={!!err.amount} /></Field>
      </div>
    </Dialog>
  );
}

/** Payment recorded on the document only — it does NOT move caisse or banque. */
export function ManualPaymentDialog({ kind, record, remaining, onClose }: { kind: 'situations' | 'supplierInvoices'; record: Rec<Situation> | Rec<SupplierInvoice>; remaining: number; onClose: () => void }) {
  const [amount, setAmount] = useState(remaining);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (amount <= 0) return;
    setBusy(true);
    try {
      await updateRecord(kind as any, record as any, { manualPayments: [...(record.manualPayments || []), { id: crypto.randomUUID(), amount: round2(Math.min(amount, remaining)), date, note: note.trim() }] } as any);
      toast.success('Règlement enregistré');
      onClose();
    } catch { /* */ } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} onSubmit={save} size="sm" title="Règlement hors caisse et banque"
      description="Pour une compensation, un effet ou un paiement déjà comptabilisé ailleurs. Ce règlement ne modifie pas la trésorerie."
      footer={<><Button onClick={onClose}>Annuler</Button><Button type="submit" variant="primary" loading={busy} disabled={amount <= 0}>Enregistrer le règlement</Button></>}>
      <div className="space-y-3.5">
        <Field label="Montant" hint={`Reste dû : ${money(remaining)}`}><MoneyInput value={amount} onChange={setAmount} /></Field>
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Motif"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. Compensation sur facture n°12" /></Field>
      </div>
    </Dialog>
  );
}

/** Deletes a document and detaches it from any journal transaction that was paying it. */
export async function deleteDocWithAllocations(kind: 'situations' | 'supplierInvoices', id: string, transactions: Rec<Transaction>[]) {
  const type = kind === 'situations' ? 'situation' : 'supplierInvoice';
  const ops: any[] = transactions.filter((t) => t.allocations?.some((a) => a.type === type && a.id === id)).map((t) => ({
    op: 'update', collection: 'transactions', id: t.id, version: t._v,
    data: { ...stripMeta(t), allocations: t.allocations.filter((a) => !(a.type === type && a.id === id)) },
  }));
  ops.push({ op: 'delete', collection: kind, id });
  await store.mutate(ops);
}

export interface PaymentLine { key: string; date: string; amount: number; label: string; source: 'journal' | 'manual'; manualId?: string; txId?: string }
export function paymentsOf(kind: 'situation' | 'supplierInvoice', doc: { id: string; manualPayments: { id: string; amount: number; date: string; note?: string }[] }, transactions: Rec<Transaction>[]): PaymentLine[] {
  const lines: PaymentLine[] = (doc.manualPayments || []).map((p) => ({ key: 'm' + p.id, date: p.date, amount: p.amount, label: p.note || 'Règlement hors trésorerie', source: 'manual', manualId: p.id }));
  for (const t of transactions) for (const a of t.allocations || []) {
    if (a.type === kind && a.id === doc.id) lines.push({ key: 't' + t.id, date: t.date, amount: a.amount, label: `${t.journal === 'banque' ? 'Banque' : 'Caisse'}${t.chequeNo ? `, réf. ${t.chequeNo}` : ''}${t.description ? `, ${t.description}` : ''}`, source: 'journal', txId: t.id });
  }
  return lines.sort((a, b) => a.date.localeCompare(b.date));
}
export const docTitle = (d: { number?: string; reference?: string; project?: string; date: string }) => (d.number || d.reference || d.project || 'Document') + (d.date ? ` du ${dateShort(d.date)}` : '');
